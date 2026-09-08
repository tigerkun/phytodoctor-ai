import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

// supabase is null when env vars are not set -- Auth.tsx falls back to local-only mode
export const supabase = (url && key) ? createClient(url, key) : null;
export const supabaseConfigured = Boolean(url && key);
