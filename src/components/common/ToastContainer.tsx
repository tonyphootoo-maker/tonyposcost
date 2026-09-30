import React, { useState, useEffect } from 'react';
import { subscribeToDBToasts, notifyToast } from '../../db';
import { useTranslation } from '../../i18n';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'error' | 'success' | 'info';
  messageTh: string;
  messageEn: string;
}

export interface ShowToastOptions {
  title?: string;
  message: string;
  type?: 'error' | 'success' | 'info';
  messageEn?: string;
}

export function showToast(
  optionsOrMessage: string | ShowToastOptions,
  messageEn?: string,
  type: 'error' | 'success' | 'info' = 'info'
) {
  if (typeof optionsOrMessage === 'object') {
    const toastType = optionsOrMessage.type || 'info';
    const msgTh = optionsOrMessage.message || optionsOrMessage.title || '';
    const msgEn = optionsOrMessage.messageEn || optionsOrMessage.title || optionsOrMessage.message || '';
    notifyToast(toastType, msgTh, msgEn);
  } else {
    notifyToast(type, optionsOrMessage, messageEn || optionsOrMessage);
  }
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { language } = useTranslation();

  useEffect(() => {
    const unsubscribe = subscribeToDBToasts((type, messageTh, messageEn) => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, messageTh, messageEn }]);

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    });

    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in ${
              isError
                ? 'bg-rose-950/90 border-rose-700/60 text-rose-100'
                : isSuccess
                ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-100'
                : 'bg-neutral-900/90 border-neutral-700/60 text-neutral-100'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {!isError && !isSuccess && <Info className="w-5 h-5 text-amber-400" />}
            </div>
            <div className="flex-1 text-sm font-medium leading-snug">
              {language === 'th' ? toast.messageTh : toast.messageEn}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-neutral-400 hover:text-neutral-200 p-0.5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
