/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X, Zap } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info' | 'live';
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (title: string, description: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, description: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = {
      id,
      title,
      description,
      type,
      duration: type === 'warning' ? 6000 : 4500,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.duration ?? 4500),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      
      {/* Toast container rendered at bottom left for clean, high-end look on desktop/mobile */}
      <div
        className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 md:px-0"
        dir="rtl"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="pointer-events-auto w-full rounded-2xl p-4 shadow-[0_15px_40px_-5px_rgba(0,0,0,0.15)] border bg-bg-card backdrop-blur-xl flex items-start gap-3.5 text-right relative overflow-hidden group hover:border-indigo-500/40 transition-all border-border-card"
              role={toast.type === 'warning' ? 'alert' : 'status'}
            >
              {/* Colored status strip */}
              <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${
                toast.type === 'success' ? 'bg-gradient-to-b from-emerald-400 to-teal-500' :
                toast.type === 'warning' ? 'bg-gradient-to-b from-amber-400 to-orange-500' :
                toast.type === 'live' ? 'bg-gradient-to-b from-purple-500 to-indigo-600' :
                'bg-gradient-to-b from-indigo-400 to-purple-500'
              }`} />

              {/* Icon container */}
              <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                toast.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                toast.type === 'live' ? 'bg-purple-500/10 text-purple-400' :
                'bg-indigo-500/10 text-indigo-400'
              }`}>
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                {toast.type === 'live' && <Zap className="w-5 h-5 animate-pulse" />}
                {toast.type === 'info' && <Info className="w-5 h-5" />}
              </div>

              {/* Text content */}
              <div className="flex-1 space-y-1 pr-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-text-primary font-sans">
                    {toast.title}
                  </h4>
                  {toast.type === 'live' && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted font-sans font-medium">
                  {toast.description}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-text-muted hover:text-text-primary p-1 hover:bg-slate-800/50 transition-colors rounded-lg cursor-pointer shrink-0"
                aria-label={`إغلاق التنبيه: ${toast.title}`}
              >
                <X className="w-4 h-4" />
              </button>

            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
