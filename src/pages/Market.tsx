import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion';
import {
  Sparkles,
  Sprout,
  ShoppingBag,
  Clock,
  Tag,
  ChevronRight,
  Star,
  AlertCircle,
  ShieldCheck,
  Leaf,
  Bookmark,
  TrendingUp,
  Zap,
  Gift,
  ExternalLink,
  Crown,
  Lock,
  Truck,
  Ticket,
  Percent,
  Gem
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import EnhancedWalletDisplay from '../components/market/EnhancedWalletDisplay';
import ProductFilters from '../components/market/ProductFilters';
import CheckoutSummary from '../components/market/CheckoutSummary';
import { useToast } from '../components/market/ToastNotification';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import PageWrapper from '../components/home/PageWrapper';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/feedback/ErrorState';
import { SkeletonList } from '../components/feedback/Skeleton';
import { SanctuaryService } from '../services/sanctuaryService';
import { MARKETPLACE_ITEMS } from '../game/ECONOMY_DATA';
import { VOUCHERS, LEVEL_TIERS } from '../game/REWARD_CONFIG';
import { lineSeedCost, lineRefundRupees, refundValueFor, volumeDiscountPct } from '../lib/marketPricing';
import { marketPrivilegesFor, nextMarketUnlock, seedPriceFor, voucherCostFor, type MarketPrivileges } from '../lib/marketUnlocks';
import type { ClaimedRefund, MarketLedgerRow } from '../types';
import {
  SANCTUARY_ITEMS,
  SANCTUARY_CATEGORIES,
  SANCTUARY_THEMES,
  type SanctuaryItem,
  type SanctuaryItemId,
  type SanctuaryTheme
} from '../game/SANCTUARY_DATA';

// ── MOCK DATA (HIGH-ACCURACY CURATED IMAGES & LINKS) ──

/** One crate on the physical stall. Written out rather than inferred so a
 *  missing flag is a type error rather than an `undefined` that reads falsy
 *  on some cards and throws nowhere. */
interface MarketProduct {
  id: string;
  category: string;
  name: string;
  subtitle: string;
  image: string;
  amazonUrl: string;
  rating: number;
  reviewCount: number;
  cashPrice: number;
  originalPrice?: number;
  seedPrice: number;
  isLimited: boolean;
  proEarlyAccess: boolean;
  tags: string[];
  /** L18 "Legendary market drop access": visible to everyone, buyable only
   *  by Flora Sages. The two dearest crates carry this so the tier has
   *  something concrete sitting behind it. */
  legendary?: boolean;
}

const MOCK_PRODUCTS: MarketProduct[] = [
  {
    id: 'drop-1',
    category: 'home',
    name: "Ceramic Self-Watering Planter (6\")",
    subtitle: "Premium terracotta with reservoir",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=ceramic+self+watering+planter+pot",
    rating: 4.8,
    reviewCount: 203,
    cashPrice: 449,
    originalPrice: 599,
    seedPrice: 2694,
    isLimited: true,
    proEarlyAccess: false,
    tags: ['limited', 'bestseller']
  },
  {
    id: 'drop-2',
    category: 'care',
    name: "Organic Cold-Pressed Neem Oil",
    subtitle: "100% pure botanical pest defense",
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=organic+cold+pressed+neem+oil+plants",
    rating: 4.9,
    reviewCount: 512,
    cashPrice: 299,
    seedPrice: 1794,
    isLimited: false,
    proEarlyAccess: false,
    tags: ['essential']
  },
  {
    id: 'drop-3',
    category: 'home',
    name: "Full-Spectrum Halo Grow Light",
    subtitle: "Simulates natural morning daylight",
    image: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8dd?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=full+spectrum+halo+grow+light+plants",
    rating: 4.7,
    reviewCount: 89,
    cashPrice: 899,
    originalPrice: 1199,
    seedPrice: 5394,
    isLimited: true,
    proEarlyAccess: true,
    tags: ['pro', 'tech']
  },
  {
    id: 'drop-4',
    category: 'care',
    name: "Chunky Aroid Soil Mix (2kg)",
    subtitle: "Orchid bark + perlite + coco coir",
    image: "https://images.unsplash.com/photo-1596433809252-260c27459d28?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=aroid+soil+mix+perlite+orchid+bark",
    rating: 4.9,
    reviewCount: 341,
    cashPrice: 349,
    originalPrice: 449,
    seedPrice: 2094,
    isLimited: false,
    proEarlyAccess: false,
    tags: ['bestseller']
  },
  {
    id: 'drop-5',
    category: 'home',
    name: "Decorative Macramé Plant Hanger",
    subtitle: "Handwoven jute, holds up to 5kg",
    image: "https://images.unsplash.com/photo-1583208754593-9cbfb9b5dbb1?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=macrame+plant+hanger",
    rating: 4.6,
    reviewCount: 156,
    cashPrice: 199,
    seedPrice: 1194,
    isLimited: false,
    proEarlyAccess: false,
    tags: []
  },
  {
    id: 'drop-6',
    category: 'care',
    name: "Premium Humidity Tray + Pebbles",
    subtitle: "Boost moisture for tropical plants",
    image: "https://images.unsplash.com/photo-1558293842-c0fd3db86157?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=humidity+tray+for+plants",
    rating: 4.5,
    reviewCount: 127,
    cashPrice: 149,
    seedPrice: 894,
    isLimited: false,
    proEarlyAccess: false,
    tags: []
  },
  {
    id: 'drop-7',
    category: 'home',
    name: "Copper Watering Can (2L)",
    subtitle: "Heirloom design with fine mist nozzle",
    image: "https://images.unsplash.com/photo-1592424090155-d6d7eebdb4de?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=copper+watering+can+plants",
    rating: 4.7,
    reviewCount: 89,
    cashPrice: 299,
    originalPrice: 399,
    seedPrice: 1794,
    isLimited: false,
    proEarlyAccess: false,
    tags: []
  },
  {
    id: 'drop-8',
    category: 'care',
    name: "Moss Pole Extension Kit",
    subtitle: "Support climbing vines & aroid growth",
    image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=moss+pole+for+climbing+plants",
    rating: 4.4,
    reviewCount: 67,
    cashPrice: 179,
    seedPrice: 1074,
    isLimited: false,
    proEarlyAccess: true,
    tags: ['pro']
  },
  {
    id: 'drop-9',
    category: 'care',
    name: 'Vermicompost Boost (5 kg)',
    subtitle: 'Organic worm-cast soil food',
    image: 'https://images.unsplash.com/photo-1587315955134-8c27e7b0e0a2?auto=format&fit=crop&w=800&q=80',
    amazonUrl: 'https://www.amazon.in/s?k=vermicompost+organic+fertiliser+plants',
    rating: 4.6,
    reviewCount: 312,
    cashPrice: 199,
    seedPrice: 1194,
    isLimited: false,
    proEarlyAccess: false,
    tags: []
  },
  {
    id: 'drop-10',
    category: 'tools',
    name: 'Bypass Pruning Shears',
    subtitle: 'Clean cuts, sap-resistant blade',
    image: 'https://images.unsplash.com/photo-1598902069229-4f2f0e38a3a2?auto=format&fit=crop&w=800&q=80',
    amazonUrl: 'https://www.amazon.in/s?k=pruning+shears+garden',
    rating: 4.7,
    reviewCount: 256,
    cashPrice: 349,
    seedPrice: 2094,
    isLimited: false,
    proEarlyAccess: false,
    tags: ['bestseller']
  },
  {
    id: 'drop-11',
    category: 'seeds',
    name: 'Herb Starter Kit (5 varieties)',
    subtitle: 'Basil, mint, coriander & more',
    image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=800&q=80',
    amazonUrl: 'https://www.amazon.in/s?k=herb+seeds+starter+kit',
    rating: 4.5,
    reviewCount: 184,
    cashPrice: 299,
    seedPrice: 1794,
    isLimited: true,
    proEarlyAccess: false,
    tags: ['limited']
  },
  {
    id: 'drop-12',
    category: 'home',
    name: 'Macramé Plant Hangers (set of 3)',
    subtitle: 'Cotton weave, balcony-ready',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80',
    amazonUrl: 'https://www.amazon.in/s?k=macrame+plant+hanger',
    rating: 4.4,
    reviewCount: 97,
    cashPrice: 249,
    seedPrice: 1494,
    isLimited: false,
    proEarlyAccess: false,
    tags: []
  },
  {
    id: 'drop-13',
    category: 'care',
    name: 'Slow-Release Fertiliser Spikes',
    subtitle: '90 days of feeding per spike',
    image: 'https://images.unsplash.com/photo-1508502726440-477c94bc361e?auto=format&fit=crop&w=800&q=80',
    amazonUrl: 'https://www.amazon.in/s?k=fertiliser+spikes+plants',
    rating: 4.3,
    reviewCount: 141,
    cashPrice: 129,
    seedPrice: 774,
    isLimited: false,
    proEarlyAccess: false,
    tags: []
  },
  {
    id: 'drop-14',
    category: 'tools',
    name: 'Soil Moisture Meter',
    subtitle: 'Know before you pour',
    image: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?auto=format&fit=crop&w=800&q=80',
    amazonUrl: 'https://www.amazon.in/s?k=soil+moisture+meter',
    rating: 4.5,
    reviewCount: 223,
    cashPrice: 279,
    seedPrice: 1674,
    isLimited: false,
    proEarlyAccess: false,
    tags: ['bestseller']
  }
];

// The two dearest crates are the legendary drops — the L18 tier's concrete
// reward. Derived by price rather than hand-flagged, so a future price edit
// cannot accidentally move the tier gate onto a mid-shelf item. A lookup Set,
// not a mutation of MOCK_PRODUCTS: the drop ids are read off the catalogue
// everywhere it is rendered, and the file has already been bitten once by a
// helper that reordered the shared array in place.
const LEGENDARY_DROP_IDS = new Set(
  [...MOCK_PRODUCTS].sort((a, b) => b.seedPrice - a.seedPrice).slice(0, 2).map(p => p.id)
);
const isLegendaryDrop = (id: string) => LEGENDARY_DROP_IDS.has(id);

// Punchable tickets come from REWARD_CONFIG, the same array the RuleBook
// renders. The market used to keep its own two-entry copy with cheaper seed
// costs, so the rulebook quoted 500 seeds for a Sprout Saver while this page
// charged 300 — one ticket, two prices, depending on which screen you were
// standing on. There is no second copy to drift any more.
const TICKETS_FOR_SALE = VOUCHERS;

// The market's purchased state used to live under these browser-wide keys.
// They are legacy now: the live copy is the user-scoped marketLedger row in
// Dexie (v22). The keys are read exactly once — to migrate whatever a player
// already paid for — and then deleted.
const CART_KEY = 'phyto_stall_cart';
const WISH_KEY = 'phyto_stall_wish';
const TICKET_KEY = 'phyto_stall_tickets';
const REFUNDS_KEY = 'phyto_stall_refunds';

const AFFILIATE_TAG = 'botanicalguard-21';

// Append the affiliate tag correctly: stall URLs already contain a query
// string (`/s?k=...`), so the tag must join with `&`, never a second `?`.
// Live platform searches: these open CURRENT listings for the product on each
// marketplace, so a stall never points at a dead or out-of-stock page.
// Flipkart retired its affiliate API years ago, so its link is a plain live
// search; Amazon carries the associate tag on the same live search.
function flipkartSearchUrl(name: string): string {
  return 'https://www.flipkart.com/search?q=' + encodeURIComponent(name);
}

function amazonLiveSearchUrl(name: string): string {
  try {
    const u = new URL('https://www.amazon.in/s');
    u.searchParams.set('k', name);
    u.searchParams.set('tag', AFFILIATE_TAG);
    return u.toString();
  } catch {
    return 'https://www.amazon.in/s?k=' + encodeURIComponent(name);
  }
}

function amazonStallUrl(amazonUrl: string): string {
  try {
    const url = new URL(amazonUrl);
    url.searchParams.set('tag', AFFILIATE_TAG);
    return url.toString();
  } catch {
    return amazonUrl + (amazonUrl.includes('?') ? '&' : '?') + 'tag=' + AFFILIATE_TAG;
  }
}

// The tracked ₹ discount a claimed seed-refund is worth lives in
// `lib/marketPricing` — two cards render that number and they already drifted
// apart once when one was left on the old seedPrice/200 formula.

// ClaimedRefund lives in types.ts: the marketLedger row persists it, and the
// page only renders it.

function makeRefundCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) out += chars[buf[i] % chars.length];
  return `PD-${out.slice(0, 3)}-${out.slice(3)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

// One-time import of the pre-ledger localStorage state. Runs only when the
// user has no ledger row, so it can never resurrect deleted data. Writes the
// imported row, then removes the keys — after the put resolves, so a failed
// write leaves the originals in place — and returns the row it wrote so the
// caller can hydrate the mirrors from it directly. That hand-off matters: the
// write-back effect is armed as soon as hydration finishes, and its empty
// initial state would otherwise race the import put and erase it.
async function migrateLegacyMarketState(userId: string): Promise<MarketLedgerRow | null> {
  const refunds = readJson<ClaimedRefund[]>(REFUNDS_KEY, []);
  const tickets = readJson<string[]>(TICKET_KEY, []);
  const wishlist = readJson<string[]>(WISH_KEY, []);
  const cart = readJson<unknown[]>(CART_KEY, []);
  if (!refunds.length && !tickets.length && !wishlist.length && !cart.length) return null;
  const row: MarketLedgerRow = {
    userId,
    refunds,
    claimedItemIds: refunds.map(r => r.id),
    tickets,
    wishlist,
    cart: cart as Array<Record<string, unknown>>,
    updatedAt: Date.now(),
  };
  await db.marketLedger.put(row);
  for (const key of [CART_KEY, WISH_KEY, TICKET_KEY, REFUNDS_KEY]) {
    localStorage.removeItem(key);
  }
  return row;
}



// ── DAILY MARKET ENGINE ──
// The same date-seed pattern the Library's daily quiz uses: everyone sees the
// same harvest on a given day, and it is a different stall at midnight.
function marketDayNumber(): number {
  const t = new Date();
  const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return Math.floor(new Date(key).getTime() / 86400000);
}

function seededPick<T>(items: T[], count: number, seed: number): T[] {
  let a = (seed >>> 0) || 1;
  const rand = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, count);
}

// The market's daily audit: one curated, sourced plant/garden finding and the
// stall item that puts it to work. Rotates at midnight so the bazaar teaches
// something new every single day.
const FRESH_FINDS: { insight: string; source: string; matchProductId: string }[] = [
  { insight: 'Watering to a schedule is the top houseplant killer — test the soil two knuckles deep first; most plants want a drink only when that layer is dry.', source: 'Royal Horticultural Society', matchProductId: 'drop-6' },
  { insight: 'Terracotta breathes: porous walls wick moisture out, making overwatering nearly impossible — the pot of choice for succulents and beginners alike.', source: 'University of Illinois Extension', matchProductId: 'drop-1' },
  { insight: 'Neem oil disrupts the life cycle of over 200 soft-bodied pests and is safe indoors — spray at dusk so sun on oiled leaves never scorches.', source: 'Journal of Economic Entomology', matchProductId: 'drop-2' },
  { insight: 'Yellowing bottom leaves usually mean the plant is sacrificing its oldest growth — a watering-rhythm problem far more often than a disease.', source: 'Cornell Botanic Gardens', matchProductId: 'drop-4' },
  { insight: 'Climbing aroids only grow their mature, fenestrated leaves once the stem can climb — a moss pole literally changes what the plant becomes.', source: 'Missouri Botanical Garden', matchProductId: 'drop-8' },
  { insight: 'Copper is antimicrobial: a copper can inhibits algae and bacteria in standing water between refills, so roots drink cleaner.', source: 'American Society for Horticultural Science', matchProductId: 'drop-7' },
  { insight: 'A humidity tray lifts local moisture 10-15% around a plant — enough for calatheas and ferns without running a humidifier all day.', source: 'Botanic Gardens Conservation International', matchProductId: 'drop-6' },
  { insight: 'Repot in spring, when roots regrow fastest, and go up only 1-2 pot sizes — a much larger volume stays soggy and invites rot.', source: 'Royal Horticultural Society', matchProductId: 'drop-1' },
  { insight: 'Group plants with similar thirst: clustering also builds a shared humid microclimate that tropicals read as home.', source: 'Royal Botanic Gardens, Kew', matchProductId: 'drop-3' },
  { insight: 'Occasional top-watering flushes accumulated fertiliser salts out of the soil; bottom-watering alone lets them build up and crisp the leaf tips.', source: 'Penn State Extension', matchProductId: 'drop-7' },
  { insight: 'A pot without drainage is a pond with a plant in it — however pretty the cachepot, the inner grow-pot needs an exit.', source: 'Brooklyn Botanic Garden', matchProductId: 'drop-1' },
  { insight: 'Spider mites explode in dry, still air; a weekly leaf-shower plus a humidity tray is the cheapest infestation insurance there is.', source: 'UC Statewide IPM Program', matchProductId: 'drop-6' },
  { insight: 'Roots need oxygen as much as water — a chunky, airy mix lets both in, and is the single cheapest upgrade for a slow plant.', source: 'Royal Horticultural Society', matchProductId: 'drop-5' },
  { insight: 'Filtered or rain water prevents the mineral crust tap water leaves on calathea and maranta soil.', source: 'Missouri Botanical Garden', matchProductId: 'drop-2' },
];

function todaysFreshFind(day: number) {
  return FRESH_FINDS[day % FRESH_FINDS.length];
}

// Today's Harvest: three stalls at 40% off their seed refund, drawn fresh at
// midnight. Deterministic per date, identical for every Keeper. Takes the
// catalogue and the stall day rather than reading them itself, so early
// access and the tier discount flow through the same path as every other
// price on the page.
function todaysHarvest(products: MarketProduct[], day: number) {
  return seededPick(products, 3, day * 31 + 7).map(p => ({
    ...p,
    seedPrice: Math.round(p.seedPrice * 0.6),
    isLimited: true,
    tags: [...p.tags, 'harvest'],
  }));
}

// ── HERO CAROUSEL ──
function HeroCarousel({ onClaim, seeds, products }: { onClaim: (id: string, refundValue: number) => void; seeds: number; products: MarketProduct[] }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const heroProducts = products.filter(p => p.isLimited).slice(0, 3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % heroProducts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroProducts.length]);

  const product = heroProducts[carouselIndex];
  // Calculate real-world refund logic (e.g., 200 seeds = ₹1)
  const refundValue = refundValueFor(product);
  const finalPrice = product.cashPrice - refundValue;
  const shortfall = Math.max(0, product.seedPrice - seeds);
  const canAfford = shortfall === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[1.75rem] mb-12 shadow-2xl border border-[#c4a574]/40"
      style={{ background: 'linear-gradient(180deg, #3d2a1c 0%, #5c3d2e 40%, #2c2419 100%)' }}
    >
      <div
        className="h-7 w-full"
        style={{
          background: 'repeating-linear-gradient(90deg, #c17f59 0 18px, #f4e4c1 18px 36px)',
          boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2)',
        }}
      />
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center p-6 md:p-10 text-[#faf3e8]">
        
        {/* Left: Image with Animation */}
        <motion.div
          key={`hero-img-${product.id}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="relative rounded-sm overflow-hidden border-[6px] border-[#e8d5b0] shadow-[8px_8px_0_rgba(0,0,0,0.25)] aspect-[4/5] bg-[#1a1410]">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.opacity = '0';
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
          <div className="absolute -top-2 -right-2 rotate-12 bg-[#f4e4c1] text-[#3d2a1c] px-4 py-3 shadow-lg border border-[#c4a574]">
            <p className="text-[9px] font-black uppercase tracking-widest">Stall price</p>
            <p className="font-serif text-2xl font-bold leading-none">₹{finalPrice}</p>
            <p className="text-[10px] mt-1 text-moss font-bold">₹{refundValue} seed refund</p>
          </div>
        </motion.div>

        {/* Right: Content */}
        <motion.div
          key={`hero-content-${product.id}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-[#c17f59] text-[#faf3e8] rounded-sm text-[10px] font-black uppercase tracking-[0.2em]"
            >
              <Zap size={12} /> Today’s stall · limited crate
            </motion.div>
            
            <h2 className="font-serif text-4xl lg:text-5xl font-semibold leading-tight text-[#faf3e8]">
              {product.name}
            </h2>
            
            <p className="text-[#e8d5b0]/80 text-base leading-relaxed max-w-lg">
              {product.subtitle}
            </p>
          </div>

          {/* Seed Refund Pricing Mechanic */}
          <div className="flex flex-col gap-3 py-4 border-y border-[#e8d5b0]/20">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-[#e8d5b0]/70 uppercase tracking-widest mb-1">On Amazon</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold font-mono text-[#faf3e8]">₹{product.cashPrice}</p>
                  {product.originalPrice && (
                    <p className="text-xs text-[#e8d5b0]/40 line-through">₹{product.originalPrice}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-[#9cba9c] uppercase tracking-widest mb-1">After seed refund</p>
                <p className="text-2xl font-bold font-mono text-[#9cba9c]">₹{finalPrice}</p>
              </div>
            </div>
            <p className="text-xs text-[#e8d5b0]/70 flex items-center gap-1">
              Spend <Leaf size={12} className="text-[#9cba9c]" /> {product.seedPrice.toLocaleString()} seeds at this stall to unlock the refund.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <motion.button
              whileHover={canAfford ? { scale: 1.02 } : undefined}
              whileTap={canAfford ? { scale: 0.98 } : undefined}
              onClick={() => {
                if (!canAfford) return;
                onClaim(product.id, refundValue);
              }}
              disabled={!canAfford}
              aria-disabled={!canAfford}
              title={canAfford ? undefined : `You need ${shortfall.toLocaleString()} more seeds`}
              className={`flex-1 font-black py-4 px-6 rounded-sm transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-[0.16em] ${
                canAfford
                  ? "bg-[#c17f59] hover:bg-[#a85a42] text-white shadow-lg cursor-pointer"
                  : "bg-white/10 text-[#e8d5b0]/45 cursor-not-allowed"
              }`}
            >
              <ShoppingBag size={18} />
              {canAfford
                ? <>Buy at stall · claim refund <ExternalLink size={16} className="ml-1" /></>
                : <>Need {shortfall.toLocaleString()} more seeds</>}
            </motion.button>
          </div>

          {/* Carousel Dots */}
          {/* The dot is drawn by an inner bar; the button around it is the hit
              area. They used to be the same element, which made every dot an
              8px-tall button -- unpickable with a thumb on a moving bus. The
              active bar's colour animates on the bar, exactly as before. */}
          <div className="flex gap-1 pt-4 justify-start">
            {heroProducts.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCarouselIndex(idx)}
                aria-label={`Go to stall slide ${idx + 1}`}
                className="min-h-[44px] px-1.5 flex items-center"
              >
                <motion.span
                  animate={{
                    width: idx === carouselIndex ? 24 : 8,
                    backgroundColor: idx === carouselIndex ? 'var(--accent-sage)' : 'var(--text-stone)',
                    opacity: idx === carouselIndex ? 1 : 0.3
                  }}
                  className="h-2 rounded-full block"
                />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── PRODUCT CARD ──
function ProductCard({ product, onClaim, onAddToCart, wished, onToggleWish, seeds, legendaryLocked, legendaryLevel }: { product: MarketProduct; onClaim: (id: string, refundValue: number) => void; onAddToCart?: (product: any) => void; wished?: boolean; onToggleWish?: (id: string) => void; seeds: number; legendaryLocked?: boolean; legendaryLevel?: number }) {
  // Calculate real-world refund logic
  const reduced = useReducedMotion();
  const refundValue = refundValueFor(product);
  const shortfall = Math.max(0, product.seedPrice - seeds);
  const canAfford = shortfall === 0 && !legendaryLocked;

  const handleAmazonRedirect = () => {
    onClaim(product.id, refundValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-[#f7f0e4] border border-[#d9c4a0] overflow-hidden hover:shadow-[0_16px_40px_rgba(61,42,28,0.18)] transition-all duration-300 flex flex-col"
    >
      <div className="h-2 w-full" style={{ background: 'repeating-linear-gradient(90deg, #5a7d5a 0 10px, #c17f59 10px 20px)' }} />
      <div onClick={handleAmazonRedirect} className="relative h-52 overflow-hidden cursor-pointer bg-[#e8dcc8]">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.currentTarget.style.opacity = '0';
          }}
        />
        {product.isLimited && (
          <div className="absolute top-3 left-3 bg-[#c17f59] text-white px-2.5 py-1 text-[9px] font-black tracking-widest uppercase shadow-md">
            Limited crate
          </div>
        )}
        {product.proEarlyAccess && (
          <div className="absolute top-3 right-3 bg-[#d4af37] text-[#2c2419] px-2.5 py-1 text-[9px] font-black tracking-widest uppercase">
            Early stall
          </div>
        )}
        {legendaryLocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#2c2419]/72 backdrop-blur-[2px]">
            <motion.div
              animate={reduced ? {} : { scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Gem size={26} className="text-[#d4af37]" />
            </motion.div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f4e4c1]">Legendary crate</p>
            <p className="text-[10px] text-[#e8d5b0]/75">Opens at level {legendaryLevel} · Flora Sage</p>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleWish?.(product.id); }}
          // 44x44, not `p-2`: pinning is a primary card action and measured
          // 32x32 at 390px -- 12px under the touch minimum, on every card of
          // every stall. The button is absolutely positioned, so growing it
          // extends the hit area over the image without moving the layout.
          className={`absolute bottom-3 left-3 h-11 w-11 flex items-center justify-center border ${wished ? 'bg-[#c17f59] text-white border-[#c17f59]' : 'bg-[#fff8e8]/95 text-[#3d2a1c] border-[#c4a574]'}`}
          aria-label={wished ? 'Unpin crate' : 'Pin crate'}
        >
          <Bookmark size={16} fill={wished ? 'currentColor' : 'none'} />
        </button>
        <div className="absolute -bottom-3 right-3 rotate-6 bg-[#fff8e8] border border-[#c4a574] px-3 py-2 shadow-md">
          <p className="text-[9px] uppercase tracking-widest text-[#7a6a50] font-black">Ask</p>
          <p className="font-serif text-lg font-bold text-[#3d2a1c] leading-none">₹{product.cashPrice}</p>
        </div>
      </div>

      <div className="p-4 pt-6 flex flex-col flex-grow">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 onClick={handleAmazonRedirect} className="font-serif text-[17px] font-semibold text-[#2c2419] leading-tight line-clamp-2 cursor-pointer hover:text-moss">
              {product.name}
            </h3>
            <p className="text-[11px] text-[#7a6a50] mt-1 line-clamp-1">{product.subtitle}</p>
          </div>
          <div className="flex items-center gap-0.5 text-[#c4a035] text-xs shrink-0">
            <Star size={11} fill="currentColor" />
            <span className="font-bold">{product.rating}</span>
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#7a6a50]">After seed refund</span>
            <span className="font-mono font-bold text-moss">₹{Math.max(0, product.cashPrice - refundValue)}</span>
          </div>
          <p className="text-[10px] text-[#7a6a50] flex items-center gap-1">
            <Leaf size={10} className="text-moss" /> {product.seedPrice.toLocaleString()} seeds at this stall
            {!canAfford && (
              <span className="ml-auto text-[#b4552d] font-semibold">
                {shortfall.toLocaleString()} short
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => onAddToCart?.(product)}
              className="flex-1 bg-[#5a7d5a] hover:bg-[#3d6b4a] text-white font-black py-2.5 px-3 text-[10px] uppercase tracking-widest">
              Add to basket
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAmazonRedirect}
              className="flex-1 border border-[#c4a574] bg-[#fff8e8] hover:bg-[#f4e4c1] text-[#3d2a1c] font-black py-2.5 px-2 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
              Claim <ExternalLink size={11} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => window.open(amazonLiveSearchUrl(product.name), '_blank', 'noopener')}
              title="See live Amazon listings for this"
              className="border border-[#c4a574] bg-[#fff8e8] hover:bg-[#f4e4c1] text-[#3d2a1c] font-black py-2.5 px-2.5 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
              <ExternalLink size={11} /> a
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => window.open(flipkartSearchUrl(product.name), '_blank', 'noopener')}
              title="See live Flipkart listings for this"
              className="border border-[#c4a574] bg-[#fff8e8] hover:bg-[#f4e4c1] text-[#3d2a1c] font-black py-2.5 px-2.5 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
              <ExternalLink size={11} /> f
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// The shop's category chips. One chip per aisle; 'seeds-tools' groups the two
// small ones. The stray 'drops' category on the ceramic planter was a data
// mistake — it is a planter — so that value no longer exists.
const SHOP_CHIPS: [string, string][] = [
  ['all', 'All crates'],
  ['home', 'Pots & hangers'],
  ['care', 'Oils & soil'],
  ['seeds-tools', 'Seeds & tools'],
];

// ── TIER LADDER STRIP ──
// Every market promise LEVEL_TIERS makes, shown where the spending happens
// with its live state. This is the strip that makes the ladder legible: until
// it existed, the game computed these unlocks into levelProgress and then
// never told the shop about them.
const LADDER_CHIPS: { key: keyof MarketPrivileges; label: string; level: number; icon: typeof Lock; blurb: string }[] = [
  { key: 'shopUnlocked', label: 'Stalls open', level: 5, icon: ShoppingBag, blurb: 'Spend seeds at the bazaar' },
  { key: 'earlyAccessHours', label: 'Early stall', level: 8, icon: Clock, blurb: 'Tomorrow’s floor from noon' },
  { key: 'freeShippingVouchers', label: 'Free shipping', level: 10, icon: Truck, blurb: 'Shipping tickets punchable' },
  { key: 'voucherExchangeBonusPct', label: '+10% exchange', level: 17, icon: Ticket, blurb: 'Tickets cost 10% fewer seeds' },
  { key: 'legendaryDrops', label: 'Legendary', level: 18, icon: Gem, blurb: 'The two dearest crates open' },
  { key: 'discountPct', label: '−5% seeds', level: 20, icon: Percent, blurb: 'Off every seed price, forever' },
];

function TierLadderStrip({ level, privileges }: { level: number; privileges: MarketPrivileges }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-10 rounded-xl border border-[#d9c4a0] bg-[#fff8e8] p-4"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c6d46] mb-3 flex items-center gap-1.5">
        <Crown size={12} /> Your bazaar standing · level {level}
      </p>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
      >
        {LADDER_CHIPS.map(({ key, label, level: at, icon: Icon, blurb }) => {
          const value = privileges[key];
          const on = typeof value === 'boolean' ? value : (value as number) > 0;
          return (
            <motion.div
              key={key}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
              }}
              whileHover={reduced ? undefined : { y: -2 }}
              title={blurb}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left ${
                on ? 'bg-[#eef4e6] border-[#5a7d5a]/40' : 'bg-[#f7f0e4] border-[#d9c4a0]'
              }`}
            >
              <Icon size={15} className={on ? 'text-[#3d6b4a] shrink-0' : 'text-[#a09070] shrink-0'} />
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-wider truncate ${on ? 'text-[#2c4a2c]' : 'text-[#7a6a50]'}`}>
                  {label}
                </p>
                <p className="text-[9px] text-[#a09070] font-mono">{on ? 'unlocked' : `level ${at}`}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ── STALL LOCK ──
// Shown in place of the physical stalls until level 5. The stall stays
// browsable-in-principle, but nothing here spends seeds, so hiding the empty
// shelf behind a locked door with the exact XP remaining is more honest than
// a shop of buttons that all bounce you off.
function StallLock({ level, xpToNext, xpProgress, nextUnlock }: {
  level: number;
  xpToNext: number;
  xpProgress: number;
  nextUnlock: { level: number; feature: string } | null;
}) {
  const reduced = useReducedMotion();
  // The tier that opens the stalls — read from LEVEL_TIERS rather than a
  // copied 700, so rebalancing the tier moves the lock with it.
  const target = LEVEL_TIERS.find(t => t.unlocks.market?.shop) ?? LEVEL_TIERS[0];
  const xpIntoTier = Math.max(0, target.xpRequired - xpToNext);
  const pct = Math.min(100, Math.round((xpIntoTier / target.xpRequired) * 100));
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-xl mx-auto rounded-2xl border-2 border-dashed border-[#c4a574] bg-[#fff8e8] p-8 text-center"
    >
      <motion.div
        animate={reduced ? {} : { y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f4e4c1] border border-[#c4a574] flex items-center justify-center"
      >
        <Lock size={26} className="text-[#8c6d46]" />
      </motion.div>
      <h3 className="font-serif text-2xl font-semibold text-[#3d2a1c] mb-2">The stalls open at Leaf-Bearer</h3>
      <p className="text-sm text-[#7a6a50] leading-relaxed mb-6">
        The bazaar is a seed sink, so it opens once you have a garden to spend on — level {target.level},
        {' '}{target.xpRequired.toLocaleString()} XP. Diagnosing plants, keeping your streak and winning duels all count.
      </p>
      <div className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-[#8c6d46]">
        <span>Level {level}</span>
        <span>{Math.max(0, target.xpRequired - xpIntoTier)} XP to go</span>
      </div>
      <div className="h-3 rounded-full bg-[#e8dcc8] overflow-hidden border border-[#d9c4a0]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #5a7d5a, #8fae7a)' }}
        />
      </div>
      {nextUnlock && nextUnlock.level > 5 && (
        <p className="text-[11px] text-[#a09070] mt-4">
          Next on the ladder: <span className="font-bold text-[#8c6d46]">{nextUnlock.feature}</span> at level {nextUnlock.level}
        </p>
      )}
    </motion.div>
  );
}

// ── MARKET PULSE ──
// Seven days of the stall, read off the same seeded rotation that stocks it —
// no stored history, no mock series. The floor genuinely is different every
// morning, and this is the shape of that difference.
function MarketPulse({ day }: { day: number }) {
  const reduced = useReducedMotion();
  const data = useMemo(() => {
    const rows: { day: string; crates: number; seedValue: number }[] = [];
    for (let back = 6; back >= 0; back--) {
      const d = day - back;
      const floor = seededPick(MOCK_PRODUCTS, Math.max(8, MOCK_PRODUCTS.length - 4), d * 13 + 1);
      const label = new Date(Date.now() - back * 86400000).toLocaleDateString(undefined, { weekday: 'short' });
      rows.push({
        day: d === day ? 'Today' : label,
        crates: floor.length,
        seedValue: Math.round(floor.reduce((s, p) => s + p.seedPrice, 0) / 1000),
      });
    }
    return rows;
  }, [day]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12 rounded-xl border border-[#d9c4a0] bg-[#fff8e8] p-5"
    >
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c6d46] flex items-center gap-1.5">
          <TrendingUp size={12} /> Market pulse · last 7 mornings
        </p>
        <p className="text-[10px] text-[#a09070]">seed value in thousands</p>
      </div>
      <p className="text-[11px] text-[#7a6a50] mb-4">
        How the floor has been stocked. The restock is seeded by date, so this is the bazaar's real rhythm — not a forecast.
      </p>
      <div className="h-44 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5a7d5a" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#5a7d5a" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#7a6a50' }} axisLine={{ stroke: '#d9c4a0' }} tickLine={false} />
            <YAxis width={34} tick={{ fontSize: 10, fill: '#a09070' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#fff8e8', border: '1px solid #d9c4a0', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#3d2a1c', fontWeight: 700 }}
              formatter={(value: number | string, name: string) =>
                name === 'crates' ? [`${value} crates`, 'On the floor'] : [`₹${value}k of seeds`, 'Floor value']
              }
            />
            <Area
              type="monotone"
              dataKey="crates"
              stroke="#3d6b4a"
              strokeWidth={2}
              fill="url(#pulseFill)"
              dot={{ r: 2.5, fill: '#3d6b4a' }}
              animationDuration={reduced ? 0 : 900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ── PRO BANNER ──
function ProBanner() {
  // This button was styled, animated, labelled "Upgrade — ₹99/mo" and had no
  // onClick at all: the most prominent call to action on the page did nothing
  // when pressed. Profile owns the real checkout, so that is where it goes.
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="mt-16 overflow-hidden relative border border-[#c4a574] rounded-sm"
      style={{ background: 'linear-gradient(90deg, #3d2a1c, #5a7d5a 55%, #c17f59)' }}
    >
      <div className="h-4" style={{ background: 'repeating-linear-gradient(90deg, #f4e4c1 0 14px, #c17f59 14px 28px)' }} />
      <div className="relative z-10 grid md:grid-cols-3 gap-8 items-center p-8 md:p-10 text-[#faf3e8]">
        <div>
          <h3 className="font-serif text-3xl font-semibold mb-2">Greenhouse membership</h3>
          <p className="text-[#faf3e8]/70 text-sm">Early crates, extra plant slots, pest AI at the stall before dawn.</p>
        </div>
        <div className="md:border-x md:border-white/15 md:px-8 space-y-2">
          {['Unlimited plant slots', 'Advanced pest AI', 'Early access drops'].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-[#faf3e8]/85">
              <Leaf size={14} className="text-[#d4e8c4]" />
              {feature}
            </div>
          ))}
        </div>
        <motion.button
          onClick={() => navigate('/profile')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-[#f4e4c1] hover:bg-white text-[#3d2a1c] font-black py-4 px-8 uppercase tracking-[0.16em] text-xs"
        >
          Upgrade — ₹99/mo
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── SANCTUARY SHELF ──
// Everything here is bought with seeds, not money. The bazaar tabs all end in
// an Amazon redirect and a real currency, which is the wrong register for a
// game balance; this is the shelf where seeds actually mean something.
//
// Each ritual wears the palette of the thing it does, so the shelf reads as a
// cabinet of curiosities rather than a pricing table: frost is cold and slowly
// turning, the dove drifts, the season swells, the charm glitters.

/** Idle animation for a ritual's icon, keyed off its theme. */
function RitualIcon({ icon, motion: kind }: { icon: string; motion: SanctuaryTheme['motion'] }) {
  const reduced = useReducedMotion();
  const loop = (animate: TargetAndTransition, transition: Transition) =>
    reduced ? {} : { animate, transition: { ...transition, repeat: Infinity, ease: 'easeInOut' as const } };

  switch (kind) {
    case 'rotate':
      return <motion.span {...loop({ rotate: 360 }, { duration: 14 })} className="inline-block">{icon}</motion.span>;
    case 'float':
      return <motion.span {...loop({ y: [0, -5, 0] }, { duration: 3.2 })} className="inline-block">{icon}</motion.span>;
    case 'pulse':
      return <motion.span {...loop({ scale: [1, 1.14, 1] }, { duration: 2.6 })} className="inline-block">{icon}</motion.span>;
    case 'twinkle':
      return (
        <motion.span
          {...loop({ rotate: [-8, 8, -8], scale: [1, 1.16, 1], opacity: [0.75, 1, 0.75] }, { duration: 2.2 })}
          className="inline-block"
        >
          {icon}
        </motion.span>
      );
    case 'sway':
      return <motion.span {...loop({ rotate: [-7, 7, -7] }, { duration: 3.8 })} className="inline-block">{icon}</motion.span>;
  }
}

function SanctuaryShelf({ seeds, userId }: { seeds: number; userId: string }) {
  const { success, error } = useToast();
  const reduced = useReducedMotion();
  const [stock, setStock] = useState<Partial<Record<SanctuaryItemId, number>>>({});
  const [busy, setBusy] = useState<SanctuaryItemId | null>(null);
  const [open, setOpen] = useState<SanctuaryItemId | null>(null);

  const refresh = async () => setStock(await SanctuaryService.getStock(userId));
  useEffect(() => { refresh().catch(() => {}); }, [userId, seeds]);

  const buy = async (item: SanctuaryItem) => {
    if (busy) return;
    setBusy(item.id);
    try {
      await SanctuaryService.purchase(item.id, userId);
      await refresh();
      success(`${item.icon} ${item.name} is yours. ${item.blurb}`);
    } catch (e: any) {
      error(e.message || 'The Sanctuary could not take that.');
    } finally {
      setBusy(null);
    }
  };

  const enter = (i: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06 } };

  return (
    <div className="space-y-12">
      <header className="max-w-2xl">
        <h2 className="font-serif text-3xl font-semibold text-[#3d2a1c]">The Sanctuary</h2>
        <p className="mt-2 text-sm text-[#7a6a50]">
          Seeds are the currency of showing up. Spend them on the rituals below — every one of them
          does something real somewhere else in the app, and nothing here expires on you.
        </p>
      </header>

      {SANCTUARY_CATEGORIES.map(cat => {
        const items = SANCTUARY_ITEMS.filter(i => i.category === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id}>
            <div className="flex items-center gap-3 mb-5">
              <h3 className="font-serif text-xl font-semibold text-[#3d2a1c]">{cat.label}</h3>
              <span className="text-[11px] text-[#a09070] italic">{cat.blurb}</span>
              <span className="flex-1 h-px bg-gradient-to-r from-[#d9c4a0] to-transparent" aria-hidden />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {items.map((item, i) => {
                const t = SANCTUARY_THEMES[item.id];
                const held = stock[item.id] ?? 0;
                const atCap = item.maxHeld > 0 && held >= item.maxHeld;
                const shortfall = Math.max(0, item.seedPrice - seeds);
                const canAfford = shortfall === 0;
                const expanded = open === item.id;
                return (
                  <motion.article
                    key={item.id}
                    {...enter(i)}
                    whileHover={reduced ? undefined : { y: -4 }}
                    className="relative overflow-hidden border p-5 flex flex-col shadow-[0_2px_10px_rgba(61,42,28,0.06)] hover:shadow-[0_10px_28px_rgba(61,42,28,0.12)] transition-shadow"
                    style={{
                      background: t.wash,
                      borderColor: atCap ? '#3c6b44' : `${t.accent}55`,
                    }}
                  >
                    {/* Ambient glow pooling behind the icon, breathing slowly. */}
                    <motion.div
                      aria-hidden
                      className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl pointer-events-none"
                      style={{ background: t.glow }}
                      {...(reduced ? {} : { animate: { opacity: [0.5, 1, 0.5], scale: [1, 1.12, 1] }, transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' } })}
                    />

                    <div className="relative flex items-start gap-4">
                      <motion.div
                        aria-hidden
                        whileHover={reduced ? undefined : { scale: 1.08, rotate: -4 }}
                        className="w-14 h-14 shrink-0 border flex items-center justify-center text-2xl select-none"
                        style={{ background: t.iconBg, borderColor: `${t.accent}55` }}
                      >
                        <RitualIcon icon={item.icon} motion={t.motion} />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-serif text-lg font-semibold text-[#3d2a1c]">{item.name}</h4>
                          {held > 0 && (
                            <motion.span
                              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="shrink-0 text-[10px] font-black uppercase tracking-widest text-white px-2 py-1"
                              style={{ background: atCap ? '#3c6b44' : t.accent }}
                            >
                              {item.unit === 'payouts'
                                ? `${held} payout${held === 1 ? '' : 's'} doubled`
                                : `${held} held`}
                            </motion.span>
                          )}
                        </div>
                        <p className="text-sm text-[#7a6a50]">{item.blurb}</p>
                      </div>
                    </div>

                    <p className="relative mt-3 text-[13px] text-[#5c4a36] leading-relaxed">{item.effect}</p>

                    <AnimatePresence>
                      {expanded && (
                        <motion.p
                          initial={reduced ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="relative overflow-hidden text-[12px] italic text-[#a09070] pl-3 mt-3"
                          style={{ borderLeft: `2px solid ${t.accent}66` }}
                        >
                          {item.lore}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <div className="relative mt-4 pt-3 border-t border-[#3d2a1c]/10 flex items-end justify-between gap-3 mt-auto">
                      <div>
                        <div className="font-mono text-sm font-black" style={{ color: t.accent }}>
                          {item.seedPrice.toLocaleString()}{' '}
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#7a6a50]">seeds</span>
                        </div>
                        {!canAfford && !atCap && (
                          <div className="text-[11px] text-[#b4552d]">
                            {shortfall.toLocaleString()} short
                          </div>
                        )}
                        {atCap && (
                          <div className="text-[11px] text-[#3c6b44]">Carrying the maximum</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpen(expanded ? null : item.id)}
                          aria-expanded={expanded}
                          className="min-h-[44px] px-3 text-[10px] font-black uppercase tracking-widest border text-[#6e5843] hover:bg-white/60"
                          style={{ borderColor: `${t.accent}44` }}
                        >
                          {expanded ? 'Less' : 'Details'}
                        </button>
                        <motion.button
                          onClick={() => buy(item)}
                          disabled={!canAfford || atCap || busy === item.id}
                          aria-disabled={!canAfford || atCap}
                          title={atCap ? 'You are carrying the maximum' : canAfford ? undefined : `Need ${shortfall.toLocaleString()} more seeds`}
                          whileTap={canAfford && !atCap && !reduced ? { scale: 0.94 } : undefined}
                          className="min-h-[44px] px-4 text-[10px] font-black uppercase tracking-widest text-[#fff8e8] disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: atCap ? '#3c6b44' : t.accent }}
                        >
                          {busy === item.id ? 'Buying…' : atCap ? 'Full' : 'Acquire'}
                        </motion.button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── MAIN EXPORT ──
// ── TODAY'S HARVEST ── three stalls at 40% off, redrawn every midnight ──
function TodaysHarvest({ onClaim, onAddToCart, seeds, products, day }: { onClaim: (id: string, refundValue: number) => void; onAddToCart?: (product: any) => void; seeds: number; products: MarketProduct[]; day: number }) {
  const deals = todaysHarvest(products, day);
  return (
    <div>
      <motion.h2 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="font-serif text-2xl md:text-3xl font-semibold mb-1 text-[#3d2a1c]">
        Today's harvest
      </motion.h2>
      <p className="text-sm text-[#7a6a50] mb-6">Three stalls picked at midnight — <span className="font-bold text-[#5a7d5a]">40% off seed refunds</span>, back to full price tomorrow.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deals.map((product) => (
          <ProductCard
            key={'harvest-' + product.id}
            product={product}
            onClaim={onClaim}
            onAddToCart={onAddToCart}
            wished={false}
            seeds={seeds}
          />
        ))}
      </div>
    </div>
  );
}

// ── FRESH FINDS ── the daily garden audit, sourced, with the stall that uses it ──
function FreshFindsAudit({ onClaim, seeds, products, day }: { onClaim: (id: string, refundValue: number) => void; seeds: number; products: MarketProduct[]; day: number }) {
  const find = todaysFreshFind(day);
  const match = products.find(p => p.id === find.matchProductId) ?? products[0];
  return (
    <div className="rounded-xl border-2 border-[#d9c4a0] bg-[#fff8e8] p-5 flex flex-col md:flex-row gap-5 items-start shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8c6d46] mb-2 flex items-center gap-1.5">
          <Leaf size={12} /> Fresh finds · audited today
        </p>
        <p className="text-sm md:text-[15px] text-[#3d2a1c] leading-relaxed font-medium">{find.insight}</p>
        <p className="text-[10px] text-[#7a6a50] mt-3 uppercase tracking-wider">Source: {find.source} · a new audit every day</p>
      </div>
      <div className="w-full md:w-60 shrink-0">
        <ProductCard product={match} onClaim={onClaim} seeds={seeds} />
      </div>
    </div>
  );
}

// ── DIGITAL GOODS ── the seed-bought cosmetics shop, wired to the inventory ──
function DigitalGoods({ seeds, userId, notify }: { seeds: number; userId: string; notify: (ok: boolean, msg: string) => void }) {
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    GameService.getInventory(userId).then(inv => {
      if (!alive) return;
      setOwned(inv.map(c => c.itemId));
      const eq = inv.find(c => c.equipped);
      if (eq) setEquipped(eq.itemId);
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  const buy = async (itemId: string) => {
    const item = MARKETPLACE_ITEMS.find(i => i.id === itemId);
    if (!item || owned.includes(itemId)) return;
    setBusy(itemId);
    try {
      await GameService.purchaseItem(itemId, userId);
      setOwned(prev => [...prev, itemId]);
      notify(true, item.name + ' is yours — equip it right here or from your profile.');
    } catch (err: any) {
      notify(false, err?.message || 'Purchase failed.');
    } finally {
      setBusy(null);
    }
  };

  const equip = async (itemId: string) => {
    setBusy(itemId);
    try {
      await GameService.equipItem(itemId, userId);
      setEquipped(itemId);
      notify(true, 'Equipped.');
    } catch (err: any) {
      notify(false, err?.message || 'Could not equip.');
    } finally {
      setBusy(null);
    }
  };

  const rarityChip: Record<string, string> = {
    common: 'bg-[#8c7355]/15 text-[#6b5a3e]',
    rare: 'bg-[#4a7dab]/15 text-[#33587a]',
    epic: 'bg-[#8a5aab]/15 text-[#6a3f8a]',
    legendary: 'bg-[#b8862f]/20 text-[#8a6415]',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#3d2a1c]">Digital goods</h2>
        <p className="text-sm text-[#7a6a50] mt-1">Frames, themes and badges for your specimens and profile — bought outright with seeds, yours forever.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {MARKETPLACE_ITEMS.map(item => {
          const isOwned = owned.includes(item.id);
          const affordable = seeds >= item.price;
          const locked = item.isProOnly;
          return (
            <div key={item.id} className="rounded-xl border border-[#d9c4a0] bg-[#fff8e8] p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif font-bold text-[15px] text-[#3d2a1c] leading-snug">{item.name}</h3>
                <span className={'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shrink-0 ' + (rarityChip[item.rarity] ?? rarityChip.common)}>
                  {item.rarity}
                </span>
              </div>
              <p className="text-xs text-[#7a6a50] leading-relaxed flex-1">{item.description}</p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[13px] font-black text-[#5a7d5a]">
                  {item.price.toLocaleString()} <span className="text-[10px] uppercase tracking-wider">seeds</span>
                </span>
                {locked && <span className="text-[9px] font-black uppercase tracking-widest text-[#b8862f] flex items-center gap-1"><Crown size={10} /> Pro</span>}
              </div>
              {isOwned ? (
                <button
                  onClick={() => equip(item.id)}
                  disabled={busy === item.id || equipped === item.id}
                  className="min-h-[44px] rounded-lg bg-[#5a7d5a] disabled:bg-[#9db59d] text-white text-[10px] font-black uppercase tracking-widest"
                >
                  {equipped === item.id ? 'Equipped' : busy === item.id ? '…' : 'Equip'}
                </button>
              ) : (
                <button
                  onClick={() => buy(item.id)}
                  disabled={busy === item.id || !affordable}
                  className="min-h-[44px] rounded-lg bg-[#b89542] disabled:bg-[#d9c4a0] disabled:text-[#a08c68] text-[#241a12] text-[10px] font-black uppercase tracking-widest"
                >
                  {busy === item.id ? '…' : !affordable ? 'Need ' + (item.price - seeds).toLocaleString() + ' more' : 'Buy with seeds'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── REQUEST BOARD ── players ask the bazaar to stock what they actually want ──
interface MarketRequest {
  id: string;
  product_name: string;
  category: string;
  details: string | null;
  created_at: string;
  user_id: string;
}

const REQUEST_CATEGORIES = ['pots', 'care', 'tools', 'seeds', 'home', 'books', 'other'] as const;

function RequestBoard({ userId, notify }: { userId: string; notify: (ok: boolean, msg: string) => void }) {
  const [requests, setRequests] = useState<MarketRequest[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('care');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const authHeader = (): Record<string, string> => {
    const token = localStorage.getItem('botanical_guardian_auth_token');
    return token ? { Authorization: 'Bearer ' + token } : {};
  };

  // A failed read used to be indistinguishable from an empty board. This
  // caught every error, and on a non-ok response did nothing at all, so a 500
  // and a genuinely empty board both rendered the same bare sentence. The two
  // need different UI: one is a dead end, the other is an invitation.
  const load = async () => {
    try {
      const r = await fetch('/api/market/requests', { headers: authHeader() });
      if (!r.ok) {
        setLoadError(r.status === 401
          ? 'Sign in to see the request board.'
          : "The request board didn't load. Nothing you posted has been lost.");
        return;
      }
      const j = await r.json();
      setRequests(j.requests ?? []);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't reach the bazaar. Check your connection and try again.");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { load(); }, [loadNonce]);

  const submit = async () => {
    if (name.trim().length < 3) { notify(false, 'Tell us what to stock — at least 3 characters.'); return; }
    if (!localStorage.getItem('botanical_guardian_auth_token')) { notify(false, 'Sign in to ask the bazaar.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/market/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ productName: name.trim(), category, details: details.trim() || undefined }),
      });
      const j = await r.json().catch(() => ({}) as any);
      if (r.ok) {
        notify(true, 'Request posted — the bazaar reads this board every morning.');
        setName(''); setDetails('');
        load();
      } else {
        notify(false, j.error || 'Could not post your request.');
      }
    } catch {
      notify(false, 'Network hiccup — try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const timeAgo = (iso: string) => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.round(hrs / 24) + 'd ago';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#3d2a1c]">Ask the bazaar</h2>
        <p className="text-sm text-[#7a6a50] mt-1">
          Want something the stalls don't carry? Ask for it — the market is restocked every morning with a fresh plant-and-garden audit, and this board is read first.
        </p>
      </div>

      <div className="rounded-xl border border-[#d9c4a0] bg-[#fff8e8] p-4 space-y-3">
        {/* The three controls below carried placeholder text but no label. A
            placeholder disappears the moment the field is typed into and is
            not reliably announced, so a screen-reader user reaching the form
            had three unlabelled inputs and no idea what any of them was for.
            The labels are visible rather than visually-hidden: the form sits
            above a fold of empty board space, and this is the page's main
            call to action. */}
        <label htmlFor="req-name" className="block text-[10px] font-black uppercase tracking-widest text-[#6b5a3e]">
          What should the bazaar stock?
        </label>
        <input
          id="req-name"
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Self-watering spike set"
          maxLength={120}
          className="w-full min-h-[44px] px-3 py-2 text-sm border border-[#d9c4a0] bg-white text-[#3d2a1c] placeholder:text-[#7a6a50]/60"
        />
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="req-category" className="text-[10px] font-black uppercase tracking-widest text-[#6b5a3e]">
              Stall to ask
            </label>
            <select
              id="req-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="min-h-[44px] px-3 py-2 text-xs border border-[#d9c4a0] bg-white text-[#3d2a1c] capitalize"
            >
              {REQUEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label htmlFor="req-details" className="text-[10px] font-black uppercase tracking-widest text-[#6b5a3e]">
              Specifics <span className="font-normal normal-case tracking-normal text-[#7a6a50]">(optional)</span>
            </label>
            <input
              id="req-details"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Size, brand, anything that narrows it down"
              maxLength={500}
              className="min-h-[44px] px-3 py-2 text-sm border border-[#d9c4a0] bg-white text-[#3d2a1c] placeholder:text-[#7a6a50]/60"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={submit}
              disabled={busy}
              className="min-h-[44px] px-6 py-2 rounded bg-[#5a7d5a] disabled:bg-[#9db59d] text-white text-[10px] font-black uppercase tracking-widest shrink-0"
            >
              {busy ? 'Posting…' : 'Post request'}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#7a6a50]">Three requests a day keeps the board readable. Signed-in Keepers only.</p>
      </div>

      {/* The list region announces its own changes. Posting a request adds a
          row with no focus movement and no navigation, so without this the
          only signal that anything happened is the toast — and a toast is
          easy to miss, or to have already vanished. */}
      <div className="space-y-2" aria-live="polite" aria-busy={!loaded}>
        {!loaded && <SkeletonList rows={3} />}

        {loaded && loadError && (
          <ErrorState
            title="The board didn't load"
            message={loadError}
            onRetry={() => setLoadNonce(n => n + 1)}
          />
        )}

        {loaded && !loadError && requests.length === 0 && (
          <EmptyState
            compact
            title="Nothing on the board yet"
            body="Be the first to name a crate you'd like the bazaar to stock. The daily audit reads this list before the stalls are set."
            action={{
              label: 'Ask for something',
              onClick: () => nameRef.current?.focus()
            }}
          />
        )}

        {!loadError && requests.map(r => (
          <div key={r.id} className="rounded-lg border border-[#d9c4a0] bg-[#fff8e8] px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#3d2a1c] truncate">{r.product_name}</p>
              {r.details && <p className="text-xs text-[#7a6a50] truncate">{r.details}</p>}
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-block px-2 py-0.5 rounded bg-[#8c7355]/15 text-[#6b5a3e] text-[9px] font-black uppercase tracking-widest">{r.category}</span>
              <p className="text-[10px] text-[#7a6a50] mt-1">{timeAgo(r.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GardenMarket() {
  const { toasts, success, error, warning, reward } = useToast();
  const { theme } = useDayNightTheme();
  // Six stalls, not eight: "Open stall", "Pots & hangers" and "Oils & soil"
  // rendered the same grid three times over, differing only by category —
  // which is what the shop's chip row does in one place.
  const [activeTab, setActiveTab] = useState<'sanctuary' | 'shop' | 'digital' | 'vouchers' | 'requests' | 'saved'>('sanctuary');
  // Purchased state mirrors the user's marketLedger row (Dexie v22). They
  // start empty and hydrate once the row resolves — or once from the legacy
  // localStorage keys if the player predates the ledger. Kept as state rather
  // than derived from the query so every existing mutation site keeps its
  // synchronous shape; the persist effect below writes changes back.
  const [claimedItems, setClaimedItems] = useState<string[]>([]);
  const [claimedRefunds, setClaimedRefunds] = useState<ClaimedRefund[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [redeemedTickets, setRedeemedTickets] = useState<string[]>([]);
  const [appliedTicketId, setAppliedTicketId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    cost: number;
    onConfirm: () => void;
  } | null>(null);
  const [orderSuccessDialog, setOrderSuccessDialog] = useState<{
    code: string;
    refund: number;
    items: Array<{ name: string; amazonUrl: string }>;
  } | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    sort: 'popular',
    category: 'all',
    priceRange: [0, 5000],
    minRating: 0,
    limitedOnly: false,
    inStockOnly: false
  });
  // Bumped by the empty-stall action to clear every filter, including the
  // ones ProductFilters holds internally.
  const [filterResetSignal, setFilterResetSignal] = useState(0);
  const clearAllFilters = () => setFilterResetSignal(n => n + 1);

  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile());
  const levelProgress = useLiveQuery(() => db.levelProgress.get(userId));
  const streakRecord = useLiveQuery(() => db.streakRecords.get(userId));
  const seeds = profile?.seeds ?? 0;
  const level = levelProgress?.currentLevel ?? 1;
  const totalXp = Math.round(levelProgress?.totalXP ?? 0);
  const xpToNext = Math.round(levelProgress?.xpToNextLevel ?? 100);

  // The shop's side of the level ladder. Every price, lock and gate below
  // reads from this one object.
  const reduced = useReducedMotion();
  const privileges = useMemo(() => marketPrivilegesFor(level), [level]);
  const nextUnlock = useMemo(() => nextMarketUnlock(level), [level]);

  // Early access (L8): from `earlyAccessHours` before midnight, tomorrow's
  // stall is already on the floor. One day number drives the rotation, the
  // harvest and the pulse, so an early-access stall is the *same* stall
  // everyone else sees at midnight — not a different one.
  const earlyWindow = privileges.earlyAccessHours > 0 && new Date().getHours() >= 24 - privileges.earlyAccessHours;
  const stallDay = useMemo(() => marketDayNumber() + (earlyWindow ? 1 : 0), [earlyWindow]);
  const stallLeft = `${23 - new Date().getHours()}h ${59 - new Date().getMinutes()}m`;

  // The catalogue with the L20 standing discount folded into every seed
  // price. Cash prices are untouched — the rupee side belongs to Amazon.
  const pricedProducts = useMemo(
    () => MOCK_PRODUCTS.map(p => ({ ...p, seedPrice: seedPriceFor(p.seedPrice, level) })),
    [level]
  );

  const appliedTicket = TICKETS_FOR_SALE.find(v => v.id === appliedTicketId && redeemedTickets.includes(v.id));

  // The ledger row, with `null` meaning "resolved, no row yet" so the first
  // paint (undefined) can be told apart from an empty ledger.
  const ledger = useLiveQuery(async () => (await db.marketLedger.get(userId)) ?? null, [userId]);
  // Which user the local mirrors have been hydrated for. Keyed by user, not a
  // boolean: switching accounts must re-hydrate, and until it has, the write
  // effect below must stay blocked — otherwise the previous account's basket
  // would be written under the new account's id.
  const [ledgerReadyFor, setLedgerReadyFor] = useState<string | null>(null);
  useEffect(() => {
    if (ledger === undefined || ledgerReadyFor === userId) return;
    let cancelled = false;
    void (async () => {
      let row = ledger;
      if (!row) row = await migrateLegacyMarketState(userId);
      if (cancelled) return;
      if (row) {
        setClaimedRefunds(row.refunds ?? []);
        setClaimedItems(row.claimedItemIds ?? []);
        setRedeemedTickets(row.tickets ?? []);
        setWishlist(row.wishlist ?? []);
        setCartItems((row.cart ?? []) as any[]);
      }
      setLedgerReadyFor(userId);
    })();
    return () => { cancelled = true; };
  }, [ledger, ledgerReadyFor, userId]);

  // Single write-back: every mutation site above keeps its synchronous shape,
  // and this effect mirrors the whole ledger row after each change. Guarded
  // on ledgerReadyFor so the empty initial state cannot overwrite the row (or
  // the legacy import) before it has been read — for THIS user.
  useEffect(() => {
    if (ledgerReadyFor !== userId) return;
    void db.marketLedger.put({
      userId,
      refunds: claimedRefunds,
      claimedItemIds: claimedItems,
      tickets: redeemedTickets,
      wishlist,
      cart: cartItems as Array<Record<string, unknown>>,
      updatedAt: Date.now(),
    });
  }, [ledgerReadyFor, userId, claimedRefunds, claimedItems, redeemedTickets, wishlist, cartItems]);
  // Filter + sort products. The 'drops' tab previously handed MOCK_PRODUCTS
  // straight to .sort()/.reverse(), which reorder the module-level array in
  // place — so choosing "price: low" on Drops silently changed the order the
  // hero carousel and every other tab render from. Copy before sorting, and
  // memoize so typing in the search box doesn't re-filter the catalogue on
  // every keystroke.
  // Stalls restock at midnight: a date-seeded subset of the catalogue is on
  // the floor today (always leaving out at most four), so the bazaar is
  // genuinely different every morning. Pinned crates ignore the rotation.
  // Keyed on `stallDay`, not mounted once — the old `[]` deps meant a page
  // left open across midnight kept selling yesterday's floor all day.
  const inStockIds = useMemo(
    () => new Set(seededPick(pricedProducts, Math.max(8, pricedProducts.length - 4), stallDay * 13 + 1).map(p => p.id)),
    [pricedProducts, stallDay]
  );
  const filteredProducts = useMemo(() => {
    let products = activeTab === 'saved'
      ? pricedProducts.filter(p => wishlist.includes(p.id))
      : [...pricedProducts];
    // The shop's chip row. 'seeds-tools' groups the two small aisles under one
    // chip; 'drops' arrives from the filter panel's legacy option and reads as
    // "everything".
    if (activeTab === 'shop' && filters.category !== 'all') {
      products = filters.category === 'seeds-tools'
        ? products.filter(p => p.category === 'seeds' || p.category === 'tools')
        : products.filter(p => p.category === filters.category);
    }
    if (activeTab === 'shop') products = products.filter(p => inStockIds.has(p.id));

    if (filters.limitedOnly) products = products.filter(p => p.isLimited);
    if (filters.search) products = products.filter(p =>
      p.name.toLowerCase().includes(filters.search.toLowerCase())
    );
    if (filters.priceRange) products = products.filter(p =>
      p.cashPrice >= filters.priceRange[0] && p.cashPrice <= filters.priceRange[1]
    );
    if (filters.minRating) products = products.filter(p => p.rating >= filters.minRating);

    switch(filters.sort) {
      case 'price-low': return products.sort((a, b) => a.cashPrice - b.cashPrice);
      case 'price-high': return products.sort((a, b) => b.cashPrice - a.cashPrice);
      case 'rating': return products.sort((a, b) => b.rating - a.rating);
      case 'new': return [...products].reverse();
      default: return products;
    }
  }, [activeTab, wishlist, filters.category, filters.limitedOnly, filters.search, filters.priceRange, filters.minRating, filters.sort, pricedProducts, inStockIds]);

  // What each crate card needs to know about the ladder. One helper so every
  // render site — the stall grid, the audit card and the harvest — passes the
  // same gate, and a future grid cannot forget it.
  const cardGates = (p: MarketProduct) => ({
    legendaryLocked: isLegendaryDrop(p.id) && !privileges.legendaryDrops,
    legendaryLevel: LEVEL_TIERS.find(t => t.unlocks.market?.legendaryDrops)?.level ?? 18,
  });

  const handleClaim = (id: string, refundValue: number) => {
    const product = pricedProducts.find(p => p.id === id);
    const cost = product ? product.seedPrice : refundValue * 200;

    if (!privileges.shopUnlocked) {
      error(`The stalls open at level 5 — you are level ${level}.`);
      return;
    }
    if (claimedRefunds.some(r => r.id === id)) {
      error('You already claimed the seed refund for this crate.');
      return;
    }
    if (seeds < cost) {
      error(`Need ${cost.toLocaleString()} seeds`);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Claim Seed Discount",
      description: `Spend ${cost.toLocaleString()} seeds to record a ₹${refundValue} seed discount on "${product?.name || 'this item'}". You'll get a discount code as your record — buy via the Amazon stall link and the discount is tracked against your seeds.`,
      cost,
      onConfirm: async () => {
        try {
          await GameService.spendSeeds(cost, 'spend', `Claimed ₹${refundValue} seed discount for ${product?.name || 'Product'}`);
          const record: ClaimedRefund = {
            id,
            code: makeRefundCode(),
            refundValue,
            seedCost: cost,
            productName: product?.name || 'Stall item',
            claimedAt: new Date().toISOString(),
          };
          setClaimedRefunds(prev => [...prev, record]);
          setClaimedItems(prev => prev.includes(id) ? prev : [...prev, id]);
          reward(`Discount claimed! Code ${record.code} · ₹${refundValue} off (saved to your tickets).`);
          // Open the affiliate stall only after the claim is recorded, so a
          // cancelled dialog never sends the user shopping discount-less.
          if (product?.amazonUrl) {
            window.open(amazonStallUrl(product.amazonUrl), '_blank', 'noopener');
          }
        } catch (err) {
          console.error(err);
          error("Transaction failed");
        }
      }
    });
  };

  const handleAddToCart = (product: MarketProduct) => {
    if (!privileges.shopUnlocked) {
      error(`The stalls open at level 5 — you are level ${level}.`);
      return;
    }
    if (isLegendaryDrop(product.id) && !privileges.legendaryDrops) {
      error(`Legendary crates open at level 18 — ${product.name} is one of them.`);
      return;
    }
    const existingItem = cartItems.find(item => item.id === product.id);
    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCartItems([...cartItems, { ...product, qty: 1 }]);
    }
    const saved = volumeDiscountPct(existingItem ? existingItem.qty + 1 : 1);
    success(saved > 0
      ? `Added ${product.name} — ${saved}% bulk discount on the seeds`
      : `Added ${product.name} to basket`);
  };

  const bumpQty = (id: string, delta: number) => {
    setCartItems(cartItems.flatMap(item => {
      if (item.id !== id) return [item];
      const qty = item.qty + delta;
      return qty < 1 ? [] : [{ ...item, qty }];
    }));
  };

  const toggleWish = (id: string) => {
    setWishlist(wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id]);
  };

  const redeemTicket = async (id: string) => {
    const voucher = TICKETS_FOR_SALE.find(v => v.id === id);
    if (!voucher) return;
    // L17 "+10% Seed-to-Voucher exchange": the same ticket costs fewer seeds.
    // Computed here rather than baked into the catalogue so the ticket tab can
    // show the tier saving as a struck-through original.
    const cost = voucherCostFor(voucher.seedCost, level);
    if (!privileges.vouchersUnlocked) {
      error(`Tickets open at level 5 — you are level ${level}.`);
      return;
    }
    if (voucher.requiredLevel && level < voucher.requiredLevel) {
      error(`${voucher.title} opens at level ${voucher.requiredLevel}.`);
      return;
    }
    if (redeemedTickets.includes(id)) {
      setAppliedTicketId(id);
      success('Ticket clipped to this basket');
      return;
    }
    if (seeds < cost) {
      error(`Need ${cost.toLocaleString()} seeds`);
      return;
    }
    try {
      await GameService.spendSeeds(cost, 'spend', `Punched ticket: ${voucher.title}`);
      setRedeemedTickets([...redeemedTickets, id]);
      setAppliedTicketId(id);
      reward(`Punched ${voucher.title}`);
    } catch {
      error('Ticket punch failed');
    }
  };

  return (
    <PageWrapper className="min-h-screen skin-bazaar text-text-bark overflow-x-hidden relative">

      <div className="relative z-10">
        <div className="sticky top-0 z-40 bazaar-mast px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="bazaar-kicker">
              {earlyWindow
                ? <>Early stall · tomorrow’s floor is live {privileges.earlyAccessHours}h before restock</>
                : <>Sunday bazaar · stall packs in {stallLeft}</>}
            </p>
            <h1 className="font-serif text-2xl md:text-3xl font-semibold text-[#3d2a1c]">The Garden Market</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <EnhancedWalletDisplay
              isCompact
              stats={{
                seeds,
                level,
                currentXp: totalXp,
                nextLevelXp: totalXp + xpToNext,
                xpPercent: levelProgress?.xpProgress ?? 0,
                vouchers: claimedItems.length,
                streak: streakRecord?.currentStreak ?? 0
              }}
            />
            {cartItems.length > 0 && (
              <button onClick={() => setShowCheckout(true)} className="px-3 py-2 min-h-[44px] bg-[#5a7d5a] text-white text-[10px] font-black uppercase tracking-widest">
                Basket {cartItems.length}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 md:px-8 py-4 flex gap-2 overflow-x-auto items-center border-b border-[#e8dcc8]" style={{ background: '#f7f0e4' }}>
          {([
            ['sanctuary', 'Sanctuary'],
            ['shop', 'Shop'],
            ['digital', 'Digital goods'],
            ['vouchers', 'Tickets'],
            ['requests', 'Ask the bazaar'],
            ['saved', `Pinned (${wishlist.length})`],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`bazaar-tab ${activeTab === tab ? 'is-on' : ''}`}
            >
              {label}
            </button>
          ))}
          {/* Search, sort and filter all act on `filteredProducts`, which is the
              physical-goods list. On the seed shelf they would be live controls
              that quietly do nothing, so they are not rendered there. */}
          {activeTab !== 'sanctuary' && (
            <>
              <input
                aria-label="Search the stalls"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search the stall…"
                className="ml-auto min-w-[10rem] min-h-[44px] px-3 py-2 text-xs border border-[#d9c4a0] bg-[#fff8e8] text-[#3d2a1c] placeholder:text-[#7a6a50]/60"
              />
              <select
                aria-label="Sort stalls"
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="min-h-[44px] px-2 py-2 text-[11px] font-black uppercase tracking-widest border border-[#d9c4a0] bg-[#fff8e8] text-[#3d2a1c]"
              >
                <option value="popular">Popular</option>
                <option value="new">New crate</option>
                <option value="price-low">₹ low</option>
                <option value="price-high">₹ high</option>
                <option value="rating">Rating</option>
              </select>
              <button onClick={() => setShowFilters(!showFilters)} className="min-h-[44px] px-3 py-2 text-[11px] font-black uppercase tracking-widest border border-[#d9c4a0] text-[#3d2a1c]">
                Filter
              </button>
            </>
          )}
        </div>

        {/* ── FILTER PANEL ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 md:px-8 py-6 border-b border-border-light bg-bg-secondary"
            >
              <ProductFilters
                onFilterChange={(newFilters) => setFilters({
                  search: newFilters.search,
                  sort: newFilters.sortBy,
                  // The panel's legacy 'vouchers'/'drops' options have no
                  // aisle any more; both read as "everything", which is what
                  // the chips' All crate shows.
                  category: newFilters.category === 'vouchers' || newFilters.category === 'drops' ? 'all' : newFilters.category,
                  priceRange: [newFilters.priceMin, newFilters.priceMax],
                  minRating: newFilters.ratingMin,
                  limitedOnly: newFilters.limitedOnly,
                  inStockOnly: newFilters.inStockOnly
                })}
                totalProducts={filteredProducts.length}
                resetSignal={filterResetSignal}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CONTENT AREA ── */}
        <div className="px-6 md:px-8 py-12 max-w-full">
          
          <AnimatePresence mode="wait">
            {activeTab === 'sanctuary' && (
              <motion.div
                key="sanctuary-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SanctuaryShelf seeds={seeds} userId={userId} />
              </motion.div>
            )}

            {activeTab === 'digital' && (
              <motion.div
                key="digital-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DigitalGoods seeds={seeds} userId={userId} notify={(ok, msg) => (ok ? success(msg) : error(msg))} />
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div
                key="requests-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <RequestBoard userId={userId} notify={(ok, msg) => (ok ? success(msg) : error(msg))} />
              </motion.div>
            )}

            {activeTab === 'shop' && (
              <motion.div
                key="shop-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-16"
              >
                {!privileges.shopUnlocked ? (
                  <StallLock level={level} xpToNext={xpToNext} xpProgress={levelProgress?.xpProgress ?? 0} nextUnlock={nextUnlock} />
                ) : (
                  <>
                    <TierLadderStrip level={level} privileges={privileges} />
                    {earlyWindow && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 rounded-lg border border-[#d4af37]/60 bg-[#d4af37]/10 px-4 py-3"
                      >
                        <Clock size={14} className="text-[#8c6d46] shrink-0" />
                        <p className="text-xs text-[#5c4a2e]">
                          <span className="font-black uppercase tracking-wider">Cultivator early access.</span>{' '}
                          You are looking at tomorrow’s floor, {privileges.earlyAccessHours} hours before everyone else.
                        </p>
                      </motion.div>
                    )}
                    <HeroCarousel onClaim={handleClaim} seeds={seeds} products={pricedProducts} />

                    <MarketPulse day={stallDay} />
                    <TodaysHarvest onClaim={handleClaim} onAddToCart={handleAddToCart} seeds={seeds} products={pricedProducts} day={stallDay} />
                    <FreshFindsAudit onClaim={handleClaim} seeds={seeds} products={pricedProducts} day={stallDay} />

                    {/* The stall grid. One grid, one chip row — the old layout
                        rendered this three times over as three tabs that
                        differed only by category. */}
                    <div>
                      <motion.h2
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="font-serif text-3xl font-semibold mb-2 text-[#3d2a1c]"
                      >
                        On the stall today
                      </motion.h2>
                      <p className="text-sm text-[#7a6a50] mb-4">Buy on Amazon or Flipkart. Spend seeds at this stall to clip a rupee refund. Stalls restock every morning.</p>
                      <div className="flex flex-wrap gap-2 mb-8">
                        {SHOP_CHIPS.map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => setFilters({ ...filters, category: value })}
                            aria-pressed={filters.category === value}
                            className={`bazaar-tab ${filters.category === value ? 'is-on' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ staggerChildren: 0.08, delayChildren: 0.3 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                      >
                        {filteredProducts.length === 0 ? (
                          <EmptyState
                            compact
                            className="col-span-full"
                            icon={ShoppingBag}
                            title="Nothing on this stall"
                            body={
                              filters.search || filters.category !== 'all' || filters.limitedOnly || filters.inStockOnly || filters.minRating > 0
                                ? "No crate here matches what you've asked for. Clearing the filters brings the whole stall back."
                                : 'This stall is between restocks. The bazaar audits and refills every morning.'
                            }
                            action={{
                              label: 'Clear filters',
                              onClick: clearAllFilters
                            }}
                          />
                        ) : filteredProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onClaim={handleClaim}
                            onAddToCart={handleAddToCart}
                            wished={wishlist.includes(product.id)}
                            onToggleWish={toggleWish}
                            seeds={seeds}
                            {...cardGates(product)}
                          />
                        ))}
                      </motion.div>
                    </div>
                  </>
                )}

                <ProBanner />
              </motion.div>
            )}

            {activeTab === 'vouchers' && (
              <motion.div
                key="vouchers-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-serif text-3xl font-semibold mb-8 text-[#3d2a1c]"
                >
                  Torn tickets
                </motion.h2>

                {/* Claimed seed-discount records */}
                {claimedRefunds.length > 0 && (
                  <div className="mb-10">
                    <h3 className="font-serif text-xl font-semibold text-[#3d2a1c] mb-3">Your claimed seed discounts</h3>
                    <div className="space-y-3">
                      {claimedRefunds.map((r) => (
                        <div key={r.id + r.code} className="bg-[#fff8e8] border border-[#c17f59]/40 px-4 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#3d2a1c]">{r.productName}</p>
                            <p className="text-[11px] text-[#7a6a50]">₹{r.refundValue} seed discount · {new Date(r.claimedAt).toLocaleDateString()}</p>
                          </div>
                          <span className="font-mono font-black tracking-widest text-[#3d2a1c] bg-[#f4e4c1] border border-[#c17f59]/50 px-3 py-1.5 select-all">{r.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {TICKETS_FOR_SALE.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                  >
                    <Gift size={48} className="mx-auto text-text-muted mb-4" />
                    <p className="text-text-stone">Your garden locker is empty. Complete diagnoses to earn vouchers.</p>
                  </motion.div>
                ) : !privileges.vouchersUnlocked ? (
                  <StallLock level={level} xpToNext={xpToNext} xpProgress={levelProgress?.xpProgress ?? 0} nextUnlock={nextUnlock} />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.1 }}
                    className="grid gap-4"
                  >
                    {TICKETS_FOR_SALE.map((voucher, idx) => {
                      const cost = voucherCostFor(voucher.seedCost, level);
                      const tierLocked = !!voucher.requiredLevel && level < voucher.requiredLevel;
                      const exchangeBonus = privileges.voucherExchangeBonusPct > 0 && cost < voucher.seedCost;
                      return (
                      <motion.div
                        key={voucher.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={reduced ? undefined : { y: -2 }}
                        className={`relative bg-[#fff8e8] border-2 border-dashed p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${tierLocked ? 'border-[#d9c4a0] opacity-80' : 'border-[#c17f59]'}`}
                        style={{ backgroundImage: 'radial-gradient(circle at 0 50%, transparent 10px, #fff8e8 11px), radial-gradient(circle at 100% 50%, transparent 10px, #fff8e8 11px)', backgroundSize: '100% 100%' }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 rotate-[-8deg] flex flex-col items-center justify-center font-serif ${tierLocked ? 'bg-[#d9c4a0] text-[#7a6a50]' : 'bg-[#c17f59] text-white'}`}>
                            <span className="text-[9px] uppercase tracking-widest">Off</span>
                            <span className="text-lg font-bold leading-none">₹{voucher.realValue}</span>
                          </div>
                          <div>
                            <h3 className="font-serif text-xl font-semibold text-[#3d2a1c] flex items-center gap-2">
                              {voucher.title}
                              {voucher.freeShipping && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#5a7d5a]/15 text-[#3d6b4a] text-[9px] font-black uppercase tracking-widest">
                                  <Truck size={10} /> Free shipping
                                </span>
                              )}
                              {tierLocked && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f4e4c1] text-[#8c6d46] text-[9px] font-black uppercase tracking-widest">
                                  <Lock size={10} /> Level {voucher.requiredLevel}
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-[#7a6a50]">{voucher.discount}</p>
                            <p className="text-[11px] text-[#a09070] mt-1 flex flex-wrap items-center gap-x-2">
                              <span>Punch within {voucher.expiryDays} days</span>
                              <span>·</span>
                              <span className="flex items-baseline gap-1.5">
                                {exchangeBonus && (
                                  <span className="line-through text-[#c4a574]">{voucher.seedCost.toLocaleString()}</span>
                                )}
                                <Leaf size={10} className="text-moss inline" /> {cost.toLocaleString()} seeds
                              </span>
                              {exchangeBonus && (
                                <span className="text-[#3d6b4a] font-bold">· L17 exchange −{privileges.voucherExchangeBonusPct}%</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={tierLocked ? undefined : { scale: 1.05 }}
                          whileTap={tierLocked ? undefined : { scale: 0.95 }}
                          onClick={() => redeemTicket(voucher.id)}
                          className={`px-4 py-2 min-h-[44px] text-[10px] font-black uppercase tracking-widest ${
                            tierLocked
                              ? 'bg-[#e8dcc8] text-[#a09070] cursor-not-allowed'
                              : 'bg-[#3d2a1c] text-[#f4e4c1]'
                          }`}
                        >
                          {tierLocked
                            ? `Level ${voucher.requiredLevel}`
                            : appliedTicketId === voucher.id ? 'Clipped' : redeemedTickets.includes(voucher.id) ? 'Apply' : 'Punch ticket'}
                        </motion.button>
                      </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'saved' && (
              <motion.div key="saved-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="font-serif text-3xl font-semibold mb-8 text-[#3d2a1c]">Pinned crates</h2>
                {!privileges.shopUnlocked ? (
                  <StallLock level={level} xpToNext={xpToNext} xpProgress={levelProgress?.xpProgress ?? 0} nextUnlock={nextUnlock} />
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.length === 0 ? (
                    <EmptyState
                      compact
                      className="col-span-full"
                      icon={Bookmark}
                      title="Nothing pinned yet"
                      body="Pin a crate from the stall to keep it here — pinned crates ignore the daily restock."
                      action={{
                        label: 'Browse the stall',
                        onClick: () => setActiveTab('shop')
                      }}
                    />
                  ) : filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClaim={handleClaim}
                      onAddToCart={handleAddToCart}
                      wished={wishlist.includes(product.id)}
                      onToggleWish={toggleWish}
                      seeds={seeds}
                      {...cardGates(product)}
                    />
                  ))}
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FOOTER ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="border-t border-border-light px-6 md:px-8 py-12 mt-12 text-center text-text-stone text-sm"
        >
          <p className="font-serif italic">Seeds are stall credit — never cash. Amazon handles the rupees.</p>
        </motion.div>
      </div>

      {/* ── CHECKOUT SIDEBAR ── */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed right-0 top-0 h-screen w-full max-w-md z-50 bg-bg-secondary border-l border-border-medium flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-border-light">
              <h3 className="font-serif text-2xl font-bold text-text-bark">Your Cart</h3>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCheckout(false)}
                className="p-2 hover:bg-bg-tertiary rounded-lg text-text-stone hover:text-text-bark transition-all"
              >
                ✕
              </motion.button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {cartItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex gap-3 bg-bg-tertiary border border-border-light rounded-lg p-3"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-text-bark line-clamp-1">{item.name}</p>
                    <p className="text-xs text-text-stone">₹{item.cashPrice}</p>
                    {volumeDiscountPct(item.qty) > 0 && (
                      <p className="text-[10px] font-black uppercase tracking-wider text-moss mt-0.5">
                        Bulk −{volumeDiscountPct(item.qty)}% seeds
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => bumpQty(item.id, -1)} aria-label={`One less ${item.name}`} className="min-h-[44px] min-w-[36px] text-xs font-black border">−</button>
                      <span className="text-xs text-text-stone/60">Qty: {item.qty}</span>
                      <button onClick={() => bumpQty(item.id, 1)} aria-label={`One more ${item.name}`} className="min-h-[44px] min-w-[36px] text-xs font-black border">+</button>
                      <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} aria-label={`Remove ${item.name}`} className="text-xs text-terracotta hover:text-terracotta-light font-bold ml-auto">Remove</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="border-t border-border-light p-6 space-y-4">
              <CheckoutSummary 
                items={cartItems.map(item => ({
                  id: item.id,
                  name: item.name,
                  price: item.cashPrice,
                  seedCost: item.seedPrice,
                  quantity: item.qty
                }))}
                userSeeds={seeds}
                selectedVoucher={appliedTicket ? { id: appliedTicket.id, discount: appliedTicket.realValue } : undefined}
                onCheckout={() => {
                  // Same two helpers CheckoutSummary renders with, so the
                  // basket can never show one price and charge another. The
                  // refund used to be recomputed here as seeds ÷ 200 — the
                  // pre-rebalance rate — and quietly paid ~3% of the sticker
                  // while every single-item claim paid 12%.
                  const totalSeedsNeeded = cartItems.reduce((sum, item) => sum + lineSeedCost(item.seedPrice, item.qty), 0);
                  const seedRefund = cartItems.reduce((sum, item) => sum + lineRefundRupees(item.cashPrice, item.qty), 0);
                  const bulkSaved = cartItems.reduce((sum, item) => sum + (item.seedPrice * item.qty - lineSeedCost(item.seedPrice, item.qty)), 0);

                  if (seeds < totalSeedsNeeded) {
                    error(`Need ${totalSeedsNeeded.toLocaleString()} seeds to checkout this cart`);
                    return;
                  }

                  setConfirmDialog({
                    isOpen: true,
                    title: "Checkout Cart",
                    description: `Spend ${totalSeedsNeeded.toLocaleString()} seeds to record ₹${seedRefund} in seed discounts across ${cartItems.length} item${cartItems.length > 1 ? 's' : ''}.${bulkSaved > 0 ? ` Bulk pricing already saved ${bulkSaved.toLocaleString()} seeds.` : ''} You'll get a discount code as your record.`,
                    cost: totalSeedsNeeded,
                    onConfirm: async () => {
                      try {
                        await GameService.spendSeeds(totalSeedsNeeded, 'spend', `Cart checkout: ${cartItems.length} items`);

                        const record: ClaimedRefund = {
                          id: `order-${Date.now()}`,
                          code: makeRefundCode(),
                          refundValue: seedRefund,
                          seedCost: totalSeedsNeeded,
                          productName: `Cart order · ${cartItems.length} item${cartItems.length > 1 ? 's' : ''}`,
                          claimedAt: new Date().toISOString(),
                        };
                        setClaimedRefunds(prev => [...prev, record]);
                        setClaimedItems(prev => Array.from(new Set([...prev, ...cartItems.map(i => i.id)])));

                        setCartItems([]);
                        setShowCheckout(false);
                        // Popup-blocker-safe: no window.open after await —
                        // the modal carries one affiliate link per item.
                        setOrderSuccessDialog({
                          code: record.code,
                          refund: seedRefund,
                          items: cartItems.map(i => ({ name: i.name, amazonUrl: i.amazonUrl })),
                        });
                        reward(`Order recorded! Code ${record.code} · ₹${seedRefund} seed discounts saved to your tickets.`);
                      } catch (err) {
                        console.error(err);
                        error("Checkout transaction failed");
                      }
                    }
                  });
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ORDER SUCCESS & DISCOUNT CODE MODAL ── */}
      <AnimatePresence>
        {orderSuccessDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-primary/80 z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#faf6ee] dark:bg-[#1a140e] border border-[#c5a059]/40 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-moss/15 text-moss flex items-center justify-center mb-3 border border-moss/30">
                <Tag size={26} />
              </div>

              <h3 className="font-serif text-2xl font-bold text-[#2c2419] dark:text-[#f4eee1] mb-1">
                Seed Discounts Recorded
              </h3>
              <p className="text-xs text-[#725e4c] dark:text-[#b8a695] mb-4">
                ₹{orderSuccessDialog.refund} in seed discounts, saved to your Tickets tab. Use the code as your record when you buy.
              </p>

              <div className="p-3.5 bg-[#f4ebd9] dark:bg-[#251d16] border border-dashed border-[#c4a574] rounded-xl mb-4 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-sm tracking-wider text-[#2c2419] dark:text-[#f4eee1] select-all">
                  {orderSuccessDialog.code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(orderSuccessDialog.code);
                    success('Discount code copied to clipboard!');
                  }}
                  className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-[#2e4a34] text-[#f4eee1] rounded-lg hover:bg-[#395c41] transition-colors"
                >
                  Copy
                </button>
              </div>

              <div className="text-left mb-4">
                <p className="text-[10px] font-sans font-bold uppercase tracking-[0.06em] text-[#725e4c] dark:text-[#b8a695] mb-2">
                  Stall links ({orderSuccessDialog.items.length})
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {orderSuccessDialog.items.map((item, idx) => (
                    <a
                      key={idx}
                      href={amazonStallUrl(item.amazonUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#251d16] border border-[#dcd2c0] dark:border-[#3d2e20] text-xs hover:border-[#8c6e38] transition-colors group"
                    >
                      <span className="font-medium text-[#2c2419] dark:text-[#f4eee1] truncate max-w-[220px]">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-moss font-bold flex items-center gap-1 group-hover:underline">
                        Open <ExternalLink size={10} />
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setOrderSuccessDialog(null)}
                className="w-full py-3 rounded-xl bg-[#2e4a34] text-[#f4eee1] text-xs font-bold uppercase tracking-wider hover:bg-[#395c41] transition-colors"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEED PURCHASE CONFIRMATION DIALOG ── */}
      <AnimatePresence>
        {confirmDialog && confirmDialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-primary/80 z-[99999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-bg-secondary border border-border-medium rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              {/* Decorative background orbs */}
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-moss/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-terracotta/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-4 border border-gold/20 text-gold">
                <Leaf size={28} className="animate-pulse" />
              </div>
              
              <h3 className="font-serif text-2xl font-bold text-text-bark mb-2">
                {confirmDialog.title}
              </h3>
              <p className="text-sm text-text-stone mb-6">
                {confirmDialog.description}
              </p>
              
              <div className="bg-bg-tertiary border border-border-light rounded-2xl py-3 px-4 mb-6 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-text-stone">Cost</span>
                <div className="flex items-center gap-1.5 font-bold text-gold">
                  <span>{confirmDialog.cost.toLocaleString()}</span>
                  <span className="text-xs">Seeds</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-3 rounded-xl border border-border-medium text-sm font-bold text-text-stone hover:bg-bg-tertiary transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-moss text-white text-sm font-bold shadow-lg hover:shadow-xl hover:bg-moss-dark transition-all"
                >
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST NOTIFICATIONS ── */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] space-y-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`px-6 py-4 rounded-full backdrop-blur-md border text-sm font-bold flex items-center gap-3 whitespace-nowrap shadow-2xl ${
                toast.type === 'success' ? 'bg-moss border-moss text-white' :
                toast.type === 'error' ? 'bg-terracotta border-terracotta text-white' :
                toast.type === 'reward' ? 'bg-gold border-gold text-text-bark' :
                'bg-white/10 border-white/20 text-white'
              }`}
            >
              <span>
                {toast.type === 'success' && '✓'}
                {toast.type === 'error' && '✕'}
                {toast.type === 'reward' && '⭐'}
                {toast.type === 'warning' && '⚠'}
                {toast.type === 'info' && 'ℹ'}
              </span>
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}