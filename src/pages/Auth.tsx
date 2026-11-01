import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Feather, ChevronDown, Sprout } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import { GameService } from '../services/gameService';
import { isValidEmail, evaluatePasswordStrength, generateLocalUserId, hashPassword, verifyPassword, isCurrentHashScheme, getAuthLockout, recordAuthFailure, clearAuthFailures } from '../services/authUtils';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { consumeAuthReturn } from '../lib/guestHandoff';
import ModernLoginSignup from '../components/ui/modern-login-signup';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.6 6.5l6.3 5.3C37.4 37.3 44 32 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

/** The app crest, leaf-only (no icon plate) for the card header. */
function SanctuaryLeaf({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs>
        <linearGradient id="pd-leaf-auth" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#9bde8b" />
          <stop offset="1" stopColor="#3fa05f" />
        </linearGradient>
      </defs>
      <path d="M256 48 C 274 48, 300 57, 326 74 C 402 124, 452 200, 444 278 C 434 372, 366 452, 284 462 C 270 464, 258 448, 256 418 C 254 448, 242 464, 228 462 C 146 452, 78 372, 68 278 C 60 200, 110 124, 186 74 C 212 57, 238 48, 256 48 Z" fill="url(#pd-leaf-auth)" />
      <g stroke="#0c2b1f" strokeWidth="21" strokeLinecap="round" fill="none">
        <path d="M78 322 L196 266" />
        <path d="M96 228 L202 210" />
        <path d="M150 132 L226 154" />
        <path d="M434 322 L316 266" />
        <path d="M416 228 L310 210" />
        <path d="M362 132 L286 154" />
      </g>
      <g fill="#0c2b1f">
        <ellipse cx="212" cy="322" rx="12" ry="21" transform="rotate(-16 212 322)" />
        <ellipse cx="300" cy="322" rx="12" ry="21" transform="rotate(16 300 322)" />
      </g>
      <path d="M256 400 L256 92" stroke="#e9f5e4" strokeWidth="14" strokeLinecap="round" opacity="0.85" fill="none" />
      <path d="M118 380 L210 380 L234 344 L262 394 L282 350 L292 380 L394 380" fill="none" stroke="#f7dfa8" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Writes the botanical_guardian_* localStorage keys the rest of the app reads
 * (Dexie userId, GameService, etc.) from a Supabase session or local auth.
 */
async function persistSession(userId: string, userEmail: string, displayName: string, accessToken?: string) {
  if (accessToken) {
    localStorage.setItem('botanical_guardian_auth_token', accessToken);
    try {
      document.cookie = `sb-access-token=${encodeURIComponent(accessToken)}; path=/; max-age=2592000; SameSite=Lax`;
    } catch {}
  } else if (!supabase) {
    localStorage.setItem('botanical_guardian_auth_token', 'token_' + Date.now());
  } else {
    localStorage.removeItem('botanical_guardian_auth_token');
    try {
      document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
    } catch {}
  }
  localStorage.setItem('botanical_guardian_userId', userId);
  localStorage.setItem('botanical_guardian_user_email', userEmail);
  localStorage.setItem('botanical_guardian_user_name', displayName);
  localStorage.setItem('botanical_guardian_onboarded', '1');
  await GameService.ensureProfile(userId);
}

// Shared field chrome: garden glass on cream by day, charcoal glass by night.
// Height comes from py-3.5, which clears the 44px touch minimum on phones.
const FIELD =
  'w-full rounded-xl border bg-white/70 px-4 py-3.5 text-sm font-medium text-[#2C2419] outline-none transition placeholder:text-[#6B6156]/60 focus:ring-2 dark:bg-[rgba(30,35,38,0.75)] dark:text-[#FAF7F2] dark:placeholder:text-[#7E8D76]/60';
const FIELD_OK =
  'border-[rgba(44,36,25,0.12)] focus:border-[#5A7D5A] focus:ring-[rgba(90,125,90,0.25)] dark:border-[rgba(255,255,255,0.12)] dark:focus:border-[#8FB58F] dark:focus:ring-[rgba(143,181,143,0.25)]';
const FIELD_LABEL =
  'mb-1.5 block pl-1 text-[11px] font-sans font-bold uppercase tracking-[0.1em] text-[#6B6156] dark:text-[#7E8D76]';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useDayNightTheme();
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  // Display timeout message if we were redirected due to inactivity
  const stateMessage = location.state?.message;

  const strength = evaluatePasswordStrength(password);
  const pwdValid = strength.isFullyValid;

  // ── Supabase session listener ──────────────────────────────────────────────
  // When Supabase OAuth or password recovery redirect lands back on /auth
  useEffect(() => {
    // Check if URL hash or search params indicate a password recovery redirect
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isRecoveryUrl =
      hash.includes('type=recovery') ||
      new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery' ||
      new URLSearchParams(search).get('type') === 'recovery';

    if (isRecoveryUrl) {
      setIsRecovery(true);
    }

    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        return;
      }
      if (!session?.user) return;
      // Do not auto-navigate home if currently in recovery mode or URL indicates recovery
      if (isRecovery || isRecoveryUrl) return;

      const u = session.user;
      const userId = `sb_${u.id}`;
      const displayName = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Naturalist';
      await persistSession(userId, u.email ?? '', displayName, session.access_token);
      navigate(consumeAuthReturn('/'));
    });
    return () => subscription.unsubscribe();
  }, [navigate, isRecovery]);

  // ── Google OAuth (Supabase-powered or legacy GSI) ─────────────────────────
  const handleGoogleSignIn = async () => {
    if (supabase) {
      // Real OAuth: Supabase verifies the Google token server-side.
      // The redirect URL must be whitelisted in Supabase Dashboard → Auth → URL Configuration.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth' },
      });
      if (error) setAuthError(error.message);
    } else {
      setAuthError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable Google Sign-In.');
    }
  };

  // ── Password Reset Dispatch ────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email.trim() || !isValidEmail(email)) {
      setEmailError('Please enter your email address to recover your seal.');
      return;
    }
    setResetting(true);
    setAuthError('');
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/auth',
        });
        if (error) {
          setAuthError(error.message);
        } else {
          setResetSent(true);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to dispatch recovery request.');
    } finally {
      setResetting(false);
    }
  };

  // ── Password Reset Confirmation Submit ─────────────────────────────────────
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !pwdValid) return;
    setLoading(true);
    setAuthError('');
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) {
          setAuthError(error.message);
          setLoading(false);
          return;
        }
        if (data.user) {
          const userId = `sb_${data.user.id}`;
          const displayName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Naturalist';
          await persistSession(userId, data.user.email ?? '', displayName, (await supabase.auth.getSession()).data.session?.access_token);
          window.history.replaceState(null, '', window.location.pathname);
          navigate(consumeAuthReturn('/'));
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update passphrase.');
      setLoading(false);
    }
  };

  // ── Form validation ────────────────────────────────────────────────────────
  const validateForm = () => {
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    if (!isLogin && !pwdValid) return false;
    return true;
  };

  // ── Email / password submit ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    // The Rank and Sanctuary selects are required for a new record. Returning
    // silently left the button looking broken — it looked enabled, did
    // nothing, and showed no reason why.
    if (!isLogin && (!name || !experienceLevel || !environment)) {
      setAuthError(
        !name ? 'Please enter your full name.'
          : !experienceLevel ? 'Please choose your rank.'
          : 'Please choose your sanctuary.'
      );
      return;
    }
    if (!validateForm()) return;

    // Local-path brute-force lockout (Supabase enforces its own server-side).
    const lockMs = getAuthLockout(email);
    if (lockMs > 0) {
      setAuthError(`Too many attempts. Please wait ${Math.ceil(lockMs / 60_000)} minute(s) and try again.`);
      return;
    }

    setLoading(true);
    setAuthError('');

    try {
      if (supabase) {
        // ── Supabase path (real bcrypt passwords, server-verified) ─────────
        if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (error) {
            // Check if account exists in local Dexie ledger before failing
            const localId = generateLocalUserId(email);
            const { db } = await import('../db/database');
            const existing = await db.userProfile.get(localId);
            if (existing?.passwordHash) {
              const salt = (existing as any).passwordSalt as string | undefined;
              const ok = await verifyPassword(localId, password, existing.passwordHash as string, salt);
              if (ok) {
                clearAuthFailures(email);
                await persistSession(localId, email.toLowerCase().trim(), existing.username || email.split('@')[0], 'token_' + Date.now());
                navigate(consumeAuthReturn('/'));
                return;
              }
            }
            setAuthError(error.message === 'Invalid login credentials'
              ? 'Incorrect email or password.'
              : error.message);
            setLoading(false);
            return;
          }
          if (data.user) {
            const userId = `sb_${data.user.id}`;
            const displayName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || name;
            await persistSession(userId, data.user.email ?? email, displayName, data.session?.access_token);
            navigate(consumeAuthReturn('/'));
          }
        } else {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name } },
          });
          if (error) {
            setAuthError(error.message);
            setLoading(false);
            return;
          }
          if (data.user) {
            const userId = `sb_${data.user.id}`;
            await persistSession(userId, data.user.email ?? email, name, data.session?.access_token);
            // Store onboarding profile data in Dexie
            const { db } = await import('../db/database');
            await db.userProfile.update(userId, {
              username: name,
              experienceLevel: experienceLevel as any,
              environment: environment as any,
            });
            // Supabase may require email confirmation — handle gracefully
            if (!data.session) {
              setAuthError('Check your email to confirm your account, then sign in.');
              setLoading(false);
              return;
            }
            navigate(consumeAuthReturn('/'));
          }
        }
      } else {
        // ── Local fallback path (salted SHA-256 client-side hash) ──────────
        // Local-only auth for single-device use. Configure Supabase
        // (see .env.example) for real server-side authentication.
        const userId = generateLocalUserId(email);
        const { db } = await import('../db/database');
        const existing = await db.userProfile.get(userId);

        if (isLogin) {
          if (!existing?.passwordHash) {
            setAuthError('No account found with this email. Please register first.');
            setLoading(false);
            return;
          }
          const salt = (existing as any).passwordSalt as string | undefined;
          const storedHash = existing.passwordHash as string;
          const ok = await verifyPassword(userId, password, storedHash, salt);
          if (!ok) {
            recordAuthFailure(email);
            setAuthError('Incorrect password.');
            setLoading(false);
            return;
          }
          // Any hash not already in the current scheme — unsalted SHA-256 or
          // salted SHA-256 — is re-derived now that we hold the plaintext, so
          // every account upgrades itself the first time it signs in.
          if (!isCurrentHashScheme(storedHash)) {
            const newHash = await hashPassword(password);
            await db.userProfile.update(userId, { passwordHash: newHash } as any);
          }
          clearAuthFailures(email);
          await persistSession(userId, email.toLowerCase().trim(), existing.username || email.split('@')[0]);
        } else {
          if (existing?.passwordHash) {
            setAuthError('An account already exists with this email. Please sign in.');
            setLoading(false);
            return;
          }
          const hash = await hashPassword(password);
          await persistSession(userId, email.toLowerCase().trim(), name);
          await db.userProfile.update(userId, {
            username: name,
            experienceLevel: experienceLevel as any,
            environment: environment as any,
            passwordHash: hash,
          } as any);
        }
        navigate(consumeAuthReturn('/'));
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsLogin(!isLogin);
    setEmail(''); setPassword(''); setName('');
    setEmailError(''); setAuthError('');
    setResetSent(false);
    setIsRecovery(false);
  };

  const handleGuestEntry = async () => {
    setLoading(true);
    try {
      const guestEmail = localStorage.getItem('botanical_guardian_user_email') || 'keeper@phytodoctor.sanctuary';
      const guestName = localStorage.getItem('botanical_guardian_user_name') || 'Botanical Master';
      const userId = localStorage.getItem('botanical_guardian_userId') || generateLocalUserId(guestEmail);
      const token = 'guest_token_' + Date.now();
      await persistSession(userId, guestEmail, guestName, token);
      const { db } = await import('../db/database');
      const existing = await db.userProfile.get(userId);
      if (!existing) {
        await db.userProfile.put({
          userId,
          username: guestName,
          experienceLevel: 'intermediate',
          environment: 'indoor',
          tier: 'free',
          seeds: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
      navigate(consumeAuthReturn('/'));
    } catch (err: any) {
      setAuthError(err.message || 'Could not enter as guest.');
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled = loading || ((!isLogin || isRecovery) && !pwdValid) || (!isLogin && (!name || !experienceLevel || !environment));

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#FAF7F2] text-[#2C2419] transition-colors duration-500 dark:bg-[#0F1419] dark:text-[#FAF7F2]">
      {/* The living garden field: blooming dot grid, tuned per theme. */}
      <ModernLoginSignup variant={theme === 'night' ? 'night' : 'day'} />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border border-[rgba(44,36,25,0.12)] bg-[rgba(255,253,250,0.82)] p-6 shadow-[0_16px_48px_rgba(44,36,25,0.14)] backdrop-blur-xl sm:p-9 dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(22,26,29,0.82)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]">

            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-[#1d5643] to-[#0c2b1f] shadow-lg ring-1 ring-[rgba(143,181,143,0.45)]">
                <SanctuaryLeaf size={38} />
              </div>
              <div className="mb-2 inline-block rounded-full border border-[#c5a059]/40 bg-[rgba(212,168,67,0.08)] px-3 py-1 text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-[#6d5628] dark:bg-[rgba(201,168,106,0.1)] dark:text-[#c9a86a]">
                PhytoDoctor · Sanctuary Gate
              </div>
              <h2 className="auth-heading text-2xl font-serif font-black tracking-tight sm:text-[1.75rem]">
                {isRecovery
                  ? 'Restore Your Seal Passphrase'
                  : isLogin
                  ? 'Welcome back, Keeper'
                  : 'Begin Your Sanctuary'}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[#6B6156] sm:text-sm dark:text-[#7E8D76]">
                {isRecovery
                  ? 'Inscribe a strong new passphrase below to re-seal your botanical folio.'
                  : isLogin
                  ? 'Present your seal to walk the beds again.'
                  : 'A few sprigs of information, and your sanctuary is planted.'}
              </p>
            </div>

            <AnimatePresence>
              {stateMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 flex items-start gap-3 rounded-xl border border-[#D4A843]/30 bg-[rgba(212,168,67,0.1)] p-3.5"
                >
                  <AlertCircle className="mt-0.5 shrink-0 text-[#9A681A] dark:text-[#E8C97A]" size={16} />
                  <p className="text-xs font-serif text-[#6d5628] dark:text-[#c9a86a]">
                    {stateMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google Sign-In (Suppressed during recovery) */}
            {!isRecovery && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={!supabaseConfigured}
                  className={`flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5A7D5A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2] dark:focus-visible:ring-offset-[#161A1D] ${
                    supabaseConfigured
                      ? 'cursor-pointer border-[rgba(44,36,25,0.12)] bg-white/85 text-[#2C2419] shadow-sm hover:bg-white hover:shadow-md dark:border-[rgba(255,255,255,0.14)] dark:bg-[rgba(30,35,38,0.85)] dark:text-[#FAF7F2] dark:hover:bg-[#1E2326]'
                      : 'cursor-not-allowed border-[rgba(44,36,25,0.08)] bg-white/40 text-[#6B6156]/60 dark:border-[rgba(255,255,255,0.06)] dark:bg-[rgba(30,35,38,0.4)] dark:text-[#7E8D76]/60'
                  }`}
                >
                  <GoogleMark />
                  {supabaseConfigured ? 'Continue with Google' : 'Google Entry Sealed'}
                </button>
                {!supabaseConfigured && (
                  <p className="mt-2 text-center text-[10px] italic text-[#6B6156] dark:text-[#7E8D76]">
                    The gatekeeper's ledger is being prepared — use the folio below instead.
                  </p>
                )}
                {authError && (
                  <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-[#B4473C] dark:text-[#E07A5F]">
                    <AlertCircle size={13} /> {authError}
                  </p>
                )}
              </div>
            )}

            {/* Divider (Suppressed during recovery) */}
            {!isRecovery && (
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[rgba(44,36,25,0.12)] dark:bg-[rgba(255,255,255,0.12)]" />
                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-[#6B6156] dark:text-[#7E8D76]">or with email</span>
                <div className="h-px flex-1 bg-[rgba(44,36,25,0.12)] dark:bg-[rgba(255,255,255,0.12)]" />
              </div>
            )}

            {/* Form */}
            <form onSubmit={isRecovery ? handleResetPasswordSubmit : handleSubmit} className="space-y-4">
              <AnimatePresence initial={false} mode="popLayout">
                {!isLogin && !isRecovery && (
                  <motion.div
                    key="signup-extras"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="relative">
                      <label htmlFor="auth-name" className={FIELD_LABEL}>Full Name</label>
                      <User className="pointer-events-none absolute bottom-3 left-4 text-[#5A7D5A] dark:text-[#8FB58F]" size={16} />
                      <input
                        id="auth-name"
                        type="text"
                        required={!isLogin}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="Naturalist Full Name"
                        className={`${FIELD} ${FIELD_OK} pl-11`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <select aria-label="Rank" required={!isLogin} value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}
                          className={`${FIELD} ${FIELD_OK} cursor-pointer appearance-none pr-9 ${experienceLevel ? '' : 'text-[#6B6156]/60 dark:text-[#7E8D76]/60'}`}>
                          <option value="" disabled>Rank</option>
                          <option value="novice">Novice</option>
                          <option value="intermediate">Keeper</option>
                          <option value="expert">Master</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A7D5A] dark:text-[#8FB58F]" size={15} />
                      </div>
                      <div className="relative">
                        <select aria-label="Sanctuary" required={!isLogin} value={environment} onChange={(e) => setEnvironment(e.target.value)}
                          className={`${FIELD} ${FIELD_OK} cursor-pointer appearance-none pr-9 ${environment ? '' : 'text-[#6B6156]/60 dark:text-[#7E8D76]/60'}`}>
                          <option value="" disabled>Sanctuary</option>
                          <option value="indoor">Indoor</option>
                          <option value="outdoor">Outdoor</option>
                          <option value="greenhouse">Glasshouse</option>
                          <option value="mixed">Mixed</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A7D5A] dark:text-[#8FB58F]" size={15} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isRecovery && (
                <div className="relative">
                  <label htmlFor="auth-email" className={FIELD_LABEL}>Email</label>
                  <Mail className={`pointer-events-none absolute bottom-3 left-4 ${emailError ? 'text-[#B4473C] dark:text-[#E07A5F]' : 'text-[#5A7D5A] dark:text-[#8FB58F]'}`} size={16} />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                    onBlur={() => { if (email && !isValidEmail(email)) setEmailError('Please enter a valid email address.'); }}
                    autoComplete="email"
                    placeholder="Dispatches Email Address"
                    className={`${FIELD} pl-11 ${
                      emailError
                        ? 'border-[#C45B4A] focus:border-[#B4473C] focus:ring-[rgba(196,91,74,0.25)] dark:border-[#E07A5F]/60'
                        : FIELD_OK
                    }`}
                  />
                  <AnimatePresence>
                    {emailError && (
                      <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mt-1.5 flex items-center gap-1 pl-1 text-xs font-bold text-[#B4473C] dark:text-[#E07A5F]">
                        <AlertCircle size={12} /> {emailError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="relative">
                <div className="mb-1.5 flex items-center justify-between pl-1 pr-1">
                  <label htmlFor="auth-password" className={FIELD_LABEL}>
                    {isRecovery ? 'New Passphrase' : 'Passphrase'}
                  </label>
                  {isLogin && !isRecovery && supabaseConfigured && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetting}
                      className="cursor-pointer text-[10px] font-sans font-bold text-[#6d5628] underline underline-offset-2 transition-colors hover:text-[#2C2419] disabled:opacity-60 dark:text-[#c9a86a] dark:hover:text-[#FAF7F2]"
                    >
                      {resetting ? 'Dispatching...' : 'Lost your seal?'}
                    </button>
                  )}
                </div>
                <Lock className="pointer-events-none absolute bottom-3 left-4 text-[#5A7D5A] dark:text-[#8FB58F]" size={16} />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
                  autoComplete={isRecovery ? 'new-password' : isLogin ? 'current-password' : 'new-password'}
                  placeholder={isRecovery ? 'Inscribe New Strong Passphrase' : 'Seal Passphrase'}
                  className={`${FIELD} ${FIELD_OK} pl-11 pr-11`}
                />
                <button type="button" aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'} onClick={() => setShowPassword(!showPassword)}
                  className="absolute bottom-0 right-1 cursor-pointer p-3.5 text-[#6B6156] transition-colors hover:text-[#2C2419] focus:outline-none dark:text-[#7E8D76] dark:hover:text-[#FAF7F2]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>

                <AnimatePresence>
                  {resetSent && !isRecovery && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-2.5 rounded-lg border border-[rgba(61,118,81,0.3)] bg-[rgba(90,158,90,0.1)] p-2.5 text-center text-xs font-serif italic text-[#3D7651] dark:border-[rgba(143,181,143,0.3)] dark:bg-[rgba(143,181,143,0.1)] dark:text-[#A8C9A8]"
                    >
                      A recovery dispatch has been transmitted to your email. Check your dispatches to restore your seal.
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {(!isLogin || isRecovery) && (passwordFocus || password.length > 0) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      <div className="mt-3 rounded-xl border border-[rgba(44,36,25,0.08)] bg-[rgba(245,240,232,0.85)] p-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(30,35,38,0.85)]">
                        <div className="mb-2 flex gap-2">
                          {[1, 2, 3].map((level) => (
                            <div key={level} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              strength.score >= level
                                ? strength.score === 1 ? 'bg-[#9A681A]' : strength.score === 2 ? 'bg-[#D4A843]' : 'bg-[#5A9E5A]'
                                : 'bg-[rgba(44,36,25,0.12)] dark:bg-[rgba(255,255,255,0.12)]'}`} />
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono font-bold text-[#6B6156] dark:text-[#7E8D76]">
                          {[
                            [strength.lengthValid, '8+ chars'],
                            [strength.upperValid, '1 uppercase'],
                            [strength.numberValid, '1 number'],
                          ].map(([valid, label]) => (
                            <div key={label as string} className={`flex items-center gap-1 ${valid ? 'text-[#3D7651] dark:text-[#8FB58F]' : ''}`}>
                              {valid ? <CheckCircle2 size={11} /> : <div className="h-2.5 w-2.5 rounded-full border border-[#6B6156]/50 dark:border-[#7E8D76]/50" />}
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                disabled={submitDisabled}
                type="submit"
                whileHover={!submitDisabled ? { y: -2, scale: 1.01 } : undefined}
                whileTap={!submitDisabled ? { y: 0, scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                className={`flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl py-3.5 font-serif font-bold text-sm uppercase tracking-wider text-white shadow-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2] disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[#161A1D] ${
                  isRecovery || isLogin
                    ? 'bg-[#3D5A3D] hover:bg-[#466B46] focus-visible:ring-[#3D5A3D] dark:bg-[#3D5A3D] dark:hover:bg-[#466B46]'
                    : 'bg-[#B0552F] hover:bg-[#C4704B] focus-visible:ring-[#B0552F]'
                }`}
              >
                {loading
                  ? <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                    >
                      <Feather size={18} />
                    </motion.div>
                  : <><span>{isRecovery ? 'Affix New Seal & Enter' : isLogin ? 'Affix Seal & Enter' : 'Plant My Sanctuary'}</span><ArrowRight size={16} /></>}
              </motion.button>
            </form>

            <div className="mt-4 text-center">
              {isRecovery ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsRecovery(false);
                    resetForm();
                  }}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center text-xs font-semibold text-[#6d5628] underline underline-offset-4 transition-colors hover:text-[#2C2419] dark:text-[#c9a86a] dark:hover:text-[#FAF7F2]"
                >
                  Cancel recovery · Return to sign in
                </button>
              ) : (
                <button type="button" onClick={resetForm}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center text-xs text-[#6B6156] transition-colors hover:text-[#2C2419] dark:text-[#7E8D76] dark:hover:text-[#FAF7F2]">
                  {isLogin
                    ? <>New to the sanctuary? <span className="ml-1.5 font-bold text-[#3D5A3D] dark:text-[#8FB58F]">Create your ledger</span></>
                    : <>Already registered? <span className="ml-1.5 font-bold text-[#3D5A3D] dark:text-[#8FB58F]">Open your folio</span></>}
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={handleGuestEntry}
                disabled={loading}
                className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-[#5A7D5A]/30 bg-[rgba(90,125,90,0.08)] px-4 py-2 text-xs font-sans font-semibold text-[#3D5A3D] transition-colors hover:border-[#5A7D5A]/60 hover:bg-[rgba(90,125,90,0.15)] disabled:opacity-50 dark:border-[#8FB58F]/30 dark:bg-[rgba(143,181,143,0.1)] dark:text-[#A8C9A8] dark:hover:bg-[rgba(143,181,143,0.18)]"
              >
                <Sprout size={13} />
                <span>Wander in as Apprentice Keeper</span>
              </button>
            </div>

            <div className="mt-6 border-t border-[rgba(44,36,25,0.08)] pt-4 dark:border-[rgba(255,255,255,0.08)]">
              <p className="text-center text-[11px] leading-relaxed text-[#6B6156] dark:text-[#7E8D76]">
                By continuing you agree to our{' '}
                <Link to="/terms" className="font-semibold underline underline-offset-2 transition-colors hover:text-[#2C2419] dark:hover:text-[#FAF7F2]">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="font-semibold underline underline-offset-2 transition-colors hover:text-[#2C2419] dark:hover:text-[#FAF7F2]">Privacy Policy</Link>.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-[#6d5628] dark:text-[#c9a86a]">
                <ShieldCheck size={13} className="text-[#5A7D5A] dark:text-[#8FB58F]" />
                <span>{supabaseConfigured ? 'Sealed & Warded · Entries Verified' : 'Local Keyring · Single-Device Ledger'}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
