import { dump } from 'js-yaml';
import type { OutputFormat } from './types.js';

const VALID_FORMATS: readonly OutputFormat[] = ['json', 'jsonl', 'csv', 'yaml', 'table'];

export const FORMAT_OPTION = [
  '-f, --format <format>',
  'Output format: json, jsonl, csv, yaml, table',
  'json',
] as const satisfies readonly [string, string, string];

// Client-side output projection. Named `--select` (not `--fields`) to avoid colliding
// with the enrich commands' existing `--fields`, which selects server-side requiredFields.
export const SELECT_OPTION = [
  '--select <paths>',
  'Comma-separated dotted paths to project from each record (e.g. id,name,company.id)',
] as const satisfies readonly [string, string];

type Row = Record<string, unknown>;

function toRows(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (typeof data === 'object' && data !== null) return [data as Row];
  return [{ value: data }];
}

// Find a single-row envelope's array-of-objects and unwrap to it.
// Recurses through single-key object wrappers so it handles all of:
//   { total: N, items: [...] }                                      (apollo-style)
//   { data: [...], meta: {...} }                                    (JSON:API search)
//   { industries: { data: [...] } }                                 (lookup — two-level wrapper)
//   { company_1: {data: {...}}, company_2: {...}, totalEnriched }   (ZoomInfo bulk enrich)
function unwrapEnvelope(rows: Row[]): Row[] {
  for (let depth = 0; depth < 4; depth++) {
    if (rows.length !== 1) return rows;
    const envelope = rows[0];
    if (!envelope || typeof envelope !== 'object') return rows;
    const entries = Object.entries(envelope);

    // 1) Prefer any key whose value is a non-empty array of objects.
    const arrayEntry = entries.find(([, v]) =>
      Array.isArray(v) && v.length > 0 && typeof v[0] === 'object',
    );
    if (arrayEntry) return arrayEntry[1] as Row[];

    // 2) Bulk-enrich shape: sibling envelopes each holding an object `.data`. Extract
    //    each `.data` payload as a row. Array `.data` values are left alone so the
    //    `lookup` two-level shape still resolves via step 3.
    const dataEnvelopes = entries.filter(([, v]) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      const inner = (v as Row).data;
      return inner !== null && typeof inner === 'object' && !Array.isArray(inner);
    });
    if (dataEnvelopes.length > 0) {
      return dataEnvelopes.map(([, v]) => (v as Row).data as Row);
    }

    // 3) Single-key wrapper — descend into it (e.g. lookup, gtm-context's `result`).
    if (entries.length === 1) {
      const value = entries[0][1];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        rows = [value as Row];
        continue;
      }
    }
    return rows;
  }
  return rows;
}

// JSON:API-flavored shape: { id, type, attributes:{...}, relationships? }.
// Hoist `attributes` keys to the top level so they become columns.
function flattenJsonApi(rows: Row[]): Row[] {
  const looksJsonApi = (r: Row): boolean =>
    r != null && typeof r === 'object' &&
    typeof r.attributes === 'object' && r.attributes !== null && !Array.isArray(r.attributes);
  if (rows.length === 0 || !rows.every(looksJsonApi)) return rows;
  return rows.map(r => {
    const attrs = r.attributes as Row;
    const out: Row = { ...attrs };
    if ('id' in r) out.id = r.id;
    if ('type' in r) out.type = r.type;
    return out;
  });
}

// One-level dot-notation flatten: { a:1, b:{c:2,d:3} } → { a:1, "b.c":2, "b.d":3 }.
// Arrays stay as-is (JSON-stringified by the cell formatter).
function flattenOneLevel(rows: Row[]): Row[] {
  return rows.map(row => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v as Row)) {
          out[`${k}.${k2}`] = v2;
        }
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

// Pipeline shared by table + CSV: unwrap → JSON:API hoist → one-level dot flatten.
export function normalizeRows(data: unknown): Row[] {
  return flattenOneLevel(flattenJsonApi(unwrapEnvelope(toRows(data))));
}

