import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scroll, ArrowRight, User, Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Feather, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/home/PageWrapper';
import AmbientParticles from '../components/AmbientParticles';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import { GameService } from '../services/gameService';
import { isValidEmail, evaluatePasswordStrength, generateLocalUserId, decodeJwtPayload } from '../services/authUtils';
import '../styles/ambient.css';
import '../styles/animations.css';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

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

export default function Auth() {
  const navigate = useNavigate();
  const { theme } = useDayNightTheme();
  const googleBtnRef = useRef<HTMLDivElement>(null);
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

  const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const strength = evaluatePasswordStrength(password);
  const pwdValid = strength.isFullyValid;

  const persistSession = async (userId: string, userEmail: string, displayName: string) => {
    localStorage.setItem('botanical_guardian_auth_token', 'token_' + Date.now());
    localStorage.setItem('botanical_guardian_userId', userId);
    localStorage.setItem('botanical_guardian_user_email', userEmail);
    localStorage.setItem('botanical_guardian_user_name', displayName);
    localStorage.setItem('botanical_guardian_onboarded', '1');
    await GameService.ensureProfile(userId);
  };

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;
    const host = googleBtnRef.current;

    const mount = () => {
      if (!window.google || !host) return;
      host.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          try {
            setLoading(true);
            const payload = decodeJwtPayload(credential);
            await persistSession(`g_${payload.sub}`, payload.email.toLowerCase(), payload.name || payload.email.split('@')[0]);
            navigate('/');
          } catch {
            setAuthError('Google sign-in failed. Try again.');
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(host, {
        theme: 'outline',
        size: 'large',
        width: host.offsetWidth || 320,
        text: 'continue_with',
        shape: 'pill',
      });
    };

    if (window.google) {
      mount();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = mount;
    script.onerror = () => setAuthError('Could not load Google Sign-In.');
    document.head.appendChild(script);
  }, [googleClientId]);

  const validateForm = () => {
    let valid = true;
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    } else {
      setEmailError('');
    }
    if (!isLogin && !pwdValid) valid = false;
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && (!name || !gender || !experienceLevel || !environment))) return;
    if (!validateForm()) return;

    setLoading(true);
    const userId = generateLocalUserId(email);
    await persistSession(userId, email.toLowerCase().trim(), name || email.split('@')[0]);

    if (!isLogin) {
      const { db } = await import('../db/database');
      await db.userProfile.update(userId, {
        username: name || email.split('@')[0],
        gender,
        experienceLevel: experienceLevel as any,
        environment: environment as any,
      });
    }
    navigate('/');
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
          {/* Brass corner bracket accents */}
          <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-[#c5a059] pointer-events-none opacity-80" />
          <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-[#c5a059] pointer-events-none opacity-80" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-[#c5a059] pointer-events-none opacity-80" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-[#c5a059] pointer-events-none opacity-80" />

          {/* Ledger Header & Crest */}
          <div className="relative z-10 text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2e4a34] text-[#f4eee1] shadow-lg border border-[#c5a059] mb-4">
              <Scroll size={26} className="text-[#c5a059]" />
            </div>

            <div className="inline-block px-3 py-1 mb-2 rounded-full border border-[#c5a059]/40 bg-[#f0e8d8]/60 dark:bg-[#251d16]/70 text-[10px] uppercase font-bold tracking-[0.25em] text-[#8c6e38]">
              Royal Sanctuary Ledger • Vol. IX
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-[#2b2118] dark:text-[#f4eee1]">
              {isLogin ? 'Sign the Sanctuary Registry' : 'Inscribe Your Accreditations'}
            </h2>
            <p className="text-xs sm:text-sm font-serif italic text-[#725e4c] dark:text-[#b8a695] mt-1.5 max-w-sm mx-auto">
              {isLogin
                ? 'Welcome back, Fellow. Present your seal to inspect your specimens and telemetry.'
                : 'A new naturalist record shall be entered into the botanical fellowship archives.'}
            </p>
          </div>

          {/* Google Sign-In Section */}
          <div className="relative z-10 mb-6">
            <div ref={googleBtnRef} className="w-full min-h-[44px] flex justify-center [&>div]:w-full" />
            {!googleClientId && (
              <button
                type="button"
                onClick={() => setAuthError('Add VITE_GOOGLE_CLIENT_ID to .env to enable Google Sign-In.')}
                className="w-full py-3 px-4 rounded-xl border border-[#c9b491] dark:border-[#523d29] bg-white dark:bg-[#221a14] font-serif font-bold text-xs text-[#2b2118] dark:text-[#ede2d5] flex items-center justify-center gap-2 shadow-sm hover:bg-[#faf6ee] dark:hover:bg-[#2b2118] transition-colors"
              >
                <GoogleMark /> Continue with Google Accreditation
              </button>
            )}

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

          {/* Primary Form */}
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                      <select
                        required={!isLogin}
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className={`w-full px-3 py-3 guest-ledger-input rounded-xl text-xs font-semibold appearance-none cursor-pointer ${gender ? '' : 'text-gray-400'}`}
                      >
                        <option value="" disabled>Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non-binary">Non-binary</option>
                        <option value="prefer-not-to-say">Unspecified</option>
                      </select>
                    </div>

                    <div className="relative">
                      <select
                        required={!isLogin}
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value)}
                        className={`w-full px-3 py-3 guest-ledger-input rounded-xl text-xs font-semibold appearance-none cursor-pointer ${experienceLevel ? '' : 'text-gray-400'}`}
                      >
                        <option value="" disabled>Rank / Skill</option>
                        <option value="novice">Novice</option>
                        <option value="intermediate">Keeper</option>
                        <option value="expert">Master</option>
                      </select>
                    </div>

                    <div className="relative">
                      <select
                        required={!isLogin}
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        className={`w-full px-3 py-3 guest-ledger-input rounded-xl text-xs font-semibold appearance-none cursor-pointer ${environment ? '' : 'text-gray-400'}`}
                      >
                        <option value="" disabled>Sanctuary</option>
                        <option value="indoor">Indoor</option>
                        <option value="outdoor">Outdoor</option>
                        <option value="greenhouse">Glasshouse</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                onBlur={() => {
                  if (email && !isValidEmail(email)) setEmailError('Please enter a valid ledger email address.');
                }}
                placeholder="Dispatches Email Address"
                className={`w-full pl-11 pr-4 py-3.5 guest-ledger-input rounded-xl text-sm font-medium ${emailError ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              <AnimatePresence>
                {emailError && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1 pl-1">
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[24px] -translate-y-1/2 text-[#8c6e38] hover:text-[#2b2118] dark:hover:text-[#f4eee1] focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

              <AnimatePresence>
                {!isLogin && (passwordFocus || password.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3 p-3 rounded-lg bg-[#faf6ee] dark:bg-[#201812] border border-[#dcd2c0] dark:border-[#423120]"
                  >
                    <div className="flex gap-2 mb-2">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            strength.score >= level
                              ? strength.score === 1 ? 'bg-amber-600' : strength.score === 2 ? 'bg-amber-400' : 'bg-emerald-600'
                              : 'bg-gray-300 dark:bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[10px] font-mono font-bold text-gray-500">
                      <div className={`flex items-center gap-1 transition-colors ${strength.lengthValid ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                        {strength.lengthValid ? <CheckCircle2 size={11} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />} 8+ chars
                      </div>
                      <div className={`flex items-center gap-1 transition-colors ${strength.upperValid ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                        {strength.upperValid ? <CheckCircle2 size={11} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />} 1 uppercase
                      </div>
                      <div className={`flex items-center gap-1 transition-colors ${strength.numberValid ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                        {strength.numberValid ? <CheckCircle2 size={11} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />} 1 number
                      </div>
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
              {loading ? (
                <div className="animate-spin text-[#c5a059]">
                  <Feather size={18} />
                </div>
              ) : (
                <>
                  <span>{isLogin ? 'Affix Seal & Enter' : 'Register Naturalist Record'}</span>
                  <ArrowRight size={16} className="text-[#c5a059]" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between register & sign-in */}
          <div className="mt-6 text-center relative z-10">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail('');
                setPassword('');
                setName('');
                setEmailError('');
                setAuthError('');
              }}
              className="text-xs font-serif font-semibold text-[#8c6e38] hover:text-[#5a3d28] dark:hover:text-[#c5a059] transition-colors underline underline-offset-4 decoration-[#c5a059]/40"
            >
              {isLogin ? "No naturalist entry on file? Inscribe new record" : 'Already registered in the ledger? Open folio'}
            </button>
          </div>

          {/* Bottom Accreditation Badge */}
          <div className="mt-6 pt-4 border-t border-[#dcd2c0]/60 dark:border-[#3d2e20] flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#8c6e38]">
            <ShieldCheck size={13} className="text-[#2e4a34] dark:text-[#8c6e38]" />
            <span>{googleClientId ? 'Sanctuary OAuth & Local Keyring Active' : 'Offline Keyring Active • VITE_GOOGLE_CLIENT_ID Optional'}</span>
          </div>
        </motion.div>
      </PageWrapper>
    </div>
  );
}

