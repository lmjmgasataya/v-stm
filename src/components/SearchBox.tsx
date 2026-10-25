"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

export function SearchBox({
  defaultValue,
  placeholder = "Search by name…",
}: {
  defaultValue: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
  }

  return (
    <input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full max-w-xs rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-xs placeholder:text-stone-400 transition focus:outline-none focus:ring-4 focus:ring-stm-brand/15 focus:border-stm-brand"
    />
  );
}
