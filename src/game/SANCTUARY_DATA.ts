/**
 * THE SANCTUARY
 *
 * The bazaar sells real goods with real money, and the voucher stall only ever
 * hands back a discount on them. Seeds, meanwhile, were a strictly one-way
 * currency: the app minted them on every diagnosis and nothing in the product
 * ever consumed them for anything a Keeper actually wants.
 *
 * The Sanctuary is that sink. Everything on it is a consumable that hooks a
 * system which already exists, so a purchase does something real rather than
 * sitting in an inventory:
 *
 *   freeze       -> RewardService.consumeStreakFreeze  (bridges one missed day)
 *   restore      -> RewardService.updateStreakOnUpload  (a second chance at a run)
 *   boost        -> GameService.earnSeeds                (doubles the next N payouts)
 *   assess       -> sandboxService.consumeAssessment    (an extra placement reading)
 *   blessing     -> GameService.calculateRarity         (lifts the next card's rarity)
 *   discovery    -> RewardService.getDiscoveryCharges..  (bypasses the weekly cap)
 *
 * PRICING. The economy pays 10-25 seeds for a daily ritual, 25 for a check-in,
 * 150 for a resolved alert, 250 for a Care-Off win and 1000 for a new species,
 * against a hard active cap of 150/day. A Keeper opening the app most days
 * clears roughly 2,000-3,000 seeds a week. So the cheap end sits inside a
 * first week (reachable, which is what makes the shelf feel alive) and the
 * expensive end sits past a fortnight (a real milestone, not a impulse).
 */

export type SanctuaryItemId =
  | 'freeze'
  | 'restore'
  | 'boost'
  | 'assess'
  | 'blessing'
  | 'discovery';

export type SanctuaryCategory = 'streak' | 'harvest' | 'vault';

/**
 * How a ritual looks on the shelf. Each one carries the palette of the thing it
 * does -- frost is cold and slow, the season is warm and swelling, the charm
 * glitters -- so a Keeper can tell them apart at a glance and the shelf reads
 * as a cabinet of curiosities rather than a pricing table.
 */
export interface SanctuaryTheme {
  /** Border, badge and price accent. */
  accent: string;
  /** Card background wash, tinted toward the accent. */
  wash: string;
  /** The ambient glow that pools behind the icon. */
  glow: string;
  /** The icon tile's gradient. */
  iconBg: string;
  /** The icon's idle animation. */
  motion: 'rotate' | 'float' | 'pulse' | 'twinkle' | 'sway';
  /** One-word tell for the card's mood. */
  mood: string;
}

export const SANCTUARY_THEMES: Record<SanctuaryItemId, SanctuaryTheme> = {
  // Frost Ward: cold, slow, crystalline.
  freeze: {
    accent: '#2f7fb8',
    wash: 'linear-gradient(150deg, #f2f9fd 0%, #e3f1fa 55%, #d5eaf7 100%)',
    glow: 'rgba(47,127,184,0.22)',
    iconBg: 'linear-gradient(140deg, #e4f3fb 0%, #bfe0f3 100%)',
    motion: 'rotate',
    mood: 'cool',
  },
  // Quiet Grace: a dove -- pale, weightless, drifting.
  restore: {
    accent: '#7c6bb0',
    wash: 'linear-gradient(150deg, #f6f3fc 0%, #ece6f8 55%, #e2d9f4 100%)',
    glow: 'rgba(124,107,176,0.20)',
    iconBg: 'linear-gradient(140deg, #efeaf9 0%, #d8cdf1 100%)',
    motion: 'float',
    mood: 'calm',
  },
  // Long Season: high summer, swelling heat.
  boost: {
    accent: '#c07f14',
    wash: 'linear-gradient(150deg, #fdf7e7 0%, #f9eecd 55%, #f4e2ac 100%)',
    glow: 'rgba(192,127,20,0.24)',
    iconBg: 'linear-gradient(140deg, #fbeecb 0%, #f3d68e 100%)',
    motion: 'pulse',
    mood: 'warm',
  },
  // Keeper's Eye: a reading, patient and watchful.
  assess: {
    accent: '#1f7a6d',
    wash: 'linear-gradient(150deg, #eef7f4 0%, #ddf0ea 55%, #cde8e0 100%)',
    glow: 'rgba(31,122,109,0.20)',
    iconBg: 'linear-gradient(140deg, #e0f1ec 0%, #b4ddd2 100%)',
    motion: 'sway',
    mood: 'keen',
  },
  // Rare Bloom Charm: something that catches the light.
  blessing: {
    accent: '#a13d8f',
    wash: 'linear-gradient(150deg, #fbf0f8 0%, #f5e2f1 55%, #eed2e9 100%)',
    glow: 'rgba(161,61,143,0.22)',
    iconBg: 'linear-gradient(140deg, #f7e5f3 0%, #e7c0de 100%)',
    motion: 'twinkle',
    mood: 'rare',
  },
  // Field Expedition: dust, leather, a compass needle settling.
  discovery: {
    accent: '#b85c33',
    wash: 'linear-gradient(150deg, #fcf2ea 0%, #f7e4d6 55%, #f0d5bf 100%)',
    glow: 'rgba(184,92,51,0.22)',
    iconBg: 'linear-gradient(140deg, #f9e6d8 0%, #efc6a9 100%)',
    motion: 'rotate',
    mood: 'wild',
  },
};

