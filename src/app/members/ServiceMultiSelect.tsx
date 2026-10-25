"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Multi-select service filter: a dropdown of checkboxes that sets repeated `?service=` params
 * (none = all services). Each tick applies immediately and goes back to page 1.
 */
export function ServiceMultiSelect({
  options,
  selected,
  allLabel,
}: {
  options: readonly string[];
  selected: string[];
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("service");
    // Ticking every service is the same as no filter
    if (next.length < options.length) for (const s of options.filter((o) => next.includes(o))) params.append("service", s);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const toggle = (service: string) =>
    apply(selected.includes(service) ? selected.filter((s) => s !== service) : [...selected, service]);

  const label =
    selected.length === 0
      ? allLabel
      : selected.length <= 2
        ? selected.map((s) => s.split(" - ")[0]).join(", ")
        : `${selected.length} services`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-sm shadow-xs transition min-w-44 ${
          selected.length ? "border-stm-brand text-stm-brand font-semibold" : "border-stone-300 text-stone-800"
        } focus:outline-none focus:ring-4 focus:ring-stm-brand/15`}
      >
        <span className="truncate">{label}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 z-20 mt-1.5 w-64 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
        >
          {options.map((s) => {
            const checked = selected.includes(s);
            return (
              <label
                key={s}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(s)} className="h-4 w-4 accent-stm-brand" />
                {s}
              </label>
            );
          })}
          <div className="mt-1 border-t border-stone-100 px-1.5 pt-1.5">
            <button
              type="button"
              onClick={() => apply([])}
              disabled={selected.length === 0}
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-stm-brand hover:bg-stone-50 disabled:text-stone-300"
            >
              Clear — show all services
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
