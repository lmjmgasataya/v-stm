"use client";

import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "./ToastContext";
import { ToastViewport } from "./ToastViewport";
import { ToastFromSearchParams } from "./ToastFromSearchParams";

export function Toaster({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <ToastFromSearchParams />
      </Suspense>
      <ToastViewport />
      {children}
    </ToastProvider>
  );
}
