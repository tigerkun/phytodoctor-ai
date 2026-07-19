import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle,
  AlertCircle,
  Info,
  XCircle,
  X,
  Leaf,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'reward';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
  position?: 'top' | 'bottom';
}

const getIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle size={20} className="text-[#7a9e7a]" />;
    case 'error':
      return <XCircle size={20} className="text-[#c45b4a]" />;
    case 'warning':
      return <AlertCircle size={20} className="text-[#d4755a]" />;
    case 'reward':
      return <Leaf size={20} className="text-[#5a7a5a]" />;
    default:
      return <Info size={20} className="text-[#a8b5a0]" />;
  }
};

const getBackgroundColor = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'bg-[#7a9e7a]/20 border-[#7a9e7a]/40';
    case 'error':
      return 'bg-[#c45b4a]/20 border-[#c45b4a]/40';
    case 'warning':
      return 'bg-[#d4755a]/20 border-[#d4755a]/40';
    case 'reward':
      return 'bg-[#5a7a5a]/20 border-[#5a7a5a]/40';
    default:
      return 'bg-[#a8b5a0]/20 border-[#a8b5a0]/40';
  }
};

function Toast({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    if (toast.duration !== Infinity) {
      const timer = setTimeout(() => onRemove(toast.id), toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 100, y: -20 }}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
      className={`rounded-lg border backdrop-blur-md p-4 shadow-xl max-w-md w-full ${getBackgroundColor(
        toast.type
      )}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(toast.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white leading-tight">{toast.message}</p>
          {toast.description && (
            <p className="text-xs text-white/70 mt-1">{toast.description}</p>
          )}

          {/* Action Button */}
          {toast.action && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toast.action.onClick}
              className="mt-2 text-xs font-bold text-[#d4af37] hover:text-[#e6c352] transition-colors uppercase tracking-wider"
            >
              {toast.action.label}
            </motion.button>
          )}
        </div>

        {/* Close Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
        >
          <X size={16} />
        </motion.button>
      </div>

      {/* Progress Bar */}
      {toast.duration && toast.duration !== Infinity && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: (toast.duration || 4000) / 1000, ease: 'linear' }}
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#5a7a5a] to-[#d4af37] rounded-b-lg origin-left"
          style={{ originX: 0 }}
        />
      )}
    </motion.div>
  );
}

export default function ToastContainer({
  toasts,
  onRemove,
  position = 'bottom',
}: ToastContainerProps) {
  return (
    <motion.div
      className={`fixed ${position}-6 right-6 z-50 flex flex-col gap-3 pointer-events-none`}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onRemove={onRemove} />
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const add = (toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message: string, description?: string) => {
    return add({
      type: 'success',
      message,
      description,
      duration: 3000,
    });
  };

  const error = (message: string, description?: string) => {
    return add({
      type: 'error',
      message,
      description,
      duration: 5000,
    });
  };

  const warning = (message: string, description?: string) => {
    return add({
      type: 'warning',
      message,
      description,
      duration: 4000,
    });
  };

  const info = (message: string, description?: string) => {
    return add({
      type: 'info',
      message,
      description,
      duration: 3000,
    });
  };

  const reward = (message: string, description?: string) => {
    return add({
      type: 'reward',
      message,
      description,
      duration: 4000,
    });
  };

  return { add, remove, toasts, success, error, warning, info, reward };
}
