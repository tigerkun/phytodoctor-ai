import { createClient } from '@supabase/supabase-js';

/**
 * Builds a PostgREST client scoped to one caller's access token, so RLS
 * decides what the request can read and write.
 *
 * The access token belongs in the Authorization header, NOT in createClient's
 * second argument. That argument becomes the `apikey` header, and the Supabase
 * gateway validates `apikey` against known keys before PostgREST ever runs — so
 * passing a user JWT there is refused with a bare "Invalid API key". The
 * message points at a service credential, which is how this was misdiagnosed
 * and sent chasing the service key while the real cause sat here.
 *
 * Verified against the live gateway:
 *   apikey=<publishable>, Authorization=Bearer <jwt>  -> reaches PostgREST
 *   apikey=<jwt>                                       -> "Invalid API key"
 *
 * supabase-js only sets Authorization when absent (see lib/fetch.ts in
 * @supabase/supabase-js), so declaring it here survives and apikey is filled
 * from the publishable key.
 */
export function createUserScopedClient(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
) {
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    // This client lives for one request's RLS scope. Letting it persist or
    // auto-refresh a session would write tokens to storage and race the gate.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
