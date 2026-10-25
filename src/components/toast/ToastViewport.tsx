"use client";

import { useToast, type ToastItem, type ToastType } from "./ToastContext";

const STYLES: Record<ToastType, { border: string; bar: string; icon: string }> = {
  success: { border: "border-stm-green/30", bar: "bg-stm-green", icon: "✅" },
  error: { border: "border-red-200", bar: "bg-red-500", icon: "⚠️" },
  warning: { border: "border-amber-200", bar: "bg-amber-500", icon: "⚠️" },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const styles = STYLES[toast.type];

  return (
    <div
      className={`pointer-events-auto relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white shadow-lg ${
        toast.leaving ? "animate-toast-out" : "animate-toast-in"
      } ${styles.border}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-lg leading-none">{styles.icon}</span>
        <p className="flex-1 text-sm font-medium text-stm-brand">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-lg leading-none text-stone-400 hover:text-stone-600"
        >
          ×
        </button>
      </div>
      <div className={`h-1 animate-toast-countdown ${styles.bar}`} />
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2 print:hidden">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}
