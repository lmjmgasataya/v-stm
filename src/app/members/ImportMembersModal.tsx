"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { FormError, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { downloadCsv } from "@/lib/csv";
import {
  MAX_IMPORT_ROWS,
  MEMBER_COLUMN_LABELS,
  MEMBER_IMPORT_HEADERS,
  autoMapColumns,
  buildMemberImportTemplate,
  detectHeaderRow,
  type ImportMapping,
  type MemberColumn,
} from "@/lib/member-import";
import { IMPORT_FILE_ACCEPT, readImportFile } from "@/lib/spreadsheet";
import { MINISTRY_OPTIONS, ministryList } from "@/lib/constants";
import {
  importMembers,
  previewMemberImport,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportSummary,
} from "./importActions";

const HEADER_CHOICES = 10; // rows offered as the header row
const PREVIEW_ROW_LIMIT = 300; // rows rendered in the review table

const STATUS_STYLES: Record<ImportPreviewRow["status"], { label: string; cls: string }> = {
  new: { label: "Import", cls: "bg-stm-green/10 text-stm-green" },
  duplicate: { label: "Skip", cls: "bg-stone-100 text-stone-500" },
  error: { label: "Error", cls: "bg-red-50 text-red-600" },
};

/**
 * Upload (.xlsx / .csv / .txt) → review: header row and column mapping are auto-detected
 * and adjustable, with a dry run of every row → confirm → summary.
 */
