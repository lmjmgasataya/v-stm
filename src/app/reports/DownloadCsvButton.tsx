"use client";

import { downloadCsv, toCsv } from "@/lib/csv";
import { secondaryBtnCls } from "@/components/form";

export function DownloadCsvButton({ filename, rows, disabled }: { filename: string; rows: (string | number)[][]; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => downloadCsv(filename, toCsv(rows))} className={secondaryBtnCls}>
      Download CSV
    </button>
  );
}
