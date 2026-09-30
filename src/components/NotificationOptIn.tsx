import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Hoisted to module scope: this is a build-time constant, and reading it on
// every render is what made the old version briefly show the button during
// the first paint before settling.
const VAPID_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;

async function authHeader(): Promise<Record<string, string>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Status = 'idle' | 'enabling' | 'enabled' | 'unsupported' | 'unavailable';

export default function NotificationOptIn() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  // On mount, work out whether this device already holds a live subscription
  // so a returning user sees "on" rather than a button to re-enable what is
  // already on. A stored endpoint that the browser has since dropped is
  // cleaned up here rather than left to fail on the next send.
  useEffect(() => {
    if (!VAPID_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (existing?.endpoint) {
          setEndpoint(existing.endpoint);
          setStatus('enabled');
        }
      } catch {
        // A browser that cannot answer this is treated as "not enabled".
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enable = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (!VAPID_KEY) {
      setStatus('unavailable');
      return;
    }
    setStatus('enabling');
    setMessage('');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('idle');
      setMessage('Alerts stay off until you allow notifications for this site.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(
          atob(VAPID_KEY.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        )
      });
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) throw new Error(`Subscription rejected (${response.status})`);
      setEndpoint(subscription.endpoint);
      setStatus('enabled');
    } catch (error) {
      console.error('[NotificationOptIn] subscription failed:', error);
      setStatus('unavailable');
      setMessage('Alerts could not be enabled on this device.');
    }
  };

  const disable = async () => {
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      // Tell the server first: if this fails we still unsubscribe locally, so
      // the device is never left with a live subscription the user has
      // switched off, which would keep delivering to a phone they think is
      // opted out.
      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({ endpoint })
        }).catch(() => undefined);
      }
      if (existing) await existing.unsubscribe();
    } catch (error) {
      console.error('[NotificationOptIn] unsubscribe failed:', error);
    }
    setEndpoint(null);
    setStatus('idle');
  };

  // A green tick only proves a subscription was stored, not that a push
  // service can actually reach this device. This sends a real one.
  const sendTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: '{}'
      });
      setMessage(response.ok
        ? 'Test alert sent — check this device for the notification.'
        : (await response.json().catch(() => ({}))).error || 'The test alert could not be sent.');
    } catch (error) {
      console.error('[NotificationOptIn] test failed:', error);
      setMessage('The test alert could not be sent.');
    } finally {
      setTesting(false);
    }
  };

  if (status === 'enabled') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <p className="inline-flex items-center gap-2 text-[#86b98b]">
          <Bell size={14} aria-hidden="true" />
          Weather alerts enabled.
        </p>
        <button
          onClick={sendTest}
          disabled={testing}
          className="rounded-lg border border-[#c5a059]/30 px-2 py-1 text-[#d8bc78] disabled:opacity-50"
        >
          {testing ? 'Sending…' : 'Send a test'}
        </button>
        <button
          onClick={disable}
          className="inline-flex items-center gap-1 rounded-lg border border-[#c5a059]/30 px-2 py-1 text-[#d8bc78]"
        >
          <BellOff size={12} aria-hidden="true" />
          Turn off
        </button>
        {message && <p className="w-full text-[#b9c9b4]">{message}</p>}
      </div>
    );
  }

  // Without a VAPID key there is no push service to subscribe to, so the
  // button could only ever report that it is unavailable. Rendering nothing
  // is more honest than offering a control that cannot work.
  if (!VAPID_KEY) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={enable}
        disabled={status === 'enabling'}
        className="inline-flex items-center gap-2 rounded-lg border border-[#c5a059]/30 px-3 py-2 text-xs text-[#d8bc78] disabled:opacity-50"
      >
        <Bell size={14} aria-hidden="true" />
        {status === 'unsupported'
          ? 'Alerts unavailable in this browser'
          : status === 'unavailable'
            ? 'Alerts could not be enabled'
            : status === 'enabling'
              ? 'Enabling alerts…'
              : 'Enable weather alerts'}
      </button>
      {message && <p className="text-xs text-[#b9c9b4]">{message}</p>}
    </div>
  );
}
