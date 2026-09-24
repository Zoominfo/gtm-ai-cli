import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface SignalsOptions {
  companyIds: string[];
  types?: string[];
  format?: string;
  select?: string;
}

const SIGNAL_TYPES = ['INTENT', 'NEWS', 'SCOOP'] as const;

// Pure mapping from CLI flags to MCP enrich_company_signals arguments.
// Exported so unit tests can hit it without a network.
export function buildSignalsArgs(opts: SignalsOptions): Record<string, unknown> {
  if (opts.companyIds.length < 1 || opts.companyIds.length > 10) {
    throw new Error(`--company-ids accepts 1-10 IDs (got ${opts.companyIds.length})`);
  }
  const ids = opts.companyIds.map((raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n === 0) {
      throw new Error(`--company-ids must be integer ZoomInfo company IDs (got "${raw}")`);
    }
    return n;
  });

  const args: Record<string, unknown> = { zoominfoCompanyIds: ids };

  if (opts.types && opts.types.length > 0) {
    const types = opts.types.map((t) => t.toUpperCase());
    const invalid = types.filter((t) => !SIGNAL_TYPES.includes(t as typeof SIGNAL_TYPES[number]));
    if (invalid.length > 0) {
      throw new Error(`--types must be one or more of ${SIGNAL_TYPES.join(', ')} (got "${invalid.join(', ')}")`);
    }
    args.signalTypes = types;
  }

  return args;
}

export function registerSignals(program: Command): void {
  program
    .command('signals')
    .description('Latest intent, news, and scoop signals for specific companies (up to 10 per call)')
    .requiredOption('--company-ids <ids...>', 'ZoomInfo company IDs (1-10) — use `gtm companies search` to find them')
    .option('--types <types...>', 'Signal types to return: INTENT | NEWS | SCOOP (default: all three, sorted by latest date)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: SignalsOptions) => {
      const data = await mcpCall('enrich_company_signals', buildSignalsArgs(opts));
      print(data, opts.format, opts.select);
    });
}