// Dotted-path getter: getPath({a:{b:1}}, "a.b") → 1.
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

// Project each record down to the requested dotted paths, keyed by the path string.
// Unwraps the response envelope first so projection runs over the record array, and
// preserves the singular/array shape of the input.
export function projectFields(data: unknown, paths: string[]): unknown {
  const pick = (row: unknown): Row => Object.fromEntries(paths.map(p => [p, getPath(row, p)]));
  // Unwrap the envelope and hoist JSON:API `attributes` so intuitive paths like `name` or
  // `revenue` resolve, while getPath still handles genuinely-nested paths (e.g. company.id).
  const rows = flattenJsonApi(unwrapEnvelope(toRows(data)));
  // Preserve the input's singular/array shape: a lone record stays an object.
  return rows.length === 1 && !Array.isArray(data) ? pick(rows[0]) : rows.map(pick);
}

function allKeys(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row === 'object' && row !== null) {
      for (const k of Object.keys(row)) seen.add(k);
    }
  }
  return [...seen];
}

function stringify(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function toCsv(rows: Row[]): string {
  if (!rows.length) return '';
  const headers = allKeys(rows);
  const escape = (val: unknown): string => {
    const s = stringify(val);
    return s.includes(',') || s.includes('\r') || s.includes('\n') || s.includes('"')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.map(h => escape(h)).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ].join('\r\n');
}

// Cap used when output is piped (no terminal width to fit to) — preserves the
// historical fixed-width grid for scripts, files, and `grep`.
const MAX_CELL_WIDTH = 50;
// Smallest content width a column may be squeezed to before we give up on the
// grid and switch to the vertical record view.
const MIN_COL_WIDTH = 5;
// Label-column cap for the vertical fallback, and a width to assume when a TTY
// reports no column count.
const MAX_LABEL_WIDTH = 30;
const FALLBACK_TERM_WIDTH = 80;

function flatten(s: string): string {
  return s.replace(/\r?\n/g, ' ');
}

function truncateTo(s: string, width: number): string {
  if (width <= 0) return '';
  if (s.length <= width) return s;
  if (width === 1) return '…';
  return `${s.slice(0, width - 1)}…`;
}

function renderGrid(headers: string[], cells: string[][], colWidths: number[]): string {
  const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const fmt = (vals: string[]): string =>
    '|' + vals.map((v, i) => ` ${v.padEnd(colWidths[i] ?? 0)} `).join('|') + '|';
  return [sep, fmt(headers), sep, ...cells.map(fmt), sep].join('\n');
}

// Total terminal columns a grid with these content widths occupies, including
// borders and per-cell padding: leading/trailing '|', a '|' between columns,
// and a space on each side of every cell.
function gridWidth(colWidths: number[]): number {
  return colWidths.reduce((sum, w) => sum + w + 2, 0) + colWidths.length + 1;
}

// Water-fill column widths so the grid fits `termWidth`: narrow columns keep
// their natural width, and only the greediest (descriptions, topics) get capped
// and ellipsised. Returns null when even MIN_COL_WIDTH-per-column won't fit —
// the signal to fall back to the vertical record view.
function fitColumnWidths(natural: number[], termWidth: number): number[] | null {
  if (gridWidth(natural) <= termWidth) return natural.slice();

  const overhead = gridWidth(natural.map(() => 0)); // borders + padding only
  const available = termWidth - overhead;
  const minTotal = natural.reduce((sum, w) => sum + Math.min(w, MIN_COL_WIDTH), 0);
  if (available < minTotal) return null;

  const sumAt = (cap: number): number => natural.reduce((sum, w) => sum + Math.min(w, cap), 0);
  // Largest uniform cap whose capped total still fits the content budget.
  let lo = MIN_COL_WIDTH;
  let hi = Math.max(...natural);
  let cap = MIN_COL_WIDTH;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sumAt(mid) <= available) { cap = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const widths = natural.map(w => Math.min(w, cap));

  // Hand any rounding slack back to the columns we actually clipped.
  let leftover = available - widths.reduce((sum, w) => sum + w, 0);
  let i = 0;
  while (leftover > 0 && widths.some((w, j) => w < natural[j])) {
    if (widths[i] < natural[i]) { widths[i] += 1; leftover -= 1; }
    i = (i + 1) % widths.length;
  }
  return widths;
}

// Expanded one-record-per-block layout (à la psql's \x), used when a row has too
// many columns to fit the terminal as a grid.
function toVertical(rows: Row[], headers: string[], termWidth: number): string {
  const labelWidth = Math.min(Math.max(...headers.map(h => h.length)), MAX_LABEL_WIDTH);
  const valueWidth = Math.max(MIN_COL_WIDTH, termWidth - labelWidth - 1);
  return rows.map((row, idx) => {
    const tag = `─── ${idx + 1} `;
    const rule = tag + '─'.repeat(Math.max(0, termWidth - tag.length));
    const lines = headers.map(h =>
      `${truncateTo(h, labelWidth).padEnd(labelWidth)} ${truncateTo(flatten(stringify(row[h])), valueWidth)}`,
    );
    return [rule, ...lines].join('\n');
  }).join('\n\n');
}

// Terminal width to fit to: the live TTY width, else an explicit `COLUMNS`
// override (also lets piped output be fit when the user asks for it), else
// undefined → the piped/legacy fixed-width grid.
function resolveTermWidth(): number | undefined {
  if (process.stdout.columns) return process.stdout.columns;
  const env = Number(process.env.COLUMNS);
  return Number.isFinite(env) && env > 0 ? env : undefined;
}

export function toTable(rows: Row[], termWidth: number | undefined = resolveTermWidth()): string {
  if (!rows.length) return '(no results)';
  const headers = allKeys(rows);

  // Piped / non-TTY: keep the historical fixed-width grid (cells capped at
  // MAX_CELL_WIDTH) so downstream tooling sees stable output.
  if (!termWidth) {
    const hdr = headers.map(h => truncateTo(flatten(h), MAX_CELL_WIDTH));
    const cells = rows.map(r => headers.map(h => truncateTo(flatten(stringify(r[h])), MAX_CELL_WIDTH)));
    const colWidths = hdr.map((h, i) => cells.reduce((max, row) => Math.max(max, row[i].length), h.length));
    return renderGrid(hdr, cells, colWidths);
  }

  const width = termWidth || FALLBACK_TERM_WIDTH;
  const rawCells = rows.map(r => headers.map(h => flatten(stringify(r[h]))));
  const natural = headers.map((h, i) => rawCells.reduce((max, row) => Math.max(max, row[i].length), h.length));

  const widths = fitColumnWidths(natural, width);
  if (!widths) return toVertical(rows, headers, width);

  const hdr = headers.map((h, i) => truncateTo(h, widths[i]));
  const cells = rawCells.map(row => row.map((c, i) => truncateTo(c, widths[i])));
  return renderGrid(hdr, cells, widths);
}

function isOutputFormat(value: string): value is OutputFormat {
  return (VALID_FORMATS as readonly string[]).includes(value);
}

export function print(data: unknown, format: string | undefined, select?: string): void {
  if (format && !isOutputFormat(format)) {
    console.error(`Error: unknown format "${format}". Valid options: ${VALID_FORMATS.join(', ')}`);
    process.exit(1);
  }

  const paths = select?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const out = paths.length ? projectFields(data, paths) : data;

  switch (format as OutputFormat | undefined) {
    case 'jsonl':
      toRows(out).forEach(row => console.log(JSON.stringify(row)));
      break;
    case 'csv':
      console.log(toCsv(normalizeRows(out)));
      break;
    case 'yaml':
      console.log(dump(out));
      break;
    case 'table':
      console.log(toTable(normalizeRows(out)));
      break;
    default:
      console.log(JSON.stringify(out, null, 2));
  }
}
