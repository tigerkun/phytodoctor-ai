/**
 * REWARD NOTIFICATION COMPONENT
 * Displays floating toast notifications for earned rewards. Large rewards
 * get a tiered leaf-petal burst behind the toast — small stays quiet.
 */

import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Zap } from 'lucide-react';
import { useEcoMode } from '../../hooks/useEcoMode';

interface RewardNotificationProps {
  xp: number;
  seeds: number;
  actionName: string;
  capExceeded?: boolean;
  onDismiss?: () => void;
}

/** Tiered celebration: the burst scales with what was earned. Small rewards
 *  (under 50 seeds) stay a quiet toast — confetti on every +5 would cheapen
 *  the rare one. */
function celebrationTier(seeds: number): 0 | 1 | 2 {
  if (seeds >= 100) return 2;
  if (seeds >= 50) return 1;
  return 0;
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  rotate: number;
  scale: number;
  hue: 'moss' | 'gold' | 'sage';
}

const PARTICLE_COLORS: Record<Particle['hue'], string> = {
  moss: '#5A7D5A',
  gold: '#D4A843',
  sage: '#A8B5A0',
};

function CelebrationBurst({ tier }: { tier: 1 | 2 }) {
  const { shouldReduceParticles, particleCount } = useEcoMode();

  // Hooks run unconditionally; eco mode only mutes what they render.
  const petals = useMemo<Particle[]>(() => {
    const total = Math.round((tier === 2 ? 14 : 8) * particleCount);
    const hues: Particle['hue'][] = tier === 2 ? ['moss', 'gold', 'sage'] : ['gold'];
    return Array.from({ length: total }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 220,
      delay: Math.random() * 0.25,
      rotate: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.8,
      hue: hues[i % hues.length],
    }));
  }, [tier, particleCount]);

  if (shouldReduceParticles) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {petals.map(p => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0, y: 10, x: 0, rotate: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: -90 - Math.random() * 50,
            x: p.x,
            rotate: p.rotate,
            scale: p.scale,
          }}
          transition={{ duration: 1.4, delay: p.delay, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 block rounded-[60%_40%_60%_40%]"
          style={{ width: 7, height: 10, backgroundColor: PARTICLE_COLORS[p.hue] }}
        />
      ))}
    </div>
  );
}

export const RewardNotification: React.FC<RewardNotificationProps> = ({
  xp,
  seeds,
  actionName,
  capExceeded = false,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const tier = capExceeded ? 0 : celebrationTier(seeds);

  return (
    <div className="relative">
      {tier !== 0 && <CelebrationBurst tier={tier} />}
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ type: 'spring', damping: 15, stiffness: 150 }}
        className={`rounded-lg backdrop-blur-lg border px-4 py-3 max-w-sm pointer-events-none ${
          capExceeded
            ? 'bg-warning/20 border-warning/40'
            : 'bg-gradient-to-r from-moss/20 to-gold/20 border-moss/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {xp > 0 && (
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-1 font-mono font-bold text-accent-gold"
              >
                <Zap size={16} />
                <span>+{xp}</span>
              </motion.div>
            )}
            {seeds > 0 && (
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="flex items-center gap-1 font-mono font-bold text-accent-moss"
              >
                <Leaf size={16} />
                <span>+{seeds}</span>
              </motion.div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-cream">{actionName}</p>
            {capExceeded && (
              <p className="text-xs text-warning">Daily cap reached—come back tomorrow!</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * NOTIFICATION CONTAINER
 * Manages multiple notifications in a stack
 */

export interface RewardToast {
  id: string;
  xp: number;
  seeds: number;
  actionName: string;
  capExceeded?: boolean;
}

interface NotificationContainerProps {
  notifications: RewardToast[];
  onDismiss: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss
}) => {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      {notifications.map((notif) => (
        <motion.div key={notif.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <RewardNotification
            xp={notif.xp}
            seeds={notif.seeds}
            actionName={notif.actionName}
            capExceeded={notif.capExceeded}
            onDismiss={() => onDismiss(notif.id)}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default RewardNotification;
