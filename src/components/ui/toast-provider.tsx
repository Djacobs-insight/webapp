"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "celebration";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, opts?: { action?: Toast["action"]; durationMs?: number }) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, opts?: { action?: Toast["action"]; durationMs?: number }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, action: opts?.action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), opts?.durationMs ?? 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div
        className="fixed bottom-20 left-1/2 z-50 flex flex-col items-center gap-2 -translate-x-1/2 md:bottom-8"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-6 py-3 shadow-lg text-base font-medium animate-fade-in-up
              ${toast.type === "success" ? "bg-teal text-warm-white" : ""}
              ${toast.type === "error" ? "bg-red-600 text-warm-white" : ""}
              ${toast.type === "warning" ? "bg-gold text-charcoal" : ""}
              ${toast.type === "celebration" ? "bg-coral text-warm-white animate-bounce" : ""}
            `}
            tabIndex={0}
            role="status"
            onClick={() => dismissToast(toast.id)}
            onKeyDown={(e) => (e.key === "Escape" ? dismissToast(toast.id) : undefined)}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                className="ml-3 underline font-bold hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action!.onClick();
                  dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
