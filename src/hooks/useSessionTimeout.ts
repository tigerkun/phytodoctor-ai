import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useSessionTimeout(isAuthenticated: boolean) {
  const timeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const handleLogout = async () => {
      // Clear all related local storage
      localStorage.removeItem('botanical_guardian_auth_token');
      localStorage.removeItem('botanical_guardian_userId');
      localStorage.removeItem('botanical_guardian_user_email');

      // If we have supabase configured, sign out from there as well
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.error("Error signing out from Supabase on session timeout", e);
        }
      }

      // Navigate to auth screen and optionally show a timeout message via state
      navigate('/auth', { state: { message: 'Your session has expired due to inactivity. Please sign in again.' } });
    };

    const resetTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(handleLogout, TIMEOUT_MS);
    };

    // Initialize timer
    resetTimer();

    // Setup event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    // Using a throttled approach could save performance on things like mousemove,
    // but resetting a timeout natively is relatively cheap. We can use a simple wrapper.
    let lastEventTime = Date.now();

    const onActivity = () => {
      const now = Date.now();
      // Throttle timer resets to at most once per second
      if (now - lastEventTime > 1000) {
        lastEventTime = now;
        resetTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, onActivity);
      });
    };
  }, [isAuthenticated, navigate]);
}
