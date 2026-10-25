"use client";

import { useRouter } from "next/navigation";
import { formatDateString } from "@/lib/date";
import { inputCls } from "@/components/form";

/** Jump to any date that has check-ins. */
export function DateSelect({ dates, value }: { dates: { date: string; total: number }[]; value: string }) {
  const router = useRouter();
  const options = dates.some((d) => d.date === value) ? dates : [{ date: value, total: 0 }, ...dates];
  return (
    <select
      aria-label="Date"
      value={value}
      onChange={(e) => router.replace(`/reports?date=${e.target.value}`, { scroll: false })}
      // inputCls is full-width; this sits between the ‹ › buttons at its natural width
      className={`${inputCls.replace("w-full", "")} w-auto min-w-0 max-w-full`}
    >
      {options.map((d) => (
        <option key={d.date} value={d.date}>
          {formatDateString(d.date)} · {d.total} STM{d.total === 1 ? "" : "s"}
        </option>
      ))}
    </select>
  );
}
