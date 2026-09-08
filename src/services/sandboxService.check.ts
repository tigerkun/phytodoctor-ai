import assert from 'node:assert';
import {
  simulateBiome,
  ASSESSMENTS_PER_DAY,
  profileSpecies,
  assessPlacement,
  type SiteEnvironment
} from './sandboxService';

async function runCheck() {
  console.log('Running sandboxService assert-based self-check...');

  // 1. Biome simulation
  const summerDate = new Date('2026-07-15T12:00:00Z');
  const tropicalOutdoor = simulateBiome('tropical', summerDate, false);
  assert.strictEqual(tropicalOutdoor.mode, 'simulate');
  assert.strictEqual(tropicalOutdoor.rainfallMm, 9);
  assert(tropicalOutdoor.temp > 20, 'Tropical temp should be warm');
  assert.strictEqual(tropicalOutdoor.uvIndex, 8);

  // Indoor chamber buffering
  const tropicalIndoor = simulateBiome('tropical', summerDate, true);
  assert.strictEqual(tropicalIndoor.indoor, true);
  assert.strictEqual(tropicalIndoor.rainfallMm, 0, 'Indoor rainfall must be 0');
  assert.strictEqual(tropicalIndoor.windSpeed, 1, 'Indoor wind must be 1');
  assert.strictEqual(tropicalIndoor.photoperiodHours, 11, 'Indoor photoperiod should be buffered to 11');
  assert(tropicalIndoor.uvIndex <= 2, 'Indoor UV index must be strictly attenuated');

  // 2. Fallback profile generation
  const profile = await profileSpecies('Monstera deliciosa');
  assert(profile.commonName.length > 0, 'commonName must not be empty');
  assert(profile.idealTempMin < profile.idealTempMax, 'idealTempMin must be less than idealTempMax');
  assert(profile.idealHumidityMin < profile.idealHumidityMax, 'humidity range must be ordered');
  assert(profile.photoperiodHours > 0, 'photoperiod must be positive');
  assert(profile.soil.length > 0, 'soil description must exist');
  assert(profile.soilPh.length > 0, 'soilPh must exist');

  // 3. Placement assessment
  const testSite: SiteEnvironment = {
    label: 'Kew Royal Conservatory',
    mode: 'simulate',
    indoor: true,
    datetime: new Date().toISOString(),
    temp: 24,
    humidity: 75,
    windSpeed: 2,
    rainfallMm: 0,
    uvIndex: 2,
    photoperiodHours: 12,
    soilType: 'loamy',
    soilPh: 6.2,
    weather: 'Buffered indoor chamber'
  };

  const report = await assessPlacement('Monstera deliciosa', testSite);
  assert(report.survivalChance >= 0 && report.survivalChance <= 100, 'survivalChance must be 0-100');
  assert(typeof report.verdict === 'string' && report.verdict.length > 0, 'verdict must exist');
  assert(report.climateScore >= 0 && report.climateScore <= 100, 'climateScore must be 0-100');
  assert(report.waterScore >= 0 && report.waterScore <= 100, 'waterScore must be 0-100');
  assert(report.lightScore >= 0 && report.lightScore <= 100, 'lightScore must be 0-100');
  assert(Array.isArray(report.tips) && report.tips.length > 0, 'tips must not be empty');
  assert(Array.isArray(report.risks) && report.risks.length > 0, 'risks must not be empty');
  assert(typeof report.protocol === 'string' && report.protocol.length > 0, 'protocol must not be empty');

  // 4. Quota constant verification
  assert.strictEqual(ASSESSMENTS_PER_DAY, 2, 'Daily quota must equal 2');

  console.log('✓ All sandboxService checks passed successfully.');
}

runCheck().catch((err) => {
  console.error('✗ sandboxService check failed:', err);
  process.exit(1);
});
