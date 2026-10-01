import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '../hooks/useIsAuthenticated';

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
  const isAuthenticated = useIsAuthenticated();
  const [checking, setChecking] = useState(true);

  // The hook knows the answer synchronously from the local token, but the
  // Supabase session check is async; give it one tick before bouncing a
  // visitor who is actually signed in with a session the token field missed.
  useEffect(() => {
    const t = setTimeout(() => setChecking(false), 350);
    return () => clearTimeout(t);
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
