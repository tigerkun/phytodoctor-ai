/**
 * Where "back" goes, and whether there is anywhere to go.
 *
 * The browser back button is doing navigation work this app cannot see. Two
 * pages hand-rolled their own back control (Assistant, PlantDetail) and both
 * called navigate(-1), which walks session history. That works in a browser
 * and breaks the moment the same code runs inside a WebView wrapper: a cold
 * start lands straight on the deep link with a history depth of one, so -1
 * either does nothing or closes the app. A person who opens a shared plant link
 * in the app would be stranded.
 *
 * So a back control here has two modes. With history behind it, it steps back
 * through it. Without, it pushes the section parent instead -- deterministic,
 * never a dead end, and the same answer on every device.
 */
import { pageTitle } from './navRoutes';

export interface BackTarget {
  /** null => render no back control at all. */
  to: string | null;
  /** Accessible name for the control. */
  label: string;
  /** Step through session history rather than pushing `to`. */
  usesHistory: boolean;
}

/** Landing pages. A back control here leads nowhere worth offering. */
const ROOTS = new Set(['/', '/auth']);

/**
 * Section parents, for the deep-link case where there is no history to walk.
 * Order matters: the first prefix that matches wins, so more specific routes
 * are listed before the sections that contain them.
 */
const PARENTS: Record<string, string> = {
  '/clinic/case-study': '/clinic',
  '/plant': '/collection',
};

/** The section a path belongs to, for use as its fallback destination. */
export function parentFor(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  for (const [prefix, parent] of Object.entries(PARENTS)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return parent;
  }
  return '/';
}

export function resolveBackTarget(pathname: string, hasHistory: boolean): BackTarget {
  const path = pathname.split(/[?#]/)[0];
  if (ROOTS.has(path)) return { to: null, label: '', usesHistory: false };
  if (hasHistory) return { to: null, label: 'Back', usesHistory: true };
  const parent = parentFor(path);
  return { to: parent, label: `Back to ${pageTitle(parent)}`, usesHistory: false };
}

/**
 * How many forward-navigable steps sit behind the current page.
 *
 * REPLACE deliberately holds the depth. Layout redirects a signed-out visitor
 * to /auth with replace:true; counting that as a step would give them a back
 * control that returns them to the page that just bounced them.
 */
export function nextHistoryDepth(current: number, navigationType: 'PUSH' | 'POP' | 'REPLACE'): number {
  if (navigationType === 'PUSH') return current + 1;
  if (navigationType === 'POP') return Math.max(1, current - 1);
  return current;
}