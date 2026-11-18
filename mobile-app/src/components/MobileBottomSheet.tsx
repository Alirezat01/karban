import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, MoreVertical, X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const sheetNode = (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="no-print fixed inset-0 z-50 flex items-end justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F172A]/45 backdrop-blur-xs"
          />

          {/* Mobile App Bottom Sheet Container (Strict 430px Width, Reference Screen 3 Chrome) */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 34 }}
            className="relative z-10 w-full max-w-[430px] max-h-[90vh] rounded-t-[32px] frost-sheet-bg text-[#0F172A] dark:text-white border-t border-x border-white/80 dark:border-slate-700/60 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Grab Handle */}
            <div className="pt-2.5 pb-0.5 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300/90 dark:bg-slate-600" />
            </div>

            {/* Sticky Detail Top Header (Circular Back + Centered Title + Circular Menu/Close) */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن پنجره"
                className="circle-icon-btn w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 transition-transform shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <h2 className="text-sm font-black text-[#0F172A] dark:text-white truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="بستن سریع"
                className="circle-icon-btn w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 pb-8 pt-1 space-y-3.5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(sheetNode, document.body);
  }
  return sheetNode;
};
