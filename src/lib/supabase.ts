import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

// Normalize URL: strip trailing /rest/v1 or trailing slashes if present
const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : undefined;

// supabase is null when env vars are not set -- Auth.tsx falls back to local-only mode
export const supabase = (url && key) ? createClient(url, key) : null;
export const supabaseConfigured = Boolean(url && key);
