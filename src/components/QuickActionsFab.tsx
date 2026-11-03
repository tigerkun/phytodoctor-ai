import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, Camera, Droplets, Sprout, X } from 'lucide-react';
import { db } from '../db/database';
import { waterAllDue } from '../services/gardenActions';
import { wateringDue } from '../services/notificationService';
import AddPlantModal from './home/AddPlantModal';
import { useToast } from './Toast';
import { useEcoMode } from '../hooks/useEcoMode';
import { triggerHaptic } from '../utils/hapticAudio';

/**
 * Quick Actions floating button — the counterpart to the FloatingAssistant
 * beside it. The assistant answers questions; this one performs acts.
 *
 * Position: default sits just above the assistant bubble (bottom-right is
 * taken), and is draggable — the placement persists for the session's
 * storage lifetime. A swipe down while the menu is closed dismisses the
 * button for the session; Ctrl+K brings it back by opening the menu, which
 * also clears the dismissal.
 *
 * "Emergency Diagnose" (long-press) navigates to /lab — which is already a
 * public route by design (the guest lane is the product). No auth is
 * bypassed here and none needs to be.
 */

const POS_KEY = 'phyto_fab_pos';
const DISMISS_KEY = 'phyto_fab_dismissed';
const LONG_PRESS_MS = 550;

function clampPos(x: number, y: number): { x: number; y: number } {
  const margin = 12;
  const maxX = window.innerWidth - 72 - margin;
  const maxY = window.innerHeight - 72 - margin;
  return {
    x: Math.max(-(window.innerWidth - 84) + margin - 24, Math.min(x, maxX - 24)),
    y: Math.max(-(window.innerHeight - 84) + margin - 96, Math.min(y, maxY - 96)),
  };
}

export default function QuickActionsFab() {
  const navigate = useNavigate();
  const { info, success } = useToast();
  const { shouldDisableAnimations } = useEcoMode();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [watering, setWatering] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1',
  );
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return clampPos(JSON.parse(raw).x, JSON.parse(raw).y);
    } catch { /* fresh placement */ }
    return { x: 0, y: 0 };
  });
  const pressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  // Plants due for water right now — the badge is live, not polled.
  const dueCount = useLiveQuery(async () => {
    const now = Date.now();
    const plants = await db.plants.toArray();
    return plants.filter(p =>
      !p.isDemo && wateringDue(p, new Date(now)),
    ).length;
  }, []) ?? 0;

  // Ctrl+K opens the menu — and re-summons a dismissed button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        sessionStorage.removeItem(DISMISS_KEY);
        setDismissed(false);
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startLongPress = () => {
    pressTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      triggerHaptic('heavy');
      setOpen(false);
      navigate('/lab');
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const waterAll = async () => {
    setOpen(false);
    if (watering) return;
    setWatering(true);
    try {
      // The shared loop with per-plant failure capture — one cloud-less
      // plant must not eat the rest of the garden's watering.
      const result = await waterAllDue();
      if (!result.total) {
        info('Nothing is thirsty right now. 🌿');
        return;
      }
      if (result.failed) {
        triggerHaptic('medium');
        info(
          `💧 Watered ${result.watered} of ${result.total} — ${result.failed} failed` +
            ` (${result.failedNames[0]}${result.failedNames.length > 1 ? ' +more' : ''}). Try again from its page.`,
        );
      } else {
        triggerHaptic('light');
        success(`Watered ${result.watered} plant${result.watered === 1 ? '' : 's'}. 💧`);
      }
    } catch (err) {
      console.error('[fab] water all failed:', err);
      info('Could not reach the garden data — try again.');
    } finally {
      setWatering(false);
    }
  };

  const items = [
    { key: 'scan', label: 'Quick Scan', icon: Camera, run: () => { setOpen(false); navigate('/lab'); } },
    { key: 'water', label: watering ? 'Watering…' : `Water All${dueCount ? ` (${dueCount})` : ''}`, icon: Droplets, run: waterAll, badge: dueCount },
    { key: 'add', label: 'Add Plant', icon: Sprout, run: () => { setOpen(false); setAddOpen(true); } },
    { key: 'stats', label: 'My Stats', icon: BarChart3, run: () => { setOpen(false); navigate('/profile'); } },
  ];

  if (dismissed) return <AddPlantModal isOpen={addOpen} onClose={() => setAddOpen(false)} onScanRedirect={() => { setAddOpen(false); navigate('/lab?tab=dex'); }} />;

  const anim = shouldDisableAnimations ? { duration: 0 } : { type: 'spring' as const, stiffness: 400, damping: 28 };

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        initial={false}
        animate={{ x: pos.x, y: pos.y }}
        style={{ position: 'fixed', bottom: 96, right: 24, zIndex: 40 }}
        onDragEnd={(_, info) => {
          // Swipe down while closed = dismiss for this session. Ctrl+K or a
          // fresh session brings it back.
          if (!open && info.offset.y > 90) {
            sessionStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
            return;
          }
          const next = clampPos(pos.x + info.offset.x, pos.y + info.offset.y);
          setPos(next);
          try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label="Quick actions"
          onClick={() => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            setOpen(prev => !prev);
          }}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={e => e.preventDefault()}
          className="w-14 h-14 rounded-full bg-[var(--moss-deep)] hover:bg-[var(--moss)] text-white flex items-center justify-center shadow-lg transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--moss)] cursor-grab active:cursor-grabbing touch-none"
        >
          {open ? <X size={22} /> : <Sprout size={22} />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              aria-label="Quick actions menu"
              initial={shouldDisableAnimations ? false : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldDisableAnimations ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={anim}
              className="absolute bottom-16 right-0 w-48 rounded-2xl border border-border-light bg-bg-glass backdrop-blur-xl shadow-2xl overflow-hidden"
            >
              {items.map(item => (
                <button
                  key={item.key}
                  role="menuitem"
                  type="button"
                  onClick={item.run}
                  className="w-full min-h-[44px] px-4 py-2.5 flex items-center gap-3 text-left text-xs font-bold text-text-primary hover:bg-moss/10 transition-colors border-b border-border-light/60 last:border-b-0 relative"
                >
                  <item.icon size={15} className="text-moss shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {!!item.badge && (
                    // Red pip with the live due count — the menu item says
                    // the number, the closed button carries a dot.
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
              <div className="px-4 py-1.5 text-[8px] font-mono uppercase tracking-widest text-text-muted border-t border-border-light/60">
                Hold button · emergency diagnose
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The closed button's red dot — visibility without opening anything. */}
        {!!dueCount && !open && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-[var(--bg-primary)] text-[8px] font-black text-white flex items-center justify-center"
          >
            {dueCount}
          </span>
        )}
      </motion.div>

      <AddPlantModal isOpen={addOpen} onClose={() => setAddOpen(false)} onScanRedirect={() => { setAddOpen(false); navigate('/lab?tab=dex'); }} />
    </>
  );
}
