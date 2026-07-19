import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Leaf,
  Gift,
  Check,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  seedCost: number;
  quantity: number;
}

interface CheckoutSummaryProps {
  items: CartItem[];
  userSeeds: number;
  selectedVoucher?: {
    id: string;
    discount: number;
  };
  onCheckout?: () => void;
  isLoading?: boolean;
}

export default function CheckoutSummary({
  items,
  userSeeds,
  selectedVoucher,
  onCheckout,
  isLoading = false,
}: CheckoutSummaryProps) {
  const [totalCash, setTotalCash] = useState(0);
  const [totalSeeds, setTotalSeeds] = useState(0);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    const cashTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const seedTotal = items.reduce((sum, item) => sum + item.seedCost * item.quantity, 0);
    const voucherDiscount = selectedVoucher?.discount || 0;

    setTotalCash(cashTotal);
    setTotalSeeds(seedTotal);
    setDiscount(voucherDiscount);
  }, [items, selectedVoucher]);

  const finalPrice = Math.max(0, totalCash - discount);
  const seedRefund = Math.floor(totalSeeds / 200);
  const hasEnoughSeeds = userSeeds >= totalSeeds;
  const canCheckout = items.length > 0 && hasEnoughSeeds;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky bottom-0 space-y-4 p-6 rounded-2xl bg-bg-glass border border-border-medium backdrop-blur-xl shadow-lg"
    >
      {/* Cart Summary */}
      <div className="space-y-3">
        <h3 className="font-serif text-xl font-bold text-text-bark flex items-center gap-2">
          <ShoppingCart size={20} className="text-moss" />
          Order Summary
        </h3>

        {/* Price Breakdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-2 text-sm"
        >
          <div className="flex justify-between items-center text-text-stone">
            <span>{items.length} Item{items.length !== 1 ? 's' : ''}</span>
            <span className="font-mono font-bold text-text-bark">₹{totalCash.toLocaleString()}</span>
          </div>

          {selectedVoucher && (
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex justify-between items-center text-moss font-bold"
            >
              <div className="flex items-center gap-2">
                <Gift size={14} />
                <span>Voucher Discount</span>
              </div>
              <span className="text-moss font-mono">-₹{discount}</span>
            </motion.div>
          )}

          <div className="h-px bg-border-light" />

          <div className="flex justify-between items-center font-bold text-lg text-text-bark">
            <span>Final Price</span>
            <span className="font-mono text-gold">₹{finalPrice.toLocaleString()}</span>
          </div>
        </motion.div>
      </div>

      {/* Seeds Refund Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-3 rounded-lg bg-moss/10 border border-moss/20"
      >
        <div className="flex items-start gap-3">
          <Leaf size={16} className="text-moss mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-moss uppercase tracking-wider mb-1">
              Seed Refund
            </p>
            <p className="text-sm text-text-stone font-medium">
              Complete order to earn <span className="font-bold text-moss">{totalSeeds.toLocaleString()}</span> seeds (≈ ₹{seedRefund})
            </p>
          </div>
        </div>
      </motion.div>

      {/* Seed Balance Check */}
      <AnimatePresence>
        {!hasEnoughSeeds && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-lg bg-terracotta/10 border border-terracotta/20 flex items-start gap-3"
          >
            <AlertCircle size={16} className="text-terracotta mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-terracotta uppercase tracking-wider mb-0.5">
                Not Enough Seeds
              </p>
              <p className="text-xs text-text-stone">
                You need {(totalSeeds - userSeeds).toLocaleString()} more seeds
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Seeds Display */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="p-3 rounded-lg bg-bg-secondary border border-border-light flex justify-between items-center"
      >
        <div className="flex items-center gap-2 text-text-stone text-sm font-medium">
          <Leaf size={14} className="text-moss" />
          <span>Your Seeds</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono font-bold text-text-bark text-lg">
            {userSeeds.toLocaleString()}
          </span>
          {totalSeeds > 0 && (
            <span className={`text-xs font-bold ${hasEnoughSeeds ? 'text-moss' : 'text-terracotta'}`}>
              {hasEnoughSeeds ? '✓' : '✗'} {Math.abs(userSeeds - totalSeeds).toLocaleString()}
            </span>
          )}
        </div>
      </motion.div>

      {/* Checkout Button */}
      <motion.button
        whileHover={canCheckout ? { scale: 1.02 } : {}}
        whileTap={canCheckout ? { scale: 0.98 } : {}}
        onClick={onCheckout}
        disabled={!canCheckout || isLoading}
        className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg ${
          canCheckout
            ? 'bg-gradient-to-r from-moss to-gold text-white hover:shadow-xl cursor-pointer'
            : 'bg-bg-secondary text-text-muted border border-border-light cursor-not-allowed'
        }`}
      >
        <motion.div
          animate={isLoading ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          className="flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Zap size={16} />
              </motion.div>
              Processing...
            </>
          ) : (
            <>
              <Check size={18} />
              Proceed to Payment
            </>
          )}
        </motion.div>
      </motion.button>

      {/* Security Badge */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[10px] text-text-muted text-center flex items-center justify-center gap-2"
      >
        <span>🔒</span>
        Secure checkout powered by Razorpay
      </motion.p>
    </motion.div>
  );
}
