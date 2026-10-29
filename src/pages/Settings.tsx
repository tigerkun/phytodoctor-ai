import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Volume2,
  VolumeX,
  Vibrate,
  Bell,
  Type,
  Accessibility,
  CloudUpload as CloudUp,
  LogOut,
  Sliders,
  ChevronLeft,
  Download,
  Share2,
  X,
  Sparkles,
  ShieldCheck,
  Smartphone,
  User
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { getTextSize, setTextSize, TEXT_SIZES, type TextSize } from '../utils/textSize';
import { getMotionPreference, setMotionPreference, MOTION_PREFERENCES, type MotionPreference } from '../utils/motionPreference';
import NotificationOptIn from '../components/NotificationOptIn';
import { useToast } from '../components/Toast';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { triggerHaptic, playAudio } from '../utils/hapticAudio';
import { GameService } from '../services/gameService';
import { MigrationService } from '../services/migrationService';
import { formatFolioSerial, parseSettingToggle } from '../services/profileUtils';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';

export default function Settings() {
  const navigate = useNavigate();
  const { transitionTo } = usePageTransition();
  const { success, error } = useToast();
  const { canInstall, standalone, isIOS, install } = useInstallPrompt();
  const userId = GameService.getUserId();
  const folioSerial = formatFolioSerial(userId);

  // Hardware and notification settings
  const [audioEnabled, setAudioEnabled] = useState(() => parseSettingToggle(localStorage.getItem('botanical_audio_enabled'), true));
  const [hapticEnabled, setHapticEnabled] = useState(() => parseSettingToggle(localStorage.getItem('botanical_haptic_enabled'), true));
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => parseSettingToggle(localStorage.getItem('botanical_notifications_enabled'), true));
  const [textSize, setTextSizeState] = useState<TextSize>(() => getTextSize());
  const [motionPreference, setMotionPreferenceState] = useState<MotionPreference>(() => getMotionPreference());

  // iOS install hint dismissal state
  const [dismissedInstall, setDismissedInstall] = useState(() => localStorage.getItem('phyto_install_hint_dismissed') === '1');
  const [syncing, setSyncing] = useState(false);

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    localStorage.setItem('botanical_audio_enabled', String(next));
    if (next) playAudio('chime');
  };

  const handleToggleHaptic = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    localStorage.setItem('botanical_haptic_enabled', String(next));
    if (next) triggerHaptic('heavy');
  };

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem('botanical_notifications_enabled', String(next));
    if (hapticEnabled) triggerHaptic('light');
  };

  const handleTextSize = (size: TextSize) => {
    setTextSizeState(size);
    setTextSize(size);
    if (hapticEnabled) triggerHaptic('light');
  };

  const handleMotionPreference = (preference: MotionPreference) => {
    setMotionPreferenceState(preference);
    setMotionPreference(preference);
    if (hapticEnabled) triggerHaptic('light');
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await GameService.flushSeedSyncOutbox();
      const result = await MigrationService.migratePlantsToCloud();
      if (result.success) {
        if (hapticEnabled) triggerHaptic('medium');
        if (audioEnabled) playAudio('success');
        success(
          result.count > 0
            ? `Backed up ${result.count} ${result.count === 1 ? 'plant' : 'plants'} to the Sanctuary cloud!`
            : 'Ledger synced — no plants on this device to back up yet.'
        );
      } else {
        error(`Sync failed: ${result.error}`);
      }
    } catch (err: any) {
      error(`Sync error: ${err?.message || 'Unknown error occurred'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Surrender your Guild Passport and sign out of the active terminal session?')) {
      const { supabase } = await import('../lib/supabase');
      if (supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem('botanical_guardian_auth_token');
      localStorage.removeItem('botanical_guardian_onboarded');
      localStorage.removeItem('botanical_guardian_userId');
      try {
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
      } catch {}
      navigate('/auth', { replace: true });
    }
  };

  return (
    <PageWrapper className="min-h-screen skin-identity">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* ── TOP HEADER ── */}
        <header className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#c5a059]/30">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => transitionTo('/profile', 'Passport')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#6a4e1e] dark:text-[#f4d38c] text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[#c5a059]/25 transition-colors"
              >
                <ChevronLeft size={12} />
                <span>Return to Passport</span>
              </button>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#2b2118] dark:text-[#fdf8ed]">
              Sanctuary Terminal Settings
            </h1>
            <p className="font-serif italic text-sm sm:text-base text-[#7c634c] dark:text-[#c4ae95] mt-1">
              Terminal Preferences, Hardware Calibration, Device Storage &amp; Credentials
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 bg-[#faf6ec] dark:bg-[#201a14] rounded-xl border border-[#d8cbba] dark:border-[#3f3223] text-center shadow-xs">
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c7459] dark:text-[#bba388]">Terminal Serial</p>
              <p className="font-mono text-xs font-bold text-[#3b2816] dark:text-[#ebd6b2]">{folioSerial}</p>
            </div>
          </div>
        </header>

        {/* ── SETTINGS PANELS ── */}
        <div className="space-y-8">
          {/* SECTION 1: SENSORY & FEEDBACK INSTRUMENTS */}
          <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
              <Sparkles size={18} className="text-[#c5a059]" />
              <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee]">
                Acoustics &amp; Tactile Feedback
              </h2>
            </div>

            <div className="space-y-4">
              {/* Audio Sound Effects */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#c5a059]/15 flex items-center justify-center text-[#c5a059]">
                    {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Acoustic Harmonic Resonance
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Apothecary water drops, chimes &amp; discovery fanfares
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleAudio}
                  className={`passport-toggle-switch ${audioEnabled ? 'is-on' : ''}`}
                  aria-label="Toggle Acoustic Audio"
                >
                  <span className="passport-toggle-nub" />
                </button>
              </div>

              {/* Haptic Feedback */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#3c6b44]/15 flex items-center justify-center text-[#3c6b44] dark:text-[#79cb91]">
                    <Vibrate size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Tactile Seal Impressions (Haptics)
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Mechanical vibrations on stamps, interactions &amp; seal presses
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleHaptic}
                  className={`passport-toggle-switch ${hapticEnabled ? 'is-on' : ''}`}
                  aria-label="Toggle Haptic Feedback"
                >
                  <span className="passport-toggle-nub" />
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 2: TELEGRAMS & NOTIFICATIONS */}
          <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
              <Bell size={18} className="text-[#c5a059]" />
              <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee]">
                Sanctuary Telegrams &amp; Alerts
              </h2>
            </div>

            <div className="space-y-4">
              {/* Dispatch Notifications */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/15 flex items-center justify-center text-[#1e3a5f] dark:text-[#82b5ed]">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Consular Daily Telegrams
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Expedition alerts, streak reminders &amp; diurnal care dispatches
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`passport-toggle-switch ${notificationsEnabled ? 'is-on' : ''}`}
                  aria-label="Toggle Consular Telegrams"
                >
                  <span className="passport-toggle-nub" />
                </button>
              </div>

              {/* Weather & Push Opt-in */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#c5a059]/15 flex items-center justify-center text-[#c5a059] shrink-0">
                    <Bell size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Weather Alert Delivery
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Push notifications to this terminal for watering &amp; microclimate shifts
                    </p>
                  </div>
                </div>
                <NotificationOptIn />
              </div>
            </div>
          </section>

          {/* SECTION 3: DISPLAY & ACCESSIBILITY */}
          <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
              <Type size={18} className="text-[#c5a059]" />
              <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee]">
                Display &amp; Ergonomics
              </h2>
            </div>

            <div className="space-y-4">
              {/* Text Size (Reading Glass) */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#3c6b44]/15 flex items-center justify-center text-[#3c6b44] dark:text-[#79cb91]">
                    <Type size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Reading Glass (Interface Text Scaling)
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Scales the whole typography system uniformly
                    </p>
                  </div>
                </div>
                <div role="group" aria-label="Text size" className="grid grid-cols-4 gap-2">
                  {TEXT_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => handleTextSize(size)}
                      aria-pressed={textSize === size}
                      className={`min-h-11 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                        textSize === size
                          ? 'border-[#3d2a1c] bg-[#3d2a1c] text-[#f4e4c1] dark:border-[#c5a059] dark:bg-[#c5a059]/20 dark:text-[#f4e4c1]'
                          : 'border-[#d8ccb8] text-[#8a7258] hover:border-[#c5a059] dark:border-[#423528] dark:text-[#b6a087] dark:hover:border-[#c5a059]'
                      }`}
                    >
                      {size === 'extra-large' ? 'Extra' : size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Garden Motion */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/15 flex items-center justify-center text-[#1e3a5f] dark:text-[#82b5ed]">
                    <Accessibility size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Garden Motion &amp; Animation
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Calms ambient particle drift and reveals — Auto respects system preferences
                    </p>
                  </div>
                </div>
                <div role="group" aria-label="Garden motion" className="grid grid-cols-3 gap-2">
                  {MOTION_PREFERENCES.map((preference) => (
                    <button
                      key={preference}
                      onClick={() => handleMotionPreference(preference)}
                      aria-pressed={motionPreference === preference}
                      className={`min-h-11 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                        motionPreference === preference
                          ? 'border-[#3d2a1c] bg-[#3d2a1c] text-[#f4e4c1] dark:border-[#c5a059] dark:bg-[#c5a059]/20 dark:text-[#f4e4c1]'
                          : 'border-[#d8ccb8] text-[#8a7258] hover:border-[#c5a059] dark:border-[#423528] dark:text-[#b6a087] dark:hover:border-[#c5a059]'
                      }`}
                    >
                      {preference === 'auto' ? 'Auto' : preference === 'reduced' ? 'Reduced' : 'Full'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: DEVICE & CLOUD STORAGE */}
          <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
              <Smartphone size={18} className="text-[#c5a059]" />
              <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee]">
                Device Terminal &amp; Vault Sync
              </h2>
            </div>

            <div className="space-y-4">
              {/* Install PWA Prompt */}
              {!standalone && !dismissedInstall && (canInstall || isIOS) && (
                <div className="p-4 rounded-2xl border border-[#c5a059]/50 bg-[#c5a059]/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-[#c5a059]/25 text-[#4d3714] dark:text-[#faebd7] flex items-center justify-center shrink-0">
                      {canInstall ? <Download size={18} /> : <Share2 size={18} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-bark">Take the garden with you</p>
                      <p className="text-xs text-text-stone leading-snug">
                        {canInstall
                          ? 'Install PhytoDoctor — full screen, home-screen icon, works offline.'
                          : isIOS
                            ? 'In Safari: tap Share, then "Add to Home Screen".'
                            : null}
                      </p>
                    </div>
                  </div>
                  {canInstall ? (
                    <button
                      onClick={async () => {
                        if (hapticEnabled) triggerHaptic('light');
                        const outcome = await install();
                        if (outcome === 'accepted') success('PhytoDoctor installed');
                      }}
                      className="shrink-0 min-h-[44px] px-4 rounded-xl bg-[#2e4a34] hover:bg-[#395c41] text-[#f4eee1] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center"
                    >
                      Install
                    </button>
                  ) : (
                    <button
                      onClick={() => { setDismissedInstall(true); localStorage.setItem('phyto_install_hint_dismissed', '1'); }}
                      aria-label="Dismiss install hint"
                      className="shrink-0 w-11 h-11 flex items-center justify-center text-text-stone hover:text-text-bark"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Cloud Sync Button */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                    Vault Synchronization
                  </h3>
                  <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                    Uplink local IndexedDB specimen records and seed ledger to Supabase cloud
                  </p>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="min-h-[44px] py-2.5 px-4 bg-[#2e4a34] hover:bg-[#395c41] text-[#f4eee1] rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shrink-0 disabled:opacity-50"
                >
                  <CloudUp size={14} />
                  <span>{syncing ? 'Uplinking…' : 'Sync Local Ledger'}</span>
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 5: ACCOUNT & CREDENTIALS */}
          <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
              <LogOut size={18} className="text-[#8b2500] dark:text-[#f48a60]" />
              <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee]">
                Sanctuary Credentials &amp; Session
              </h2>
            </div>

            <div className="p-4 bg-red-950/5 dark:bg-red-950/20 rounded-2xl border border-red-800/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-sm text-red-900 dark:text-red-300">
                  Surrender Guild Passport
                </h3>
                <p className="text-[10px] font-mono text-red-700/80 dark:text-red-400/80">
                  Clears local session tokens and signs out of this botanical workstation
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="min-h-[44px] py-2.5 px-4 bg-red-900/15 hover:bg-red-900/25 border border-red-800/40 text-red-800 dark:text-red-300 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shrink-0"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  );
}
