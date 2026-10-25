"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Dropdown that sets `?<param>=` in the URL (blank removes it), keeping other params. */
export function FilterSelect({
  param,
  value,
  label,
  options,
  optionLabels,
}: {
  param: string;
  value: string;
  /** Text of the blank (no filter) choice. */
  label: string;
  options: readonly string[];
  optionLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set(param, e.target.value);
        else params.delete(param);
        params.delete("page"); // a new filter starts from the first page
        router.replace(`${pathname}?${params.toString()}`);
      }}
      className="rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-xs transition focus:outline-none focus:ring-4 focus:ring-stm-brand/15 focus:border-stm-brand"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {optionLabels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}
