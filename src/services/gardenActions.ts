import { db } from '../db/database';
import { PlantService } from './plantService';
import { wateringDue } from './notificationService';

export interface WaterAllResult {
  watered: number;
  failed: number;
  total: number;
  failedNames: string[];
}

/**
 * Water every non-demo plant whose watering is due — the loop behind the
 * Quick Actions FAB and the assistant's action chips. Per-plant try/catch:
 * one cloud-less plant (created offline, PLANT_NOT_ON_SERVER) must not eat
 * the rest of the garden's watering. Callers own the feedback copy; this
 * module owns the loop and the one definition of "thirsty".
 */
export async function waterAllDue(now: Date = new Date()): Promise<WaterAllResult> {
  const due = (await db.plants.toArray()).filter(p => !p.isDemo && wateringDue(p, now));
  let watered = 0;
  const failedNames: string[] = [];
  for (const plant of due) {
    try {
      await PlantService.waterPlant(plant.id, now);
      watered++;
    } catch (err) {
      failedNames.push(plant.name || plant.id);
      console.error('[garden-actions] watering failed:', plant.id, err);
    }
  }
  return { watered, failed: failedNames.length, total: due.length, failedNames };
}
