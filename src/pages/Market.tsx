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
import LevelDisplay from '../components/game/LevelDisplay';
import StreakWidget from '../components/game/StreakWidget';
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
    amazonUrl: "https://www.amazon.in/dp/B0C3D82HGW",
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
    amazonUrl: "https://www.amazon.in/dp/B07R98J3T6",
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
    amazonUrl: "https://www.amazon.in/dp/B0B5D1R2NP",
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
    amazonUrl: "https://www.amazon.in/dp/B09MRND3R1",
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
    amazonUrl: "https://www.amazon.in/dp/B08V8RCSWD",
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
    amazonUrl: "https://www.amazon.in/dp/B0BD4W94P9",
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
    amazonUrl: "https://www.amazon.in/dp/B09NDMBMBS",
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
    amazonUrl: "https://www.amazon.in/dp/B099K7M839",
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl bg-bg-secondary border border-border-medium p-8 md:p-12 lg:p-16 mb-16 shadow-xl"
    >
        {/* Animated Background Orbs */}
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-80 h-80 bg-moss/10 rounded-full blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, -50, 0] }}
          transition={{ duration: 12, repeat: Infinity, delay: 1 }}
          className="absolute -bottom-20 -left-20 w-96 h-96 bg-terracotta/10 rounded-full blur-3xl pointer-events-none"
        />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        
        {/* Left: Image with Animation */}
        <motion.div
          key={`hero-img-${product.id}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="relative rounded-2xl overflow-hidden bg-bg-tertiary border border-border-light aspect-square">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Refund Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-4 -right-4 bg-gold text-text-bark px-4 py-2 rounded-2xl font-bold text-sm shadow-lg border border-gold"
          >
            Claim ₹{refundValue} Refund
          </motion.div>
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
              className="inline-flex items-center gap-2 px-3 py-1 bg-terracotta/20 border border-terracotta/40 rounded-full text-terracotta text-xs font-bold uppercase tracking-wider"
            >
              <Zap size={12} /> LIMITED MONSOON DROP
            </motion.div>
            
            <h2 className="font-serif text-4xl lg:text-5xl font-bold text-text-bark leading-tight">
              {product.name}
            </h2>
            
            <p className="text-text-stone text-base leading-relaxed max-w-lg">
              {product.subtitle}
            </p>
          </div>

          {/* Seed Refund Pricing Mechanic */}
          <div className="flex flex-col gap-3 py-4 border-t border-b border-border-light">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-bold text-text-stone uppercase tracking-wider mb-1">Amazon Price</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-text-bark font-mono">₹{product.cashPrice}</p>
                  {product.originalPrice && (
                    <p className="text-xs text-text-stone/60 line-through">₹{product.originalPrice}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-moss uppercase tracking-wider mb-1">Final Cost</p>
                <p className="text-2xl font-bold text-text-bark font-mono">₹{finalPrice}</p>
              </div>
            </div>
            
            <div className="bg-moss/10 border border-moss/30 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-moss uppercase tracking-widest mb-0.5">Seed Cashback</p>
                <p className="text-xs text-text-stone">Refunded to account post-purchase</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-moss font-mono">- ₹{refundValue}</p>
                <p className="text-[10px] text-text-stone flex items-center justify-end gap-1">Costs <Leaf size={10}/>{product.seedPrice.toLocaleString()}</p>
              </div>
            </div>
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
              className="flex-1 bg-moss hover:bg-moss-dark text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-sm tracking-wider"
            >
              <ShoppingBag size={18} /> Buy & Claim Refund <ExternalLink size={16} className="ml-1" />
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
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-bg-secondary border border-border-medium rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col"
    >
      {/* Image Section */}
      <div onClick={handleAmazonRedirect} className="relative h-56 bg-bg-tertiary overflow-hidden cursor-pointer">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80';
          }}
        />

        {/* Badges */}
        {product.isLimited && (
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-3 left-3 bg-terracotta/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
          >
            LIMITED
          </motion.div>
        )}

        {product.proEarlyAccess && (
          <div className="absolute top-3 right-3 bg-gold/20 backdrop-blur-sm border border-gold/40 text-gold px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
            PRO
          </div>
        )}

        {/* Bookmark */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute bottom-3 right-3 p-2 rounded-full bg-bg-secondary/80 hover:bg-bg-secondary backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Bookmark size={16} className="text-text-bark" />
        </motion.button>
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-2">
            <h3 
              onClick={handleAmazonRedirect}
              className="font-serif text-lg font-bold text-text-bark leading-tight line-clamp-2 cursor-pointer hover:text-moss transition-colors"
            >
              {product.name}
            </h3>
            <p className="text-xs text-text-stone mt-1 line-clamp-1">{product.subtitle}</p>
          </div>
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1 text-gold text-xs"
          >
            <Star size={12} fill="currentColor" />
            <span className="font-bold">{product.rating}</span>
          </motion.div>
        </div>

        {/* Seed Refund Mechanic UI */}
        <div className="mt-auto space-y-3 pt-4 border-t border-border-light">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] font-bold text-text-stone uppercase tracking-wider mb-0.5">Amazon Price</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-text-bark font-mono">₹{product.cashPrice}</p>
                {product.originalPrice && (
                  <p className="text-[10px] text-text-stone/60 line-through">₹{product.originalPrice}</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-moss/10 border border-moss/30 rounded-xl p-3 flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black text-moss uppercase tracking-widest mb-0.5">Seed Cashback</p>
              <p className="text-[10px] text-text-stone">Refund post-purchase</p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-moss font-mono leading-none">- ₹{refundValue}</p>
              <p className="text-[9px] text-text-stone flex items-center justify-end gap-1 mt-1">
                <Leaf size={8} /> {product.seedPrice.toLocaleString()} Seeds
              </p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-2 mt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onAddToCart?.(product)}
            className="flex-1 bg-moss hover:bg-moss-dark text-white font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            Add to Cart
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAmazonRedirect}
            className="flex-1 bg-bg-tertiary border border-border-medium hover:bg-bg-secondary text-text-bark font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            Buy <ExternalLink size={12} />
          </motion.button>
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
      className="mt-16 rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/10 via-moss/5 to-gold/5 backdrop-blur-md p-8 md:p-12 overflow-hidden relative"
    >
      {/* Animated Background */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute -top-20 -right-20 w-60 h-60 bg-gold/20 rounded-full blur-3xl pointer-events-none animate-orb-pulse"
      />

      <div className="relative z-10 grid md:grid-cols-3 gap-8 items-center">
        <div>
          <h3 className="font-serif text-3xl font-bold text-gold mb-2">Unlock the Greenhouse</h3>
          <p className="text-white/70 text-sm">Unlock premium features & early access</p>
        </div>

        <div className="md:border-l md:border-r border-white/10 md:px-8 space-y-2">
          {['Unlimited plant slots', 'Advanced pest AI', 'Early access drops'].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.9 + i * 0.1 }}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <Leaf size={14} className="text-moss" />
              {feature}
            </motion.div>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gold hover:bg-gold-light text-text-bark font-bold py-4 px-8 rounded-xl transition-all shadow-lg uppercase tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 min-h-[44px]"
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

  const profile = useLiveQuery(() => GameService.getProfile());
  const levelProgress = useLiveQuery(() => db.levelProgress.get(GameService.getUserId()));
  const seeds = profile?.seeds ?? 0;
  const level = levelProgress?.currentLevel ?? 1;

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
    <PageWrapper className="min-h-screen text-text-bark overflow-x-hidden relative transition-colors duration-1000">
      
      {/* ── AMBIENT BACKGROUND ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          animate={{ 
            x: [0, 100, 0],
            y: [0, -50, 0],
            opacity: [0.1, 0.25, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute -top-40 -left-40 w-80 h-80 bg-moss/10 rounded-full blur-3xl animate-orb-pulse"
        />
        <motion.div
          animate={{ 
            x: [0, -80, 0],
            y: [0, 60, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 25, repeat: Infinity, delay: 2 }}
          className="absolute -bottom-32 -right-32 w-96 h-96 bg-terracotta/10 rounded-full blur-3xl animate-orb-pulse"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ duration: 15, repeat: Infinity, delay: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-orb-pulse"
        />
      </div>

      {/* ── WALLET BAR - ENHANCED ── */}
      <EnhancedWalletDisplay 
        stats={{
          seeds,
          level,
          nextLevelXp: (level + 1) * 500,
          currentXp: (level * 500) + Math.random() * 300,
          vouchers: MOCK_VOUCHERS.length,
          streak: 7
        }}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 max-w-full">
        
        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="sticky top-0 z-40 backdrop-blur-lg border-b border-border-light px-6 md:px-8 py-4"
        >
          <div className="flex items-center justify-between max-w-full">
            <div className="flex items-center gap-2">
              <Leaf className="text-moss" size={28} />
              <h1 className="font-serif text-2xl font-bold text-gold">The Garden Market</h1>
            </div>
          </div>
        </motion.div>

        {/* ── NAVIGATION TABS + FILTER BUTTON ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="px-6 md:px-8 py-6 border-b border-border-light flex gap-3 items-center justify-between"
        >
          <div className="flex gap-3 overflow-x-auto">
            {(['drops', 'home', 'care', 'vouchers'] as const).map((tab, idx) => (
              <motion.button
                key={tab}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-full font-bold text-sm uppercase tracking-wider whitespace-nowrap transition-all animate-tab-highlight ${
                  activeTab === tab
                    ? 'bg-moss text-white shadow-lg'
                    : 'bg-bg-secondary text-text-stone border border-border-light hover:bg-bg-tertiary hover:text-text-bark'
                }`}
              >
                {tab === 'drops' ? '🌿 Drops' : tab === 'home' ? '🏺 Pots' : tab === 'care' ? '🧪 Care' : '🎟 Vouchers'}
              </motion.button>
            ))}
          </div>

          {/* Filter & Checkout Buttons */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary border border-border-medium rounded-lg text-sm font-bold text-text-bark transition-all"
            >
              🔍 Filter
            </motion.button>
            {cartItems.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCheckout(!showCheckout)}
                className="px-4 py-2 bg-moss hover:bg-moss-dark border border-moss rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2"
              >
                🛒 Cart ({cartItems.length})
              </motion.button>
            )}
          </div>
        </motion.div>

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
                    className="font-serif text-3xl font-bold mb-8 text-text-bark"
                  >
                    Available Now
                  </motion.h2>
                  
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
                  className="font-serif text-3xl font-bold mb-8 text-text-bark"
                >
                  Planters & Home
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
                  className="font-serif text-3xl font-bold mb-8 text-text-bark"
                >
                  Care & Soil
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
                  className="font-serif text-3xl font-bold mb-8 text-text-bark"
                >
                  My Vouchers
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
                        className="bg-bg-secondary border border-border-light rounded-2xl p-6 flex items-center justify-between hover:bg-bg-tertiary hover:border-border-medium transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">🎟</div>
                          <div>
                            <h3 className="font-bold text-text-bark">{voucher.title}</h3>
                            <p className="text-sm text-text-stone">{voucher.value}</p>
                            <p className="text-xs text-text-muted mt-1">Expires in {voucher.expiryDays} days</p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-moss hover:bg-moss-dark text-white rounded-lg font-bold text-sm uppercase transition-all"
                        >
                          Apply
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
          <p>🌿 Part of the BotanicalGuardian Ecosystem • Seeds = Discount Power, Never Real Currency</p>
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
            className="fixed inset-0 bg-bg-primary/70 backdrop-blur-md z-[99999] flex items-center justify-center p-4"
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