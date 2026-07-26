import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Star } from 'lucide-react';

interface StreakPopupProps {
  isOpen: boolean;
  streak: number;
  seedsEarned: number;
  onClose: () => void;
}

export default function StreakPopup({ isOpen, streak, seedsEarned, onClose }: StreakPopupProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: -50, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl flex flex-col items-center text-center max-w-sm w-full relative overflow-hidden"
          >
            {/* Background Orbs */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(251,146,60,0.2)_360deg)] pointer-events-none"
            />
            
            <div className="relative z-10 space-y-6">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 15, -15, 0] }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 mx-auto bg-orange-100 text-orange-500 rounded-full flex items-center justify-center shadow-inner"
              >
                <Zap size={48} className="fill-orange-500" />
              </motion.div>
              
              <div>
                <h2 className="text-3xl font-black text-garden-earth mb-2">Streak Continued!</h2>
                <p className="text-garden-earth/60 font-medium">You've checked in for <span className="text-orange-500 font-bold">{streak} days</span> in a row!</p>
              </div>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-6 py-3 rounded-2xl font-bold"
              >
                <Star size={20} className="fill-yellow-500 text-yellow-500" />
                +{seedsEarned} Seeds Earned!
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
