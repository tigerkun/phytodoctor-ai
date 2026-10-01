import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Single source of truth for "is someone signed in", live across the session.
 *
 * Two auth modes exist: Supabase sessions (the deployed app) and the local
 * token mode (self-hosted/no-Supabase builds). Both reduce to a boolean here
 * so route guards and feature gates -- like the guest scan lane -- never
 * disagree about who is holding the page.
 */
export function useIsAuthenticated(): boolean {
  const [authed, setAuthed] = useState<boolean>(() =>
    Boolean(localStorage.getItem('botanical_guardian_auth_token'))
  );

  useEffect(() => {
    let mounted = true;
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) setAuthed(Boolean(session));
      }).catch(() => {});
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthed(Boolean(session));
      });
      return () => {
        mounted = false;
        data.subscription.unsubscribe();
      };
    }
    return () => { mounted = false; };
  }, []);

  return authed;
}
