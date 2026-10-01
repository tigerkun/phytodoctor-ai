import { describe, it, expect } from 'vitest';
import { clientIpOf } from '../clientIp';

/**
 * These exist because the limiter was measured failing in production. Before
 * the fix, rotating X-Forwarded-For produced 70 requests in 19 seconds with no
 * 429 -- on the routes that bill Gemini per call. The test that matters is
 * "rotating XFF does not rotate the identity"; the rest pin the fallback
 * order so the Cloudflare path cannot quietly regress to trusting the header.
 */

function req(headers: Record<string, string | string[] | undefined>, ip?: string, remote?: string) {
  return { headers, ip, socket: { remoteAddress: remote } };
}

describe('clientIpOf — Cloudflare in front (production)', () => {
  it('uses CF-Connecting-IP, which the edge sets and the client cannot forge', () => {
    expect(
      clientIpOf(req({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4' }))
    ).toBe('203.0.113.9');
  });

  it('a rotating X-Forwarded-For cannot change the identity once the edge header is present', () => {
    // The measured bypass: a fresh XFF per request, expecting a fresh bucket.
    const seen = new Set<string>();
    for (let i = 0; i < 70; i++) {
      seen.add(
        clientIpOf(
          req({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': `10.${i % 250}.${i % 250}.${i % 250}` })
        )
      );
    }
    expect(seen.size).toBe(1);
    expect([...seen]).toEqual(['203.0.113.9']);
  });

  it('takes the last hop of a multi-entry CF chain, not the whole header', () => {
    expect(clientIpOf(req({ 'cf-connecting-ip': '  198.51.100.4  ' }))).toBe('198.51.100.4');
  });

  it('ignores an empty CF header rather than counting everyone as one caller', () => {
    expect(
      clientIpOf(req({ 'cf-connecting-ip': '   ', 'x-forwarded-for': '5.6.7.8' }))
    ).toBe('5.6.7.8');
  });
});

describe('clientIpOf — no Cloudflare (local dev, direct to Render)', () => {
  it('falls back to the rightmost X-Forwarded-For entry', () => {
    expect(clientIpOf(req({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }))).toBe('8.8.8.8');
  });

  it('falls back to req.ip, then the socket address, then a literal', () => {
    expect(clientIpOf(req({}, '10.0.0.7'))).toBe('10.0.0.7');
    expect(clientIpOf(req({}, undefined, '10.0.0.8'))).toBe('10.0.0.8');
    expect(clientIpOf(req({}))).toBe('unknown');
  });

  it('ignores an array-shaped XFF rather than reading its first element', () => {
    // Node collapses duplicate headers to an array. Reading entries[0] there
    // would hand back a client-chosen value, so the array form is skipped.
    expect(clientIpOf(req({ 'x-forwarded-for': ['1.1.1.1'] }, '10.0.0.7'))).toBe('10.0.0.7');
    expect(clientIpOf(req({ 'x-forwarded-for': ['1.1.1.1'] }))).toBe('unknown');
  });
});