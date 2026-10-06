/**
 * The Keeper's explicit motion preference, layered over the OS setting.
 *
 * `prefers-reduced-motion` only honours the operating-system switch, which
 * many people never find — and some of those people are exactly the ones who
 * need it (vestibular disorders, motion sickness). This gives the app its own
 * switch in Profile › Settings with three honest positions:
 *
 *   'auto'    follow the OS (the default; the switch is inert until touched)
 *   'reduced' always reduce, whatever the OS says
 *   'full'    always play motion — an explicit override for someone whose OS
 *             is set to reduce for reasons that do not apply inside this app
 *
 * useEcoMode consumes this. Nothing else should read it directly.
 */

export const MOTION_PREFERENCES = ['auto', 'reduced', 'full'] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

const STORAGE_KEY = 'botanical_motion_preference';
/** Fired on window whenever the preference changes, so live consumers update. */
export const MOTION_PREFERENCE_EVENT = 'phyto:motion-preference-change';

export function isMotionPreference(value: unknown): value is MotionPreference {
  return typeof value === 'string' && (MOTION_PREFERENCES as readonly string[]).includes(value);
}

export function getMotionPreference(): MotionPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMotionPreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function setMotionPreference(preference: MotionPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Still in force for this session even when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent(MOTION_PREFERENCE_EVENT));
}
