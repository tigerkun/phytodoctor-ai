import { supabase } from '../lib/supabase';
import { db } from '../db/database';
import type { Plant } from '../types';

export interface PostgresPlant {
  id: string;
  user_id: string;
  name: string;
  species: string;
  acquired_at: string;
  soil_type: string | null;
  soil_ph: number | null;
  pot_size: string | null;
  pot_material: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  hardiness_zone: string | null;
  check_in_time: string | null;
  baseline_signature: any | null;
  guardian_score: number;
  status: string;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

/**
 * Safely converts Date, string, or timestamp into an ISO-8601 string.
 */
export function safeToIso(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Maps a local Dexie Plant record into a snake_case, Postgres-compatible payload.
 */
export function formatPlantForPostgres(plant: Plant, userId: string): PostgresPlant {
  return {
    id: plant.id,
    user_id: userId,
    name: plant.name,
    species: plant.species,
    acquired_at: safeToIso(plant.acquiredAt),
    soil_type: plant.soilType ?? null,
    soil_ph: typeof plant.soilPh === 'number' ? plant.soilPh : null,
    pot_size: plant.potSize ?? null,
    pot_material: plant.potMaterial ?? null,
    location: plant.location ?? null,
    latitude: typeof plant.latitude === 'number' ? plant.latitude : null,
    longitude: typeof plant.longitude === 'number' ? plant.longitude : null,
    hardiness_zone: plant.hardinessZone ?? null,
    check_in_time: plant.checkInTime ?? null,
    baseline_signature: plant.baselineSignature ?? null,
    guardian_score: typeof plant.guardianScore === 'number' ? plant.guardianScore : 0,
    status: plant.status || 'Stable',
    photo_url: plant.photoUrl ?? null,
    created_at: safeToIso(plant.createdAt),
    updated_at: safeToIso(plant.updatedAt),
    is_demo: Boolean(plant.isDemo)
  };
}

export const MigrationService = {
  /**
   * Reads all plants from the local Dexie table, transforms keys and dates,
   * and upserts them into the Supabase Postgres 'plants' table for the current user.
   */
  async migratePlantsToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      if (!supabase) {
        throw new Error('Supabase client is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      }

      // 1. Get the current logged-in user
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user?.id) {
        throw new Error('You must be signed in to sync your botanical records to the cloud.');
      }

      const userId = session.user.id;

      // 2. Fetch all local records from Dexie
      const localPlants = await db.plants.toArray();
      if (localPlants.length === 0) {
        return { success: true, count: 0 };
      }

      // 3. Format records for Postgres RLS insertion
      const cloudReadyPlants = localPlants.map(p => formatPlantForPostgres(p, userId));

      // 4. Batch upsert into Supabase (overwrites existing by ID without duplicate-key errors)
      const { error: insertError } = await supabase
        .from('plants')
        .upsert(cloudReadyPlants, { onConflict: 'id' });

      if (insertError) {
        throw insertError;
      }

      return { success: true, count: cloudReadyPlants.length };
    } catch (err: any) {
      const message = err?.message || 'Unknown migration error occurred';
      console.error('[MigrationService] Failed to migrate plants:', message);
      return { success: false, count: 0, error: message };
    }
  }
};
