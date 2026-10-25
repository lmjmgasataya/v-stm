"use client";

import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCount = useRef(0);

  useEffect(() => {
    function startBar() {
      if (pendingCount.current === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(8);
        setVisible(true);
        intervalRef.current = setInterval(() => {
          setProgress((p) => {
            if (p >= 82) {
              clearInterval(intervalRef.current!);
              return 82;
            }
            return p + Math.random() * 12;
          });
        }, 250);
      }
      pendingCount.current++;
    }

    function endBar() {
      pendingCount.current = Math.max(0, pendingCount.current - 1);
      if (pendingCount.current > 0) return;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const urlStr = args[0] instanceof Request ? args[0].url : String(args[0]);
      const isSameOrigin = urlStr.startsWith("/") || urlStr.startsWith(window.location.origin);

      if (isSameOrigin) startBar();
      try {
        return await originalFetch(...args);
      } finally {
        if (isSameOrigin) endBar();
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-[3px] bg-[linear-gradient(to_right,var(--color-stm-accent),var(--color-stm-brand),var(--color-stm-green),var(--color-stm-amber))] shadow-[0_0_8px_2px_rgba(15,118,110,0.45)] transition-[width,opacity] duration-300 ease-out"
      style={{
        width: `${progress}%`,
        opacity: visible ? 1 : 0,
      }}
    />
  );
}
