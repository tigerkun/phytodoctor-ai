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
    isDemo: Boolean(row.is_demo),
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

  if (plant.isDemo !== undefined) payload.is_demo = Boolean(plant.isDemo);

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
          const mapped = data.map(postgresToPlant);
          // Sync Dexie in background for offline queries
          try {
            await db.plants.bulkPut(mapped);
          } catch {}
          return mapped;
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
      isDemo: Boolean(input.isDemo),
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
      const { error } = await supabase
        .from('plants')
        .update(pgPayload)
        .eq('id', id);

      if (error) {
        console.error('[PlantService] Supabase update error:', error);
        throw error;
      }
    }

    try {
      await db.plants.update(id, payloadUpdates);
    } catch {}

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

    try {
      await db.plants.delete(id);
      await db.cards.where('plantId').equals(id).delete();
      await db.checkins.where('plantId').equals(id).delete();
    } catch {}

    const all = await this.fetchPlants();
    notifySubscribers(all);
  },
};
