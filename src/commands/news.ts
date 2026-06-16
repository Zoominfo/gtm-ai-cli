import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface NewsEnrichOptions {
  companyId: string;
  categories?: string[];
  urls?: string[];
  publishingStart?: string;
  publishingEnd?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

const NEWS_CATEGORIES = [
  'FINANCIAL_RESULTS',
  'FUNDING',
  'GENERAL_NEWS',
  'GENERAL_PRESS_RELEASE',
  'MERGER_OR_ACQUISITION',
  'PERSON',
  'PRODUCT',
] as const;

export function registerNews(program: Command): void {
  const news = program.command('news').description('Fetch news articles for a company');

  news
    .command('enrich')
    .description('Fetch news articles for a specific company')
    .requiredOption('--company-id <id>', 'ZoomInfo company ID (integer)')
    .option('--categories <cats...>', `Filter by category (${NEWS_CATEGORIES.join(', ')})`)
    .option('--urls <urls...>', 'Article URLs to filter by')
    .option('--publishing-start <YYYY-MM-DD>', 'Earliest publishing date')
    .option('--publishing-end <YYYY-MM-DD>', 'Latest publishing date')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: NewsEnrichOptions) => {
      const args: Record<string, unknown> = {
        zoominfoCompanyId: parseInt(opts.companyId, 10),
      };
      if (opts.categories) args.categories = opts.categories;
      if (opts.urls) args.articleUrls = opts.urls;
      if (opts.publishingStart) args.publishingDateStart = opts.publishingStart;
      if (opts.publishingEnd) args.publishingDateEnd = opts.publishingEnd;
      if (opts.page) args.page = parseInt(opts.page, 10);
      if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

      const data = await mcpCall('enrich_news', args);
      print(data, opts.format, opts.select);
    });
}