export function ImportMembersModal({ services, scoped }: { services: readonly string[]; scoped: boolean }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({ headerRow: null, columns: [] });
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string>();
  const [checking, startChecking] = useTransition();
  const [importing, startImporting] = useTransition();
  const previewRequest = useRef(0);
  const router = useRouter();

  function reset() {
    setFileName("");
    setRows(null);
    setPreview(null);
    setResult(null);
    setError(undefined);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleFile(file: File | undefined) {
    reset();
    if (!file) return;
    try {
      const parsed = await readImportFile(file);
      if (parsed.length === 0) throw new Error("The file is empty.");
      const headerRow = detectHeaderRow(parsed);
      if (parsed.length - (headerRow ?? -1) - 1 > MAX_IMPORT_ROWS) {
        throw new Error(`That's more than ${MAX_IMPORT_ROWS.toLocaleString()} rows — split the file and import it in parts.`);
      }
      setFileName(file.name);
      setRows(parsed);
      setMapping({ headerRow, columns: autoMapColumns(parsed, headerRow) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  // Re-run the dry run whenever the file or mapping changes; only the latest answer is shown
  useEffect(() => {
    if (!rows) return;
    const request = ++previewRequest.current;
    startChecking(async () => {
      const next = await previewMemberImport(rows, mapping);
      if (request === previewRequest.current) setPreview(next);
    });
  }, [rows, mapping]);

  function changeHeaderRow(value: string) {
    if (!rows) return;
    const headerRow = value === "" ? null : Number(value);
    setMapping({ headerRow, columns: autoMapColumns(rows, headerRow) });
  }

  function changeColumn(index: number, field: MemberColumn | null) {
    setMapping((m) => ({
      ...m,
      // A field maps to one column: picking it here clears it elsewhere
      columns: m.columns.map((f, i) => (i === index ? field : f === field ? null : f)),
    }));
  }

  function confirmImport() {
    if (!rows) return;
    startImporting(async () => {
      const summary = await importMembers(rows, mapping);
      setResult(summary);
      if (summary.imported > 0) router.refresh();
    });
  }

  const title = result ? "Import complete" : rows ? "Review import" : "Import service team members";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtnCls}>
        Import
      </button>

      {open && (
        <Modal title={title} onClose={close} wide={rows && !result ? "xl" : true}>
          {result ? (
            <ResultStep result={result} onClose={close} />
          ) : rows ? (
            <ReviewStep
              fileName={fileName}
              rows={rows}
              mapping={mapping}
              preview={preview}
              checking={checking}
              importing={importing}
              onHeaderRowChange={changeHeaderRow}
              onColumnChange={changeColumn}
              onBack={reset}
              onConfirm={confirmImport}
            />
          ) : (
            <>
              <ol className="list-decimal list-inside space-y-2 text-sm text-stone-600">
                <li>
                  Upload an Excel (.xlsx) file, or a .csv / .txt file with columns separated by commas or tabs. The header
                  row is detected automatically — you can check and fix the columns before anything is saved.
                </li>
                <li>
                  Recognized headers (any order):
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[...MEMBER_IMPORT_HEADERS, "Full Name"].map((h) => (
                      <code key={h} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                        {h}
                      </code>
                    ))}
                  </div>
                </li>
                <li>
                  Only the name is required (Last + First Name, or one Full Name column). Put several ministries or
                  discipleship steps in one cell separated by “;” or “,” — ministries: {ministryList(MINISTRY_OPTIONS)}. VGL
                  names are matched to v-1&apos;s VGL list; unmatched names are kept as typed.
                  {scoped &&
                    (services.length === 1
                      ? ` Blank services become ${services[0]}; rows for other services are skipped.`
                      : ` Service Attending must be ${services.join(" or ")}.`)}{" "}
                  <button
                    type="button"
                    onClick={() => downloadCsv("stm-import-template.csv", buildMemberImportTemplate())}
                    className="font-semibold text-stm-brand hover:underline"
                  >
                    Download template
                  </button>
                </li>
              </ol>

              <input
                type="file"
                accept={IMPORT_FILE_ACCEPT}
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = ""; // allow picking the same file again
                }}
                className="mt-4 w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stm-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />
              <div className="mt-3">
                <FormError message={error} />
              </div>

              <div className="mt-5 flex justify-end">
                <button type="button" onClick={close} className={secondaryBtnCls}>
                  Close
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function ReviewStep({
  fileName,
  rows,
  mapping,
  preview,
  checking,
  importing,
  onHeaderRowChange,
  onColumnChange,
  onBack,
  onConfirm,
}: {
  fileName: string;
  rows: string[][];
  mapping: ImportMapping;
  preview: ImportPreview | null;
  checking: boolean;
  importing: boolean;
  onHeaderRowChange: (value: string) => void;
  onColumnChange: (index: number, field: MemberColumn | null) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "new" | "skipped" | "warnings">("all");
  const header = mapping.headerRow === null ? null : rows[mapping.headerRow];
  const firstData = rows[(mapping.headerRow ?? -1) + 1] ?? [];
  const counts = preview?.counts ?? { new: 0, duplicate: 0, error: 0 };
  const allRows = preview?.rows ?? [];
  const warned = allRows.filter((r) => r.status === "new" && r.warnings.length > 0).length;
  const shown = allRows.filter((r) =>
    filter === "all"
      ? true
      : filter === "new"
        ? r.status === "new"
        : filter === "warnings"
          ? r.status === "new" && r.warnings.length > 0
          : r.status !== "new"
  );

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <p className="mr-auto text-stone-600">
          <span className="font-semibold text-stone-800">{fileName}</span> · {rows.length} row{rows.length === 1 ? "" : "s"}
        </p>
        <label className="flex items-center gap-2 text-stone-600">
          Header row
          <select
            value={mapping.headerRow ?? ""}
            onChange={(e) => onHeaderRowChange(e.target.value)}
            className={`${inputCls} w-auto max-w-xs`}
          >
            <option value="">None — every row is a person</option>
            {rows.slice(0, HEADER_CHOICES).map((row, i) => (
              <option key={i} value={i}>
                Row {i + 1}: {row.filter(Boolean).join(", ").slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section>
        <h4 className="mb-2 font-semibold text-stone-700">Columns</h4>
        <div className="max-h-64 overflow-auto rounded-lg border border-stone-200">
          <table className="w-full">
            <thead className="sticky top-0 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">In your file</th>
                <th className="px-3 py-2">Example</th>
                <th className="px-3 py-2">Import as</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {mapping.columns.map((field, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 font-medium text-stone-800">{header?.[i] || `Column ${i + 1}`}</td>
                  <td className="max-w-48 truncate px-3 py-1.5 text-stone-500">{firstData[i] || "—"}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={field ?? ""}
                      onChange={(e) => onColumnChange(i, (e.target.value || null) as MemberColumn | null)}
                      className={`${inputCls} py-1.5 ${field ? "" : "text-stone-400"}`}
                    >
                      <option value="">Don’t import</option>
                      {(Object.keys(MEMBER_COLUMN_LABELS) as MemberColumn[]).map((c) => (
                        <option key={c} value={c}>
                          {MEMBER_COLUMN_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h4 className="mr-2 font-semibold text-stone-700">Records</h4>
          {(
            [
              ["all", `All ${allRows.length}`],
              ["new", `${counts.new} to import`],
              ["warnings", `${warned} with blanks`],
              ["skipped", `${counts.duplicate + counts.error} skipped`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === key ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40"
              }`}
            >
              {label}
            </button>
          ))}
          {checking && <span className="text-xs text-stone-400">Checking…</span>}
        </div>
        <div className={`max-h-80 overflow-auto rounded-lg border border-stone-200 ${checking ? "opacity-60" : ""}`}>
          <table className="w-full">
            <thead className="sticky top-0 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Mobile</th>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Ministry</th>
                <th className="px-3 py-2">VGL</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shown.slice(0, PREVIEW_ROW_LIMIT).map((r) => (
                <tr key={r.row} className="align-top">
                  <td className="px-3 py-1.5 text-stone-400">{r.row}</td>
                  <td className="px-3 py-1.5 text-stone-800 whitespace-nowrap">
                    {r.lastName || "—"}, {r.firstName || "—"}
                    {r.middleInitial && ` ${r.middleInitial}.`}
                    {r.nickname && <span className="text-stone-400"> ({r.nickname})</span>}
                  </td>
                  <td className="px-3 py-1.5 text-stone-600 whitespace-nowrap">{r.mobileNumber || "—"}</td>
                  <td className="px-3 py-1.5 text-stone-600 whitespace-nowrap">{r.serviceAttending ?? "—"}</td>
                  <td className="px-3 py-1.5 text-stone-600">{ministryList(r.ministries) || "—"}</td>
                  <td className="px-3 py-1.5 text-stone-600 whitespace-nowrap">
                    {r.vglName ?? "—"}
                    {r.vglName &&
                      (r.vglLinked ? (
                        <span className="ml-1 text-stm-green" title="Matched to v-1's VGL list">
                          ✓
                        </span>
                      ) : (
                        <span className="ml-1 text-stm-amber" title="Not in v-1's VGL list — kept as typed">
                          *
                        </span>
                      ))}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status].cls}`}>
                      {STATUS_STYLES[r.status].label}
                    </span>
                    {r.message && <span className="ml-2 text-xs text-stone-500">{r.message}</span>}
                    {r.status === "new" &&
                      r.warnings.map((w) => (
                        <p key={w} className="mt-0.5 text-xs text-stm-amber">
                          {w} — left blank
                        </p>
                      ))}
                  </td>
                </tr>
              ))}
              {preview && shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-stone-400">
                    No records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {shown.length > PREVIEW_ROW_LIMIT && (
          <p className="mt-1 text-xs text-stone-400">
            Showing the first {PREVIEW_ROW_LIMIT} of {shown.length}.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-stone-600">
          {preview && (
            <>
              <span className="font-semibold text-stone-800">{counts.new}</span> will be added
              {counts.duplicate > 0 && <>, {counts.duplicate} already here</>}
              {counts.error > 0 && <span className="text-red-600">, {counts.error} with errors</span>}.
            </>
          )}
        </p>
        <button type="button" onClick={onBack} disabled={importing} className={secondaryBtnCls}>
          Choose another file
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!preview || checking || importing || counts.new === 0}
          className={primaryBtnCls}
        >
          {importing ? "Importing…" : `Import ${counts.new} member${counts.new === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}

function ResultStep({ result, onClose }: { result: ImportSummary; onClose: () => void }) {
  return (
    <>
      <div className="rounded-lg bg-stone-50 p-3 text-sm">
        <p className="font-semibold text-stm-green">{result.imported} member(s) imported.</p>
        {result.duplicates > 0 && <p className="text-stone-600">{result.duplicates} skipped — already a member.</p>}
        {result.errors > 0 && <p className="text-red-600">{result.errors} skipped — missing name or service.</p>}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className={primaryBtnCls}>
          Done
        </button>
      </div>
    </>
  );
}
