import { db, type TreatmentActionRecord } from '../db/database';
import { GameService } from './gameService';

// In-memory fallback if IndexedDB is unavailable in a test runner or headless environment
const memoryActionStore = new Map<string, TreatmentActionRecord>();

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export interface AdherenceMetrics {
  completedCount: number;
  totalCount: number;
  adherencePct: number;
  stageLabel: string;
  badgeColor: string;
  vitalityDelta: number;
  isFullyCompleted: boolean;
}

export interface ToggleTreatmentResult {
  record: TreatmentActionRecord;
  isCompleted: boolean;
  newlyAwarded: boolean;
  seedsAwarded: number;
  vitalityBoost: number;
  updatedScore?: number;
  updatedStatus?: string;
}

export class TreatmentService {
  /**
   * Clears the in-memory test store.
   */
  static clearMemoryStore(): void {
    memoryActionStore.clear();
  }

  /**
   * Generates a stable, canonical target key for a treatment action.
   * If a plantId is known, scopes to that plant; else if scanId is known,
   * scopes to that scan; otherwise scopes to the specimen species.
   */
  static buildTargetKey(params: {
    plantId?: string | null;
    scanId?: string | null;
    species?: string | null;
    diagnosis?: string | null;
    phaseIndex: number;
    phaseDay: string;
    action: string;
  }): string {
    const scope = params.plantId
      ? `plant:${params.plantId}`
      : params.scanId
        ? `scan:${params.scanId}`
        : `specimen:${slug(params.species || 'botanical')}`;
    const daySlug = slug(params.phaseDay || `phase-${params.phaseIndex + 1}`);
    const actionSlug = slug(params.action || 'action').slice(0, 64);
    return `${scope}:p${params.phaseIndex}:${daySlug}:${actionSlug}`;
  }

