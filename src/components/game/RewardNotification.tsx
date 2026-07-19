/**
 * REWARD NOTIFICATION COMPONENT
 * Displays floating toast notifications for earned rewards
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Zap } from 'lucide-react';

interface RewardNotificationProps {
  xp: number;
  seeds: number;
  actionName: string;
  capExceeded?: boolean;
  onDismiss?: () => void;
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

  return (
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
      {notifications.map((notif, idx) => (
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
