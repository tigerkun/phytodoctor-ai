import { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Vibrate,
  Bell,
  Sprout,
  Type,
  Accessibility,
  CloudUpload as CloudUp,
  LogOut,
  ChevronLeft,
  Download,
  Share2,
  X,
  Sparkles,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTextSize, setTextSize, TEXT_SIZES, type TextSize } from '../utils/textSize';
import { getMotionPreference, setMotionPreference, MOTION_PREFERENCES, type MotionPreference } from '../utils/motionPreference';
import NotificationOptIn from '../components/NotificationOptIn';
import { NotificationService, type ReminderPrefs } from '../services/notificationService';
import { resetGardenProgress } from '../services/progressReset';
import { gardenerProfile, saveGardenerProfile, type GardenerProfile } from '../services/gardenDashboardService';
import { db } from '../db/database';
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

  // Reminder rhythm (time-of-day + check-in cadence) lives in the
  // notification service's own prefs store; the master switch above still
  // silences everything.
  const [reminderPrefs, setReminderPrefs] = useState(() => NotificationService.prefs());
  const [reminderBannerPermission, setReminderBannerPermission] = useState<'granted' | 'default' | 'denied'>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'default'),
  );

  const handleReminderPref = (patch: Partial<ReminderPrefs>) => {
    const next = { ...reminderPrefs, ...patch };
    setReminderPrefs(next);
    NotificationService.savePrefs(next);
  };

  const handleReminderPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setReminderBannerPermission(permission);
    if (permission === 'granted' && !reminderPrefs.localNotifications) {
      handleReminderPref({ localNotifications: true });
    }
    if (hapticEnabled) triggerHaptic('light');
  };

  // Custom reminder window — the engine replaces the named slot with these
  // hours when enabled (from===to falls back to the slot, so a misconfigured
  // pair can never silently mute everything).
  const customWindow = reminderPrefs.customWindow ?? { enabled: false, fromHour: 8, toHour: 20 };
  const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

  // Danger zone: the local garden reset (progressReset.ts). Deliberately
  // local-only — the modal copy says exactly what survives and what returns.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetGarden = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await resetGardenProgress(userId);
      if (hapticEnabled) triggerHaptic('medium');
      success('Garden reset — a fresh seedbed awaits. 🌱');
      // A reload is the clean slate: every in-memory cache (PlantService's
      // subscriber list, GameService's profile) rebuilds from the emptied
      // stores instead of stumbling over stale state.
      setTimeout(() => { window.location.href = '/'; }, 900);
    } catch (err) {
      console.error('[settings] garden reset failed:', err);
      error('Reset failed — nothing was cleared. Try again.');
      setResetting(false);
      setResetOpen(false);
    }
  };

  // Gardener profile + data export (Section 2.5).
  const [gardenerProfileData, setGardenerProfileData] = useState<GardenerProfile>(() => gardenerProfile());
  const [exporting, setExporting] = useState(false);

  const handleProfileChange = (patch: Partial<GardenerProfile>) => {
    const next = { ...gardenerProfileData, ...patch };
    setGardenerProfileData(next);
    saveGardenerProfile(next);
    if (hapticEnabled) triggerHaptic('light');
  };

  const handleExportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Every object store, one JSON file — the Keeper's data is theirs to
      // take. The photos store is excluded: raw Blobs do not serialize and
      // would bloat the file past usefulness; everything structured ships.
      const dump: Record<string, unknown[]> = {};
      for (const table of db.tables) {
        if (table.name === 'photos') continue;
        dump[table.name] = await table.toArray();
      }
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), ...dump }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phytodoctor-garden-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[settings] data export failed:', err);
    } finally {
      setExporting(false);
    }
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

              {/* Reminder rhythm — when and how often the reminder engine
                  nudges while the app is open. Toasts need no permission;
                  browser banners additionally ask once, on demand. */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#3c6b44]/15 flex items-center justify-center text-[#3c6b44] dark:text-[#79cb91] shrink-0">
                    <Bell size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                      Reminder Rhythm
                    </h3>
                    <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                      Watering, treatment &amp; check-in nudges while the garden is open
                    </p>
                  </div>
                </div>
                <div role="group" aria-label="Reminder timing" className="grid grid-cols-2 gap-2">
                  {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleReminderPref({ timeOfDay: slot })}
                      aria-pressed={reminderPrefs.timeOfDay === slot}
                      className={`min-h-11 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                        reminderPrefs.timeOfDay === slot
                          ? 'border-[#3d2a1c] bg-[#3d2a1c] text-[#f4e4c1] dark:border-[#c5a059] dark:bg-[#c5a059]/20 dark:text-[#f4e4c1]'
                          : 'border-[#d8ccb8] dark:border-[#423528] text-[#5f7161] dark:text-[#b6a087] hover:border-[#c5a059]/60'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                  <button
                    onClick={handleReminderPermission}
                    aria-pressed={reminderBannerPermission === 'granted'}
                    className={`min-h-11 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                      reminderBannerPermission === 'granted'
                        ? 'border-[#3c6b44] bg-[#3c6b44]/15 text-[#3c6b44] dark:text-[#79cb91]'
                        : 'border-[#d8ccb8] dark:border-[#423528] text-[#5f7161] dark:text-[#b6a087] hover:border-[#c5a059]/60'
                    }`}
                  >
                    {reminderBannerPermission === 'granted' ? 'Banners On' : 'Allow Banners'}
                  </button>
                </div>
                <div role="group" aria-label="Check-in frequency" className="grid grid-cols-3 gap-2 mt-2">
                  {(['daily', 'every-2-days', 'weekly'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => handleReminderPref({ frequency: freq })}
                      aria-pressed={reminderPrefs.frequency === freq}
                      className={`min-h-11 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                        reminderPrefs.frequency === freq
                          ? 'border-[#3d2a1c] bg-[#3d2a1c] text-[#f4e4c1] dark:border-[#c5a059] dark:bg-[#c5a059]/20 dark:text-[#f4e4c1]'
                          : 'border-[#d8ccb8] dark:border-[#423528] text-[#5f7161] dark:text-[#b6a087] hover:border-[#c5a059]/60'
                      }`}
                    >
                      {freq.replace('-', ' ')}
                    </button>
                  ))}
                </div>

                {/* Custom window — replaces the named slot when enabled.
                    Hours are 0–23; 22 → 6 wraps midnight. */}
                <div className="mt-3 pt-3 border-t border-[#d8ccb8] dark:border-[#423528]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-serif font-bold text-xs text-[#2e2117] dark:text-[#faebd7]">
                        Custom Reminder Window
                      </h4>
                      <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                        Nudges arrive only between the hours you set
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleReminderPref({
                          customWindow: {
                            enabled: !customWindow.enabled,
                            fromHour: customWindow.fromHour,
                            toHour: customWindow.toHour,
                          },
                        })
                      }
                      className={`passport-toggle-switch ${customWindow.enabled ? 'is-on' : ''}`}
                      aria-label="Toggle custom reminder window"
                    >
                      <span className="passport-toggle-nub" />
                    </button>
                  </div>
                  {customWindow.enabled && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {(['fromHour', 'toHour'] as const).map((field) => (
                        <label key={field} className="flex flex-col gap-1">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c7459] dark:text-[#bba388]">
                            {field === 'fromHour' ? 'From' : 'Until'}
                          </span>
                          <select
                            value={customWindow[field]}
                            onChange={(e) =>
                              handleReminderPref({
                                customWindow: { ...customWindow, [field]: Number(e.target.value) },
                              })
                            }
                            className="min-h-11 rounded-xl border border-[#d8ccb8] dark:border-[#423528] bg-[#faf4e6]/90 dark:bg-[#251e18]/90 px-3 text-xs font-mono font-bold text-[#3b2816] dark:text-[#ebd6b2]"
                            aria-label={field === 'fromHour' ? 'Reminders from hour' : 'Reminders until hour'}
                          >
                            {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                              <option key={h} value={h}>{hourLabel(h)}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2.5: GARDENER PROFILE & DATA */}
          <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
              <Sprout size={18} className="text-[#c5a059]" />
              <h2 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee]">
                Gardener Profile &amp; Data
              </h2>
            </div>

            <div className="space-y-4">
              {/* Plant preference profile — the lens care advice is tuned
                  through. Tailoring reads this via gardenDashboardService. */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528]">
                <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7] mb-1">
                  Your Plant Profile
                </h3>
                <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087] mb-3">
                  Shapes the advice the garden gives you
                </p>
                <div className="space-y-2">
                  {([
                    { key: 'light', label: 'Light', options: ['bright', 'moderate', 'low'] as const },
                    { key: 'humidity', label: 'Humidity I can provide', options: ['high', 'moderate', 'dry'] as const },
                    { key: 'space', label: 'Space', options: ['apartment', 'house', 'balcony'] as const },
                    { key: 'skill', label: 'Experience', options: ['beginner', 'intermediate', 'expert'] as const },
                  ] as const).map(row => (
                    <div key={row.key} className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#725e4c] dark:text-[#b8a695] w-40 shrink-0">
                        {row.label}
                      </span>
                      <div role="group" aria-label={row.label} className="flex flex-wrap gap-1.5 flex-1">
                        {row.options.map(opt => (
                          <button
                            key={opt}
                            onClick={() => handleProfileChange({ [row.key]: opt })}
                            aria-pressed={gardenerProfileData[row.key] === opt}
                            className={`min-h-9 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                              gardenerProfileData[row.key] === opt
                                ? 'border-[#3d2a1c] bg-[#3d2a1c] text-[#f4e4c1] dark:border-[#c5a059] dark:bg-[#c5a059]/20 dark:text-[#f4e4c1]'
                                : 'border-[#d8ccb8] dark:border-[#423528] text-[#5f7161] dark:text-[#b6a087] hover:border-[#c5a059]/60'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data & privacy — see it, take it, delete it. */}
              <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                    Your Data
                  </h3>
                  <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                    Export every record the garden holds, as JSON
                  </p>
                </div>
                <button
                  onClick={handleExportData}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#3c6b44] text-[#3c6b44] dark:text-[#79cb91] text-[10px] font-mono font-black uppercase tracking-wider hover:bg-[#3c6b44]/10 transition-colors shrink-0"
                >
                  {exporting ? 'Preparing…' : 'Export JSON'}
                </button>
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

            {/* Start fresh — the local garden reset. Deliberately local-only:
                cloud rows survive and the copy says so. */}
            <div className="p-4 bg-red-950/5 dark:bg-red-950/20 rounded-2xl border border-red-800/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-serif font-bold text-sm text-red-900 dark:text-red-300">
                  Start Fresh
                </h3>
                <p className="text-[10px] font-mono text-red-700/80 dark:text-red-400/80">
                  Clears this device&apos;s garden — plants, check-ins, cards, XP, seeds.
                  Cloud-synced plants return on the next sync; purchases and photos are kept.
                </p>
              </div>
              <button
                onClick={() => setResetOpen(true)}
                className="min-h-[44px] py-2.5 px-4 bg-red-900/15 hover:bg-red-900/25 border border-red-800/40 text-red-800 dark:text-red-300 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shrink-0"
              >
                <Trash2 size={14} />
                <span>Start Fresh…</span>
              </button>
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

      {/* Reset confirmation — step two of the two-step confirm. Naming what
          survives is the point: a reset that eats someone's Pro status or
          photos is a bug wearing a feature's clothes. */}
      {resetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm garden reset"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => !resetting && setResetOpen(false)} />
          <div className="relative passport-visa-folio rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="font-serif text-xl font-bold text-[#2e2117] dark:text-[#fbf7ee] mb-2">
              Reset this garden?
            </h3>
            <p className="text-xs text-[#5f7161] dark:text-[#b6a087] leading-relaxed mb-2">
              Cleared on this device: plants, check-ins, cards, XP, seed history,
              quiz stats, reminders. The fresh garden re-runs onboarding.
            </p>
            <p className="text-xs text-[#5f7161] dark:text-[#b6a087] leading-relaxed mb-2">
              Kept: your Pro status, purchased goods, and photos. Cloud-synced
              plants return on the next sync — delete them from the cloud first
              if you want them gone for good.
            </p>
            <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087] mb-5">
              Full account deletion remains a support contact — see Help.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setResetOpen(false)}
                disabled={resetting}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#d8ccb8] dark:border-[#423528] text-xs font-mono font-bold uppercase tracking-wider text-[#5f7161] dark:text-[#b6a087] hover:border-[#c5a059]/60 transition-colors disabled:opacity-50"
              >
                Keep my garden
              </button>
              <button
                type="button"
                onClick={handleResetGarden}
                disabled={resetting}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-900 hover:bg-red-800 text-[#f4eee1] text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {resetting ? 'Resetting…' : 'Reset everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
