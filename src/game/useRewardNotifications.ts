/**
 * REWARD NOTIFICATION MANAGER HOOK
 * Centralized toast notification management for all reward events
 */

import { useState, useCallback } from 'react';

export interface RewardToast {
  id: string;
  xp: number;
  seeds: number;
  actionName: string;
  capExceeded?: boolean;
}

export const useRewardNotifications = () => {
  const [notifications, setNotifications] = useState<RewardToast[]>([]);

  const showNotification = useCallback((xp: number, seeds: number, actionName: string, capExceeded = false) => {
    const id = crypto.randomUUID();
    const toast: RewardToast = { id, xp, seeds, actionName, capExceeded };
    setNotifications(prev => [...prev, toast]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);

    return id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, showNotification, dismissNotification };
};

export default useRewardNotifications;
