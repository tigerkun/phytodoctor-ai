import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Shield,
  Award,
  Edit2,
  Check,
  Crown,
  Star,
  TrendingUp,
  Calendar,
  Zap,
  LogOut,
  Flame,
  Volume2,
  VolumeX,
  Vibrate,
  Bell,
  Sparkles,
  BookOpen,
  Clock,
  ShieldCheck,
  Compass,
  Feather,
  ArrowUpRight,
  RefreshCw,
  Coins,
  CloudUpload as CloudUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, type SeedTransaction } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameService } from '../services/gameService';
import { RewardService } from '../services/rewardService';
import { MigrationService } from '../services/migrationService';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';
import { triggerHaptic, playAudio } from '../utils/hapticAudio';
import {
  evaluateProfileBadges,
  calculateLevelProgression,
  getStreakMultiplier,
  formatFolioSerial,
  parseSettingToggle
} from '../services/profileUtils';

export default function Profile() {
  const navigate = useNavigate();
  const { transitionTo } = usePageTransition();
  const userId = GameService.getUserId();

  // Ensure user profile, level progress, and streak records exist
  useEffect(() => {
    GameService.ensureProfile(userId);
    RewardService.ensureLevelProgress(userId);
    RewardService.ensureStreakRecord(userId);
  }, [userId]);

  // Reactive DB queries (pure reads with explicit userId deps)
  const profile = useLiveQuery(() => db.userProfile.get(userId), [userId]);
  const cards = useLiveQuery(() => db.cards.where('userId').equals(userId).toArray(), [userId]) || [];
  const seedTransactions = useLiveQuery(() => 
    db.seedTransactions.where('userId').equals(userId).reverse().sortBy('createdAt'),
    [userId]
  ) || [];
  const levelProgress = useLiveQuery(() => db.levelProgress.get(userId), [userId]);
  const streakRecord = useLiveQuery(() => db.streakRecords.get(userId), [userId]);

  // Plants and Check-ins for consular care visa inspection ledger
  const userPlants = useLiveQuery(() => db.plants.where('userId').equals(userId).toArray(), [userId]) || [];
  const plantMap = useMemo(() => new Map(userPlants.map(p => [p.id, p])), [userPlants]);
  const plantIds = useMemo(() => userPlants.map(p => p.id), [userPlants]);
  const checkins = useLiveQuery(async () => {
    if (plantIds.length === 0) return [];
    return await db.checkins.where('plantId').anyOf(plantIds).reverse().sortBy('timestamp');
  }, [plantIds]) || [];

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [equippedTitle, setEquippedTitle] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'novice' | 'intermediate' | 'expert'>('novice');
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor' | 'greenhouse' | 'mixed'>('indoor');
  const [gender, setGender] = useState('');
  const [imgError, setImgError] = useState(false);

  // Folio 3 dual ledger view: Seed ledger vs Check-in visas
  const [ledgerTab, setLedgerTab] = useState<'seeds' | 'checkins'>('seeds');

  // Hardware and notification settings
  const [audioEnabled, setAudioEnabled] = useState(() => parseSettingToggle(localStorage.getItem('botanical_audio_enabled'), true));
  const [hapticEnabled, setHapticEnabled] = useState(() => parseSettingToggle(localStorage.getItem('botanical_haptic_enabled'), true));
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => parseSettingToggle(localStorage.getItem('botanical_notifications_enabled'), true));

  // Upgrading feedback
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || 'Guild Master');
      setAvatarUrl(profile.avatarUrl || '');
      setImgError(false);
      setEquippedTitle(profile.equippedTitle || '');
      setExperienceLevel(profile.experienceLevel || 'intermediate');
      setEnvironment(profile.environment || 'greenhouse');
      setGender(profile.gender || 'Botanical Guardian');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    await db.userProfile.update(userId, {
      username: username.trim() || 'Guild Master',
      avatarUrl: avatarUrl.trim(),
      equippedTitle: equippedTitle.trim() || null,
      experienceLevel,
      environment,
      gender: gender.trim() || undefined
    });
    setIsEditing(false);
    if (hapticEnabled) triggerHaptic('medium');
    if (audioEnabled) playAudio('success');
  };

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

  const handleUpgradeToPro = async () => {
    if (profile?.tier === 'pro') return;
    setIsUpgrading(true);
    try {
      await GameService.upgradeToPro(userId);
      if (hapticEnabled) triggerHaptic('heavy');
      if (audioEnabled) playAudio('success');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await MigrationService.migratePlantsToCloud();
      if (result.success) {
        if (hapticEnabled) triggerHaptic('medium');
        if (audioEnabled) playAudio('success');
        alert(`Successfully backed up ${result.count} plants to the Sanctuary cloud!`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Sync error: ${err?.message || 'Unknown error occurred'}`);
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
      navigate('/auth', { replace: true });
    }
  };

  const folioSerial = useMemo(() => formatFolioSerial(userId), [userId]);

  const mythicCount = cards.filter(c => c.rarity === 'mythic').length;
  const currentStreak = streakRecord?.currentStreak ?? profile?.currentStreak ?? 0;
  const longestStreak = streakRecord?.longestStreak ?? profile?.longestStreak ?? 0;
  const effectiveXP = levelProgress?.totalXP ?? profile?.totalXP ?? 0;

  const progression = useMemo(() => calculateLevelProgression(effectiveXP), [effectiveXP]);
  const streakMultiplier = useMemo(() => getStreakMultiplier(currentStreak), [currentStreak]);

  const badges = useMemo(() => evaluateProfileBadges({
    currentStreak,
    cardCount: cards.length,
    tier: profile?.tier || 'free',
    totalXP: effectiveXP,
    mythicCount
  }), [currentStreak, cards.length, profile?.tier, effectiveXP, mythicCount]);

  if (!profile) {
    return (
      <PageWrapper className="min-h-screen skin-identity flex items-center justify-center">
        <div className="text-center p-8 bg-[#faf6ec] rounded-2xl border-2 border-[#d8ccb8] shadow-xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="inline-block text-3xl mb-3"
          >
            🌿
          </motion.div>
          <p className="font-serif text-lg font-bold text-[#3a2818]">Unsealing Guild Dossier & Field Folio…</p>
          <p className="font-mono text-xs uppercase tracking-widest text-[#8a7258] mt-1">Societas Botanica District IV</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="min-h-screen skin-identity">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* ── TOP CONSULAR REGISTRATION BANNER ── */}
        <header className="mb-8 sm:mb-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#c5a059]/30">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#6a4e1e] dark:text-[#f4d38c] text-[10px] font-mono font-bold uppercase tracking-widest mb-2">
              <Compass size={12} className="text-[#c5a059]" />
              <span>Societas Botanica Regalis · Folio Civitatis</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#2b2118] dark:text-[#fdf8ed]">
              The Guild Master&apos;s Field Passport
            </h1>
            <p className="font-serif italic text-sm sm:text-base text-[#7c634c] dark:text-[#c4ae95] mt-1">
              Official Fellowship Ledger, Consular Visa Registrations & Sanctuary Accreditation
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-3">
            <div className="px-3 py-2 bg-[#faf6ec] dark:bg-[#201a14] rounded-xl border border-[#d8cbba] dark:border-[#3f3223] text-center shadow-xs">
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c7459] dark:text-[#bba388]">Official Folio</p>
              <p className="font-mono text-xs font-bold text-[#3b2816] dark:text-[#ebd6b2]">{folioSerial}</p>
            </div>
          </div>
        </header>

        {/* ── MAIN TWO-COLUMN PASSPORT LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

          {/* ════════ LEFT COLUMN: THE GUILD PASSPORT BOOKLET COVER (5 COLS) ════════ */}
          <div className="lg:col-span-5 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="passport-buckram-booklet rounded-3xl p-6 sm:p-8 text-[#faecd0] overflow-hidden"
            >
              {/* Stitched Spine & Left Tape */}
              <div className="absolute left-0 top-0 bottom-0 w-3 passport-spine-tape" />

              {/* Inner Stitched Border */}
              <div className="passport-stitch-border rounded-2xl p-5 sm:p-6 relative flex flex-col items-center text-center">
                
                {/* Debossed Gold Foil Passport Header */}
                <div className="mb-6 space-y-1">
                  <div className="flex items-center justify-center gap-2 text-[#c5a059]">
                    <Sparkles size={14} />
                    <span className="text-[9px] font-mono uppercase tracking-[0.25em] gold-foil-debossed">
                      Herbarium Societas Botanica
                    </span>
                    <Sparkles size={14} />
                  </div>
                  <h2 className="font-serif text-lg font-bold gold-foil-debossed tracking-wider">
                    FIELD PASSPORT & CREDENTIALS
                  </h2>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-[#a8bfab]/70">
                    DISTRICT IV · SANCTUARY MASTER
                  </p>
                </div>

                {/* Tintype Oval Brass Member Locket */}
                <div className="my-4 relative">
                  <div className="tintype-locket">
                    <div className="tintype-hinge" />
                    <div className="tintype-inner">
                      {avatarUrl && !imgError ? (
                        <img
                          src={avatarUrl}
                          alt="Guild Master Portrait"
                          className="w-full h-full object-cover"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-[#324535] via-[#212f24] to-[#141d16] text-[#faecd0] select-none">
                          <div className="w-14 h-14 rounded-full border border-[#c5a059]/40 flex items-center justify-center bg-[#17241b] shadow-inner mb-0.5">
                            <span className="font-serif font-black text-xl tracking-wider text-[#dfbe76]">
                              {(username || profile.username || 'GM')
                                .split(' ')
                                .map((w: string) => w[0])
                                .filter(Boolean)
                                .slice(0, 2)
                                .join('')
                                .toUpperCase() || 'GM'}
                            </span>
                          </div>
                          <span className="text-[7px] font-mono uppercase tracking-[0.2em] text-[#c5a059]/80">SANCTUARY MASTER</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Brass Key Edit Button */}
                  <button
                    onClick={() => {
                      setIsEditing(!isEditing);
                      if (hapticEnabled) triggerHaptic('light');
                    }}
                    title="Engrave Identity"
                    className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-radial from-[#faecd0] to-[#b89242] border-2 border-[#5c4013] text-[#3b2408] flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>

                {/* Tilted Consular Visa Ink Stamp */}
                <div className="consular-visa-stamp -rotate-6 my-4 w-52 py-2 px-3 border-dashed">
                  <span className="text-[8px] tracking-[0.2em]">★ ROYAL FELLOWSHIP ACCREDITATION ★</span>
                  <span className="text-[11px] font-black tracking-wider my-0.5">SANCTUARY MASTER</span>
                  <span className="text-[8px] font-mono tracking-widest text-[#8b2500]/80 dark:text-[#ff7d58]/80">
                    REG. {folioSerial}
                  </span>
                </div>

                {/* Identity Form or Display */}
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div
                      key="edit-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full space-y-3 mt-4 text-left"
                    >
                      <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[#d8c59d] mb-1">
                          Naturalist Call Sign
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3 py-2 bg-[#121c15] text-[#f7e8ce] font-serif font-bold text-sm rounded-lg border border-[#c5a059]/40 focus:outline-none focus:border-[#e2bf65]"
                          placeholder="e.g. Master Linnaeus"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[#d8c59d] mb-1">
                          Tintype Portrait URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-[#121c15] text-[#f7e8ce] font-mono text-xs rounded-lg border border-[#c5a059]/40 focus:outline-none focus:border-[#e2bf65]"
                          placeholder="https://..."
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[#d8c59d] mb-1">
                          Equipped Title / Honorific
                        </label>
                        <input
                          type="text"
                          value={equippedTitle}
                          onChange={(e) => setEquippedTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-[#121c15] text-[#f7e8ce] font-serif text-xs rounded-lg border border-[#c5a059]/40 focus:outline-none focus:border-[#e2bf65]"
                          placeholder="e.g. The Canopy Whisperer"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-mono uppercase tracking-widest text-[#d8c59d] mb-1">
                            Experience Tier
                          </label>
                          <select
                            value={experienceLevel}
                            onChange={(e) => setExperienceLevel(e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-[#121c15] text-[#f7e8ce] text-xs rounded-lg border border-[#c5a059]/40 focus:outline-none"
                          >
                            <option value="novice">Novice</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="expert">Expert</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[8px] font-mono uppercase tracking-widest text-[#d8c59d] mb-1">
                            Sanctuary Habitat
                          </label>
                          <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-[#121c15] text-[#f7e8ce] text-xs rounded-lg border border-[#c5a059]/40 focus:outline-none"
                          >
                            <option value="greenhouse">Greenhouse</option>
                            <option value="indoor">Indoor</option>
                            <option value="outdoor">Outdoor</option>
                            <option value="mixed">Mixed Terrain</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleUpdateProfile}
                          className="flex-1 py-2.5 bg-radial from-[#e0be6c] to-[#9e7a2b] text-[#2c1c08] rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 active:scale-98 transition-all"
                        >
                          <Check size={14} /> Affix Guild Seal
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-2.5 bg-[#17241a] text-[#c9b79b] rounded-xl font-mono text-xs uppercase tracking-wider hover:bg-[#1e2f23]"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="identity-info"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 space-y-1 w-full"
                    >
                      <h3 className="font-serif text-2xl sm:text-3xl font-black text-[#faf1de] tracking-tight">
                        {profile.username || 'Guild Master'}
                      </h3>
                      <p className="font-serif italic text-xs sm:text-sm text-[#d1b88a]">
                        {profile.equippedTitle ? `The ${profile.equippedTitle}` : 'Fellowship Scholar of Rare Flora'}
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#faecd0] text-[10px] font-mono uppercase tracking-wider">
                          Rank: {progression.title} (Lvl {progression.currentLevel})
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Engraved Copper Credentials Plinth */}
                <div className="w-full mt-6 copper-plate rounded-xl p-4 text-center">
                  <div className="absolute top-2 left-2 copper-rivet" />
                  <div className="absolute top-2 right-2 copper-rivet" />
                  <div className="absolute bottom-2 left-2 copper-rivet" />
                  <div className="absolute bottom-2 right-2 copper-rivet" />

                  <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-[#451e0d] dark:text-[#ffd6ad]">
                      Credentials Grade
                    </span>
                    {profile.tier === 'pro' ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-black uppercase text-[#451e0d] dark:text-[#ffd6ad]">
                        <Crown size={12} /> PRO COMMISSION
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono font-bold uppercase text-[#451e0d] dark:text-[#ffd6ad]">
                        APPRENTICE (STANDARD)
                      </span>
                    )}
                  </div>

                  <p className="font-serif font-black text-base sm:text-lg text-[#2d1105] dark:text-[#fff2df] tracking-wide">
                    {profile.tier === 'pro' ? 'MASTER BOTANIST COMMISSION' : 'FELLOWSHIP CANDIDATE'}
                  </p>

                  {profile.tier !== 'pro' && (
                    <button
                      onClick={handleUpgradeToPro}
                      disabled={isUpgrading}
                      className="mt-3 w-full py-2 bg-[#2d1407] hover:bg-[#421d0a] text-[#faecd0] text-[10px] font-mono font-black uppercase tracking-widest rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-98"
                    >
                      {isUpgrading ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Engraving Plate…
                        </>
                      ) : (
                        <>
                          <Crown size={12} /> Upgrade Commission (+1,000 Seeds)
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
            </motion.div>

            {/* 4 Consular Circular Franking Seals */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <StatFrankStamp
                label="Seed Treasury"
                value={profile.seeds.toLocaleString()}
                sub="Botanical Grains"
                icon={<Coins size={14} className="text-[#c5a059]" />}
              />
              <StatFrankStamp
                label="Living Herbarium"
                value={cards.length.toString()}
                sub="Catalogued Specimen"
                icon={<BookOpen size={14} className="text-[#3c6b44]" />}
              />
              <StatFrankStamp
                label="Mythic Species"
                value={mythicCount.toString()}
                sub="Archival Rarities"
                icon={<Award size={14} className="text-[#8c4391]" />}
              />
              <StatFrankStamp
                label="Vigilance Streak"
                value={`${currentStreak}d`}
                sub="Continuous Duty"
                icon={<Flame size={14} className="text-[#b85323]" />}
              />
            </div>

            {/* Consular Dossier Logistics Card */}
            <div className="passport-visa-folio rounded-2xl p-6 relative">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#c5a059]/25">
                <Feather size={16} className="text-[#c5a059]" />
                <h3 className="font-serif font-bold text-base text-[#2b2118] dark:text-[#f7eee1]">
                  Sanctuary Dossier Logistics
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <LogisticsRow label="Naturalist Grade" value={profile.experienceLevel ? profile.experienceLevel.toUpperCase() : 'NOVICE'} />
                <LogisticsRow label="Registered Zone" value={profile.environment ? profile.environment.toUpperCase() : 'MIXED TERRAIN'} />
                <LogisticsRow label="Naturalist Designation" value={profile.gender || 'BOTANICAL GUARDIAN'} />
                <LogisticsRow label="Sanctuary Status" value={profile.tier === 'pro' ? 'ROYAL CHARTER ACCREDITED' : 'ACTIVE APPRENTICE'} />
              </div>
            </div>
          </div>

          {/* ════════ RIGHT COLUMN: VISA PAGES & FELLOWSHIP FOLIOS (7 COLS) ════════ */}
          <div className="lg:col-span-7 space-y-8">

            {/* ── FOLIO 1: LEVEL ACCREDITATION & CANOPY VIGILANCE ── */}
            <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-3 border-b border-[#c5a059]/30">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#8c7355] dark:text-[#baa07c]">
                    Folio Section I · Visa Stamp
                  </span>
                  <h3 className="font-serif text-2xl font-black text-[#2e2117] dark:text-[#fbf7ee]">
                    Mastery & Canopy Vigilance
                  </h3>
                </div>
                <div className="px-3 py-1 bg-[#1e3a5f]/10 dark:bg-[#1e3a5f]/30 border border-[#1e3a5f]/40 rounded-full text-[9px] font-mono font-bold uppercase text-[#1e3a5f] dark:text-[#7bb0e7] tracking-wider self-start sm:self-auto">
                  District IV Accreditation
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Level Mastery Card */}
                <div className="p-5 rounded-2xl bg-[#faf4e6]/90 dark:bg-[#251e18]/90 border border-[#d8ccb8] dark:border-[#423528] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c7459] dark:text-[#baa489]">
                        Level {progression.currentLevel}
                      </span>
                      <h4 className="font-serif text-xl font-black text-[#2e2117] dark:text-[#faebd7]">
                        {progression.title}
                      </h4>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xl font-black text-[#3c6b44] dark:text-[#79cb91]">
                        {progression.totalXP}
                      </span>
                      <span className="text-[9px] block uppercase text-[#8c7459] dark:text-[#baa489]">Total XP</span>
                    </div>
                  </div>

                  {/* XP Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-[#7c664e] dark:text-[#bda488]">
                      <span>{progression.isMaxLevel ? 'Highest Fellowship Order' : `Progress to ${progression.nextTitle}`}</span>
                      <span>{progression.xpProgress}%</span>
                    </div>
                    <div className="h-2.5 bg-[#e0d4c1] dark:bg-[#382d22] rounded-full overflow-hidden p-0.5 border border-[#c4b39b]/40">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#3c6b44] via-[#c5a059] to-[#d4af37] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progression.xpProgress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-[9px] font-mono text-[#8c765f] dark:text-[#a8927a] text-right">
                      {progression.isMaxLevel ? 'Max Rank Attained · Guild Master Prestige' : `${progression.xpToNext} XP remaining to Next Level`}
                    </p>
                  </div>

                  {/* Next Unlock Note */}
                  <div className="p-2.5 bg-[#efe8d8] dark:bg-[#1f1914] rounded-lg border border-[#d2c4ae] dark:border-[#382c20] flex items-center gap-2 text-[10px] font-mono text-[#57432f] dark:text-[#d3bc9f]">
                    <Sparkles size={13} className="text-[#c5a059] shrink-0" />
                    <span>{progression.isMaxLevel ? 'Status:' : 'Next Unlock:'} <strong>{progression.nextUnlock}</strong></span>
                  </div>
                </div>

                {/* Canopy Vigilance Franking Stamp */}
                <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[#faf4e6]/90 dark:bg-[#251e18]/90 border border-[#d8ccb8] dark:border-[#423528] text-center relative overflow-hidden">
                  <div className="consular-visa-stamp forest-stamp w-40 h-40 p-3 rounded-full flex flex-col items-center justify-center">
                    <span className="text-[8px] tracking-widest font-mono">SANCTUARY PATROL</span>
                    <div className="flex items-center justify-center gap-1 my-1">
                      <Flame size={20} className="text-[#b85323]" />
                      <span className="text-3xl font-serif font-black">{currentStreak}</span>
                      <span className="text-[10px] font-mono uppercase">DAYS</span>
                    </div>
                    <span className="text-[9px] font-black tracking-wider bg-[#244b2f]/10 dark:bg-[#79cb91]/20 px-2 py-0.5 rounded">
                      {streakMultiplier}x HARVEST BONUS
                    </span>
                    <span className="text-[7px] tracking-widest text-[#244b2f]/70 dark:text-[#79cb91]/70 mt-1">
                      OFFICIAL FRANK · DISTRICT IV
                    </span>
                  </div>

                  <div className="w-full mt-3 pt-3 border-t border-[#d8ccb8] dark:border-[#3f3223] flex items-center justify-between text-[10px] font-mono text-[#6e5843] dark:text-[#baa489]">
                    <span>Personal Best: <strong>{longestStreak} Days</strong></span>
                    {streakRecord && streakRecord.freezesAvailableThisMonth > 0 && (
                      <span className="flex items-center gap-1 text-[#3c6b44] dark:text-[#79cb91]">
                        <ShieldCheck size={12} /> {streakRecord.freezesAvailableThisMonth} Freezes Left
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ── FOLIO 2: CONSULAR DISTINCTIONS & GUILD SEALS (BADGES) ── */}
            <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#c5a059]/30">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#8c7355] dark:text-[#baa07c]">
                    Folio Section II · Accreditations
                  </span>
                  <h3 className="font-serif text-2xl font-black text-[#2e2117] dark:text-[#fbf7ee]">
                    Consular Distinctions & Seals
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8c7459] dark:text-[#baa489]">
                  {badges.filter(b => b.unlocked).length} / {badges.length} Sealed
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {badges.map((badge) => (
                  <BadgeSealItem key={badge.id} badge={badge} />
                ))}
              </div>
            </section>

            {/* ── FOLIO 3: SEED TREASURY & DIURNAL CHECK-IN VISAS ── */}
            <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-[#c5a059]/30">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#8c7355] dark:text-[#baa07c]">
                    Folio Section III · Consular Folios
                  </span>
                  <h3 className="font-serif text-2xl font-black text-[#2e2117] dark:text-[#fbf7ee]">
                    {ledgerTab === 'seeds' ? 'Consular Seed Treasury Ledger' : 'Diurnal Care & Check-In Visas'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* Ledger Tab Switcher */}
                  <div className="flex items-center p-1 bg-[#eae0cd] dark:bg-[#282018] rounded-xl border border-[#c5a059]/30">
                    <button
                      onClick={() => {
                        setLedgerTab('seeds');
                        if (hapticEnabled) triggerHaptic('light');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold transition-all ${
                        ledgerTab === 'seeds'
                          ? 'bg-[#2b2118] text-[#faecd0] shadow-xs'
                          : 'text-[#6e5843] dark:text-[#bda68e] hover:text-[#2b2118]'
                      }`}
                    >
                      Treasury
                    </button>
                    <button
                      onClick={() => {
                        setLedgerTab('checkins');
                        if (hapticEnabled) triggerHaptic('light');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold transition-all ${
                        ledgerTab === 'checkins'
                          ? 'bg-[#2b2118] text-[#faecd0] shadow-xs'
                          : 'text-[#6e5843] dark:text-[#bda68e] hover:text-[#2b2118]'
                      }`}
                    >
                      Care Visas ({checkins.length})
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (hapticEnabled) triggerHaptic('light');
                      transitionTo('/market', 'The Sunday Heirloom Bazaar');
                    }}
                    className="px-3 py-1.5 bg-[#c5a059]/20 hover:bg-[#c5a059]/30 border border-[#c5a059]/50 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider text-[#4d3714] dark:text-[#faebd7] flex items-center gap-1.5 transition-colors"
                  >
                    <Coins size={12} className="text-[#c5a059]" />
                    <span className="hidden sm:inline">Heirloom Bazaar</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>

              {/* Ruled Accounting Ledger Table */}
              <div className="seed-treasury-ledger rounded-xl overflow-hidden border border-[#d8cbba] dark:border-[#3d3224]">
                {ledgerTab === 'seeds' ? (
                  <>
                    <div className="grid grid-cols-12 bg-[#efe7d5] dark:bg-[#251e18] px-4 py-2.5 text-[9px] font-mono font-black uppercase tracking-wider text-[#634e3a] dark:text-[#d3bc9f] border-b border-[#d8cbba] dark:border-[#3d3224]">
                      <span className="col-span-3">Registration</span>
                      <span className="col-span-6">Dispatch Description</span>
                      <span className="col-span-3 text-right">Balance Impact</span>
                    </div>

                    {seedTransactions.length === 0 ? (
                      <div className="py-10 px-4 text-center space-y-1">
                        <p className="font-serif italic text-sm text-[#7e6955] dark:text-[#bda68e]">
                          &quot;No outstanding transaction claims or dispatch infractions recorded in this folio.&quot;
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[#a89582] dark:text-[#7f6f60]">
                          Accredited Balance: {profile.seeds.toLocaleString()} Seeds
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#e6dbcc] dark:divide-[#2e251d] max-h-64 overflow-y-auto">
                        {seedTransactions.slice(0, 8).map((tx) => (
                          <div
                            key={tx.id}
                            className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-[#f3edd5]/40 dark:hover:bg-[#221a14]/40 transition-colors"
                          >
                            <span className="col-span-3 font-mono text-[10px] text-[#7d6751] dark:text-[#b09a83]">
                              {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="col-span-6 font-serif font-medium text-[#2e2117] dark:text-[#faebd7] truncate pr-2">
                              {tx.description || tx.source}
                            </span>
                            <span className={`col-span-3 text-right font-mono font-bold ${
                              tx.amount >= 0 ? 'text-[#3c6b44] dark:text-[#79cb91]' : 'text-[#b85323] dark:text-[#f48a60]'
                            }`}>
                              {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} Seeds
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-12 bg-[#efe7d5] dark:bg-[#251e18] px-4 py-2.5 text-[9px] font-mono font-black uppercase tracking-wider text-[#634e3a] dark:text-[#d3bc9f] border-b border-[#d8cbba] dark:border-[#3d3224]">
                      <span className="col-span-3">Patrol Date</span>
                      <span className="col-span-5">Specimen & Vigil Notes</span>
                      <span className="col-span-4 text-right">Consular Frank</span>
                    </div>

                    {checkins.length === 0 ? (
                      <div className="py-10 px-4 text-center space-y-1">
                        <p className="font-serif italic text-sm text-[#7e6955] dark:text-[#bda68e]">
                          &quot;No diurnal surveillance check-ins or care visas recorded in this folio cycle.&quot;
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[#a89582] dark:text-[#7f6f60]">
                          Active Living Collection: {cards.length} Specimen Catalogued
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#e6dbcc] dark:divide-[#2e251d] max-h-64 overflow-y-auto">
                        {checkins.slice(0, 8).map((chk) => {
                          const plant = plantMap.get(chk.plantId);
                          const plantLabel = plant?.name || plant?.species || 'Sanctuary Flora';
                          const score = chk.guardianScore ?? 80;
                          return (
                            <div
                              key={chk.id}
                              className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-[#f3edd5]/40 dark:hover:bg-[#221a14]/40 transition-colors"
                            >
                              <span className="col-span-3 font-mono text-[10px] text-[#7d6751] dark:text-[#b09a83]">
                                {new Date(chk.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                              <div className="col-span-5 pr-2 truncate">
                                <p className="font-serif font-bold text-[#2e2117] dark:text-[#faebd7] truncate">
                                  {plantLabel}
                                </p>
                                <p className="font-mono text-[9px] text-[#7d6751] dark:text-[#b09a83] truncate">
                                  {chk.changes?.join(', ') || chk.weatherDescription || 'Diurnal care patrol verified'}
                                </p>
                              </div>
                              <div className="col-span-4 text-right">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[9px] font-black uppercase tracking-wider ${
                                  score >= 80
                                    ? 'bg-[#3c6b44]/15 text-[#2c5332] dark:text-[#79cb91] border border-[#3c6b44]/30'
                                    : score >= 55
                                    ? 'bg-[#c5a059]/15 text-[#73541e] dark:text-[#f4d38c] border border-[#c5a059]/30'
                                    : 'bg-[#b85323]/15 text-[#8b2500] dark:text-[#f48a60] border border-[#b85323]/30'
                                }`}>
                                  ★ FRANK {score}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* ── FOLIO 4: FIELD INSTRUMENTS & DISPATCH SETTINGS ── */}
            <section className="passport-visa-folio rounded-3xl p-6 sm:p-8 relative">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#c5a059]/30">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#8c7355] dark:text-[#baa07c]">
                    Folio Section IV · Terminal Controls
                  </span>
                  <h3 className="font-serif text-2xl font-black text-[#2e2117] dark:text-[#fbf7ee]">
                    Consular Field Instruments
                  </h3>
                </div>
              </div>

              <div className="space-y-4">
                {/* Audio Sound Effects Toggle */}
                <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#c5a059]/15 flex items-center justify-center text-[#c5a059]">
                      {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                        Acoustic Harmonic Resonance
                      </h4>
                      <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                        Apothecary water drops, chimes & discovery fanfares
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

                {/* Haptic Vibration Toggle */}
                <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#3c6b44]/15 flex items-center justify-center text-[#3c6b44] dark:text-[#79cb91]">
                      <Vibrate size={18} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                        Tactile Seal Impressions (Haptics)
                      </h4>
                      <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                        Physical mechanical vibration on stamps & interactions
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

                {/* Dispatch Notifications Toggle */}
                <div className="p-4 bg-[#faf4e6]/90 dark:bg-[#251e18]/90 rounded-2xl border border-[#d8ccb8] dark:border-[#423528] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/15 flex items-center justify-center text-[#1e3a5f] dark:text-[#82b5ed]">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                        Consular Daily Telegrams
                      </h4>
                      <p className="text-[10px] font-mono text-[#8a7258] dark:text-[#b6a087]">
                        Expedition alerts, streak warnings & diurnal care dispatches
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

                {/* Sign Out Danger Zone */}
                <div className="mt-6 pt-4 border-t border-[#d8ccb8] dark:border-[#382d22]">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full py-3 px-4 bg-[#2e4a34] hover:bg-[#395c41] text-[#f4eee1] rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors mb-4"
                  >
                    <span className="flex items-center gap-2">
                      <CloudUp size={14} /> 
                      {syncing ? 'Uplinking to Vault...' : 'Sync Local Ledger to Cloud'}
                    </span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full py-3 px-4 bg-red-900/10 hover:bg-red-900/20 border border-red-800/30 text-red-700 dark:text-red-400 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut size={14} /> Surrender Guild Passport (Sign Out)
                    </span>
                    <span className="text-[9px] opacity-70">Purge Active Session</span>
                  </button>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

// ── SUBCOMPONENTS ──

function StatFrankStamp({
  label,
  value,
  sub,
  icon
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl bg-[#faf6ec] dark:bg-[#1f1914] border border-[#dcd1be] dark:border-[#3d3326] shadow-xs flex flex-col justify-between transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[8px] font-mono uppercase tracking-widest text-[#8c7459] dark:text-[#baa489]">
          {label}
        </span>
        {icon}
      </div>
      <div>
        <p className="font-serif text-2xl font-black text-[#2e2117] dark:text-[#faf0dd] tracking-tight">
          {value}
        </p>
        <p className="text-[9px] font-mono text-[#7d6751] dark:text-[#a6927d] uppercase">
          {sub}
        </p>
      </div>
    </div>
  );
}

function LogisticsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#c5a059]/15 last:border-0">
      <span className="text-[9px] font-mono uppercase tracking-widest text-[#7c6650] dark:text-[#a6917a]">
        {label}
      </span>
      <span className="font-mono text-[10px] font-bold text-[#2e2117] dark:text-[#f4e7d1]">
        {value}
      </span>
    </div>
  );
}

function BadgeSealItem({
  badge
}: {
  badge: {
    id: string;
    label: string;
    description: string;
    unlocked: boolean;
    category: string;
  };
}) {
  return (
    <div
      className={`consular-seal-badge ${badge.unlocked ? 'is-active' : 'opacity-50 grayscale'} rounded-2xl p-4 text-center flex flex-col items-center justify-between transition-all`}
    >
      <div className="my-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
          badge.unlocked
            ? 'bg-radial from-[#faecd0] to-[#c5a059] border-[#7d5e21] text-[#3d2a0a] shadow-md'
            : 'bg-[#d8cfbe] dark:bg-[#2d241c] border-[#8a7a66] text-[#6b5c4b]'
        }`}>
          {badge.id === 'scholar_pro' ? (
            <Crown size={20} />
          ) : badge.id === 'mythic_patron' ? (
            <Award size={20} />
          ) : badge.id === 'week_one' ? (
            <Calendar size={20} />
          ) : badge.id === 'collector' ? (
            <Star size={20} />
          ) : (
            <Zap size={20} />
          )}
        </div>
      </div>

      <div>
        <h5 className="font-serif font-bold text-xs text-[#2e2117] dark:text-[#faebd7] leading-tight mb-1">
          {badge.label}
        </h5>
        <p className="text-[9px] font-mono text-[#7a654f] dark:text-[#ad9780] leading-tight">
          {badge.description}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-[#c5a059]/20 w-full text-center">
        <span className={`text-[8px] font-mono uppercase tracking-widest font-black ${
          badge.unlocked ? 'text-[#3c6b44] dark:text-[#79cb91]' : 'text-[#8a7258]'
        }`}>
          {badge.unlocked ? '★ SEALED' : 'UNCLAIMED'}
        </span>
      </div>
    </div>
  );
}
