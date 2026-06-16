import type { PageOptions } from './types.js';

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
