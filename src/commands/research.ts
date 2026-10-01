import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';
import { parseId } from '../utils.js';

interface AccountResearchOptions {
  companyId: string;
  query: string;
  format?: string;
  select?: string;
}

interface ContactResearchOptions {
  contactId: string;
  query: string;
  format?: string;
  select?: string;
}

// Pure mappers from CLI flags to research-tool arguments. Exported for unit tests.
export function buildAccountResearchArgs(opts: AccountResearchOptions): Record<string, unknown> {
  return { query: opts.query, zoominfoCompanyId: parseId(opts.companyId, '--company-id') };
}

export function buildContactResearchArgs(opts: ContactResearchOptions): Record<string, unknown> {
  return { query: opts.query, zoominfoContactId: parseId(opts.contactId, '--contact-id') };
}

export function registerResearch(program: Command): void {
  const research = program
    .command('research')
    .description('Agentic, natural-language research on an account or contact');

  research
    .command('account')
    .description('Research a company/account using ZoomInfo data, your CRM, and conversation history')
    .requiredOption('--company-id <id>', 'ZoomInfo company ID (integer) — use `gtm companies search` to find one')
    .requiredOption('--query <text>', 'Natural-language description of the context you want (frame the goal, not just keywords)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AccountResearchOptions) => {
      const data = await mcpCall('account_research', buildAccountResearchArgs(opts));
      print(data, opts.format, opts.select);
    });

  research
    .command('contact')
    .description('Research a specific person/contact using ZoomInfo data, your CRM, and conversation history')
    .requiredOption('--contact-id <id>', 'ZoomInfo contact ID (integer) — use `gtm contacts search` to find one')
    .requiredOption('--query <text>', 'Natural-language description of the context you want (frame the goal, not just keywords)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ContactResearchOptions) => {
      const data = await mcpCall('contact_research', buildContactResearchArgs(opts));
      print(data, opts.format, opts.select);
    });
}
