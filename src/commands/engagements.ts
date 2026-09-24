import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface EngagementsListOptions {
  companyId?: string;
  contactId?: string;
  start?: string;
  end?: string;
  type?: string;
  limit?: string;
  sort?: string;
  format?: string;
  select?: string;
}

interface EngagementsAskOptions {
  query: string;
  engagementId?: string;
  companyId?: string;
  contactId?: string;
  includeContent?: boolean;
  format?: string;
  select?: string;
}

// ZoomInfo IDs are integers. Validate + coerce here so a bad ID fails fast
// with a clear message rather than reaching the MCP as NaN.
function parseId(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n === 0) {
    throw new Error(`${flag} must be an integer ZoomInfo ID (got "${value}")`);
  }
  return n;
}

// Pure mappers from CLI flags to MCP engagement-tool arguments. Exported for unit tests.
export function buildEngagementsListArgs(opts: EngagementsListOptions): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  if (opts.companyId) args.zoominfoCompanyId = parseId(opts.companyId, '--company-id');
  if (opts.contactId) args.zoominfoContactId = parseId(opts.contactId, '--contact-id');
  if (opts.start) args.engagementDateStart = opts.start;
  if (opts.end) args.engagementDateEnd = opts.end;
  if (opts.type) args.engagementType = opts.type.toUpperCase();
  if (opts.limit) args.engagementLimit = parseInt(opts.limit, 10);
  if (opts.sort) args.sort = opts.sort;

  return args;
}

export function buildEngagementsAskArgs(opts: EngagementsAskOptions): Record<string, unknown> {
  const scopes = [opts.engagementId, opts.companyId, opts.contactId].filter(Boolean);
  if (scopes.length !== 1) {
    throw new Error('provide exactly one of --engagement-id, --company-id, or --contact-id');
  }

  const args: Record<string, unknown> = { query: opts.query };

  // Engagement IDs are opaque strings (some contain literal angle brackets) — pass verbatim.
  if (opts.engagementId) args.engagementId = opts.engagementId;
  if (opts.companyId) args.zoominfoCompanyId = parseId(opts.companyId, '--company-id');
  if (opts.contactId) args.zoominfoContactId = parseId(opts.contactId, '--contact-id');
  if (opts.includeContent) args.includeContent = true;

  return args;
}

export function registerEngagements(program: Command): void {
  const engagements = program
    .command('engagements')
    .description('Engagement history (meetings, emails) and conversation intelligence');

  engagements
    .command('list')
    .description('List engagements (meetings and emails) with external contacts — requires a calendar/email/meeting integration in ZoomInfo')
    .option('--company-id <id>', 'Filter by ZoomInfo company ID (integer)')
    .option('--contact-id <id>', 'Filter by ZoomInfo contact ID (integer)')
    .option('--start <datetime>', 'Start of date window, ISO 8601 (e.g. 2026-06-01T00:00:00Z). Default: 7 days ago. Window max 90 days')
    .option('--end <datetime>', 'End of date window, ISO 8601. Default: 7 days from now')
    .option('--type <type>', 'EMAILS | MEETINGS | EMAILS_AND_MEETINGS (default)')
    .option('--limit <n>', 'Number of engagements to return (max 50)', '10')
    .option('--sort <order>', 'chronological (default) | -chronological (newest first)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: EngagementsListOptions) => {
      const data = await mcpCall('browse_engagements', buildEngagementsListArgs(opts));
      print(data, opts.format, opts.select);
    });

  engagements
    .command('ask')
    .description('Ask a natural-language question about calls, meetings, and emails (conversation intelligence)')
    .requiredOption('--query <text>', 'The question, with context and any date range of interest (default lookback: 365 days)')
    .option('--engagement-id <id>', 'Scope to one engagement (opaque ID from `gtm engagements list` — pass verbatim, quoted)')
    .option('--company-id <id>', 'Scope to an account: synthesize across its recent engagements (ZoomInfo company ID)')
    .option('--contact-id <id>', 'Scope to a contact: synthesize across their recent engagements (ZoomInfo contact ID)')
    .option('--include-content', 'Append the raw transcript / email body (--engagement-id scope only; can be very large)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: EngagementsAskOptions) => {
      const data = await mcpCall('conversation_intelligence', buildEngagementsAskArgs(opts));
      print(data, opts.format, opts.select);
    });
}
