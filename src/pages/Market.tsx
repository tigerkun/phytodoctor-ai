import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Sprout, ShoppingBag, Clock, Tag, 
  ChevronRight, Star, AlertCircle, ShieldCheck, 
  Leaf, Bookmark, TrendingUp, Zap, Gift, ExternalLink
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import EnhancedWalletDisplay from '../components/market/EnhancedWalletDisplay';
import ProductFilters from '../components/market/ProductFilters';
import CheckoutSummary from '../components/market/CheckoutSummary';
import { useToast } from '../components/market/ToastNotification';
import { useDayNightTheme } from '../hooks/useDayNightTheme';
import PageWrapper from '../components/home/PageWrapper';

// ── MOCK DATA (HIGH-ACCURACY CURATED IMAGES & LINKS) ──
const MOCK_PRODUCTS = [
  {
    id: 'drop-1',
    category: 'drops',
    name: "Ceramic Self-Watering Planter (6\")",
    subtitle: "Premium terracotta with reservoir",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
    amazonUrl: "https://www.amazon.in/s?k=ceramic+self+watering+planter+pot",
    rating: 4.8,
    reviewCount: 203,
    cashPrice: 449,
    originalPrice: 599,
    seedPrice: 8980,
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
    seedPrice: 5980,
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
    seedPrice: 17980,
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
    seedPrice: 6980,
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
    seedPrice: 3980,
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
    seedPrice: 2980,
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
    seedPrice: 5980,
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
    seedPrice: 3580,
    isLimited: false,
    proEarlyAccess: true,
    tags: ['pro']
  }
];

const MOCK_VOUCHERS = [
  {
    id: 'v1',
    title: "Sprout Saver",
    value: "₹50 off",
    seedCost: 500,
    expiryDays: 12,
    isApplied: false
  },
  {
    id: 'v2',
    title: "Garden Pass",
    value: "₹150 off + Free Shipping",
    seedCost: 1500,
    expiryDays: 5,
    isApplied: false
  }
];



