import { describe, it, expect } from 'vitest';
import {
  detectDiseasePatterns,
  detectGrowthStage,
  assessPropagationReadiness,
  interpretImaggaTags,
  type ImaggaTag,
} from '../imaggaClient';

const tag = (name: string, confidence: number): ImaggaTag => ({ name, confidence });

describe('detectDiseasePatterns', () => {
  it('the scan found the interpreter it means to check', () => {
    expect(detectDiseasePatterns([tag('plant', 90)]).diseases).toEqual([]);
  });

  it('maps symptom tags to keeper language', () => {
    const r = detectDiseasePatterns([tag('yellowing', 72), tag('leaf', 90)]);
    expect(r.diseases).toHaveLength(1);
    expect(r.diseases[0].disease).toContain('yellowing');
    // One strong hit is already a medium: it is a clear, confident signal.
    expect(r.severity).toBe('medium');
  });

  it('escalates severity only on multiple strong independent patterns', () => {
    const oneStrong = detectDiseasePatterns([tag('yellowing', 85)]);
    expect(oneStrong.severity).toBe('medium');
    const twoStrong = detectDiseasePatterns([tag('yellowing', 85), tag('mold', 70)]);
    expect(twoStrong.severity).toBe('high');
  });

  it('a confident tag below the evidence threshold does not count', () => {
    const r = detectDiseasePatterns([tag('yellowing', 20)]);
    expect(r.diseases).toEqual([]);
    expect(r.severity).toBe('low');
  });
});

describe('detectGrowthStage', () => {
  it('flowering outranks the foliage stages a flowering plant also tags', () => {
    const r = detectGrowthStage([tag('flowering', 70), tag('seedling', 50), tag('lush', 60)]);
    expect(r.stage).toBe('flowering');
  });

  it('never invents a stage from silence', () => {
    expect(detectGrowthStage([tag('leaf', 90)])).toEqual({ stage: null, confidence: 0 });
  });
});

describe('assessPropagationReadiness', () => {
  it('picks the highest-confidence method and reports readiness', () => {
    const r = assessPropagationReadiness([tag('pup', 65), tag('node', 45)]);
    expect(r.ready).toBe(true);
    expect(r.method).toBe('offset');
    expect(r.confidence).toBe(65);
  });

  it('is not ready when nothing propagation-shaped appears', () => {
    expect(assessPropagationReadiness([tag('leaf', 90)])).toEqual({ ready: false, method: 'none', confidence: 0 });
  });
});

describe('interpretImaggaTags', () => {
  it('bundles all three reads from one tag set', () => {
    const r = interpretImaggaTags([tag('yellowing', 75), tag('pup', 60), tag('flowering', 80)]);
    expect(r.diseases.diseases.length).toBe(1);
    expect(r.growthStage.stage).toBe('flowering');
    expect(r.propagation.method).toBe('offset');
  });
});
