// Pure CSV helpers with no server-only imports, safe to use from Client Components.

const DELIMITER_SCAN_ROWS = 10;

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map((v) => escapeCsvField(v == null ? "" : String(v))).join(",")).join("\r\n");
}

/**
 * .csv/.txt can be comma- or tab-delimited (Excel copy-pastes and "Text (Tab delimited)"
 * saves use tabs). Sniffs the first few lines, not just the first, since a title line
 * above the header often has neither: the delimiter found on more lines wins.
 */
function detectDelimiter(text: string): "," | "\t" {
  const lines = text.split(/\r?\n/, DELIMITER_SCAN_ROWS);
  const score = (d: string) => [lines.filter((l) => l.includes(d)).length, lines.join("").split(d).length];
  const [tabLines, tabs] = score("\t");
  const [commaLines, commas] = score(",");
  return tabLines > commaLines || (tabLines === commaLines && tabs > commas) ? "\t" : ",";
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, ""); // strip Excel's UTF-8 BOM
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !r.every((cell) => cell.trim() === ""));
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Surname particles kept with the last name: "Juan Dela Cruz", "Ana de los Santos"
const SURNAME_PARTICLES = new Set([
  "de", "del", "dela", "della", "delos", "la", "las", "los", "san", "sta", "sta.", "sto", "sto.", "santa", "santo", "van", "von", "da", "di", "du",
]);

/** "Dela Cruz, Juan" or "Juan Dela Cruz" → first/last. A single word comes back as a first name only. */
export function splitFullName(raw: string): { firstName: string; lastName: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  const comma = name.indexOf(",");
  if (comma !== -1) return { lastName: name.slice(0, comma).trim(), firstName: name.slice(comma + 1).trim() };
  const words = name.split(" ");
  if (words.length < 2) return { firstName: name, lastName: "" };
  let start = words.length - 1;
  while (start > 1 && SURNAME_PARTICLES.has(words[start - 1].toLowerCase())) start--;
  return { firstName: words.slice(0, start).join(" "), lastName: words.slice(start).join(" ") };
}
