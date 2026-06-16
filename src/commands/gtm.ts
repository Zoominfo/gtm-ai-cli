import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface GtmGetOptions {
  detailed?: boolean;
  format?: string;
  select?: string;
}

interface GtmUpdateOptions {
  query: string;
  source?: string;
  sourceFile?: string;
  format?: string;
  select?: string;
}

export function registerGtm(program: Command): void {
  const gtm = program.command('gtm-context').description("Read and update your organization's GTM context");

  gtm
    .command('get')
    .description("Show the authenticated user's GTM context (org, offerings, ICPs, personas, competitors)")
    .option('--detailed', 'Return full expanded profiles (default: compressed)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: GtmGetOptions) => {
      const args: Record<string, unknown> = {};
      if (opts.detailed) args.detailed = true;
      const data = await mcpCall('get_gtm_context', args);
      print(data, opts.format, opts.select);
    });

  gtm
    .command('update')
    .description('Update GTM context by synthesizing unstructured content (admin only)')
    .requiredOption('--query <text>', 'Natural language instruction framing your intent')
    .option('--source <text>', 'Raw content to analyze (max ~2,000 words)')
    .option('--source-file <path>', 'Path to a file with raw content (preferred for large inputs)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: GtmUpdateOptions) => {
      const args: Record<string, unknown> = { query: opts.query };
      if (opts.sourceFile) {
        args.sourceMaterial = await readFile(opts.sourceFile, 'utf8');
      } else if (opts.source) {
        args.sourceMaterial = opts.source;
      }
      const data = await mcpCall('update_gtm_context', args);
      print(data, opts.format, opts.select);
    });
}
