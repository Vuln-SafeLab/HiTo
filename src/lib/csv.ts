// Pure CSV encode/decode, shared by server export and client report download; no runtime deps

export type CsvCell = string | number | boolean | null;

// CSV formula-injection neutralization: Excel/LibreOffice execute = + - @ and tab/CR as formulas. The username in audit logs is attacker-controlled from the pre-login form, so raw export would poison the admin's spreadsheet — prefix with a single quote to downgrade to plain text
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: CsvCell): string {
  let text = value === null ? "" : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return `﻿${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
}

export function parseCsv(text: string): string[][] {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last !== undefined && last.every((value) => value === "")) rows.pop();
    else break;
  }
  return rows;
}
