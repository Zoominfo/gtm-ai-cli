import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';
import { requireSearchFilters } from '../utils.js';

interface CompaniesSearchOptions {
  name?: string;
  domain?: string;
  industry?: string;
  metro?: string;
  state?: string;
  country?: string;
  continent?: string;
  zip?: string;
  employees?: string;
  employeesMin?: string;
  employeesMax?: string;
  revenue?: string;
  revenueMin?: string;
  revenueMax?: string;
  type?: string;
  ticker?: string[];
  tech?: string;
  naics?: string;
  sic?: string;
  fundingMin?: string;
  fundingMax?: string;
  fundingStart?: string;
  fundingEnd?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

interface CompaniesEnrichOptions {
  id?: string;
  name?: string;
  domain?: string;
  website?: string;
  ticker?: string;
  ip?: string;
  file?: string;
  fields?: string[];
  format?: string;
  select?: string;
}

interface CompaniesSimilarOptions {
  id?: string;
  name?: string;
  format?: string;
  select?: string;
}

// Pure mapping from CLI flags to MCP search_companies arguments.
// Exported so unit tests can hit it without a network.
export function buildCompaniesSearchArgs(opts: CompaniesSearchOptions): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  if (opts.name) args.companyName = opts.name;
  if (opts.domain) args.companyWebsite = opts.domain;
  if (opts.industry) args.industryCodes = opts.industry;
  if (opts.metro) args.metroRegion = opts.metro;
  if (opts.state) args.state = opts.state;
  if (opts.country) args.country = opts.country;
  if (opts.continent) args.continent = opts.continent;
  if (opts.zip) args.zipCode = opts.zip;
  if (opts.employees) args.employeeCount = opts.employees;
  if (opts.employeesMin) args.employeeRangeMin = opts.employeesMin;
  if (opts.employeesMax) args.employeeRangeMax = opts.employeesMax;
  if (opts.revenue) args.revenue = opts.revenue;
  if (opts.revenueMin) args.revenueMin = parseInt(opts.revenueMin, 10);
  if (opts.revenueMax) args.revenueMax = parseInt(opts.revenueMax, 10);
  if (opts.type) args.companyType = opts.type;
  if (opts.ticker) args.companyTicker = opts.ticker;
  if (opts.tech) args.techAttributeTagList = opts.tech;
  if (opts.naics) args.naicsCodes = opts.naics;
  if (opts.sic) args.sicCodes = opts.sic;
  if (opts.fundingMin) args.fundingAmountMin = parseInt(opts.fundingMin, 10);
  if (opts.fundingMax) args.fundingAmountMax = parseInt(opts.fundingMax, 10);
  if (opts.fundingStart) args.fundingStartDate = opts.fundingStart;
  if (opts.fundingEnd) args.fundingEndDate = opts.fundingEnd;
  if (opts.sort) args.sort = opts.sort;
  if (opts.page) args.page = parseInt(opts.page, 10);
  if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

  return args;
}

// Build the `companies` array entry for a single-target enrich call from flags.
export function buildCompaniesEnrichEntry(opts: CompaniesEnrichOptions): Record<string, unknown> | null {
  const entry: Record<string, unknown> = {};
  if (opts.id) entry.companyId = opts.id;
  if (opts.name) entry.companyName = opts.name;
  if (opts.domain) entry.domain = opts.domain;
  if (opts.website) entry.companyWebsite = opts.website;
  if (opts.ticker) entry.companyTicker = opts.ticker;
  if (opts.ip) entry.ipAddress = opts.ip;
  return Object.keys(entry).length > 0 ? entry : null;
}

