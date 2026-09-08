import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scroll, ArrowRight, User, Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Feather } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/home/PageWrapper';
import AmbientParticles from '../components/AmbientParticles';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import { GameService } from '../services/gameService';
import { isValidEmail, evaluatePasswordStrength, generateLocalUserId, hashPassword, verifyPassword } from '../services/authUtils';
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
  const [gender, setGender] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [authError, setAuthError] = useState('');

  const strength = evaluatePasswordStrength(password);
  const pwdValid = strength.isFullyValid;

  // ── Supabase session listener ──────────────────────────────────────────────
  // When Supabase OAuth redirect lands back on /auth, the session fires here.
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;
      const u = session.user;
      const userId = `sb_${u.id}`;
      const displayName = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Naturalist';
      await persistSession(userId, u.email ?? '', displayName);
      navigate('/');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

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
    if (!isLogin && (!name || !gender || !experienceLevel || !environment)) return;
    if (!validateForm()) return;

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
              gender,
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
        // ── Local fallback path (SHA-256 client-side hash) ─────────────────
        // ponytail: local-only auth, no server. Safe for single-user devices.
        // Upgrade path: configure Supabase (see .env.example).
        const userId = generateLocalUserId(email);
        const { db } = await import('../db/database');
        const existing = await db.userProfile.get(userId);

        if (isLogin) {
          if (!existing?.passwordHash) {
            setAuthError('No account found with this email. Please register first.');
            setLoading(false);
            return;
          }
          const ok = await verifyPassword(userId, password, existing.passwordHash as string);
          if (!ok) {
            setAuthError('Incorrect password.');
            setLoading(false);
            return;
          }
          await persistSession(userId, email.toLowerCase().trim(), existing.username || email.split('@')[0]);
        } else {
          if (existing?.passwordHash) {
            setAuthError('An account already exists with this email. Please sign in.');
            setLoading(false);
            return;
          }
          const hash = await hashPassword(userId, password);
          await persistSession(userId, email.toLowerCase().trim(), name);
          await db.userProfile.update(userId, {
            username: name,
            gender,
            experienceLevel: experienceLevel as any,
            environment: environment as any,
            passwordHash: hash,
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
              {isLogin ? 'Sign the Sanctuary Registry' : 'Inscribe Your Accreditations'}
            </h2>
            <p className="text-xs sm:text-sm font-serif italic text-[#725e4c] dark:text-[#b8a695] mt-1.5 max-w-sm mx-auto">
              {isLogin
                ? 'Welcome back, Fellow. Present your seal to inspect your specimens.'
                : 'A new naturalist record shall be entered into the fellowship archives.'}
            </p>
          </div>

          {/* Google Sign-In */}
          <div className="relative z-10 mb-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-xl border border-[#c9b491] dark:border-[#523d29] bg-white dark:bg-[#221a14] font-serif font-bold text-xs text-[#2b2118] dark:text-[#ede2d5] flex items-center justify-center gap-2 shadow-sm hover:bg-[#faf6ee] dark:hover:bg-[#2b2118] transition-colors"
            >
              <GoogleMark />
              {supabaseConfigured ? 'Continue with Google' : 'Google Sign-In (Supabase not configured)'}
            </button>
            {authError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-2.5 flex items-center gap-1.5 justify-center">
                <AlertCircle size={13} /> {authError}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="relative z-10 flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#dcd2c0] dark:bg-[#3d2e20]" />
            <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-[#8c6e38]">or ledger folio</span>
            <div className="flex-1 h-px bg-[#dcd2c0] dark:bg-[#3d2e20]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c6e38]" size={17} />
                    <input
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Naturalist Full Name"
                      className="w-full pl-11 pr-4 py-3.5 guest-ledger-input rounded-xl text-sm font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <select required={!isLogin} value={gender} onChange={(e) => setGender(e.target.value)}
                      className={`w-full px-3 py-3 guest-ledger-input rounded-xl text-xs font-semibold appearance-none cursor-pointer ${gender ? '' : 'text-gray-400'}`}>
                      <option value="" disabled>Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non-binary">Non-binary</option>
                      <option value="prefer-not-to-say">Unspecified</option>
                    </select>
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

            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${emailError ? 'text-red-500' : 'text-[#8c6e38]'}`} size={17} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                onBlur={() => { if (email && !isValidEmail(email)) setEmailError('Please enter a valid email address.'); }}
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

            <div className="relative">
              <Lock className="absolute left-4 top-[24px] -translate-y-1/2 text-[#8c6e38]" size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                placeholder="Seal Passphrase"
                className="w-full pl-11 pr-11 py-3.5 guest-ledger-input rounded-xl text-sm font-medium"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[24px] -translate-y-1/2 text-[#8c6e38] hover:text-[#2b2118] dark:hover:text-[#f4eee1] focus:outline-none">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

              <AnimatePresence>
                {!isLogin && (passwordFocus || password.length > 0) && (
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

            <button
              disabled={loading || (!isLogin && !pwdValid)}
              type="submit"
              className="w-full py-4 mt-6 ledger-seal-button rounded-xl font-serif font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {loading
                ? <div className="animate-spin text-[#c5a059]"><Feather size={18} /></div>
                : <><span>{isLogin ? 'Affix Seal & Enter' : 'Register Naturalist Record'}</span><ArrowRight size={16} className="text-[#c5a059]" /></>}
            </button>
          </form>

          <div className="mt-6 text-center relative z-10">
            <button onClick={resetForm}
              className="text-xs font-serif font-semibold text-[#8c6e38] hover:text-[#5a3d28] dark:hover:text-[#c5a059] transition-colors underline underline-offset-4 decoration-[#c5a059]/40">
              {isLogin ? 'No account on file? Inscribe new record' : 'Already registered? Open folio'}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-[#dcd2c0]/60 dark:border-[#3d2e20] flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#8c6e38]">
            <ShieldCheck size={13} className="text-[#2e4a34] dark:text-[#8c6e38]" />
            <span>{supabaseConfigured ? 'Supabase Auth · Google OAuth Active' : 'Local Keyring Active · Configure Supabase for full auth'}</span>
          </div>
        </motion.div>
      </PageWrapper>
    </div>
  );
}
