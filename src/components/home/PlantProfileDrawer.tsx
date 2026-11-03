import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Droplets, Sprout, RefreshCw, BellOff, Bell } from 'lucide-react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { usePageTransition } from './PageTransitionContext';
import { db } from '@/db/database';
import { PlantService } from '@/services/plantService';
import type { Plant } from '@/types';

interface PlantPhoto {
  url: string;
  date: Date;
  healthScore: number;
}

interface PlantProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plant: {
    id: string;
    nickname: string;
    species: string;
    healthScore: number;
    lastWatered: Date;
    image: string;
    bio?: string;
    careSchedule?: {
      watering: string;
      fertilizing: string;
      rotation: string;
    };
    healthHistory?: number[];
    photos?: PlantPhoto[];
  };
}

const CADENCE_OPTIONS = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30];

export function PlantProfileDrawer({ isOpen, onClose, plant }: PlantProfileDrawerProps) {
  const { theme } = useDayNightTheme();
  const { transitionTo } = usePageTransition();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reminderBusy, setReminderBusy] = useState(false);

  // Reminders read the live Dexie row rather than the display prop — the
  // drawer is open while things change, and the prop predates the
  // reminder fields entirely.
  const livePlant = useLiveQuery(() => db.plants.get(plant.id), [plant.id]);
  const muted = Boolean(livePlant?.remindersMuted);
  const cadence = livePlant?.wateringIntervalDays ?? 7;

  // Cloud-scoped writes throw when the plant never reached Postgres
  // (created offline). The local row is still the plant the Keeper sees —
  // patch it there rather than losing the toggle.
  const patchPlant = async (updates: Partial<Plant>) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await PlantService.updatePlant(plant.id, updates);
    } catch {
      await db.plants.update(plant.id, updates);
    } finally {
      setReminderBusy(false);
    }
  };

  // Fallback defaults
  const plantBio = plant?.bio || "A precious addition to your home sanctuary.";
  const plantCareSchedule = plant?.careSchedule || {
    watering: 'Every 7 days',
    fertilizing: 'Monthly',
    rotation: 'Every 2 weeks'
  };
  const plantHealthHistory = plant?.healthHistory || [85, 87, 88, 86, 85, 88, 89, 90, 92, 92, 91, 93, 94];
  const plantPhotos = plant?.photos || [
    { url: plant?.image, date: plant?.lastWatered || new Date(), healthScore: plant?.healthScore || 80 }
  ];

  useEffect(() => {
    setPhotoIndex(0);
  }, [plant]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl max-h-[90vh] overflow-y-auto"
            style={{
              background: theme === 'day'
                ? 'rgba(255, 248, 240, 0.95)'
                : 'rgba(15, 20, 25, 0.95)',
              backdropFilter: 'blur(20px)'
            }}
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ borderColor: theme === 'day' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)' }}>
              <h2 className="text-2xl font-serif font-bold" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                {plant.nickname}
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={24} style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }} />
              </motion.button>
            </div>

            <div className="p-6 space-y-8">
              {/* Photo Timeline */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-lg font-serif font-bold mb-4" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                  Growth Timeline
                </h3>

                {/* Main Photo with Parallax */}
                <div className="relative rounded-2xl overflow-hidden mb-4 h-80 bg-gradient-to-b from-gray-300 to-gray-400">
                  <motion.img
                    key={photoIndex}
                    src={plantPhotos[photoIndex]?.url || plant.image}
                    alt="Plant timeline"
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                  />

                  {/* Date Badge */}
                  <motion.div
                    className="absolute bottom-4 left-4 px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md"
                    style={{
                      background: theme === 'day'
                        ? 'rgba(255, 255, 255, 0.8)'
                        : 'rgba(30, 28, 26, 0.8)',
                      color: theme === 'day' ? '#3D405B' : '#E8DCC8'
                    }}
                  >
                    {plantPhotos[photoIndex]?.date instanceof Date 
                      ? plantPhotos[photoIndex].date.toLocaleDateString() 
                      : typeof plantPhotos[photoIndex]?.date === 'string'
                        ? new Date(plantPhotos[photoIndex].date).toLocaleDateString()
                        : 'Today'}
                  </motion.div>
                </div>

                {/* Photo Slider */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {plantPhotos.map((photo, idx) => (
                    <motion.button
                      key={idx}
                      onClick={() => setPhotoIndex(idx)}
                      className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all"
                      style={{
                        borderColor: idx === photoIndex ? '#5a7a5a' : 'transparent'
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <img
                        src={photo.url}
                        alt="Timeline"
                        className="w-full h-full object-cover"
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Plant Bio */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-lg font-serif font-bold mb-3" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                  About {plant.nickname}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}
                >
                  {plantBio}
                </p>
              </motion.div>

              {/* Care Schedule */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-lg font-serif font-bold mb-4" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                  Care Schedule
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Watering', value: plantCareSchedule.watering, icon: Droplets },
                    { label: 'Fertilizing', value: plantCareSchedule.fertilizing, icon: Sprout },
                    { label: 'Rotation', value: plantCareSchedule.rotation, icon: RefreshCw }
                  ].map((item, idx) => (
                    <motion.div
                      key={item.label}
                      className="p-4 rounded-lg text-center"
                      style={{
                        background: theme === 'day'
                          ? 'rgba(255, 255, 255, 0.5)'
                          : 'rgba(255, 255, 255, 0.05)'
                      }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + idx * 0.1 }}
                    >
                      <item.icon size={20} className="mb-2 text-moss" strokeWidth={1.75} aria-hidden="true" />
                      <p
                        className="text-xs font-bold mb-1"
                        style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}
                      >
                        {item.value}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Reminders — per-plant mute and watering cadence. The cadence
                  IS the plant's wateringIntervalDays (one source of truth for
                  the engine, quick actions and server push alike), not a
                  parallel override field. */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <h3 className="text-lg font-serif font-bold mb-4" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                  Reminders
                </h3>
                <div
                  className="rounded-lg p-4 space-y-4"
                  style={{ background: theme === 'day' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.05)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {muted
                        ? <BellOff size={18} style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }} aria-hidden="true" />
                        : <Bell size={18} className="text-moss" aria-hidden="true" />}
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                          {muted ? 'Reminders muted' : 'Reminders on'}
                        </p>
                        <p className="text-[11px]" style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}>
                          Skips watering nudges for this plant, here and on cloud push
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={muted}
                      aria-label={muted ? 'Unmute reminders for this plant' : 'Mute reminders for this plant'}
                      disabled={reminderBusy}
                      onClick={() => patchPlant({ remindersMuted: !muted })}
                      className="shrink-0 w-12 h-7 rounded-full transition-colors relative disabled:opacity-50"
                      style={{ background: muted ? '#5a7a5a' : theme === 'day' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }}
                    >
                      <span
                        className="absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all"
                        style={{ left: muted ? 26 : 4 }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="drawer-watering-cadence" className="text-sm font-bold" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                      Water every
                    </label>
                    <select
                      id="drawer-watering-cadence"
                      value={CADENCE_OPTIONS.includes(cadence) ? cadence : ''}
                      disabled={reminderBusy}
                      onChange={(e) => {
                        const days = Number(e.target.value);
                        if (!days) return;
                        // setWateringInterval also recomputes nextWaterDue from
                        // the last watering; the offline fallback below keeps
                        // the cadence without it.
                        PlantService.setWateringInterval(plant.id, days).catch(() =>
                          db.plants.update(plant.id, { wateringIntervalDays: days })
                        );
                      }}
                      className="rounded-md border px-2 py-1.5 text-sm font-bold disabled:opacity-50"
                      style={{
                        color: theme === 'day' ? '#3D405B' : '#E8DCC8',
                        borderColor: theme === 'day' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
                        background: 'transparent',
                      }}
                    >
                      {!CADENCE_OPTIONS.includes(cadence) && (
                        <option value="" disabled>{cadence} days</option>
                      )}
                      {CADENCE_OPTIONS.map((days) => (
                        <option key={days} value={days}>
                          {days} {days === 1 ? 'day' : 'days'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {livePlant?.wateringIntervalCustom && (
                    <p className="text-[11px] italic" style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}>
                      Custom cadence — this plant waters on its own rhythm, not the garden default.
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Health History Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="text-lg font-serif font-bold mb-4" style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}>
                  30-Day Health Trend
                </h3>
                <div className="flex items-end gap-1 h-24">
                  {plantHealthHistory.map((score, idx) => (
                    <motion.div
                      key={idx}
                      className="flex-1 rounded-t-sm transition-all"
                      style={{
                        height: `${(score / 100) * 100}%`,
                        background: score >= 90 ? '#5a7a5a' : score >= 70 ? '#7a9e7a' : score >= 50 ? '#d4af37' : '#d4755a'
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${(score / 100) * 100}%` }}
                      transition={{ delay: idx * 0.02 }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex gap-4 pt-4 pb-8"
              >
                 <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onClose();
                    transitionTo(`/assistant?plantName=${encodeURIComponent(plant.nickname)}&species=${encodeURIComponent(plant.species)}&plantId=${encodeURIComponent(plant.id)}`, 'AI Assistant');
                  }}
                  className="flex-1 py-3 min-h-[44px] rounded-lg font-bold text-white transition-all bg-[var(--moss)] hover:bg-[var(--moss-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"
                >
                  💬 Ask Gemini
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 min-h-[44px] rounded-lg font-bold transition-all bg-[var(--bg-tertiary)] hover:bg-[var(--border-medium)] text-[var(--text-bark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"
                >
                  📦 Archive
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
