import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, ArrowRight, User, Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/home/PageWrapper';
import { GameService } from '../services/gameService';

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validation States
  const [emailError, setEmailError] = useState('');
  const [passwordFocus, setPasswordFocus] = useState(false);

  const DEMO_EMAIL = 'tejasgaur94@gmail.com';

  // Validation Rules
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const pwdLength = password.length >= 8;
  const pwdUpper = /[A-Z]/.test(password);
  const pwdNumber = /[0-9]/.test(password);
  const pwdValid = pwdLength && pwdUpper && pwdNumber;
  const strengthScore = [pwdLength, pwdUpper, pwdNumber].filter(Boolean).length;

  const validateForm = () => {
    let valid = true;
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    } else {
      setEmailError('');
    }
    
    if (!isLogin && !pwdValid) {
      valid = false; // Will rely on visual strength meter for feedback
    }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) return;
    if (!validateForm()) return;
    
    setLoading(true);
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    
    // Derive a stable, unique userId from email
    const userId = btoa(email.toLowerCase().trim()).replace(/=/g, '');
    
    // Set auth state
    localStorage.setItem('botanical_guardian_auth_token', 'mock_token_' + Date.now());
    localStorage.setItem('botanical_guardian_userId', userId);
    localStorage.setItem('botanical_guardian_user_email', email.toLowerCase().trim());
    localStorage.setItem('botanical_guardian_user_name', name || email.split('@')[0]);
    localStorage.setItem('botanical_guardian_onboarded', '1');
    
    // Seed demo garden only for the demo account, and only on first login
    if (email.toLowerCase().trim() === DEMO_EMAIL) {
      const { seedDemoGarden } = await import('../demo/seedDemoGarden');
      const { db } = await import('../db/database');
      const existingPlants = await db.plants.where('userId').equals(userId).count();
      if (existingPlants === 0) {
        await seedDemoGarden('priya', userId);
      }
    } else {
      // Ensure a fresh empty profile exists for this user
      await GameService.ensureProfile(userId);
    }
    
    setLoading(false);
    navigate('/');
  };


  return (
    <PageWrapper className="min-h-[85vh] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[var(--garden-cream)]/30 to-[var(--garden-earth)]/5" />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="w-full max-w-md bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/60 relative overflow-hidden"
      >
        {/* Decorative Glows */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--garden-sage)]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--garden-earth)]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex justify-center mb-8">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 bg-gradient-to-br from-white to-[var(--garden-cream)] rounded-2xl flex items-center justify-center text-[var(--garden-sage)] shadow-xl shadow-[var(--garden-sage)]/10 border border-white"
            >
              <Leaf size={32} />
            </motion.div>
          </div>

          <h2 className="text-3xl font-serif font-bold text-center text-[var(--garden-earth)] mb-2">
            {isLogin ? 'Welcome Back' : 'Join the Guardians'}
          </h2>
          <p className="text-center text-sm font-medium text-gray-500 mb-8">
            {isLogin ? 'Sign in to monitor your sanctuary.' : 'Create an account to start your botanical journey.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  className="relative"
                >
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required={!isLogin}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full pl-12 pr-4 py-4 bg-white/80 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/50 focus:border-[var(--garden-sage)] transition-all font-bold shadow-sm"
                  />
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
                type={showPassword ? "text" : "password"}
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

              {/* Password Strength Meter (Only for Sign Up) */}
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
              }}
              className="text-sm font-bold text-[var(--garden-sage)] hover:text-[var(--garden-earth)] transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already a guardian? Sign in"}
            </button>
          </div>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
            <ShieldCheck size={14} />
            Secure Local Mock Auth
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
}
