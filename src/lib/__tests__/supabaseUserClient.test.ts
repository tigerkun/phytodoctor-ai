import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { createUserScopedClient } from '../supabaseUserClient';

const URL = 'https://project.supabase.co';
const PUBLISHABLE = 'sb_publishable_test_key';
const USER_TOKEN = 'user.access.token.jwt';

const realFetch = globalThis.fetch;
const realWebSocket = (globalThis as any).WebSocket;

/**
 * `createClient` builds a Realtime client, and that resolves a WebSocket
 * constructor during construction and throws when the runtime has none. Node
 * only gained a global WebSocket in 22, so this test fails outright on Node 20
 * with "Node.js detected but native WebSocket not found" — a runtime mismatch
 * that says nothing about the header contract it exists to pin.
 *
 * Production runs node:22-alpine and this test never opens a socket: only the
 * PostgREST request matters. A no-op constructor satisfies the lookup on
 * runtimes that lack one, and the real one is left alone where it exists, so
 * the test stops depending on which Node version happens to run it.
 */
class NoopWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  binaryType = 'blob';
  bufferedAmount = 0;
  extensions = '';
  protocol = '';
  onopen: any = null;
  onclose: any = null;
  onerror: any = null;
  onmessage: any = null;
  constructor(_url: string, _protocols?: string | string[]) {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

beforeAll(() => {
  if (typeof (globalThis as any).WebSocket === 'undefined') {
    (globalThis as any).WebSocket = NoopWebSocket;
  }
});

afterAll(() => {
  (globalThis as any).WebSocket = realWebSocket;
});

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