  /**
   * Returns human-readable relative time string for completion stamps.
   */
  static formatRelativeTime(isoOrDate: string | Date | null | undefined): string {
    if (!isoOrDate) return '';
    const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    const time = date.getTime();
    if (Number.isNaN(time)) return '';

    const diffMs = Date.now() - time;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Applied just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Applied ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Applied ${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Applied yesterday';
    if (diffDays < 7) return `Applied ${diffDays}d ago`;

    return `Applied ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  /**
   * Computes clinical recovery adherence metrics from completed step count.
   */
  static calculateAdherence(completedCount: number, totalCount: number): AdherenceMetrics {
    const total = Math.max(0, totalCount);
    const completed = Math.min(total, Math.max(0, completedCount));
    const adherencePct = total === 0 ? 0 : Math.round((completed / total) * 100);

    let stageLabel = 'Stage 0 · Regimen Pending';
    let badgeColor = 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30';

    if (adherencePct === 100) {
      stageLabel = 'Stage 3 · Regimen Complete · Recovery Optimal';
      badgeColor = 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40';
    } else if (adherencePct >= 50) {
      stageLabel = 'Stage 2 · High Clinical Adherence';
      badgeColor = 'bg-moss/20 text-moss-deep dark:text-moss border-moss/40';
    } else if (adherencePct > 0) {
      stageLabel = 'Stage 1 · Active Rehabilitation';
      badgeColor = 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40';
    }

    const vitalityDelta = Math.round((adherencePct / 100) * 12);

    return {
      completedCount: completed,
      totalCount: total,
      adherencePct,
      stageLabel,
      badgeColor,
      vitalityDelta,
      isFullyCompleted: total > 0 && completed === total,
    };
  }

  /**
   * Fetches all treatment action records for a given plantId or targetKey prefix.
   */
  static async getCompletedActions(plantIdOrScope?: string | null): Promise<TreatmentActionRecord[]> {
    if (!plantIdOrScope) return [];
    if (isIndexedDBAvailable()) {
      try {
        if (db.treatmentActions) {
          let rows: TreatmentActionRecord[] = [];
          if (
            plantIdOrScope.startsWith('plant:') ||
            plantIdOrScope.startsWith('specimen:') ||
            plantIdOrScope.startsWith('scan:')
          ) {
            rows = await db.treatmentActions
              .filter(r => r.targetKey.startsWith(plantIdOrScope) && Boolean(r.completedAt))
              .toArray();
          } else {
            // Direct plantId
            rows = await db.treatmentActions
              .where('plantId')
              .equals(plantIdOrScope)
              .filter(r => Boolean(r.completedAt))
              .toArray();
            if (rows.length === 0) {
              rows = await db.treatmentActions
                .filter(r => r.targetKey.includes(plantIdOrScope) && Boolean(r.completedAt))
                .toArray();
            }
          }
          return rows;
        }
      } catch {
        // Fall through to memory
      }
    }

    return Array.from(memoryActionStore.values()).filter(r => {
      const matchesScope =
        r.plantId === plantIdOrScope ||
        r.targetKey.startsWith(plantIdOrScope) ||
        r.targetKey.includes(plantIdOrScope);
      return matchesScope && Boolean(r.completedAt);
    });
  }

  /**
   * Retrieves a single treatment action record by targetKey.
   */
  static async getActionByKey(targetKey: string): Promise<TreatmentActionRecord | null> {
    if (isIndexedDBAvailable()) {
      try {
        if (db.treatmentActions) {
          const found = await db.treatmentActions.where('targetKey').equals(targetKey).first();
          if (found) return found;
        }
      } catch {
        // Fall through to memory
      }
    }
    return memoryActionStore.get(targetKey) || null;
  }

  /**
   * Migrates existing checkoff actions scoped to a scanId over to the newly indexed plantId.
   */
  static async associateScanWithPlant(scanId?: string | null, plantId?: string | null): Promise<void> {
    if (!scanId || !plantId) return;
    const scanPrefix = `scan:${scanId}:`;
    if (isIndexedDBAvailable()) {
      try {
        if (db.treatmentActions) {
          const scanActions = await db.treatmentActions
            .filter(r => r.targetKey.startsWith(scanPrefix))
            .toArray();
          for (const action of scanActions) {
            const newTargetKey = action.targetKey.replace(scanPrefix, `plant:${plantId}:`);
            await db.treatmentActions.put({
              ...action,
              plantId,
              targetKey: newTargetKey,
            });
          }
        }
      } catch {}
    }

    // Mirror in memory store
    for (const [key, action] of Array.from(memoryActionStore.entries())) {
      if (key.startsWith(scanPrefix)) {
        const newKey = key.replace(scanPrefix, `plant:${plantId}:`);
        memoryActionStore.set(newKey, {
          ...action,
          plantId,
          targetKey: newKey,
        });
      }
    }
  }

  /**
   * Toggles completion status of a treatment action with persistence,
   * non-duplicate seed economy reward, and plant vitality nudging.
   */
  static async toggleTreatmentAction(params: {
    plantId?: string | null;
    scanId?: string | null;
    species?: string | null;
    diagnosis?: string | null;
    phaseIndex: number;
    phaseDay: string;
    action: string;
    expectedOutcome?: string;
    notes?: string;
    userId?: string;
    timeline?: Array<{ day: string; action: string; expectedOutcome?: string }>;
  }): Promise<ToggleTreatmentResult> {
    const targetKey = this.buildTargetKey({
      plantId: params.plantId,
      scanId: params.scanId,
      species: params.species,
      diagnosis: params.diagnosis,
      phaseIndex: params.phaseIndex,
      phaseDay: params.phaseDay,
      action: params.action,
    });

    const existing = await this.getActionByKey(targetKey);
    const wasCompleted = Boolean(existing?.completedAt);

    if (wasCompleted && existing) {
      // Un-marking as done: keep vitalityBonusAwarded true so re-checking does not re-award seeds
      const updated: TreatmentActionRecord = {
        ...existing,
        completedAt: '',
      };

      if (isIndexedDBAvailable()) {
        try {
          if (db.treatmentActions) {
            await db.treatmentActions.put(updated);
          }
        } catch {}
      }
      memoryActionStore.set(targetKey, updated);

      return {
        record: updated,
        isCompleted: false,
        newlyAwarded: false,
        seedsAwarded: 0,
        vitalityBoost: 0,
      };
    }

    // Marking as completed
    const alreadyAwarded = Boolean(existing?.vitalityBonusAwarded);
    const seedsToAward = alreadyAwarded ? 0 : 15;
    const vitalityBoost = alreadyAwarded ? 0 : 4;
    const nowIso = new Date().toISOString();
    let userId = params.userId;
    if (!userId) {
      try {
        userId = typeof localStorage !== 'undefined' ? GameService.getUserId() : 'local-user';
      } catch {
        userId = 'local-user';
      }
    }

    let updatedScore: number | undefined;
    let updatedStatus: string | undefined;

    // 1. Economy award if not previously claimed for this milestone
    if (seedsToAward > 0 && isIndexedDBAvailable()) {
      try {
        await GameService.earnSeeds(
          seedsToAward,
          'reward',
          `Completed recovery action: ${params.action.slice(0, 48)}`,
          userId
        );
      } catch (err) {
        console.warn('[TreatmentService] Could not award seeds:', err);
      }
    }

    // 2. Plant Vitality Boost and Check-In / Note Log
    if (params.plantId && isIndexedDBAvailable()) {
      try {
        const plant = await db.plants.get(params.plantId);
        if (plant) {
          const currentScore = plant.guardianScore ?? 70;
          updatedScore = Math.min(100, currentScore + vitalityBoost);

          // Nudge status towards 'Recovering' or 'Stable' if it was compromised
          if (plant.status === 'Alert' || plant.status === 'Watching') {
            updatedStatus = 'Recovering';
          } else {
            updatedStatus = plant.status;
          }

          const plantUpdates: Record<string, any> = {
            guardianScore: updatedScore,
            status: updatedStatus,
            updatedAt: new Date(),
          };

          if (!plant.recoveryRoadmap && params.timeline && params.timeline.length > 0) {
            plantUpdates.recoveryRoadmap = {
              diagnosis: params.diagnosis || `Rehabilitation Regimen for ${plant.name}`,
              timeline: params.timeline,
            };
          }

          await db.plants.update(params.plantId, plantUpdates);

          // Add clinical adherence entry to plant field notes
          await db.notes.add({
            id: crypto.randomUUID(),
            userId,
            plantId: params.plantId,
            category: 'action',
            content: `Clinical Treatment Applied [${params.phaseDay}]: ${params.action}${params.expectedOutcome ? ` → Expected: ${params.expectedOutcome}` : ''}`,
            tags: ['treatment', 'recovery', 'milestone'],
            createdAt: new Date(),
          });
        }
      } catch (err) {
        console.warn('[TreatmentService] Could not update plant vitality:', err);
      }
    }

    const record: TreatmentActionRecord = {
      id: existing?.id || crypto.randomUUID(),
      plantId: params.plantId || undefined,
      targetKey,
      phaseIndex: params.phaseIndex,
      phaseDay: params.phaseDay,
      action: params.action,
      expectedOutcome: params.expectedOutcome,
      completedAt: nowIso,
      notes: params.notes ?? existing?.notes,
      vitalityBonusAwarded: true,
      seedsAwarded: (existing?.seedsAwarded || 0) + seedsToAward,
    };

    if (isIndexedDBAvailable()) {
      try {
        if (db.treatmentActions) {
          await db.treatmentActions.put(record);
        }
      } catch {}
    }
    memoryActionStore.set(targetKey, record);

    return {
      record,
      isCompleted: true,
      newlyAwarded: seedsToAward > 0,
      seedsAwarded: seedsToAward,
      vitalityBoost,
      updatedScore,
      updatedStatus,
    };
  }

  /**
   * Attaches or updates a field observation note on a treatment milestone.
   */
  static async saveActionNote(targetKey: string, notes: string): Promise<void> {
    const existing = await this.getActionByKey(targetKey);
    if (!existing) return;
    const updated: TreatmentActionRecord = {
      ...existing,
      notes,
    };
    if (isIndexedDBAvailable()) {
      try {
        if (db.treatmentActions) {
          await db.treatmentActions.put(updated);
        }
      } catch {}
    }
    memoryActionStore.set(targetKey, updated);
  }
}
