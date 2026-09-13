import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Lightweight frontend route guard.
 * Prevents logged-out visitors from accessing private routes and undefined state
 * by bouncing directly to /auth with return location state preserved.
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('botanical_guardian_auth_token'));
  });

  useEffect(() => {
    let isMounted = true;
    const verifyAuth = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setIsAuthenticated(Boolean(session));
          setChecking(false);
        }
      } else {
        const token = localStorage.getItem('botanical_guardian_auth_token');
        if (isMounted) {
          setIsAuthenticated(Boolean(token));
          setChecking(false);
        }
      }
    };
    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isAuthenticated && !checking) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Prevent flash of protected content during initial check if token is missing
  if (!isAuthenticated && checking) {
    return null;
  }

  return <>{children}</>;
}
