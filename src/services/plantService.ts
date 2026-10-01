import { supabase } from '../lib/supabase';
import { db } from '../db/database';
import { GameService } from './gameService';
import type { Plant, SoilType, PotMaterial } from '../types';

/**
 * Maps a snake_case Supabase Postgres record into the camelCase Plant model
 * with parsed Date objects used by the React application.
 */
export function postgresToPlant(row: any): Plant {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || 'Unnamed Specimen',
    species: row.species || 'Unknown species',
    acquiredAt: row.acquired_at ? new Date(row.acquired_at) : new Date(),
    soilType: (row.soil_type as SoilType) ?? 'well-draining',
    soilPh: typeof row.soil_ph === 'number' ? row.soil_ph : null,
    potSize: row.pot_size || '',
    potMaterial: (row.pot_material as PotMaterial) || 'plastic',
    location: row.location || '',
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    hardinessZone: row.hardiness_zone ?? null,
    checkInTime: row.check_in_time || '08:00',
    baselineSignature: row.baseline_signature ?? null,
    guardianScore: typeof row.guardian_score === 'number' ? row.guardian_score : 50,
    status: row.status || 'Stable',
    photoUrl: row.photo_url || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    wateringIntervalDays: typeof row.watering_interval_days === 'number' ? row.watering_interval_days : 7,
    lastWateredAt: row.last_watered_at ? new Date(row.last_watered_at) : null,
    nextWaterDue: row.next_water_due ? new Date(row.next_water_due) : null,
    coldToleranceC: typeof row.cold_tolerance_c === 'number' ? row.cold_tolerance_c : null,
    heatToleranceC: typeof row.heat_tolerance_c === 'number' ? row.heat_tolerance_c : null,
    isDemo: Boolean(row.is_demo),
    parentPlantId: row.parent_plant_id ?? null,
    propagationMethod: row.propagation_method ?? null,
    generation: typeof row.generation === 'number' ? row.generation : 1,
  };
}

/**
 * Maps a camelCase partial Plant model to a snake_case Postgres payload
 * converting Dates into ISO-8601 strings.
 */
export function plantToPostgres(plant: Partial<Plant>, userId?: string): Record<string, any> {
  const payload: Record<string, any> = {};

  if (plant.id !== undefined) payload.id = plant.id;
  if (userId) payload.user_id = userId;
  else if (plant.userId) payload.user_id = plant.userId;

  if (plant.name !== undefined) payload.name = plant.name;
  if (plant.species !== undefined) payload.species = plant.species;

  if (plant.acquiredAt !== undefined) {
    payload.acquired_at = plant.acquiredAt instanceof Date
      ? plant.acquiredAt.toISOString()
      : new Date(plant.acquiredAt as any).toISOString();
  }

  if (plant.soilType !== undefined) payload.soil_type = plant.soilType;
  if (plant.soilPh !== undefined) payload.soil_ph = plant.soilPh;
  if (plant.potSize !== undefined) payload.pot_size = plant.potSize;
  if (plant.potMaterial !== undefined) payload.pot_material = plant.potMaterial;
  if (plant.location !== undefined) payload.location = plant.location;
  if (plant.latitude !== undefined) payload.latitude = plant.latitude;
  if (plant.longitude !== undefined) payload.longitude = plant.longitude;
  if (plant.hardinessZone !== undefined) payload.hardiness_zone = plant.hardinessZone;
  if (plant.checkInTime !== undefined) payload.check_in_time = plant.checkInTime;
  if (plant.baselineSignature !== undefined) payload.baseline_signature = plant.baselineSignature;
  if (plant.guardianScore !== undefined) payload.guardian_score = plant.guardianScore;
  if (plant.status !== undefined) payload.status = plant.status;
  if (plant.photoUrl !== undefined) payload.photo_url = plant.photoUrl;

  if (plant.createdAt !== undefined) {
    payload.created_at = plant.createdAt instanceof Date
      ? plant.createdAt.toISOString()
      : new Date(plant.createdAt as any).toISOString();
  }

  if (plant.updatedAt !== undefined) {
    payload.updated_at = plant.updatedAt instanceof Date
      ? plant.updatedAt.toISOString()
      : new Date(plant.updatedAt as any).toISOString();
  }

  if (plant.wateringIntervalDays !== undefined) {
    payload.watering_interval_days = plant.wateringIntervalDays;
  }
  if (plant.lastWateredAt !== undefined) {
    payload.last_watered_at = plant.lastWateredAt instanceof Date
      ? plant.lastWateredAt.toISOString()
      : plant.lastWateredAt
        ? new Date(plant.lastWateredAt as any).toISOString()
        : null;
  }
  if (plant.nextWaterDue !== undefined) {
    payload.next_water_due = plant.nextWaterDue instanceof Date
      ? plant.nextWaterDue.toISOString()
      : plant.nextWaterDue
        ? new Date(plant.nextWaterDue as any).toISOString()
        : null;
  }
  if (plant.coldToleranceC !== undefined) payload.cold_tolerance_c = plant.coldToleranceC;
  if (plant.heatToleranceC !== undefined) payload.heat_tolerance_c = plant.heatToleranceC;

  if (plant.isDemo !== undefined) payload.is_demo = Boolean(plant.isDemo);
  if (plant.parentPlantId !== undefined) payload.parent_plant_id = plant.parentPlantId;
  if (plant.propagationMethod !== undefined) payload.propagation_method = plant.propagationMethod;
  if (plant.generation !== undefined) payload.generation = plant.generation;

  return payload;
}

