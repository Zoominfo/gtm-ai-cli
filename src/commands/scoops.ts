import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';
import { requireSearchFilters } from '../utils.js';

interface ScoopsSearchOptions {
  scoopIds?: string[];
  scoopTypes?: string[];
  scoopTopics?: string[];
  department?: string[];
  description?: string;
  publishedStart?: string;
  publishedEnd?: string;
  updatedSinceCreation?: boolean;
  companyId?: string;
  companyName?: string;
  industry?: string[];
  metro?: string[];
  state?: string;
  country?: string;
  employees?: string[];
  revenue?: string;
  managementLevel?: string[];
  jobTitle?: string[];
  sort?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

interface ScoopsEnrichOptions {
  companyId?: string[];
  name?: string;
  websites?: string[];
  scoopTypes?: string[];
  scoopTopics?: string[];
  department?: string[];
  description?: string;
  publishedStart?: string;
  publishedEnd?: string;
  updatedSinceCreation?: boolean;
  sort?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

export function buildScoopsSearchArgs(opts: ScoopsSearchOptions): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  if (opts.scoopIds) args.scoopIds = opts.scoopIds;
  if (opts.scoopTypes) args.scoopTypes = opts.scoopTypes;
  if (opts.scoopTopics) args.scoopTopics = opts.scoopTopics;
  if (opts.department) args.department = opts.department;
  if (opts.description) args.description = opts.description;
  if (opts.publishedStart) args.publishedStartDate = opts.publishedStart;
  if (opts.publishedEnd) args.publishedEndDate = opts.publishedEnd;
  if (opts.updatedSinceCreation) args.updatedSinceCreation = true;
  if (opts.industry) args.industryCodes = opts.industry;
  if (opts.metro) args.metroRegions = opts.metro;
  if (opts.state) args.state = opts.state;
  if (opts.country) args.country = opts.country;
  if (opts.employees) args.employeeCount = opts.employees;
  if (opts.revenue) args.revenue = opts.revenue;
  if (opts.managementLevel) args.managementLevels = opts.managementLevel;
  if (opts.jobTitle) args.jobTitle = opts.jobTitle;
  if (opts.sort) args.sort = opts.sort;
  if (opts.page) args.page = parseInt(opts.page, 10);
  if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

  return args;
}

export function registerScoops(program: Command): void {
  const scoops = program.command('scoops').description('Real-time business intelligence signals');

  scoops
    .command('search')
    .description('Search for scoops across ZoomInfo')
    .option('--scoop-ids <ids...>', 'Specific scoop IDs')
    .option('--scoop-types <types...>', 'Funding | Earnings | Award | Partnership | New Hire | Layoffs | ... (use lookup scoop-types)')
    .option('--scoop-topics <ids...>', 'Scoop topic IDs (use `gtm lookup --field scoop-topics`)')
    .option('--department <depts...>', 'Information Technology | Finance | Marketing | Engineering & Technical | Sales | Human Resources | C-Suite | Legal | Operations | Other')
    .option('--description <words>', 'Words to match in scoop description (space-separated)')
    .option('--published-start <YYYY-MM-DD>')
    .option('--published-end <YYYY-MM-DD>')
    .option('--updated-since-creation', 'Only scoops updated since publishedStartDate')
    .option('--industry <codes...>', 'Industry codes')
    .option('--metro <regions...>', 'Metro regions')
    .option('--state <states>')
    .option('--country <countries>')
    .option('--employees <ranges...>', 'Employee count ranges')
    .option('--revenue <range>', 'Revenue range')
    .option('--management-level <levels...>', 'Management levels to include')
    .option('--job-title <titles...>', 'Contact job titles')
    .option('--sort <field>', 'Default: -originalPublishedDate')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ScoopsSearchOptions) => {
      const args = buildScoopsSearchArgs(opts);
      requireSearchFilters(args, 'gtm scoops search', [
        '--scoop-types <types...>     Funding | Earnings | Award | Partnership | New Hire | Layoffs | …',
        '--scoop-topics <ids...>      Scoop topic IDs (use `gtm lookup --field scoop-topics`)',
        '--department <depts...>      Information Technology | Finance | Sales | …',
        '--description <words>        Words to match in scoop description',
        '--published-start <YYYY-MM-DD>  Publication window start',
        '--industry <codes...>        Industry codes (use `gtm lookup --field industries`)',
      ]);
      const data = await mcpCall('search_scoops', args);
      print(data, opts.format, opts.select);
    });

  scoops
    .command('enrich')
    .description('Fetch scoops for a specific company')
    .option('--company-id <ids...>', 'ZoomInfo company ID(s)')
    .option('--name <name>', 'Company name')
    .option('--websites <urls...>', 'Company website URLs')
    .option('--scoop-types <types...>')
    .option('--scoop-topics <ids...>')
    .option('--department <depts...>')
    .option('--description <words>')
    .option('--published-start <YYYY-MM-DD>')
    .option('--published-end <YYYY-MM-DD>')
    .option('--updated-since-creation')
    .option('--sort <field>')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ScoopsEnrichOptions) => {
      if (!opts.companyId && !opts.name && !opts.websites) {
        console.error('Error: provide --company-id, --name, or --websites');
        process.exit(1);
      }
      const args: Record<string, unknown> = {};
      if (opts.companyId) args.zoominfoCompanyIds = opts.companyId;
      if (opts.name) args.companyName = opts.name;
      if (opts.websites) args.companyWebsites = opts.websites;
      if (opts.scoopTypes) args.scoopTypes = opts.scoopTypes;
      if (opts.scoopTopics) args.scoopTopics = opts.scoopTopics;
      if (opts.department) args.department = opts.department;
      if (opts.description) args.description = opts.description;
      if (opts.publishedStart) args.publishedStartDate = opts.publishedStart;
      if (opts.publishedEnd) args.publishedEndDate = opts.publishedEnd;
      if (opts.updatedSinceCreation) args.updatedSinceCreation = true;
      if (opts.sort) args.sort = opts.sort;
      if (opts.page) args.page = parseInt(opts.page, 10);
      if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

      const data = await mcpCall('enrich_scoops', args);
      print(data, opts.format, opts.select);
    });
}