// ── HERO CAROUSEL ──
function HeroCarousel({ onClaim }: { onClaim: (id: string, refundValue: number) => void }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const heroProducts = MOCK_PRODUCTS.filter(p => p.isLimited).slice(0, 3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % heroProducts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroProducts.length]);

  const product = heroProducts[carouselIndex];
  // Calculate real-world refund logic (e.g., 200 seeds = ₹1)
  const refundValue = Math.floor(product.seedPrice / 200);
  const finalPrice = product.cashPrice - refundValue;

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
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                window.open(`${product.amazonUrl}?tag=botanicalguard-21`, '_blank');
                onClaim(product.id, refundValue);
              }}
              className="flex-1 bg-[#c17f59] hover:bg-[#a85a42] text-white font-black py-4 px-6 rounded-sm transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-[0.16em]"
            >
              <ShoppingBag size={18} /> Buy at stall · claim refund <ExternalLink size={16} className="ml-1" />
            </motion.button>
          </div>

          {/* Carousel Dots */}
          <div className="flex gap-2 pt-4 justify-start">
            {heroProducts.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={() => setCarouselIndex(idx)}
                animate={{
                  width: idx === carouselIndex ? 24 : 8,
                  backgroundColor: idx === carouselIndex ? 'var(--accent-sage)' : 'var(--text-stone)',
                  opacity: idx === carouselIndex ? 1 : 0.3
                }}
                className="h-2 rounded-full transition-all"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── PRODUCT CARD ──
function ProductCard({ product, onClaim, onAddToCart }: { product: any; onClaim: (id: string, refundValue: number) => void; onAddToCart?: (product: any) => void }) {
  // Calculate real-world refund logic
  const refundValue = Math.floor(product.seedPrice / 200);

  const handleAmazonRedirect = () => {
    window.open(`${product.amazonUrl}?tag=botanicalguard-21`, '_blank');
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
            e.currentTarget.src = 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80';
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
          </p>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => onAddToCart?.(product)}
              className="flex-1 bg-[#5a7d5a] hover:bg-[#3d6b4a] text-white font-black py-2.5 px-3 text-[10px] uppercase tracking-widest">
              Add to basket
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAmazonRedirect}
              className="flex-1 border border-[#c4a574] bg-[#fff8e8] hover:bg-[#f4e4c1] text-[#3d2a1c] font-black py-2.5 px-3 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
              Buy <ExternalLink size={11} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── PRO BANNER ──
function ProBanner() {
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

// ── MAIN EXPORT ──
export default function GardenMarket() {
  const { toasts, success, error, warning, reward } = useToast();
  const { theme } = useDayNightTheme();
  const [activeTab, setActiveTab] = useState<'drops' | 'home' | 'care' | 'vouchers'>('drops');
  const [claimedItems, setClaimedItems] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    cost: number;
    onConfirm: () => void;
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

  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile());
  const levelProgress = useLiveQuery(() => db.levelProgress.get(userId));
  const streakRecord = useLiveQuery(() => db.streakRecords.get(userId));
  const seeds = profile?.seeds ?? 0;
  const level = levelProgress?.currentLevel ?? 1;
  const totalXp = Math.round(levelProgress?.totalXP ?? 0);
  const xpToNext = Math.round(levelProgress?.xpToNextLevel ?? 100);

  // Filter products
  const getFilteredProducts = () => {
    let products = activeTab === 'drops' 
      ? MOCK_PRODUCTS
      : MOCK_PRODUCTS.filter(p => p.category === activeTab);

    if (filters.limitedOnly) products = products.filter(p => p.isLimited);
    if (filters.search) products = products.filter(p => 
      p.name.toLowerCase().includes(filters.search.toLowerCase())
    );
    if (filters.priceRange) products = products.filter(p => 
      p.cashPrice >= filters.priceRange[0] && p.cashPrice <= filters.priceRange[1]
    );
    if (filters.minRating) products = products.filter(p => p.rating >= filters.minRating);

    // Sort
    switch(filters.sort) {
      case 'price-low': return products.sort((a, b) => a.cashPrice - b.cashPrice);
      case 'price-high': return products.sort((a, b) => b.cashPrice - a.cashPrice);
      case 'rating': return products.sort((a, b) => b.rating - a.rating);
      case 'new': return products.reverse();
      default: return products;
    }
  };

  const filteredProducts = getFilteredProducts();

  const handleClaim = (id: string, refundValue: number) => {
    const product = MOCK_PRODUCTS.find(p => p.id === id);
    const cost = product ? product.seedPrice : refundValue * 200;

    if (seeds < cost) {
      error(`Need ${cost.toLocaleString()} seeds`);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Claim Seed Refund",
      description: `Spend seeds to unlock a ₹${refundValue} refund on Amazon for "${product?.name || 'this item'}".`,
      cost,
      onConfirm: async () => {
        try {
          await GameService.addSeeds(-cost, 'spend', `Claimed refund for ${product?.name || 'Product'}`);
          setClaimedItems([...claimedItems, id]);
          reward(`Refund Claimed! Deducted ${cost.toLocaleString()} seeds.`);
        } catch (err) {
          console.error(err);
          error("Transaction failed");
        }
      }
    });
  };

  const handleAddToCart = (product: any) => {
    const existingItem = cartItems.find(item => item.id === product.id);
    if (existingItem) {
      setCartItems(cartItems.map(item => 
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCartItems([...cartItems, { ...product, qty: 1 }]);
    }
    success(`Added ${product.name} to cart`);
  };

  return (
    <PageWrapper className="min-h-screen text-text-bark overflow-x-hidden relative">
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(ellipse at top, rgba(193,127,89,0.18), transparent 50%), linear-gradient(180deg, #f6efe4 0%, var(--bg-primary) 40%)',
        }}
      />

      <div className="relative z-10">
        <div className="h-5 w-full" style={{ background: 'repeating-linear-gradient(90deg, #c17f59 0 22px, #f4e4c1 22px 44px, #5a7d5a 44px 66px)' }} />

        <div className="sticky top-0 z-40 border-b border-[#d9c4a0] px-4 md:px-8 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(247,240,228,0.94)' }}>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#c17f59]">Sunday bazaar · seeds spend here</p>
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
              <button onClick={() => setShowCheckout(true)} className="px-3 py-2 bg-[#5a7d5a] text-white text-[10px] font-black uppercase tracking-widest">
                Basket {cartItems.length}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 md:px-8 py-4 flex gap-2 overflow-x-auto items-center border-b border-[#e8dcc8]" style={{ background: '#f7f0e4' }}>
          {([
            ['drops', 'Open stall'],
            ['home', 'Pots & hangers'],
            ['care', 'Oils & soil'],
            ['vouchers', 'Tickets'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border ${
                activeTab === tab
                  ? 'bg-[#3d2a1c] text-[#f4e4c1] border-[#3d2a1c]'
                  : 'bg-transparent text-[#7a6a50] border-[#d9c4a0] hover:border-[#c17f59]'
              }`}
            >
              {label}
            </button>
          ))}
          <button onClick={() => setShowFilters(!showFilters)} className="ml-auto px-3 py-2 text-[11px] font-black uppercase tracking-widest border border-[#d9c4a0] text-[#3d2a1c]">
            Filter
          </button>
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
                  category: newFilters.category === 'vouchers' ? 'drops' : newFilters.category,
                  priceRange: [newFilters.priceMin, newFilters.priceMax],
                  minRating: newFilters.ratingMin,
                  limitedOnly: newFilters.limitedOnly,
                  inStockOnly: newFilters.inStockOnly
                })}
                totalProducts={filteredProducts.length}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CONTENT AREA ── */}
        <div className="px-6 md:px-8 py-12 max-w-full">
          
          <AnimatePresence mode="wait">
            {activeTab === 'drops' && (
              <motion.div
                key="drops-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-16"
              >
                <HeroCarousel onClaim={handleClaim} />

                {/* Featured Section */}
                <div>
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-serif text-3xl font-semibold mb-2 text-[#3d2a1c]"
                  >
                    On the stall today
                  </motion.h2>
                  <p className="text-sm text-[#7a6a50] mb-8">Buy on Amazon. Spend seeds at this stall to clip a rupee refund.</p>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.08, delayChildren: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                  >
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onClaim={handleClaim}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </motion.div>
                </div>

                <ProBanner />
              </motion.div>
            )}

            {activeTab === 'home' && (
              <motion.div
                key="home-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-serif text-3xl font-semibold mb-8 text-[#3d2a1c]"
                >
                  Pottery aisle
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClaim={handleClaim}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'care' && (
              <motion.div
                key="care-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-serif text-3xl font-semibold mb-8 text-[#3d2a1c]"
                >
                  Apothecary aisle
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClaim={handleClaim}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </motion.div>
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
                
                {MOCK_VOUCHERS.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                  >
                    <Gift size={48} className="mx-auto text-text-muted mb-4" />
                    <p className="text-text-stone">Your garden locker is empty. Complete diagnoses to earn vouchers.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.1 }}
                    className="grid gap-4"
                  >
                    {MOCK_VOUCHERS.map((voucher, idx) => (
                      <motion.div
                        key={voucher.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="relative bg-[#fff8e8] border-2 border-dashed border-[#c17f59] p-6 flex items-center justify-between"
                        style={{ backgroundImage: 'radial-gradient(circle at 0 50%, transparent 10px, #fff8e8 11px), radial-gradient(circle at 100% 50%, transparent 10px, #fff8e8 11px)', backgroundSize: '100% 100%' }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rotate-[-8deg] bg-[#c17f59] text-white flex flex-col items-center justify-center font-serif">
                            <span className="text-[9px] uppercase tracking-widest">Off</span>
                            <span className="text-lg font-bold leading-none">{voucher.value.split(' ')[0]}</span>
                          </div>
                          <div>
                            <h3 className="font-serif text-xl font-semibold text-[#3d2a1c]">{voucher.title}</h3>
                            <p className="text-sm text-[#7a6a50]">{voucher.value}</p>
                            <p className="text-[11px] text-[#a09070] mt-1">Punch by {voucher.expiryDays} days · {voucher.seedCost} seeds</p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-[#3d2a1c] text-[#f4e4c1] text-[10px] font-black uppercase tracking-widest"
                        >
                          Redeem
                        </motion.button>
                      </motion.div>
                    ))}
                  </motion.div>
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
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-text-bark line-clamp-1">{item.name}</p>
                    <p className="text-xs text-text-stone">₹{item.cashPrice}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-xs text-terracotta hover:text-terracotta-light font-bold">Remove</button>
                      <span className="text-xs text-text-stone/60">Qty: {item.qty}</span>
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
                onCheckout={() => {
                  const totalCash = cartItems.reduce((sum, item) => sum + (item.cashPrice * item.qty), 0);
                  const totalSeedsNeeded = cartItems.reduce((sum, item) => sum + (item.seedPrice * item.qty), 0);
                  
                  if (seeds < totalSeedsNeeded) {
                    error(`Need ${totalSeedsNeeded.toLocaleString()} seeds to checkout this cart`);
                    return;
                  }

                  setConfirmDialog({
                    isOpen: true,
                    title: "Checkout Cart",
                    description: `Spend ${totalSeedsNeeded.toLocaleString()} seeds to complete purchase and claim cashback refunds.`,
                    cost: totalSeedsNeeded,
                    onConfirm: async () => {
                      try {
                        await GameService.addSeeds(-totalSeedsNeeded, 'spend', `Checked out ${cartItems.length} items`);
                        
                        // Open the first cart item's Amazon product details (prevents popup blocker spam for multiple items)
                        if (cartItems.length > 0) {
                          window.open(`${cartItems[0].amazonUrl}?tag=botanicalguard-21`, '_blank');
                        }

                        const seedRefund = Math.floor(totalCash / 200);
                        reward(`Order placed! Redirected to checkout & deducted ${totalSeedsNeeded.toLocaleString()} seeds.`);
                        setCartItems([]);
                        setShowCheckout(false);
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