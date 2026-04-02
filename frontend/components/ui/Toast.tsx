"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const ICON: Record<ToastType, string> = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
};

const ALERT_CLASS: Record<ToastType, string> = {
  success: "alert-success",
  error:   "alert-error",
  warning: "alert-warning",
  info:    "alert-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter.current;
    setItems(prev => [...prev, { id, message, type }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Fixed toast stack — top-right */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ minWidth: 280, maxWidth: 360 }}
      >
        {items.map(t => (
          <div
            key={t.id}
            className={`alert ${ALERT_CLASS[t.type]} shadow-xl text-sm animate-in fade-in slide-in-from-right-4 duration-200`}
            style={{ pointerEvents: "auto" }}
          >
            <span className="text-base font-bold leading-none">{ICON[t.type]}</span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