type PlantChangeListener = (plants: Plant[]) => void;
const listeners = new Set<PlantChangeListener>();

export function onPlantsChange(listener: PlantChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySubscribers(plants: Plant[]) {
  listeners.forEach((fn) => {
    try {
      fn(plants);
    } catch (e) {
      console.error('[PlantService] subscriber error:', e);
    }
  });
}

/**
 * The values postgresToPlant substitutes when Postgres has nothing to say.
 *
 * Merging the mapped rows straight back over Dexie means these stand-ins win
 * over whatever the device actually has, and the next fetchPlants() (after
 * every add/update/delete, plus each mount of the lab page) erases it. The
 * visible case is a photo stored locally as a `data:` or `local://` URL
 * because its cloud upload failed: the server has no photo_url, so the merge
 * writes '' and the plant renders blank with the original unrecoverable.
 */
const SERVER_DEFAULTS = {
  name: 'Unnamed Specimen',
  species: 'Unknown species',
  soilType: 'well-draining',
  potSize: '',
  potMaterial: 'plastic',
  location: '',
  checkInTime: '08:00',
  status: 'Stable',
  photoUrl: '',
  guardianScore: 50,
  wateringIntervalDays: 7,
} as const satisfies Partial<Record<keyof Plant, unknown>>;

/**
 * Lets a real local value win wherever the server contributed only a stand-in.
 * Anything the server genuinely holds still overwrites, so an intentional
 * rename or re-pot on another device propagates as before.
 */
function preserveLocalFields(mapped: Plant, local: Plant | undefined): Plant {
  if (!local) return mapped;
  const merged = { ...mapped } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(SERVER_DEFAULTS)) {
    if (merged[key] === fallback && local[key as keyof Plant] !== undefined && local[key as keyof Plant] !== fallback) {
      merged[key] = local[key as keyof Plant];
    }
  }
  return merged as unknown as Plant;
}

