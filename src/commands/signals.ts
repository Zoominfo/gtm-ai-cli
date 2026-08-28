import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface SignalsEnrichOptions {
  companyId: string[];
  types?: string[];
  format?: string;
  select?: string;
}

export function buildSignalsEnrichArgs(opts: SignalsEnrichOptions): Record<string, unknown> {
  const args: Record<string, unknown> = {
    zoominfoCompanyIds: opts.companyId.map(id => parseInt(id, 10)),
  };
  if (opts.types) args.signalTypes = opts.types;
  return args;
}

export function registerSignals(program: Command): void {
  const signals = program.command('signals').description('Unified company signals (intent, news, scoops)');

  signals
    .command('enrich')
    .description('Fetch intent, news, and/or scoop signals for up to 10 companies in one call')
    .requiredOption('--company-id <ids...>', 'ZoomInfo company ID(s) — 1 to 10')
    .option('--types <types...>', 'Restrict to specific signal types: INTENT | NEWS | SCOOP (default: all three)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: SignalsEnrichOptions) => {
      const data = await mcpCall('enrich_company_signals', buildSignalsEnrichArgs(opts));
      print(data, opts.format, opts.select);
    });
}
