import { InvalidArgumentError } from 'commander';
import { dump } from 'js-yaml';
import type { OutputFormat } from './types.js';

const VALID_FORMATS: readonly OutputFormat[] = ['json', 'jsonl', 'csv', 'yaml', 'table'];

// Validated while parsing flags, so a bad --format fails before any MCP call is made.
function parseFormat(value: string): OutputFormat {
  if (!isOutputFormat(value)) throw new InvalidArgumentError(`Valid options: ${VALID_FORMATS.join(', ')}`);
  return value;
}

export const FORMAT_OPTION = [
  '-f, --format <format>',
  'Output format: json, jsonl, csv, yaml, table',
  parseFormat,
  'json',
] as const satisfies readonly [string, string, (value: string) => OutputFormat, OutputFormat];

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

function isObject(v: unknown): v is Row {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// A bulk-enrich result: `{ success, input, data }` on a match, `{ success: false, input, error }`
// on a miss. Array `.data` values don't qualify, so the `lookup` shape is unaffected.
function isBulkResult(v: unknown): v is Row {
  return isObject(v) && (isObject(v.data) || (typeof v.success === 'boolean' && 'input' in v));
}

// Find the records inside a response envelope. `list` says whether they came from a
// list, so a one-hit search still projects to an array. Handles all of:
//   { data: [...], meta: {...} }                                    (JSON:API search, incl. empty)
//   { total: N, items: [...] }                                      (apollo-style)
//   { industries: [{ fuzzyMatch, data: [...] }] }                   (lookup)
//   { company_1: {data: {...}}, company_2: {...}, totalEnriched }   (ZoomInfo bulk enrich)
//   { result: {...} }                                               (single-key wrapper)
function unwrapEnvelope(data: unknown): { rows: Row[]; list: boolean } {
  if (Array.isArray(data)) return { rows: data as Row[], list: true };

  let record = data;
  for (let depth = 0; depth < 4 && isObject(record); depth++) {
    // 1) A JSON:API `data` array, even when empty, so a search with no hits yields no rows.
    if (Array.isArray(record.data) && record.data.every(isObject)) {
      return { rows: record.data, list: true };
    }

    // 2) Any key whose value is a non-empty array of objects. Lookup nests each field's
    //    values one level deeper, as a lone `{ fuzzyMatch, data: [...] }` wrapper.
    const items = Object.values(record).find(
      (v): v is Row[] => Array.isArray(v) && v.length > 0 && isObject(v[0]),
    );
    if (items) {
      if (items.length === 1 && Array.isArray(items[0].data)) {
        record = items[0];
        continue;
      }
      return { rows: items, list: true };
    }

    // 3) Bulk-enrich shape: one row per input, in input order. Misses keep their row
    //    (input + error) so results stay aligned with the inputs that produced them.
    //    A single-target enrich stays a lone record.
    const results = Object.values(record).filter(isBulkResult);
    if (results.length > 0) {
      return {
        rows: results.map(r => (isObject(r.data) ? r.data : { inputCriteria: r.input, error: r.error })),
        list: results.length > 1,
      };
    }

    // 4) Single-key wrapper — descend into it (e.g. gtm-context's `result`).
    const values = Object.values(record);
    if (values.length !== 1 || !isObject(values[0])) break;
    record = values[0];
  }
  return { rows: toRows(record), list: false };
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
  return flattenOneLevel(flattenJsonApi(unwrapEnvelope(data).rows));
}

// Dotted-path getter: getPath({a:{b:1}}, "a.b") → 1.
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

// Project each record down to the requested dotted paths, keyed by the path string.
// Unwraps the response envelope first so projection runs over the record array. A list
// response always projects to an array (whatever the hit count); a lone record stays an object.
export function projectFields(data: unknown, paths: string[]): unknown {
  const pick = (row: unknown): Row => Object.fromEntries(paths.map(p => [p, getPath(row, p)]));
  // Hoist JSON:API `attributes` so intuitive paths like `name` or `revenue` resolve, while
  // getPath still handles genuinely-nested paths (e.g. company.id).
  const { rows, list } = unwrapEnvelope(data);
  const picked = flattenJsonApi(rows).map(pick);
  return list ? picked : picked[0];
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
      unwrapEnvelope(out).rows.forEach(row => console.log(JSON.stringify(row)));
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
