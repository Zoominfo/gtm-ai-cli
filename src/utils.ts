import { basename } from 'node:path';
import type { PageOptions } from './types.js';

// `zoominfo` is a compat alias for the canonical `gtm` bin (both package.json bin
// entries point at the same entrypoint). Help/usage text mirrors whichever name was
// invoked so `zoominfo --help` doesn't print `Usage: gtm`. We check argv[1] (npm bin
// shim path) and argv[0] (compiled-binary path); anything unrecognized — dev runs,
// tests, Windows .cmd shims that re-invoke node with the script path — falls back to
// `gtm`. Guidance strings elsewhere (e.g. "Run: gtm auth login") stay canonical.
export function resolveProgramName(argv: readonly string[]): 'gtm' | 'zoominfo' {
  return argv.slice(0, 2).some(p => p && basename(p).toLowerCase().startsWith('zoominfo'))
    ? 'zoominfo'
    : 'gtm';
}

export interface PageOptionInput {
  page?: string;
  perPage?: string;
}

export function parsePageOptions(opts: PageOptionInput): PageOptions {
  const page = parseInt(opts.page ?? '', 10);
  const per_page = parseInt(opts.perPage ?? '', 10);

  if (isNaN(page) || page < 1) {
    console.error('Error: --page must be a positive integer');
    process.exit(1);
  }
  if (isNaN(per_page) || per_page < 1) {
    console.error('Error: --per-page must be a positive integer');
    process.exit(1);
  }

  return { page, per_page };
}

// Strict integer flag parsing: rejects values like "5k" or "1.5" that parseInt would
// silently truncate, so a typo fails fast instead of reaching the MCP as the wrong number.
export function parseInteger(value: string, flag: string): number {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n)) {
    throw new Error(`${flag} must be an integer (got "${value}")`);
  }
  return n;
}

// ZoomInfo IDs are non-zero integers; some (e.g. contact IDs) are negative.
export function parseId(value: string, flag: string): number {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n) || n === 0) {
    throw new Error(`${flag} must be an integer ZoomInfo ID (got "${value}")`);
  }
  return n;
}

export function parseRange(input: string): { min: string; max: string } {
  const [min, max] = input.split(',');
  return { min: min ?? '', max: max ?? '' };
}

// The MCP search tools deprecated their comma-separated string params in favor of typed
// `*List` array variants. CLI flags keep accepting comma-separated values; this converts
// them to the array shape the active params expect.
export function splitList(input: string): string[] {
  return input.split(',').map((v) => v.trim()).filter(Boolean);
}

const NON_FILTER_KEYS = new Set(['page', 'pageSize', 'sort']);

// Exits with a helpful error if the built MCP args contain only paging/sort keys.
// Search endpoints with no filter return unbounded results that aren't useful from a CLI.
export function requireSearchFilters(
  args: Record<string, unknown>,
  cmdPath: string,
  suggestions: string[],
): void {
  const filterKeys = Object.keys(args).filter(k => !NON_FILTER_KEYS.has(k));
  if (filterKeys.length > 0) return;
  const lines = [
    `Error: \`${cmdPath}\` needs at least one filter.`,
    '',
    'Common filters:',
    ...suggestions.map(s => `  ${s}`),
    '',
    `Run \`${cmdPath} --help\` for the full list.`,
  ];
  console.error(lines.join('\n'));
  process.exit(1);
}

// Normalizes the identifier objects from an enrich `--file` before they reach the MCP
// tool, which silently ignores keys it doesn't recognize. Aliases (CLI flag names, or
// field names as they appear in enrich output) are renamed to their MCP key; unknown
// keys and empty entries throw so a typo fails loudly instead of matching nothing.
export function normalizeEnrichEntries(
  entries: unknown[],
  validKeys: readonly string[],
  aliases: Record<string, string>,
): Record<string, unknown>[] {
  return entries.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`entry ${i + 1} must be an object`);
    }
    const entry: Record<string, unknown> = {};
    const unknownKeys: string[] = [];
    for (const [key, value] of Object.entries(raw)) {
      const mcpKey = aliases[key] ?? key;
      if (validKeys.includes(mcpKey)) entry[mcpKey] = value;
      else unknownKeys.push(key);
    }
    if (unknownKeys.length > 0) {
      throw new Error(
        `entry ${i + 1} has unsupported key(s): ${unknownKeys.join(', ')}. ` +
        `Supported keys: ${[...validKeys, ...Object.keys(aliases)].join(', ')}`,
      );
    }
    if (Object.keys(entry).length === 0) {
      throw new Error(`entry ${i + 1} has no identifier`);
    }
    return entry;
  });
}