export interface SanctuaryItem {
  id: SanctuaryItemId;
  name: string;
  blurb: string;
  /** What the Keeper is actually buying, in plain words. */
  effect: string;
  category: SanctuaryCategory;
  seedPrice: number;
  /** How many this may be held at once. 0 = unlimited. */
  maxHeld: number;
  /**
   * What one unit of the held count means. Almost everything is a discrete
   * object ("2 held"), but a Long Season is a countdown of boosted payouts, so
   * counting it as a single object would promise five doubles and deliver one.
   */
  unit: 'held' | 'payouts';
  /** How many payouts one unit of this item is worth. Only for `payouts`. */
  perUnit?: number;
  icon: string;
  /** One line of flavour shown under the effect. */
  lore: string;
}

/**
 * What a Quiet Grace puts a run back to. Low on purpose: restoring to the
 * Keeper's personal best would hand back the very thing they lost, and
 * restoring higher than any real run would be a paid multiplier.
 */
export const RESTORED_STREAK = 3;

export const SANCTUARY_CATEGORIES: { id: SanctuaryCategory; label: string; blurb: string }[] = [
  { id: 'streak', label: 'Streak Ward', blurb: 'Keep the run alive.' },
  { id: 'harvest', label: 'Harvest Rituals', blurb: 'Stretch what a good week pays.' },
  { id: 'vault', label: 'Vault Rituals', blurb: 'Bend the rules of collection.' },
];

export const SANCTUARY_ITEMS: SanctuaryItem[] = [
  {
    id: 'freeze',
    name: 'Frost Ward',
    blurb: 'One missed day, forgiven.',
    effect: 'Adds one streak freeze to this month. Spent automatically the first day you miss, so your run carries on instead of resetting.',
    category: 'streak',
    seedPrice: 400,
    maxHeld: 5,
    unit: 'held',
    icon: '❄',
    lore: 'Tier grants a few of these each month. This is simply asking for more before you need them.',
  },
  {
    id: 'restore',
    name: 'Quiet Grace',
    blurb: 'One do-over on a broken run.',
    effect: 'Restores your streak to 3 days the moment you buy it, whether or not it is currently alive. The run keeps growing from there.',
    category: 'streak',
    seedPrice: 900,
    maxHeld: 1,
    unit: 'held',
    icon: '🕊',
    lore: 'A freeze stops the break. This undoes it.',
  },
  {
    id: 'boost',
    name: 'Long Season',
    blurb: 'Doubles your next payouts.',
    effect: 'The next 5 seed payouts you earn are doubled. Spends itself on use; anything left when the season ends is lost.',
    category: 'harvest',
    seedPrice: 1_200,
    maxHeld: 0,
    unit: 'payouts',
    perUnit: 5,
    icon: '☀',
    lore: 'The monsoon months. Everything ripens at once, then it is over.',
  },
  {
    id: 'assess',
    name: "Keeper's Eye",
    blurb: 'A reading past the daily cap.',
    effect: 'Buys one extra light-placement assessment today, over and above your normal daily allowance.',
    category: 'vault',
    seedPrice: 600,
    maxHeld: 3,
    unit: 'held',
    icon: '👁',
    lore: 'A second opinion from someone who has grown the thing themselves.',
  },
  {
    id: 'blessing',
    name: 'Rare Bloom Charm',
    blurb: 'Lifts the rarity of your next card.',
    effect: 'Your next specimen card is generated at Epic or better, whatever its species would normally earn.',
    category: 'vault',
    seedPrice: 2_500,
    maxHeld: 2,
    unit: 'held',
    icon: '✦',
    lore: 'Rarity is earned by consistency. This is the shortcut, and it is priced like one.',
  },
  {
    id: 'discovery',
    name: 'Field Expedition',
    blurb: 'An extra discovery this week.',
    effect: 'Unlocks one extra species discovery beyond your weekly charge, for as long as you hold one.',
    category: 'vault',
    seedPrice: 1_500,
    maxHeld: 2,
    unit: 'held',
    icon: '🧭',
    lore: 'A day in the field is worth a week at the window.',
  },
];

export const SANCTUARY_BY_ID: Record<SanctuaryItemId, SanctuaryItem> = SANCTUARY_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<SanctuaryItemId, SanctuaryItem>
);
