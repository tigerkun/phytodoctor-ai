import { describe, expect, it } from 'vitest';
import {
  deriveToleranceProfile,
  simulateMicroclimate,
  type PlantToleranceProfile,
} from '../environmentalSimulation';

describe('environmentalSimulation', () => {
  it('derives tropical profiles accurately', () => {
    const profile = deriveToleranceProfile('Monstera deliciosa');
    expect(profile.idealTempMinC).toBe(18);
    expect(profile.idealTempMaxC).toBe(28);
    expect(profile.idealHumidityMinPct).toBe(60);
    expect(profile.idealLight).toBe('Indirect');
  });

  it('derives arid profiles accurately', () => {
    const profile = deriveToleranceProfile('Sansevieria trifasciata');
    expect(profile.idealTempMinC).toBe(14);
    expect(profile.idealTempMaxC).toBe(32);
    expect(profile.idealHumidityMinPct).toBe(25);
    expect(profile.idealLight).toBe('Direct');
  });

  it('respects temperature overrides from scan vitals', () => {
    const profile = deriveToleranceProfile('Ficus lyrata', { temperatureC: 22 });
    expect(profile.idealTempMinC).toBe(18);
    expect(profile.idealTempMaxC).toBe(27);
  });

  it('scores ideal microclimates with optimal viability (>= 80)', () => {
    const profile: PlantToleranceProfile = {
      speciesName: 'Monstera deliciosa',
      idealTempMinC: 18,
      idealTempMaxC: 28,
      idealHumidityMinPct: 60,
      idealHumidityMaxPct: 80,
      idealLight: 'Indirect',
    };
    const sim = simulateMicroclimate(
      { temperatureC: 23, humidityPct: 70, lightLevel: 'Indirect' },
      profile
    );
    expect(sim.score).toBeGreaterThanOrEqual(80);
    expect(sim.thermalStrain).toBe(0);
    expect(sim.humidityStress).toBe(0);
    expect(sim.lightMismatch).toBe(0);
    expect(sim.viability).toBe('Optimal');
    expect(sim.alerts.length).toBe(0);
  });

  it('detects severe thermal strain and chilling stress when below minimum', () => {
    const profile: PlantToleranceProfile = {
      speciesName: 'Tropical Palm',
      idealTempMinC: 18,
      idealTempMaxC: 28,
      idealHumidityMinPct: 50,
      idealHumidityMaxPct: 80,
      idealLight: 'Indirect',
    };
    const sim = simulateMicroclimate(
      { temperatureC: 5, humidityPct: 60, lightLevel: 'Indirect' },
      profile
    );
    expect(sim.thermalStrain).toBeGreaterThan(80);
    expect(sim.score).toBeLessThan(65);
    expect(sim.alerts.some(a => a.includes('Chilling stress'))).toBe(true);
  });

  it('detects excessive transpiration strain when humidity is depleted', () => {
    const profile: PlantToleranceProfile = {
      speciesName: 'Fern',
      idealTempMinC: 18,
      idealTempMaxC: 26,
      idealHumidityMinPct: 65,
      idealHumidityMaxPct: 90,
      idealLight: 'Indirect',
    };
    const sim = simulateMicroclimate(
      { temperatureC: 22, humidityPct: 20, lightLevel: 'Indirect' },
      profile
    );
    expect(sim.humidityStress).toBeGreaterThan(50);
    expect(sim.alerts.some(a => a.includes('Vapor Pressure Deficit'))).toBe(true);
  });

  it('handles extreme and NaN inputs safely without crashing', () => {
    const profile = deriveToleranceProfile('Unknown');
    const sim = simulateMicroclimate(
      { temperatureC: NaN, humidityPct: 150, lightLevel: 'Low' },
      profile
    );
    expect(sim.score).toBeGreaterThanOrEqual(10);
    expect(sim.score).toBeLessThanOrEqual(99);
    expect(['Optimal', 'Favorable', 'Stressed', 'Critical']).toContain(sim.viability);
  });

  it('prevents temperature range inversion on zero or low temperature inputs', () => {
    const zeroProfile = deriveToleranceProfile('Succulent', { temperatureC: 0 });
    expect(zeroProfile.idealTempMinC).toBeLessThanOrEqual(zeroProfile.idealTempMaxC);
    expect(zeroProfile.idealTempMaxC - zeroProfile.idealTempMinC).toBeGreaterThanOrEqual(5);

    const highProfile = deriveToleranceProfile('Succulent', { temperatureC: 50 });
    expect(highProfile.idealTempMinC).toBeLessThanOrEqual(highProfile.idealTempMaxC);
  });

  it('normalizes non-canonical light level strings without NaN or index errors', () => {
    const profile = deriveToleranceProfile('Fern');
    const sim = simulateMicroclimate(
      { temperatureC: 22, humidityPct: 60, lightLevel: 'Direct Sun' as any },
      profile
    );
    expect(sim.lightMismatch).toBeGreaterThan(0);
    expect(Number.isFinite(sim.score)).toBe(true);
  });

  it('emits thermal deficit alerts when ambient temperature drops below species minimum', () => {
    const profile = deriveToleranceProfile('Monstera'); // min is 18C
    const sim = simulateMicroclimate(
      { temperatureC: 14, humidityPct: 65, lightLevel: 'Indirect' },
      profile
    );
    expect(sim.alerts.some(a => a.includes('Thermal deficit'))).toBe(true);
  });
});
