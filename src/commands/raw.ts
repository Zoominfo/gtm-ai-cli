import type { Command } from 'commander';
import { listMcpTools, mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface RawOptions {
  args?: string;
  format?: string;
  select?: string;
}

// Catch-all that lets you invoke any MCP tool by name with a raw JSON argument blob.
// Useful for tools that don't have a curated wrapper yet, or for one-off experimentation.
//
//   gtm raw search_companies --args '{"query":"Acme","limit":5}'
//   gtm raw list-tools
export function registerRaw(program: Command): void {
  const raw = program.command('raw').description('Invoke any MCP tool directly');

  raw
    .command('list-tools')
    .description('List every MCP tool the server exposes')
    .option(...FORMAT_OPTION)
    .action(async (opts: { format?: string }) => {
      const tools = await listMcpTools();
      print(tools.map(t => ({ name: t.name, description: t.description })), opts.format);
    });

  raw
    .command('call <tool>')
    .description('Call an MCP tool by name with raw JSON arguments')
    .option('--args <json>', 'JSON-encoded argument object', '{}')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (tool: string, opts: RawOptions) => {
      let args: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(opts.args ?? '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('--args must be a JSON object');
        }
        args = parsed as Record<string, unknown>;
      } catch (err) {
        console.error(`Error parsing --args: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
      const data = await mcpCall(tool, args);
      print(data, opts.format, opts.select);
    });
}
