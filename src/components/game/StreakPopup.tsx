import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Star } from 'lucide-react';
import { db } from '../../db/database';
import { GameService } from '../../services/gameService';

interface StreakPopupProps {
  isOpen: boolean;
  streak: number;
  seedsEarned: number;
  onClose: () => void;
}

export default function StreakPopup({ isOpen, streak, seedsEarned, onClose }: StreakPopupProps) {
  // 30-day check-in heatmap, computed from the check-ins that already exist
  // — no new table, no new writes. Oldest cell first, today last.
  const [dayCounts, setDayCounts] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    (async () => {
      try {
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        since.setDate(since.getDate() - 29);
        const userId = GameService.getUserId();
        const plants = await db.plants.where('userId').equals(userId).toArray();
        const counts = new Array<number>(30).fill(0);
        // Key-only reads over [plantId+timestamp]: check-in rows carry the
        // raw photo Blob, and a month of those materialised at once just to
        // count timestamps is exactly the memory spike the heatmap must not
        // cause on a low-battery phone.
        await Promise.all(plants.map(async (p) => {
          const keys = await db.checkins
            .where('[plantId+timestamp]')
            .between([p.id, since], [p.id, new Date(8640000000000000)])
            .keys();
          for (const key of keys) {
            const idx = Math.floor((new Date(key[1]).setHours(0, 0, 0, 0) - since.getTime()) / 86_400_000);
            if (idx >= 0 && idx < 30) counts[idx]++;
          }
        }));
        if (live) setDayCounts(counts);
      } catch {
        if (live) setDayCounts(new Array<number>(30).fill(0));
      }
    })();
    return () => { live = false; };
  }, [isOpen]);

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

              {/* The month at a glance: one square per day, greener the more
                  check-ins landed. Read-only — the popup auto-dismisses. */}
              {dayCounts.length > 0 && (
                <div aria-label="Check-ins over the last 30 days">
                  <p className="text-[9px] font-mono font-black uppercase tracking-widest text-garden-earth/40 mb-2">
                    Last 30 days · {dayCounts.reduce((a, b) => a + b, 0)} check-ins
                  </p>
                  <div className="grid grid-cols-10 gap-1 justify-items-center" role="img">
                    {dayCounts.map((count, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        title={
                          i === 29
                            ? 'Today'
                            : count > 0
                            ? `${count} check-in${count > 1 ? 's' : ''}`
                            : 'No check-ins'
                        }
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] ${
                          count === 0
                            ? 'bg-garden-earth/10'
                            : count === 1
                            ? 'bg-[#8FB58F]'
                            : count === 2
                            ? 'bg-[#5A7D5A]'
                            : 'bg-[#3D5A3D]'
                        } ${i === 29 ? 'ring-2 ring-orange-400' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
