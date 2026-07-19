import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, ArrowRight, User, Mail, Lock, ShieldCheck } from 'lucide-react';
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

  const DEMO_EMAIL = 'tejasgaur94@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) return;
    
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
        className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/50 relative"
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--garden-sage)]/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-[var(--garden-earth)]/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-[var(--garden-cream)] rounded-2xl flex items-center justify-center text-[var(--garden-sage)] shadow-inner border border-white">
              <Leaf size={32} />
            </div>
          </div>

          <h2 className="text-3xl font-serif font-bold text-center text-[var(--garden-earth)] mb-2">
            {isLogin ? 'Welcome Back' : 'Join the Guardians'}
          </h2>
          <p className="text-center text-sm font-medium text-[var(--text-muted)] mb-8">
            {isLogin ? 'Sign in to monitor your sanctuary.' : 'Create an account to start your botanical journey.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  className="relative"
                >
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full pl-12 pr-4 py-4 bg-white/50 border border-[var(--garden-olive)]/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/30 focus:border-[var(--garden-sage)]/50 transition-all font-medium"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full pl-12 pr-4 py-4 bg-white/50 border border-[var(--garden-olive)]/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/30 focus:border-[var(--garden-sage)]/50 transition-all font-medium"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-12 pr-4 py-4 bg-white/50 border border-[var(--garden-olive)]/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--garden-sage)]/30 focus:border-[var(--garden-sage)]/50 transition-all font-medium"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full py-4 mt-6 text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
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
              }}
              className="text-sm font-bold text-[var(--garden-sage)] hover:text-[var(--garden-earth)] transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already a guardian? Sign in"}
            </button>
          </div>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
            <ShieldCheck size={14} />
            Secure Local Mock Auth
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
}
