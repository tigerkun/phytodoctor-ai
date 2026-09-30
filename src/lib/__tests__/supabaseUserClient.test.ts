import { describe, it, expect, afterEach } from 'vitest';
import { createUserScopedClient } from '../supabaseUserClient';

const URL = 'https://project.supabase.co';
const PUBLISHABLE = 'sb_publishable_test_key';
const USER_TOKEN = 'user.access.token.jwt';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

/**
 * Captures the headers supabase-js actually puts on the wire.
 *
 * This is the whole point of the module: the failure mode it exists to prevent
 * is invisible in the source, because `createClient(url, jwt)` reads like it
 * authenticates the caller. It doesn't — the second argument becomes apikey,
 * and the gateway rejects it with "Invalid API key" before PostgREST runs.
 * Only the outgoing request shows the difference.
 */
async function captureHeaders(token: string, publishableKey = PUBLISHABLE) {
  let seen: Headers | null = null;
  globalThis.fetch = (async (_input: any, init: any) => {
    seen = new Headers(init?.headers);
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const client = createUserScopedClient(URL, publishableKey, token);
  await client.from('profiles').select('seeds').limit(1);

  if (!seen) throw new Error('no request was made');
  return seen as unknown as Headers;
}

describe('createUserScopedClient header contract', () => {
  it('sends the publishable key as apikey, never the user token', async () => {
    const headers = await captureHeaders(USER_TOKEN);
    expect(headers.get('apikey')).toBe(PUBLISHABLE);
    expect(headers.get('apikey')).not.toBe(USER_TOKEN);
  });

  it('sends the caller token as the Authorization bearer', async () => {
    const headers = await captureHeaders(USER_TOKEN);
    expect(headers.get('Authorization')).toBe(`Bearer ${USER_TOKEN}`);
  });

  it('confines the user token to the Authorization header alone', async () => {
    const headers = await captureHeaders(USER_TOKEN);
    const carrying = [...headers.entries()]
      .filter(([, value]) => value.includes(USER_TOKEN))
      .map(([name]) => name.toLowerCase());
    // A token echoed into apikey is exactly the bug; one that turns up
    // anywhere else is a leak waiting to be cached by an intermediary.
    expect(carrying).toEqual(['authorization']);
  });

  it('does not let the SDK overwrite the declared Authorization', async () => {
    // The regression itself: supabase-js defaults Authorization to the apikey
    // when the header is absent, so a client built without an explicit
    // Authorization sends `Bearer <publishable key>` and silently loses the
    // caller's identity — every row then reads as RLS-denied rather than
    // erroring, which is harder to notice than a hard failure.
    const headers = await captureHeaders(USER_TOKEN);
    expect(headers.get('Authorization')).not.toBe(`Bearer ${PUBLISHABLE}`);
  });
});
