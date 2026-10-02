/**
 * The one list of places this app can go.
 *
 * NavigationBar and MobileBottomNav used to carry two hand-kept arrays that had
 * drifted apart: the desktop bar showed Home/Lab/Arena/Market/Library while the
 * phone bar showed Home/Lab/Vault/Market/AI Chat. Same user, same account, two
 * different maps of the same product -- and no way to tell which one was
 * canonical. A sixth destination added to either file would have widened the gap
 * rather than closing it, so the fix is to stop keeping two lists.
 *
 * This module holds no React state and no router, so a test can import it
 * directly rather than string-matching component source.
 */
import { Leaf, Microscope, Archive, Swords, ShoppingBag, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavDestination {
  path: string;
  /** Desktop bar text, and the accessible name. */
  label: string;
  /** Bottom-bar text. Kept to one short word: the bar is ~64px tall on a
   *  small phone and anything longer wraps to two lines and shrinks the tap
   *  target. */
  short: string;
  Icon: LucideIcon;
  /** Human page name, used for the route-change announcement and for "Back to
   *  X" labels. Spelled out rather than reusing `label` because "Vault" reads
   *  oddly as "Back to Vault" on a page it never left. */
  description: string;
  /** Show in the thumb-reachable bottom bar. */
  bottomBar: boolean;
}

/**
 * Five is a hard ceiling for the bottom bar. A sixth item on a 360px phone
 * leaves ~60px per item, which drops the tap target under the 44px minimum
 * once the label is taken into account.
 */
export const BOTTOM_BAR_LIMIT = 5;

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { path: '/', label: 'Home', short: 'Home', Icon: Leaf, description: 'Home', bottomBar: true },
  { path: '/lab', label: 'Lab', short: 'Lab', Icon: Microscope, description: 'Botanical Lab', bottomBar: true },
  { path: '/collection', label: 'Vault', short: 'Vault', Icon: Archive, description: 'Your Vault', bottomBar: true },
  { path: '/arena', label: 'Arena', short: 'Arena', Icon: Swords, description: 'Care-Off Arena', bottomBar: true },
  { path: '/market', label: 'Market', short: 'Market', Icon: ShoppingBag, description: 'Seed Market', bottomBar: true },
  // Library stays desktop-and-footer only. The phone reaches it from Home and
  // the footer; spending a bottom-bar slot on it would cost the Arena, which
  // has no other entry point once the floating gardener is the AI Chat door.
  { path: '/library', label: 'Library', short: 'Library', Icon: BookOpen, description: 'Field Library', bottomBar: false },
];

/** The destinations that fit in the bottom bar, capped at BOTTOM_BAR_LIMIT. */
export function bottomBarDestinations(): NavDestination[] {
  return NAV_DESTINATIONS.filter(d => d.bottomBar).slice(0, BOTTOM_BAR_LIMIT);
}

/** Whether `href` is the destination a tab should light up. The home tab is an
 *  exact match only, or every path would mark Home as active. */
export function isDestinationActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Routes outside the destination list that still need a spoken name. Deep
// patterns are matched first: '/clinic/case-study' would otherwise be caught by
// the '/clinic' entry and announced as the wrong page.
const DEEP_ROUTE_TITLES: readonly (readonly [RegExp, string])[] = [
  [/^\/plant\//, 'Plant profile'],
  [/^\/clinic\/case-study$/, 'Case study'],
];

const OTHER_ROUTE_TITLES: Record<string, string> = {
  '/auth': 'Sign in',
  '/help': 'Help and FAQ',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',
  '/clinic': 'The Clinic',
  '/profile': 'Your profile',
  '/assistant': 'The Master Gardener',
  '/audit': 'System audit',
};

/**
 * The page's name for screen readers. Falls back to the product name rather
 * than an empty string, because announcing "" on an unknown route is worse than
 * announcing something vague.
 */
export function pageTitle(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  const known = NAV_DESTINATIONS.find(d => d.path === path || (d.path !== '/' && path.startsWith(`${d.path}/`)));
  if (known) return known.description;
  for (const [pattern, title] of DEEP_ROUTE_TITLES) {
    if (pattern.test(path)) return title;
  }
  return OTHER_ROUTE_TITLES[path] ?? 'PhytoDoctor';
}