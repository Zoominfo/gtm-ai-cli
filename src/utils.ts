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

export function parseRange(input: string): { min: string; max: string } {
  const [min, max] = input.split(',');
  return { min: min ?? '', max: max ?? '' };
}

// Splits a CLI-facing comma or " OR "-separated string into a trimmed, non-empty array.
// Used to adapt legacy comma/OR-syntax flags onto v2 MCP tool params that expect typed arrays.
export function splitList(input: string): string[] {
  return input.split(/,| OR /i).map(s => s.trim()).filter(Boolean);
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
