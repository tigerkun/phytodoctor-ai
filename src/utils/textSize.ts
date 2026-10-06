/**
 * The Keeper's text size, applied by scaling the root font size.
 *
 * Tailwind's named sizes (text-sm, p-4, gap-6 …) are all rem, so one value on
 * <html> rescales the whole interface — including the browser's default 16px
 * when the visitor has changed it there. Arbitrary pixel sizes (the odd
 * text-[9px] stamp) are deliberately left alone: they are decorative
 * micro-labels, and scaling them would break the plates they sit inside.
 *
 * Sizes are absolute px on the root, not a multiplier, so a visitor who has
 * already enlarged text in their browser gets a predictable result instead of
 * a surprise doubling.
 */

export const TEXT_SIZES = ['small', 'default', 'large', 'extra-large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

const STORAGE_KEY = 'botanical_text_size';

export const TEXT_SIZE_PX: Record<TextSize, number> = {
  small: 14,
  default: 16,
  large: 18,
  'extra-large': 20,
};

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value);
}

export function getTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTextSize(stored) ? stored : 'default';
  } catch {
    // Private-mode Safari and storage-blocked iframes throw on getItem.
    return 'default';
  }
}

/** Persist the choice and apply it to the live document immediately. */
export function setTextSize(size: TextSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // The setting still applies for this session even if it cannot persist.
  }
  applyTextSize(size);
}

/** Apply a size to <html> without touching storage — used at boot. */
export function applyTextSize(size: TextSize): void {
  document.documentElement.style.fontSize = `${TEXT_SIZE_PX[size]}px`;
}

/** Read storage once and apply it before the first paint of the app. */
export function initTextSize(): void {
  applyTextSize(getTextSize());
}
