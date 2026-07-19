import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Star,
  TrendingUp,
  Clock,
  DollarSign,
  Leaf,
  ChevronDown,
} from 'lucide-react';

interface ProductFiltersProps {
  onFilterChange?: (filters: FilterState) => void;
  totalProducts?: number;
}

interface FilterState {
  search: string;
  sortBy: 'popular' | 'new' | 'price-low' | 'price-high' | 'rating';
  ratingMin: number;
  priceMin: number;
  priceMax: number;
  category: 'all' | 'drops' | 'home' | 'care' | 'vouchers';
  inStockOnly: boolean;
  limitedOnly: boolean;
}

export default function ProductFilters({
  onFilterChange,
  totalProducts = 0,
}: ProductFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    sortBy: 'popular',
    ratingMin: 0,
    priceMin: 0,
    priceMax: 2000,
    category: 'all',
    inStockOnly: false,
    limitedOnly: false,
  });

  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange?.(updated);
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      search: '',
      sortBy: 'popular',
      ratingMin: 0,
      priceMin: 0,
      priceMax: 2000,
      category: 'all',
      inStockOnly: false,
      limitedOnly: false,
    };
    setFilters(defaultFilters);
    onFilterChange?.(defaultFilters);
  };

  const activeFilters = Object.values(filters).filter(
    (v) => v !== '' && v !== 'popular' && v !== 'all' && v !== 0 && v !== 2000 && v !== false
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Search Bar */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-stone pointer-events-none" size={18} />
        <input
          type="text"
          placeholder="Search products..."
          value={filters.search}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
          className="w-full pl-12 pr-4 py-3 rounded-lg bg-bg-secondary border border-border-medium text-text-bark placeholder:text-text-muted focus:outline-none focus:border-moss/50 focus:bg-bg-tertiary transition-all"
        />
      </motion.div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() =>
            handleFilterChange({
              limitedOnly: !filters.limitedOnly,
            })
          }
          className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all ${
            filters.limitedOnly
              ? 'bg-terracotta text-white shadow-lg'
              : 'bg-bg-secondary text-text-stone border border-border-light hover:bg-bg-tertiary'
          }`}
        >
          Limited Only
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() =>
            handleFilterChange({
              inStockOnly: !filters.inStockOnly,
            })
          }
          className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all ${
            filters.inStockOnly
              ? 'bg-moss text-white shadow-lg'
              : 'bg-bg-secondary text-text-stone border border-border-light hover:bg-bg-tertiary'
          }`}
        >
          In Stock
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider bg-bg-secondary text-text-stone border border-border-light hover:bg-bg-tertiary transition-all flex items-center gap-2"
        >
          <Filter size={14} />
          Filters
          {activeFilters > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-terracotta text-white text-[10px] font-bold">
              {activeFilters}
            </span>
          )}
        </motion.button>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-4 border-t border-border-light overflow-hidden"
          >
            {/* Sort By */}
            <div>
              <label className="text-xs font-bold text-text-stone uppercase tracking-wider mb-2 block">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  handleFilterChange({
                    sortBy: e.target.value as FilterState['sortBy'],
                  })
                }
                className="w-full px-4 py-2 rounded-lg bg-bg-secondary border border-border-medium text-text-bark text-sm focus:outline-none focus:border-moss/50 focus:bg-bg-tertiary transition-all"
              >
                <option value="popular">Most Popular</option>
                <option value="new">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-bold text-text-stone uppercase tracking-wider mb-2 block">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'drops', 'home', 'care'] as const).map((cat) => (
                  <motion.button
                    key={cat}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleFilterChange({ category: cat })}
                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      filters.category === cat
                        ? 'bg-moss text-white shadow-lg'
                        : 'bg-bg-secondary text-text-stone border border-border-light hover:bg-bg-tertiary'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat === 'drops' ? 'Drops' : cat === 'home' ? 'Home' : 'Care'}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-xs font-bold text-text-stone uppercase tracking-wider mb-2 block">
                Price Range: ₹{filters.priceMin} - ₹{filters.priceMax}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="5000"
                  value={filters.priceMin}
                  onChange={(e) =>
                    handleFilterChange({
                      priceMin: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="range"
                  min="0"
                  max="5000"
                  value={filters.priceMax}
                  onChange={(e) =>
                    handleFilterChange({
                      priceMax: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="text-xs font-bold text-text-stone uppercase tracking-wider mb-2 block">
                Minimum Rating
              </label>
              <div className="flex gap-2">
                {[0, 3, 4, 4.5].map((rating) => (
                  <motion.button
                    key={rating}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleFilterChange({ ratingMin: rating })}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      filters.ratingMin === rating
                        ? 'bg-gold text-text-bark shadow-lg'
                        : 'bg-bg-secondary text-text-stone border border-border-light hover:bg-bg-tertiary'
                    }`}
                  >
                    {rating === 0 ? 'All' : (
                      <>
                        <Star size={12} fill="currentColor" />
                        {rating}+
                      </>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={resetFilters}
              className="w-full py-2 rounded-lg bg-bg-secondary border border-border-medium text-text-stone hover:bg-bg-tertiary hover:text-text-bark font-bold text-xs uppercase tracking-wider transition-all"
            >
              Reset All Filters
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Info */}
      {totalProducts > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-text-muted text-center"
        >
          Showing {totalProducts} product{totalProducts !== 1 ? 's' : ''}
        </motion.p>
      )}
    </motion.div>
  );
}
