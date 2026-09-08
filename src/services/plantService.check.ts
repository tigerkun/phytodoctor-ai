import assert from 'node:assert';
import { postgresToPlant, plantToPostgres } from './plantService';
import type { Plant } from '../types';

export function runPlantServiceChecks() {
  console.log('--- Running PlantService Transformation Checks ---');

  // 1. Postgres snake_case to React Plant camelCase
  const rawPgRow = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: 'user-777',
    name: 'Royal Orchid',
    species: 'Orchis mascula',
    acquired_at: '2026-03-01T10:30:00.000Z',
    soil_type: 'peaty',
    soil_ph: 6.2,
    pot_size: '8 inch',
    pot_material: 'ceramic',
    location: 'Conservatory Solarium',
    latitude: 51.5,
    longitude: -0.12,
    hardiness_zone: '9a',
    check_in_time: '14:00',
    baseline_signature: { leafEnergy: 0.9 },
    guardian_score: 94,
    status: 'Stable',
    photo_url: 'https://example.com/orchid.jpg',
    created_at: '2026-03-01T10:30:00.000Z',
    updated_at: '2026-03-02T12:00:00.000Z',
    is_demo: false,
  };

  const plant = postgresToPlant(rawPgRow);

  assert.strictEqual(plant.id, rawPgRow.id);
  assert.strictEqual(plant.userId, rawPgRow.user_id);
  assert.strictEqual(plant.name, 'Royal Orchid');
  assert.strictEqual(plant.species, 'Orchis mascula');
  assert(plant.acquiredAt instanceof Date, 'acquiredAt must be converted to Date');
  assert.strictEqual(plant.acquiredAt.toISOString(), '2026-03-01T10:30:00.000Z');
  assert.strictEqual(plant.soilType, 'peaty');
  assert.strictEqual(plant.soilPh, 6.2);
  assert.strictEqual(plant.potSize, '8 inch');
  assert.strictEqual(plant.potMaterial, 'ceramic');
  assert.strictEqual(plant.guardianScore, 94);
  assert.strictEqual(plant.status, 'Stable');
  assert(plant.createdAt instanceof Date, 'createdAt must be converted to Date');
  assert(plant.updatedAt instanceof Date, 'updatedAt must be converted to Date');

  // 2. React Plant camelCase to Postgres snake_case
  const pgPayload = plantToPostgres(plant, 'user-777');

  assert.strictEqual(pgPayload.id, plant.id);
  assert.strictEqual(pgPayload.user_id, 'user-777');
  assert.strictEqual(pgPayload.name, 'Royal Orchid');
  assert.strictEqual(pgPayload.species, 'Orchis mascula');
  assert.strictEqual(pgPayload.acquired_at, '2026-03-01T10:30:00.000Z');
  assert.strictEqual(pgPayload.soil_type, 'peaty');
  assert.strictEqual(pgPayload.soil_ph, 6.2);
  assert.strictEqual(pgPayload.guardian_score, 94);
  assert.strictEqual(pgPayload.is_demo, false);

  console.log('All PlantService transformation checks passed successfully!');
  return { success: true };
}

if (process.argv[1]?.includes('plantService.check')) {
  runPlantServiceChecks();
}
