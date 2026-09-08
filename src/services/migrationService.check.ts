import assert from 'node:assert';
import { safeToIso, formatPlantForPostgres } from './migrationService';
import type { Plant } from '../types';

export function runMigrationChecks() {
  console.log('--- Running MigrationService Unit Checks ---');

  // 1. safeToIso checks
  const fixedDate = new Date('2026-05-15T12:00:00Z');
  assert.strictEqual(safeToIso(fixedDate), '2026-05-15T12:00:00.000Z');
  assert.strictEqual(safeToIso('2026-05-15T12:00:00Z'), '2026-05-15T12:00:00.000Z');
  assert.doesNotThrow(() => safeToIso(null));
  assert.doesNotThrow(() => safeToIso(undefined));

  // 2. formatPlantForPostgres transformation check
  const mockPlant: Plant = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Monstera Deliciosa',
    species: 'Monstera deliciosa',
    acquiredAt: fixedDate,
    soilType: 'loamy',
    soilPh: 6.5,
    potSize: '12 inch',
    potMaterial: 'terracotta',
    location: 'Conservatory East Wing',
    latitude: 51.478,
    longitude: -0.295,
    hardinessZone: '10b',
    checkInTime: '09:00',
    baselineSignature: {
      hsvHistogram: [0.1, 0.2],
      leafContours: 12,
      meanRgb: [45, 120, 50],
      textureEnergy: 0.85,
      computedAt: fixedDate
    },
    guardianScore: 88,
    status: 'Stable',
    photoUrl: 'https://example.com/monstera.jpg',
    createdAt: fixedDate,
    updatedAt: fixedDate,
    isDemo: false
  };

  const userId = 'user-uuid-9999';
  const pgPayload = formatPlantForPostgres(mockPlant, userId);

  assert.strictEqual(pgPayload.id, mockPlant.id);
  assert.strictEqual(pgPayload.user_id, userId);
  assert.strictEqual(pgPayload.name, 'Monstera Deliciosa');
  assert.strictEqual(pgPayload.species, 'Monstera deliciosa');
  assert.strictEqual(pgPayload.acquired_at, '2026-05-15T12:00:00.000Z');
  assert.strictEqual(pgPayload.soil_type, 'loamy');
  assert.strictEqual(pgPayload.soil_ph, 6.5);
  assert.strictEqual(pgPayload.pot_size, '12 inch');
  assert.strictEqual(pgPayload.pot_material, 'terracotta');
  assert.strictEqual(pgPayload.location, 'Conservatory East Wing');
  assert.strictEqual(pgPayload.latitude, 51.478);
  assert.strictEqual(pgPayload.longitude, -0.295);
  assert.strictEqual(pgPayload.hardiness_zone, '10b');
  assert.strictEqual(pgPayload.guardian_score, 88);
  assert.strictEqual(pgPayload.status, 'Stable');
  assert.strictEqual(pgPayload.is_demo, false);
  assert.strictEqual(pgPayload.created_at, '2026-05-15T12:00:00.000Z');
  assert.strictEqual(pgPayload.updated_at, '2026-05-15T12:00:00.000Z');

  console.log('All MigrationService checks passed successfully!');
  return { success: true };
}

if (process.argv[1]?.includes('migrationService.check')) {
  runMigrationChecks();
}
