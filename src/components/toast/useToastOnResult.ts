"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./ToastContext";

interface ToastableResult {
  error?: string;
  success?: string;
}

/** Fires a toast whenever a fresh useActionState result carries an error or success message. */
export function useToastOnResult(result: ToastableResult | undefined) {
  const { showToast } = useToast();
  const lastSeen = useRef<ToastableResult | undefined>(undefined);

  useEffect(() => {
    if (!result || result === lastSeen.current) return;
    lastSeen.current = result;
    if (result.error) showToast("error", result.error);
    else if (result.success) showToast("success", result.success);
  }, [result, showToast]);
}
