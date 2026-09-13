import { useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function NotificationOptIn() {
  const [status, setStatus] = useState<'idle' | 'enabled' | 'unsupported' | 'unavailable'>('idle');

  const enable = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    const key = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!key) {
      setStatus('unavailable');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(
          atob(key.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        )
      });
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) throw new Error('Push subscription was rejected.');
      setStatus('enabled');
    } catch (error) {
      console.error('[NotificationOptIn] subscription failed:', error);
      setStatus('unavailable');
    }
  };

  if (status === 'enabled') return <p className="text-xs text-[#86b98b]">Weather alerts enabled.</p>;
  return (
    <button onClick={enable} className="inline-flex items-center gap-2 rounded-lg border border-[#c5a059]/30 px-3 py-2 text-xs text-[#d8bc78]">
      <Bell size={14} aria-hidden="true" />
      {status === 'unsupported'
        ? 'Alerts unavailable in this browser'
        : status === 'unavailable'
          ? 'Alerts need app configuration'
          : 'Enable weather alerts'}
    </button>
  );
}
