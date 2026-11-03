import { describe, it, expect } from 'vitest';
import { classifyScanError, supportQuery } from '../scanRecovery';

describe('classifyScanError', () => {
  it('the scan found the classifier it means to check', () => {
    expect(classifyScanError(new Error('anything')).kind).toBeDefined();
  });

  it('maps transport failures from geminiService to their buckets', () => {
    expect(classifyScanError(new Error('The scan took too long and was cancelled. Check your connection and try again.')).kind).toBe('timeout');
    expect(classifyScanError(new Error('Could not reach the analysis service. Check your connection and try again.')).kind).toBe('offline');
  });

  it('rates a 429 as rate-limited, before the generic server bucket', () => {
    const r = classifyScanError(new Error('Server error (429)'));
    expect(r.kind).toBe('rate-limited');
    expect(r.advice).toContain('Wait 60 seconds');
  });

  it('buckets 5xx as the server having a bad day', () => {
    expect(classifyScanError(new Error('Server error (502)')).kind).toBe('server');
    expect(classifyScanError(new Error('Account limits are temporarily unavailable. Please try again.')).kind).toBe('server');
  });

  it('maps unreadable photos to the invalid-image bucket', () => {
    expect(classifyScanError(new Error('image decode failed')).kind).toBe('invalid-image');
    expect(classifyScanError(new Error('Unable to read selected leaf specimen file. Please select another.')).kind).toBe('invalid-image');
  });

  it('never invents copy for an unknown error — the real message is the title', () => {
    const real = 'Supabase returned a transient 548 while saving the specimen.';
    const r = classifyScanError(new Error(real));
    expect(r.kind).toBe('unknown');
    expect(r.title).toBe(real);
  });
});

describe('supportQuery', () => {
  it('carries the kind and a trimmed message', () => {
    const q = supportQuery('timeout', 'The scan took too long.');
    expect(q).toContain('(timeout)');
    expect(q).toContain('The scan took too long.');
  });

  it('truncates long messages to keep the handoff readable', () => {
    const q = supportQuery('server', 'x'.repeat(400));
    // The 400-character failure must not pass through whole.
    expect(q).not.toContain('x'.repeat(200));
    expect(q.length).toBeLessThan(240);
    expect(q.endsWith('…". Can you help me get it working?')).toBe(true);
  });
});
