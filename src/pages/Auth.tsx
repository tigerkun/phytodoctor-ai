import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, ArrowRight, User, Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/home/PageWrapper';
import AmbientParticles from '../components/AmbientParticles';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import { GameService } from '../services/gameService';
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

function decodeJwt(credential: string) {
  const b64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return JSON.parse(atob(b64 + pad)) as { sub: string; email: string; name?: string };
}

function AuthLiveBackground() {
  const { theme } = useDayNightTheme();
  const isNight = theme === 'night';

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{
          background: isNight
            ? 'radial-gradient(ellipse at 20% 10%, #1a3a2a 0%, #0f1419 45%, #1a1816 100%)'
            : 'radial-gradient(ellipse at 70% 0%, #d4e8c4 0%, #e8f4e8 35%, #f5f0e8 100%)',
        }}
      />

      <motion.div
        className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl"
        style={{ background: isNight ? 'rgba(129,178,154,0.18)' : 'rgba(90,122,90,0.28)' }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-20 w-[32rem] h-[32rem] rounded-full blur-3xl"
        style={{ background: isNight ? 'rgba(212,175,55,0.12)' : 'rgba(212,117,90,0.22)' }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full blur-3xl"
        style={{ background: isNight ? 'rgba(129,178,154,0.1)' : 'rgba(255,229,180,0.45)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {['🌿', '🍃', '🌱', '🍂', '🌿', '🍃'].map((leaf, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl opacity-40"
          style={{ left: `${8 + i * 16}%`, top: '-8%' }}
          animate={{ y: ['0vh', '110vh'], rotate: [0, 180, 360], x: [0, i % 2 === 0 ? 30 : -24, 0] }}
          transition={{ duration: 12 + i * 2, repeat: Infinity, delay: i * 1.4, ease: 'linear' }}
        >
          {leaf}
        </motion.span>
      ))}

      <AmbientParticles theme={theme} />
    </div>
  );
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

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const pwdLength = password.length >= 8;
  const pwdUpper = /[A-Z]/.test(password);
  const pwdNumber = /[0-9]/.test(password);
  const pwdValid = pwdLength && pwdUpper && pwdNumber;
  const strengthScore = [pwdLength, pwdUpper, pwdNumber].filter(Boolean).length;

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
            const payload = decodeJwt(credential);
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
    const userId = btoa(email.toLowerCase().trim()).replace(/=/g, '');
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
    <>
      <AuthLiveBackground />
      <PageWrapper className="min-h-[85vh] flex items-center justify-center p-6 relative">

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="w-full max-w-md bg-white/75 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/60 relative z-10 overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--garden-sage)]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--garden-earth)]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex justify-center mb-8">
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="w-16 h-16 bg-gradient-to-br from-white to-[var(--garden-cream)] rounded-2xl flex items-center justify-center text-[var(--garden-sage)] shadow-xl shadow-[var(--garden-sage)]/10 border border-white"
            >
              <Leaf size={32} />
            </motion.div>
          </div>

          <h2 className="text-3xl font-serif font-bold text-center text-[var(--garden-earth)] mb-2">
            {isLogin ? 'Welcome Back' : 'Join the Guardians'}
          </h2>
          <p className="text-center text-sm font-medium text-gray-500 mb-6">
            {isLogin ? 'Sign in to monitor your sanctuary.' : 'Create an account to start your botanical journey.'}
          </p>

          <div ref={googleBtnRef} className="w-full min-h-[44px] flex justify-center [&>div]:w-full" />
          {!googleClientId && (
            <button
              type="button"
              onClick={() => setAuthError('Add VITE_GOOGLE_CLIENT_ID to .env (Google Cloud OAuth Web client).')}
              className="w-full mt-2 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-sm text-gray-700 flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50"
            >
              <GoogleMark /> Continue with Google
            </button>
          )}

          {authError && (
            <p className="text-xs text-red-500 font-bold mt-3 flex items-center gap-1 justify-center">
              <AlertCircle size={12} /> {authError}
            </p>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">or email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  className="relative"
                >
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full pl-12 pr-4 py-4 bg-white/80 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)] transition-all font-bold shadow-sm"
                    />
                  </div>

                  <div className="relative mt-4">
                    <select
                      required={!isLogin}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={`w-full px-4 py-4 bg-white/80 ${gender ? 'text-gray-900' : 'text-gray-400'} border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)] transition-all font-bold shadow-sm appearance-none`}
                    >
                      <option value="" disabled>Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non-binary">Non-binary</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="relative mt-4">
                    <select
                      required={!isLogin}
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className={`w-full px-4 py-4 bg-white/80 ${experienceLevel ? 'text-gray-900' : 'text-gray-400'} border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)] transition-all font-bold shadow-sm appearance-none`}
                    >
                      <option value="" disabled>Experience Level</option>
                      <option value="novice">Novice (Just starting)</option>
                      <option value="intermediate">Intermediate (Keep most alive)</option>
                      <option value="expert">Expert (Jungle owner)</option>
                    </select>
                  </div>

                  <div className="relative mt-4">
                    <select
                      required={!isLogin}
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      className={`w-full px-4 py-4 bg-white/80 ${environment ? 'text-gray-900' : 'text-gray-400'} border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)] transition-all font-bold shadow-sm appearance-none`}
                    >
                      <option value="" disabled>Primary Environment</option>
                      <option value="indoor">Indoor</option>
                      <option value="outdoor">Outdoor</option>
                      <option value="greenhouse">Greenhouse</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${emailError ? 'text-red-400' : 'text-gray-400'}`} size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                onBlur={() => {
                  if (email && !isValidEmail(email)) setEmailError('Please enter a valid email address.');
                }}
                placeholder="Email Address"
                className={`w-full pl-12 pr-4 py-4 bg-white/80 text-gray-900 placeholder-gray-400 border ${emailError ? 'border-red-300 focus:ring-red-500/50 focus:border-red-500' : 'border-gray-200 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)]'} rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold shadow-sm`}
              />
              <AnimatePresence>
                {emailError && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-red-500 font-bold mt-2 flex items-center gap-1 pl-2">
                    <AlertCircle size={12} /> {emailError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-[28px] -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                placeholder="Password"
                className="w-full pl-12 pr-12 py-4 bg-white/80 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)] transition-all font-bold shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[28px] -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>

              <AnimatePresence>
                {!isLogin && (passwordFocus || password.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="flex gap-2 mb-2">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            strengthScore >= level
                              ? strengthScore === 1 ? 'bg-red-400' : strengthScore === 2 ? 'bg-amber-400' : 'bg-emerald-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-[10px] font-bold text-gray-500 pl-1">
                      <div className={`flex items-center gap-1.5 transition-colors ${pwdLength ? 'text-emerald-600' : ''}`}>
                        {pwdLength ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300" />} 8+ characters
                      </div>
                      <div className={`flex items-center gap-1.5 transition-colors ${pwdUpper ? 'text-emerald-600' : ''}`}>
                        {pwdUpper ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300" />} 1 uppercase letter
                      </div>
                      <div className={`flex items-center gap-1.5 transition-colors ${pwdNumber ? 'text-emerald-600' : ''}`}>
                        {pwdNumber ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300" />} 1 number
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={(!loading && (isLogin || pwdValid)) ? { scale: 1.02 } : {}}
              whileTap={(!loading && (isLogin || pwdValid)) ? { scale: 0.98 } : {}}
              disabled={loading || (!isLogin && !pwdValid)}
              type="submit"
              className="w-full py-4 mt-8 text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, var(--garden-sage), #6B8E6B)', boxShadow: '0 10px 25px rgba(90, 122, 90, 0.3)' }}
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <Leaf size={20} />
                </motion.div>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={20} />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail('');
                setPassword('');
                setName('');
                setEmailError('');
                setAuthError('');
              }}
              className="text-sm font-bold text-[var(--garden-sage)] hover:text-[var(--garden-earth)] transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already a guardian? Sign in'}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
            <ShieldCheck size={14} />
            {googleClientId ? 'Google + email sign-in' : 'Email auth · Google needs VITE_GOOGLE_CLIENT_ID'}
          </div>
        </div>
      </motion.div>
      </PageWrapper>
    </>
  );
}