export function registerCompanies(program: Command): void {
  const companies = program.command('companies').description('Search, enrich, and find similar companies');

  companies
    .command('search')
    .description("Search ZoomInfo's company database")
    .option('--name <name>', 'Company name')
    .option('--domain <url>', 'Company website (https://example.com)')
    .option('--industry <codes>', 'Industry codes (comma-separated) — use `gtm lookup --field industries` for valid values')
    .option('--metro <regions>', 'Metro regions (comma-separated) — use `gtm lookup --field metro-regions`')
    .option('--state <states>', 'State or province (comma-separated)')
    .option('--country <countries>', 'Country (comma-separated)')
    .option('--continent <continents>', 'Continent (comma-separated)')
    .option('--zip <code>', 'Zip / postal code')
    .option('--employees <ranges>', 'Employee count ranges, e.g. "100to249,250to499"')
    .option('--employees-min <n>', 'Minimum employee count (granular)')
    .option('--employees-max <n>', 'Maximum employee count (granular)')
    .option('--revenue <ranges>', 'Revenue ranges, e.g. "1Mto5M,10Mto25M"')
    .option('--revenue-min <thousands>', 'Min annual revenue in thousands')
    .option('--revenue-max <thousands>', 'Max annual revenue in thousands')
    .option('--type <type>', 'Company type: private, public, npo, education, government, other')
    .option('--ticker <symbols...>', 'Stock ticker symbols')
    .option('--tech <productIds>', 'Tech product IDs (comma-separated) — use lookup tech-products')
    .option('--naics <codes>', 'NAICS codes (comma-separated)')
    .option('--sic <codes>', 'SIC codes (comma-separated)')
    .option('--funding-min <thousands>', 'Min funding amount in thousands')
    .option('--funding-max <thousands>', 'Max funding amount in thousands')
    .option('--funding-start <YYYY-MM-DD>', 'Funding window start')
    .option('--funding-end <YYYY-MM-DD>', 'Funding window end')
    .option('--sort <field>', 'Sort: name | employeeCount | revenue (prefix - for descending)')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: CompaniesSearchOptions) => {
      const args = buildCompaniesSearchArgs(opts);
      requireSearchFilters(args, 'gtm companies search', [
        '--name <name>            Company name',
        '--domain <url>           Company website (https://example.com)',
        '--industry <codes>       Industry codes (use `gtm lookup --field industries`)',
        '--metro <regions>        Metro regions (use `gtm lookup --field metro-regions`)',
        '--employees <ranges>     Employee count ranges (e.g. "100to249,250to499")',
        '--revenue <ranges>       Revenue ranges (e.g. "1Mto5M,10Mto25M")',
        '--tech <productIds>      Tech product IDs (use `gtm lookup --field tech-products`)',
      ]);
      const data = await mcpCall('search_companies', args);
      print(data, opts.format, opts.select);
    });

  companies
    .command('enrich')
    .description('Enrich a company (or up to 10 via --file)')
    .option('--id <companyId>', 'ZoomInfo company ID (most accurate)')
    .option('--name <name>', 'Company name')
    .option('--domain <url>', 'Company domain or website')
    .option('--website <url>', 'Company website URL (https://example.com)')
    .option('--ticker <symbol>', 'Stock ticker symbol')
    .option('--ip <address>', 'IP address')
    .option('--file <path>', 'JSON file with an array of identifier objects (up to 10)')
    .option('--fields <fields...>', 'Specific fields to return (see --help for valid values)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: CompaniesEnrichOptions) => {
      let companiesArr: unknown[];

      if (opts.file) {
        const text = await readFile(opts.file, 'utf8');
        const parsed: unknown = JSON.parse(text);
        const arr = Array.isArray(parsed)
          ? parsed
          : (parsed as { companies?: unknown }).companies;
        if (!Array.isArray(arr)) {
          console.error('Error: --file must contain a JSON array of company identifier objects (or { "companies": [...] })');
          process.exit(1);
        }
        companiesArr = arr;
      } else {
        const entry = buildCompaniesEnrichEntry(opts);
        if (!entry) {
          console.error('Error: provide at least one identifier (--id, --name, --domain, --website, --ticker, --ip) or use --file');
          process.exit(1);
        }
        companiesArr = [entry];
      }

      const args: Record<string, unknown> = { companies: companiesArr };
      if (opts.fields && opts.fields.length > 0) args.requiredFields = opts.fields;

      const data = await mcpCall('enrich_companies', args);
      print(data, opts.format, opts.select);
    });

  companies
    .command('similar')
    .description('Find companies similar to a reference company')
    .option('--id <companyId>', 'Reference company ZoomInfo ID (preferred)')
    .option('--name <name>', 'Reference company name (if no ID)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: CompaniesSimilarOptions) => {
      if (!opts.id && !opts.name) {
        console.error('Error: provide --id or --name');
        process.exit(1);
      }
      const args: Record<string, unknown> = {};
      if (opts.id) args.companyId = opts.id;
      if (opts.name) args.companyName = opts.name;
      const data = await mcpCall('find_similar_companies', args);
      print(data, opts.format, opts.select);
    });
}
