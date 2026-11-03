import { useEffect } from 'react';
import { useToast } from './Toast';
import { NotificationService, type DueReminder } from '../services/notificationService';

const EMOJI: Record<DueReminder['kind'], string> = {
  watering: '💧',
  treatment: '🩺',
  checkin: '🌿',
};

/**
 * The heartbeat of the client-side reminder engine. Mounted once inside the
 * ToastProvider; every 15 minutes (and on tab focus, since that is when a
 * Keeper actually returns) it evaluates what is due and delivers through
 * the toast queue. The engine itself dedupes per plant per day, so a fast
 * ticker never spams.
 */
export default function ReminderRunner() {
  const { info, warning } = useToast();

  useEffect(() => {
    let running = false;
    const tick = async () => {
      // Background tabs tick too — that is exactly when a browser
      // notification (not a toast) is the right channel. The engine picks
      // the channel from document.hidden itself.
      if (running) return;
      running = true;
      try {
        await NotificationService.runOnce((reminder) => {
          const message = `${EMOJI[reminder.kind]} ${reminder.body}`;
          // Overdue watering is the one nudge that earns urgency.
          if (reminder.kind === 'watering') warning(message);
          else info(message);
        });
      } finally {
        running = false;
      }
    };
    const interval = window.setInterval(tick, 15 * 60_000);
    document.addEventListener('visibilitychange', tick);
    void tick();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
    // The toast callbacks are stable within the provider's lifetime; the
    // engine re-reads its own preferences on every tick.
  }, []);

  return null;
}
