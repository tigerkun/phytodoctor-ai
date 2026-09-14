import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scroll, ArrowRight, User, Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Feather } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/home/PageWrapper';
import AmbientParticles from '../components/AmbientParticles';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import { GameService } from '../services/gameService';
import { isValidEmail, evaluatePasswordStrength, generateLocalUserId, hashPassword, verifyPassword, generateSalt, getAuthLockout, recordAuthFailure, clearAuthFailures } from '../services/authUtils';
import { supabase, supabaseConfigured } from '../lib/supabase';
import '../styles/ambient.css';
import '../styles/animations.css';

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

/**
 * Writes the botanical_guardian_* localStorage keys the rest of the app reads
 * (Dexie userId, GameService, etc.) from a Supabase session or local auth.
 */
async function persistSession(userId: string, userEmail: string, displayName: string) {
  localStorage.setItem('botanical_guardian_auth_token', 'token_' + Date.now());
  localStorage.setItem('botanical_guardian_userId', userId);
  localStorage.setItem('botanical_guardian_user_email', userEmail);
  localStorage.setItem('botanical_guardian_user_name', displayName);
  localStorage.setItem('botanical_guardian_onboarded', '1');
  await GameService.ensureProfile(userId);
}

export default function Auth() {
  const navigate = useNavigate();
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
      await persistSession(userId, u.email ?? '', displayName);
      navigate('/');
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
          await persistSession(userId, data.user.email ?? '', displayName);
          window.history.replaceState(null, '', window.location.pathname);
          navigate('/');
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
    if (!isLogin && (!name || !experienceLevel || !environment)) return;
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
            setAuthError(error.message === 'Invalid login credentials'
              ? 'Incorrect email or password.'
              : error.message);
            setLoading(false);
            return;
          }
          if (data.user) {
            const userId = `sb_${data.user.id}`;
            const displayName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || name;
            await persistSession(userId, data.user.email ?? email, displayName);
            navigate('/');
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
            await persistSession(userId, data.user.email ?? email, name);
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
            navigate('/');
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
          let ok = await verifyPassword(userId, password, existing.passwordHash as string, salt);
          if (!ok && salt === undefined) {
            // Legacy unsalted account that still passed with the old scheme
            // cannot reach this branch (verify already fell back); this only
            // guards against a stored legacy hash + missing salt mismatch.
            ok = false;
          }
          if (!ok) {
            recordAuthFailure(email);
            setAuthError('Incorrect password.');
            setLoading(false);
            return;
          }
          // Upgrade legacy unsalted accounts to the salted scheme in-place.
          if (!salt) {
            const newSalt = generateSalt();
            const newHash = await hashPassword(userId, password, newSalt);
            await db.userProfile.update(userId, { passwordSalt: newSalt, passwordHash: newHash } as any);
          }
          clearAuthFailures(email);
          await persistSession(userId, email.toLowerCase().trim(), existing.username || email.split('@')[0]);
        } else {
          if (existing?.passwordHash) {
            setAuthError('An account already exists with this email. Please sign in.');
            setLoading(false);
            return;
          }
          const salt = generateSalt();
          const hash = await hashPassword(userId, password, salt);
          await persistSession(userId, email.toLowerCase().trim(), name);
          await db.userProfile.update(userId, {
            username: name,
            experienceLevel: experienceLevel as any,
            environment: environment as any,
            passwordHash: hash,
            passwordSalt: salt,
          } as any);
        }
        navigate('/');
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

  return (
    <div className="skin-gatekeeper min-h-screen relative overflow-hidden transition-colors duration-500">
      <AmbientParticles theme={theme} />

      <PageWrapper className="min-h-[88vh] flex items-center justify-center p-4 sm:p-6 md:p-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-lg gatekeeper-ledger p-7 sm:p-10 md:p-12 relative overflow-hidden"
        >
          {/* Brass corner brackets */}
          <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-[#c5a059] pointer-events-none opacity-80" />
          <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-[#c5a059] pointer-events-none opacity-80" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-[#c5a059] pointer-events-none opacity-80" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-[#c5a059] pointer-events-none opacity-80" />

          {/* Header */}
          <div className="relative z-10 text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2e4a34] shadow-lg border border-[#c5a059] mb-4">
              <Scroll size={26} className="text-[#c5a059]" />
            </div>
            <div className="inline-block px-3 py-1 mb-2 rounded-full border border-[#c5a059]/40 bg-[#f0e8d8]/60 text-[10px] uppercase font-bold tracking-[0.25em] text-[#8c6e38]">
              Royal Sanctuary Ledger • Vol. IX
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-[#2b2118] dark:text-[#f4eee1]">
              {isRecovery
                ? 'Restore Your Seal Passphrase'
                : isLogin
                ? 'Sign the Sanctuary Registry'
                : 'Inscribe Your Accreditations'}
            </h2>
            <p className="text-xs sm:text-sm font-serif italic text-[#725e4c] dark:text-[#b8a695] mt-1.5 max-w-sm mx-auto">
              {isRecovery
                ? 'Inscribe a strong new passphrase below to re-seal your botanical folio.'
                : isLogin
                ? 'Welcome back, Fellow. Present your seal to inspect your specimens.'
                : 'A new naturalist record shall be entered into the fellowship archives.'}
            </p>
          </div>

          {/* Google Sign-In (Suppressed during recovery) */}
          {!isRecovery && (
            <div className="relative z-10 mb-6">
              <motion.button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!supabaseConfigured}
                whileHover={supabaseConfigured ? { y: -2, boxShadow: '0 10px 22px rgba(45,30,15,0.14)' } : undefined}
                whileTap={supabaseConfigured ? { y: 0, scale: 0.98 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={`w-full py-3 px-4 rounded-xl border font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e4a34] focus-visible:ring-offset-2 ${
                  supabaseConfigured
                    ? 'border-[#c9b491] dark:border-[#523d29] bg-white dark:bg-[#221a14] text-[#2b2118] dark:text-[#ede2d5] hover:bg-[#faf6ee] dark:hover:bg-[#2b2118] cursor-pointer'
                    : 'border-[#dcd2c0] dark:border-[#3d2e20] bg-[#f4eee1]/60 dark:bg-[#1c160f] text-[#a89a84] dark:text-[#6b5c48] cursor-not-allowed'
                }`}
              >
                <GoogleMark />
                {supabaseConfigured ? 'Continue with Google' : 'Google Entry Sealed'}
              </motion.button>
              {!supabaseConfigured && (
                <p className="text-[10px] text-center text-[#a89a84] dark:text-[#6b5c48] mt-2 italic">
                  The gatekeeper's ledger is being prepared — use the folio below instead.
                </p>
              )}
              {authError && (
                <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-2.5 flex items-center gap-1.5 justify-center">
                  <AlertCircle size={13} /> {authError}
                </p>
              )}
            </div>
          )}

          {/* Divider (Suppressed during recovery) */}
          {!isRecovery && (
            <div className="relative z-10 flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#dcd2c0] dark:bg-[#3d2e20]" />
              <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-[#8c6e38]">or ledger folio</span>
              <div className="flex-1 h-px bg-[#dcd2c0] dark:bg-[#3d2e20]" />
            </div>
          )}

          {/* Form */}
          <form onSubmit={isRecovery ? handleResetPasswordSubmit : handleSubmit} className="relative z-10 space-y-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && !isRecovery && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative">
                    <label className="block text-[11px] font-sans font-bold uppercase tracking-[0.1em] text-[#6b5325] dark:text-[#caa651] mb-1.5 pl-1">Full Name</label>
                    <User className="absolute left-4 bottom-3 text-[#8c6e38]" size={17} />
                    <input
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      placeholder="Naturalist Full Name"
                      className="w-full pl-11 pr-4 py-3.5 guest-ledger-input rounded-xl text-sm font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select required={!isLogin} value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}
                      className={`w-full px-3 py-3 guest-ledger-input rounded-xl text-xs font-semibold appearance-none cursor-pointer ${experienceLevel ? '' : 'text-gray-400'}`}>
                      <option value="" disabled>Rank</option>
                      <option value="novice">Novice</option>
                      <option value="intermediate">Keeper</option>
                      <option value="expert">Master</option>
                    </select>
                    <select required={!isLogin} value={environment} onChange={(e) => setEnvironment(e.target.value)}
                      className={`w-full px-3 py-3 guest-ledger-input rounded-xl text-xs font-semibold appearance-none cursor-pointer ${environment ? '' : 'text-gray-400'}`}>
                      <option value="" disabled>Sanctuary</option>
                      <option value="indoor">Indoor</option>
                      <option value="outdoor">Outdoor</option>
                      <option value="greenhouse">Glasshouse</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isRecovery && (
              <div className="relative">
                <label className="block text-[11px] font-sans font-bold uppercase tracking-[0.1em] text-[#6b5325] dark:text-[#caa651] mb-1.5 pl-1">Email</label>
                <Mail className={`absolute left-4 bottom-3 ${emailError ? 'text-red-500' : 'text-[#8c6e38]'}`} size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  onBlur={() => { if (email && !isValidEmail(email)) setEmailError('Please enter a valid email address.'); }}
                  autoComplete="email"
                  placeholder="Dispatches Email Address"
                  className={`w-full pl-11 pr-4 py-3.5 guest-ledger-input rounded-xl text-sm font-medium ${emailError ? 'border-red-500' : ''}`}
                />
                <AnimatePresence>
                  {emailError && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1 pl-1">
                      <AlertCircle size={12} /> {emailError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="relative">
              <div className="flex items-center justify-between mb-1.5 pl-1 pr-1">
                <label className="block text-[11px] font-sans font-bold uppercase tracking-[0.1em] text-[#6b5325] dark:text-[#caa651]">
                  {isRecovery ? 'New Passphrase' : 'Passphrase'}
                </label>
                {isLogin && !isRecovery && supabaseConfigured && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetting}
                    className="text-[10px] font-serif font-semibold text-[#8c6e38] hover:text-[#5a3d28] dark:hover:text-[#c5a059] transition-colors underline underline-offset-2 decoration-[#c5a059]/40"
                  >
                    {resetting ? 'Dispatching...' : 'Lost your seal?'}
                  </button>
                )}
              </div>
              <Lock className="absolute left-4 bottom-3 text-[#8c6e38]" size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                autoComplete={isRecovery ? 'new-password' : isLogin ? 'current-password' : 'new-password'}
                placeholder={isRecovery ? 'Inscribe New Strong Passphrase' : 'Seal Passphrase'}
                className="w-full pl-11 pr-11 py-3.5 guest-ledger-input rounded-xl text-sm font-medium"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 bottom-3 text-[#8c6e38] hover:text-[#2b2118] dark:hover:text-[#f4eee1] focus:outline-none">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

              <AnimatePresence>
                {resetSent && !isRecovery && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-serif italic text-center"
                  >
                    A recovery dispatch has been transmitted to your email. Check your dispatches to restore your seal.
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {(!isLogin || isRecovery) && (passwordFocus || password.length > 0) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3 p-3 rounded-lg bg-[#faf6ee] dark:bg-[#201812] border border-[#dcd2c0] dark:border-[#423120]">
                    <div className="flex gap-2 mb-2">
                      {[1, 2, 3].map((level) => (
                        <div key={level} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          strength.score >= level
                            ? strength.score === 1 ? 'bg-amber-600' : strength.score === 2 ? 'bg-amber-400' : 'bg-emerald-600'
                            : 'bg-gray-300 dark:bg-gray-700'}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono font-bold text-gray-500">
                      {[
                        [strength.lengthValid, '8+ chars'],
                        [strength.upperValid, '1 uppercase'],
                        [strength.numberValid, '1 number'],
                      ].map(([valid, label]) => (
                        <div key={label as string} className={`flex items-center gap-1 ${valid ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                          {valid ? <CheckCircle2 size={11} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />}
                          {label}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              disabled={loading || ((!isLogin || isRecovery) && !pwdValid)}
              type="submit"
              whileHover={!(loading || ((!isLogin || isRecovery) && !pwdValid)) ? { y: -2, scale: 1.01 } : undefined}
              whileTap={!(loading || ((!isLogin || isRecovery) && !pwdValid)) ? { y: 0, scale: 0.97 } : undefined}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className={`w-full py-4 mt-6 rounded-xl font-serif font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                isRecovery || isLogin ? 'ledger-seal-button focus-visible:ring-[#2e4a34]' : 'ledger-inscribe-button focus-visible:ring-[#a47f3b]'
              }`}
            >
              {loading
                ? <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                    className={isLogin || isRecovery ? 'text-[#c5a059]' : 'text-[#2e4a34]'}
                  >
                    <Feather size={18} />
                  </motion.div>
                : <><span>{isRecovery ? 'Affix New Seal & Enter' : isLogin ? 'Affix Seal & Enter' : 'Inscribe & Enter'}</span><ArrowRight size={16} className={isLogin || isRecovery ? 'text-[#c5a059]' : 'text-[#2e4a34]'} /></>}
            </motion.button>
          </form>

          <div className="mt-6 text-center relative z-10">
            {isRecovery ? (
              <button
                type="button"
                onClick={() => {
                  setIsRecovery(false);
                  resetForm();
                }}
                className="text-xs font-serif font-semibold text-[#8c6e38] hover:text-[#5a3d28] dark:hover:text-[#c5a059] transition-colors underline underline-offset-4 decoration-[#c5a059]/40"
              >
                Cancel recovery · Return to sign in
              </button>
            ) : (
              <button onClick={resetForm}
                className="text-xs font-serif font-semibold text-[#8c6e38] hover:text-[#5a3d28] dark:hover:text-[#c5a059] transition-colors underline underline-offset-4 decoration-[#c5a059]/40">
                {isLogin ? 'No account on file? Inscribe new record' : 'Already registered? Open folio'}
              </button>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#dcd2c0]/60 dark:border-[#3d2e20] flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#8c6e38]">
            <ShieldCheck size={13} className="text-[#2e4a34] dark:text-[#8c6e38]" />
            <span>{supabaseConfigured ? 'Sealed & Warded · Entries Verified' : 'Local Keyring · Single-Device Ledger'}</span>
          </div>
        </motion.div>
      </PageWrapper>
    </div>
  );
}
