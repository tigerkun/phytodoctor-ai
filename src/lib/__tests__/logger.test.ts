import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, redactFields, errFields, withRequestContext, setRequestUser, currentRequestId } from '../logger';

/**
 * The logger is the one component whose failure mode is invisible: it does not
 * throw, it does not render, it just quietly stops telling you what happened.
 * And it is the one component that sees everything, including the things that
 * must never be written down. So both halves are pinned here -- redaction in
 * every shape a secret arrives in, and the request id reaching lines written
 * deep inside a call stack.
 */

let lines: string[];
let spies: ReturnType<typeof vi.spyOn>[];

/** The last JSON line written, or undefined if nothing was written. */
function lastLine(): Record<string, unknown> | undefined {
  const raw = lines.at(-1);
  return raw === undefined ? undefined : JSON.parse(raw);
}

beforeEach(() => {
  lines = [];
  spies = [
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    }),
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    }),
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    }),
  ];
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
});

describe('every line is a single JSON object', () => {
  it('emits one parseable object carrying the message and the level', () => {
    log.info('market checkout started', { listingId: 'abc' });
    expect(lines).toHaveLength(1);
    expect(lastLine()).toMatchObject({
      level: 'info',
      msg: 'market checkout started',
      listingId: 'abc',
    });
    expect(typeof (lastLine()!.ts as string)).toBe('string');
  });

  it('routes each level to the matching console stream', () => {
    log.warn('slow query');
    log.error('checkout failed');
    expect(spies[0]).not.toHaveBeenCalled();
    expect(spies[1]).toHaveBeenCalledTimes(1);
    expect(spies[2]).toHaveBeenCalledTimes(1);
  });
});

describe('redaction', () => {
  it('replaces secret-bearing keys whatever they are named', () => {
    const out = redactFields({
      password: 'hunter2',
      access_token: 'abc.def.ghi',
      SUPABASE_SERVICE_KEY: 'sb_secret_xxx',
      authorization: 'Bearer nope',
      apiKey: 'k',
      cookie: 'session=1',
      listingId: 'keep-me',
    });
    expect(out.password).toBe('[redacted]');
    expect(out.access_token).toBe('[redacted]');
    expect(out.SUPABASE_SERVICE_KEY).toBe('[redacted]');
    expect(out.authorization).toBe('[redacted]');
    expect(out.apiKey).toBe('[redacted]');
    expect(out.cookie).toBe('[redacted]');
    expect(out.listingId).toBe('keep-me');
  });

  it('keeps an email\'s domain but not the person', () => {
    expect(redactFields({ email: 'someone@example.com' }).email).toBe('[redacted]@example.com');
    // A value with no "@" is not an email, so there is no domain to keep.
    expect(redactFields({ email: 'not-an-address' }).email).toBe('[redacted]');
  });

  it('drops secrets carried on the error object, not just on its message', () => {
    // Supabase attaches the offending request to the error, and the request
    // carries the key. Logging the whole error must not leak it.
    const error = Object.assign(new Error('insert failed'), {
      status: 400,
      api_key: 'sb_secret_xxx',
      session_id: 'sess_1',
      table: 'market_listings',
    });
    const line = { ...redactFields(errFields(error)) };
    const serialised = JSON.stringify(line);
    expect(serialised).not.toContain('sb_secret_xxx');
    expect(serialised).not.toContain('sess_1');
    expect(serialised).toContain('insert failed');
    // The non-secret context is the reason to log the error at all.
    expect(serialised).toContain('market_listings');
  });

  it('truncates a runaway value instead of dumping a whole model response', () => {
    const line = JSON.stringify(redactFields({ preview: 'x'.repeat(900) }));
    expect(line.length).toBeLessThan(700);
  });

  it('never emits a raw undefined field', () => {
    expect('missing' in redactFields({ missing: undefined, kept: 1 })).toBe(false);
  });
});

describe('request scope', () => {
  it('tags a line with the id of the request in flight', () => {
    withRequestContext({ requestId: 'req-abc' }, () => {
      log.info('inside');
    });
    expect(lastLine()!.requestId).toBe('req-abc');
  });

  it('reaches a line written several frames down with no request passed to it', () => {
    const deep = () => log.error('failed at the bottom');
    const middle = () => deep();
    withRequestContext({ requestId: 'req-deep' }, () => {
      middle();
    });
    expect(lastLine()).toMatchObject({ requestId: 'req-deep', msg: 'failed at the bottom' });
  });

  it('attributes later lines to the user resolved mid-request', () => {
    withRequestContext({ requestId: 'req-user' }, () => {
      log.info('before auth');
      setRequestUser('910ba357-e667-4e7c-bd8a-0cfe56c2407a');
      log.info('after auth');
    });
    expect(JSON.parse(lines[0]).userId).toBeUndefined();
    expect(JSON.parse(lines[1]).userId).toBe('910ba357-e667-4e7c-bd8a-0cfe56c2407a');
  });

  it('does not bleed the id onto an unrelated request', () => {
    withRequestContext({ requestId: 'req-one' }, () => log.info('first'));
    log.info('outside any request');
    expect(JSON.parse(lines[0]).requestId).toBe('req-one');
    expect(JSON.parse(lines[1]).requestId).toBeUndefined();
  });

  it('reports no current id outside a request', () => {
    expect(currentRequestId()).toBeUndefined();
  });

  it('survives the async gap the auth check introduces', () => {
    // apiGate resolves the user in a promise callback; a context that did not
    // cross the await would leave every post-auth line unattributed.
    return withRequestContext({ requestId: 'req-async' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      setRequestUser('1645084f-4437-40e9-b4f6-0fbeea50fc62');
      log.warn('after the await');
      expect(lastLine()).toMatchObject({
        requestId: 'req-async',
        userId: '1645084f-4437-40e9-b4f6-0fbeea50fc62',
      });
    });
  });
});