export const PlantService = {
  /**
   * Fetches all plants ordered by creation date descending.
   * Primary: Supabase Postgres with RLS.
   * Fallback: Dexie IndexedDB.
   */
  async fetchPlants(): Promise<Plant[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const serverRows = data.map(postgresToPlant);
          // Keep local-only values that Postgres has no column for, then mirror
          // the merged set back. bulkPut on the mapped rows alone is a full
          // overwrite, which is how a locally-stored photo survived as a blank
          // image on the very next fetch.
          let merged = serverRows;
          try {
            const local = await db.plants.bulkGet(serverRows.map((p) => p.id));
            merged = serverRows.map((p, i) => preserveLocalFields(p, local[i]));
          } catch {}
          try {
            await db.plants.bulkPut(merged);
          } catch {}
          return merged;
        }
      } catch (err) {
        console.error('[PlantService] Error fetching from Supabase:', err);
      }
    }

    const fallbackUserId = GameService.getUserId();
    return await db.plants.where('userId').equals(fallbackUserId).toArray();
  },

  /**
   * Fetches a single plant by its unique UUID.
   */
  async getPlant(id: string): Promise<Plant | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return postgresToPlant(data);
        }
      } catch (err) {
        console.error('[PlantService] Error fetching plant by id from Supabase:', err);
      }
    }

    const local = await db.plants.get(id);
    return local || null;
  },

  /**
   * Inserts a new plant row.
   * Automatically resolves current user session to satisfy Supabase RLS.
   */
  async addPlant(input: Partial<Plant>): Promise<Plant> {
    const id = input.id || crypto.randomUUID();
    const now = new Date();

    let resolvedUserId = input.userId;
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        resolvedUserId = session.user.id;
      }
    }
    if (!resolvedUserId) {
      resolvedUserId = GameService.getUserId();
    }

    let generation = input.generation ?? 1;
    if (input.parentPlantId) {
      const parent = await this.getPlant(input.parentPlantId);
      if (!parent || parent.userId !== resolvedUserId) throw new Error('Parent specimen not found.');
      generation = (parent.generation || 1) + 1;
    }
    const newPlant: Plant = {
      id,
      userId: resolvedUserId,
      name: input.name?.trim() || 'New Specimen',
      species: input.species?.trim() || 'Botanical Specimen',
      acquiredAt: input.acquiredAt instanceof Date ? input.acquiredAt : now,
      soilType: input.soilType ?? 'well-draining',
      soilPh: typeof input.soilPh === 'number' ? input.soilPh : null,
      potSize: input.potSize || '10 inch',
      potMaterial: input.potMaterial || 'terracotta',
      location: input.location || 'Conservatory',
      latitude: typeof input.latitude === 'number' ? input.latitude : null,
      longitude: typeof input.longitude === 'number' ? input.longitude : null,
      hardinessZone: input.hardinessZone ?? null,
      checkInTime: input.checkInTime || '08:00',
      baselineSignature: input.baselineSignature ?? null,
      guardianScore: typeof input.guardianScore === 'number' ? input.guardianScore : 85,
      status: input.status || 'Stable',
      photoUrl: input.photoUrl || '',
      createdAt: now,
      updatedAt: now,
      // Seed the schedule up front. A plant with a NULL next_water_due is
      // invisible to the server's watering-reminder scheduler, so a fresh
      // specimen would never trigger a reminder until someone manually
      // watered it through the bench tools.
      wateringIntervalDays: input.wateringIntervalDays ?? 7,
      lastWateredAt: input.lastWateredAt ?? null,
      nextWaterDue: input.nextWaterDue ?? new Date(now.getTime() + (input.wateringIntervalDays ?? 7) * 86_400_000),
      isDemo: Boolean(input.isDemo),
      parentPlantId: input.parentPlantId ?? null,
      propagationMethod: input.propagationMethod ?? null,
      generation,
    };

    if (supabase) {
      const pgPayload = plantToPostgres(newPlant, resolvedUserId);
      const { data, error } = await supabase
        .from('plants')
        .insert(pgPayload)
        .select()
        .single();

      if (error) {
        console.error('[PlantService] Supabase insert error:', error);
        throw error;
      }

      if (data) {
        const created = postgresToPlant(data);
        try {
          await db.plants.put(created);
        } catch {}
        const all = await this.fetchPlants();
        notifySubscribers(all);
        return created;
      }
    }

    // Offline / fallback path
    await db.plants.put(newPlant);
    const all = await this.fetchPlants();
    notifySubscribers(all);
    return newPlant;
  },

  /**
   * Updates an existing plant in Supabase Postgres and mirrors locally.
   */
  async updatePlant(id: string, updates: Partial<Plant>): Promise<void> {
    const now = new Date();
    const payloadUpdates = { ...updates, updatedAt: now };

    if (supabase) {
      const pgPayload = plantToPostgres(payloadUpdates);
      // `.select()` is load-bearing. A bare `.update().eq()` reports success
      // when ZERO rows matched — only returning the rows reveals the miss. The
      // silent case was a plant that never reached Postgres (created while
      // signed out, or before migratePlantsToCloud ran): the remote write hit
      // nothing, the local write went through, and the fetchPlants() below then
      // returned the server list without that plant and broadcast it to every
      // subscriber — the plant disappeared from the whole app, with no error.
      const { data, error } = await supabase
        .from('plants')
        .update(pgPayload)
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('[PlantService] Supabase update error:', error);
        throw error;
      }
      if (!data || data.length === 0) {
        const err = new Error('This specimen is not on your cloud account yet.');
        (err as any).code = 'PLANT_NOT_ON_SERVER';
        throw err;
      }
    }

    // update() resolves to the number of rows changed, so 0 means the local
    // mirror missed too. Swallowing that hid real write failures.
    try {
      const changed = await db.plants.update(id, payloadUpdates);
      if (changed === 0) console.warn('[PlantService] no local row for plant', id);
    } catch (e) {
      console.error('[PlantService] local plant update failed:', e);
    }

    const all = await this.fetchPlants();
    notifySubscribers(all);
  },

  /**
   * Deletes a plant by ID in Supabase Postgres and mirrors locally.
   */
  async deletePlant(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('plants')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[PlantService] Supabase delete error:', error);
        throw error;
      }
    }

    // Each table is cleared independently. A single try/catch around the whole
    // cascade meant a mid-way failure (storage quota is the realistic one)
    // skipped every later delete and left partial rows behind. These are all
    // plant-scoped operational data, so a failure is logged and the rest still
    // run rather than silently orphaning four more tables.
    //
    // db.cards is NOT cleared here on purpose: it is the Keeper's earned
    // collection (level, XP, growth stage, battle scars, rarity, isFeatured) and
    // is local-only, never synced and never rebuilt. Cascading into it destroys
    // progression that was earned, so whether a plant delete should take the
    // card with it is a product decision, not a cascade detail.
    const cascade: Array<[string, () => Promise<unknown>]> = [
      ['checkins', () => db.checkins.where('plantId').equals(id).delete()],
      ['predictions', () => db.predictions.where('plantId').equals(id).delete()],
      ['sensorReadings', () => db.sensorReadings.where('plantId').equals(id).delete()],
      ['alerts', () => db.alerts.where('plantId').equals(id).delete()],
      ['notes', () => db.notes.where('plantId').equals(id).delete()],
    ];
    try {
      await db.plants.delete(id);
    } catch (e) {
      console.error('[PlantService] local plant delete failed:', e);
    }
    for (const [table, run] of cascade) {
      try {
        await run();
      } catch (e) {
        console.error(`[PlantService] failed to clear ${table} for plant ${id}:`, e);
      }
    }

    const all = await this.fetchPlants();
    notifySubscribers(all);
  },
};
