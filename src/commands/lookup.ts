import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface LookupOptions {
  field: string[];
  fuzzy?: string;
  vendor?: string;
  category?: string;
  parentCategory?: string;
  subCategory?: string;
  format?: string;
  select?: string;
}

const LOOKUP_FIELDS = [
  'board-members', 'buying-groups', 'company-rankings', 'company-types',
  'continents', 'countries', 'departments', 'employee-count',
  'funding-round-types', 'hashtags', 'industries', 'intent-topics',
  'job-functions', 'job-titles', 'management-levels', 'metro-regions',
  'naics-codes', 'news-categories', 'revenue-ranges', 'scoop-departments',
  'scoop-topics', 'scoop-types', 'sic-codes', 'states', 'sub-unit-types',
  'tech-categories', 'tech-products', 'tech-skills', 'tech-vendors',
  'years-of-experience',
] as const;

export function registerLookup(program: Command): void {
  program
    .command('lookup')
    .description('Get standardized reference values (industries, metros, management-levels, intent-topics, etc.)')
    .requiredOption('--field <names...>', `Field name(s) to look up. Valid: ${LOOKUP_FIELDS.join(', ')}`)
    .option('--fuzzy <text>', 'Filter results by partial name match (case-insensitive). Applies to the first --field.')
    .option('--vendor <name>', 'For tech-products: exact vendor name from `gtm lookup --field tech-vendors`')
    .option('--category <name>', 'For tech-products: a category from `gtm lookup --field tech-categories`; for hashtags: narrow within a category')
    .option('--parent-category <name>', 'For tech-products: a parent category (the `id` from `gtm lookup --field tech-categories`); for hashtags: filter by parent category')
    .option('--sub-category <name>', 'For hashtag/tech lookups: filter by sub-category')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .addHelpText('after', '\ntech-products needs --vendor, --category, or --parent-category.')
    .action(async (opts: LookupOptions) => {
      // job-titles only returns the six management-level buckets, all with the id "job-titles",
      // so it can never resolve a title. Point at the free-text --job-title filter instead.
      if (opts.field.includes('job-titles')) {
        console.error(
          'Note: job-titles only lists management-level buckets, not titles. Job titles are free text: pass them straight to '
          + '`gtm contacts search --job-title "VP Sales OR CRO"`, and use `--field management-levels` for seniority.',
        );
      }

      const fields = opts.field.map((name, i) => {
        const obj: Record<string, unknown> = { fieldName: name };
        // fuzzyMatch applies per-field; only attach it to the first one to match the MCP semantics
        // and the typical CLI use case ("look up X with fuzzy match Y").
        if (i === 0 && opts.fuzzy) obj.fuzzyMatch = opts.fuzzy;
        return obj;
      });
      const args: Record<string, unknown> = { fields };
      if (opts.vendor) args.vendor = opts.vendor;
      if (opts.category) args.category = opts.category;
      if (opts.parentCategory) args.parentCategory = opts.parentCategory;
      if (opts.subCategory) args.subCategory = opts.subCategory;

      const data = await mcpCall('lookup', args);
      print(data, opts.format, opts.select);
    });
}
