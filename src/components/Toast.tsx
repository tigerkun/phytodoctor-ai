import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (options: ToastOptions | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastMessage extends ToastOptions {
  id: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((options: ToastOptions | string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toastOptions = typeof options === 'string' ? { message: options, type: 'info' as ToastType } : options;
    const { message, type = 'info', duration = 4000 } = toastOptions;

    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = {
    toast: addToast,
    success: (message: string) => addToast({ message, type: 'success' }),
    error: (message: string) => addToast({ message, type: 'error' }),
    info: (message: string) => addToast({ message, type: 'info' }),
    warning: (message: string) => addToast({ message, type: 'warning' }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none max-w-sm w-full items-end">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const iconMap = {
  success: <CheckCircle2 size={20} className="text-moss" />,
  error: <AlertCircle size={20} className="text-terracotta" />,
  warning: <AlertTriangle size={20} className="text-gold" />,
  info: <Info size={20} className="text-sage" />,
};

function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className="pointer-events-auto flex items-start gap-3 p-4 bg-bg-glass backdrop-blur-md border border-border-light shadow-xl rounded-2xl w-full"
    >
      <div className="shrink-0 mt-0.5">{iconMap[toast.type || 'info']}</div>
      <div className="flex-grow">
        <p className="text-sm font-medium text-text-bark whitespace-pre-wrap">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="shrink-0 text-text-muted hover:text-text-bark transition-colors p-1 rounded-lg hover:bg-bg-tertiary"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
