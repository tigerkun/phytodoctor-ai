import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Home, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/home/PageWrapper';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <PageWrapper className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/leaves.png')] opacity-[0.03] pointer-events-none" />
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-moss/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-gold/5 rounded-full blur-2xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center max-w-lg mx-auto px-6"
      >
        <div className="relative inline-block mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="w-32 h-32 rounded-full border border-moss/20 flex items-center justify-center bg-bg-secondary shadow-inner"
          >
            <Compass size={48} className="text-moss/40" />
          </motion.div>
          <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-bg-primary border border-border-medium rounded-full flex items-center justify-center shadow-lg">
            <Leaf size={20} className="text-gold" />
          </div>
        </div>

        <h1 className="text-6xl font-serif font-black text-text-bark mb-4 tracking-tighter">
          404
        </h1>
        <h2 className="text-2xl font-bold text-text-stone mb-6">
          Lost in the Overgrowth
        </h2>
        <p className="text-text-muted mb-10 leading-relaxed max-w-sm mx-auto">
          The path you are looking for has been reclaimed by nature. Let's get you back to the sanctuary.
        </p>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-3 px-8 py-4 bg-moss text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:shadow-2xl hover:bg-moss/90 transition-all border border-white/10"
        >
          <Home size={18} /> Return to Hub
        </motion.button>
      </motion.div>
    </PageWrapper>
  );
}
