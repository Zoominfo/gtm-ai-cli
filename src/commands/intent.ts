import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface IntentSearchOptions {
  topics: string[];
  signalScoreMin?: string;
  signalScoreMax?: string;
  audienceStrengthMin?: string;
  audienceStrengthMax?: string;
  signalStart?: string;
  signalEnd?: string;
  industry?: string;
  metro?: string;
  state?: string;
  country?: string;
  employees?: string;
  revenue?: string;
  tech?: string;
  recommendedContacts?: boolean;
  sort?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

interface IntentEnrichOptions {
  topics: string[];
  companyId?: string;
  name?: string;
  website?: string;
  signalScoreMin?: string;
  signalScoreMax?: string;
  audienceStrengthMin?: string;
  audienceStrengthMax?: string;
  signalStart?: string;
  signalEnd?: string;
  recommendedContacts?: boolean;
  sort?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

export function buildIntentSearchArgs(opts: IntentSearchOptions): Record<string, unknown> {
  const args: Record<string, unknown> = { topics: opts.topics };

  if (opts.signalScoreMin) args.signalScoreMin = parseInt(opts.signalScoreMin, 10);
  if (opts.signalScoreMax) args.signalScoreMax = parseInt(opts.signalScoreMax, 10);
  if (opts.audienceStrengthMin) args.audienceStrengthMin = opts.audienceStrengthMin;
  if (opts.audienceStrengthMax) args.audienceStrengthMax = opts.audienceStrengthMax;
  if (opts.signalStart) args.signalStartDate = opts.signalStart;
  if (opts.signalEnd) args.signalEndDate = opts.signalEnd;
  if (opts.industry) args.industryCodes = opts.industry;
  if (opts.metro) args.metroRegion = opts.metro;
  if (opts.state) args.state = opts.state;
  if (opts.country) args.country = opts.country;
  if (opts.employees) args.employeeCount = opts.employees;
  if (opts.revenue) args.revenue = opts.revenue;
  if (opts.tech) args.techAttributeTagList = opts.tech;
  if (opts.recommendedContacts) args.findRecommendedContacts = true;
  if (opts.sort) args.sort = opts.sort;
  if (opts.page) args.page = parseInt(opts.page, 10);
  if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

  return args;
}

export function registerIntent(program: Command): void {
  const intent = program.command('intent').description('Search and enrich buyer intent signals');

  intent
    .command('search')
    .description('Find companies showing buyer intent for a set of topics')
    .requiredOption('--topics <topics...>', 'Intent topic names (1-50) — use `gtm lookup --field intent-topics`')
    .option('--signal-score-min <n>', 'Minimum signal score (60-100)')
    .option('--signal-score-max <n>', 'Maximum signal score (60-100)')
    .option('--audience-strength-min <letter>', 'Min audience strength (A-E, E = smallest)')
    .option('--audience-strength-max <letter>', 'Max audience strength (A-E, A = largest)')
    .option('--signal-start <YYYY-MM-DD>', 'Signal window start')
    .option('--signal-end <YYYY-MM-DD>', 'Signal window end')
    .option('--industry <codes>', 'Industry codes (comma-separated)')
    .option('--metro <regions>', 'Metro regions (comma-separated)')
    .option('--state <states>')
    .option('--country <countries>')
    .option('--employees <ranges>', 'Employee count ranges')
    .option('--revenue <ranges>', 'Revenue ranges')
    .option('--tech <productIds>', 'Tech product IDs (comma-separated)')
    .option('--recommended-contacts', 'Include recommended contacts (slower, may time out)')
    .option('--sort <field>', 'Sort (prefix - for descending), e.g. -signalScore')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: IntentSearchOptions) => {
      const data = await mcpCall('search_intent', buildIntentSearchArgs(opts));
      print(data, opts.format, opts.select);
    });

  intent
    .command('enrich')
    .description('Fetch intent signals for a specific company')
    .requiredOption('--topics <topics...>', 'Intent topic names (1-50)')
    .option('--company-id <id>', 'ZoomInfo company ID (preferred)')
    .option('--name <name>', 'Company name')
    .option('--website <url>', 'Company website (https://example.com)')
    .option('--signal-score-min <n>', 'Minimum signal score (60-100)')
    .option('--signal-score-max <n>', 'Maximum signal score (60-100)')
    .option('--audience-strength-min <letter>', 'A-E')
    .option('--audience-strength-max <letter>', 'A-E')
    .option('--signal-start <YYYY-MM-DD>')
    .option('--signal-end <YYYY-MM-DD>')
    .option('--recommended-contacts', 'Include recommended contacts')
    .option('--sort <field>')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: IntentEnrichOptions) => {
      if (!opts.companyId && !opts.name && !opts.website) {
        console.error('Error: provide --company-id, --name, or --website');
        process.exit(1);
      }
      const args: Record<string, unknown> = { topics: opts.topics };
      if (opts.companyId) args.companyId = opts.companyId;
      if (opts.name) args.companyName = opts.name;
      if (opts.website) args.companyWebsite = opts.website;
      if (opts.signalScoreMin) args.signalScoreMin = parseInt(opts.signalScoreMin, 10);
      if (opts.signalScoreMax) args.signalScoreMax = parseInt(opts.signalScoreMax, 10);
      if (opts.audienceStrengthMin) args.audienceStrengthMin = opts.audienceStrengthMin;
      if (opts.audienceStrengthMax) args.audienceStrengthMax = opts.audienceStrengthMax;
      if (opts.signalStart) args.signalStartDate = opts.signalStart;
      if (opts.signalEnd) args.signalEndDate = opts.signalEnd;
      if (opts.recommendedContacts) args.findRecommendedContacts = true;
      if (opts.sort) args.sort = opts.sort;
      if (opts.page) args.page = parseInt(opts.page, 10);
      if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

      const data = await mcpCall('enrich_intent', args);
      print(data, opts.format, opts.select);
    });
}
