#!/usr/bin/env node

// Strip `--debug` / `-d` from argv before Commander sees it so it works as a
// universal flag on any subcommand. Expose via env var so modules deep in the
// call tree (mcp.ts) can opt in without us threading a boolean everywhere.
const debugIdx = process.argv.findIndex(a => a === '--debug' || a === '-d');
if (debugIdx >= 0) {
  process.env.GTM_DEBUG = '1';
  process.argv.splice(debugIdx, 1);
}

import { Command } from 'commander';
import { pkg } from './pkg.js';
import { registerAuth } from './commands/auth.js';
import { registerCompanies } from './commands/companies.js';
import { registerContacts } from './commands/contacts.js';
import { registerFeedback } from './commands/feedback.js';
import { registerGtm } from './commands/gtm.js';
import { registerIntent } from './commands/intent.js';
import { registerLookup } from './commands/lookup.js';
import { registerNews } from './commands/news.js';
import { registerRaw } from './commands/raw.js';
import { registerResearch } from './commands/research.js';
import { registerScoops } from './commands/scoops.js';
import { closeClient } from './mcp.js';

const program = new Command();

program
  .name('gtm')
  .description('Command-line interface for the ZoomInfo GTM AI MCP server\n\nGlobal flags:\n  -d, --debug   Log MCP tool calls and responses to stderr (also: GTM_DEBUG=1)')
  .version(pkg.version);

registerAuth(program);
registerCompanies(program);
registerContacts(program);
registerFeedback(program);
registerGtm(program);
registerIntent(program);
registerLookup(program);
registerNews(program);
registerRaw(program);
registerResearch(program);
registerScoops(program);

program.addHelpCommand(false);
program.addCommand(
  new Command('help')
    .argument('[commands...]', 'command path (e.g. companies search)')
    .description('Display help for a command')
    .action((cmds: string[]) => {
      let cmd: Command = program;
      for (const name of cmds) {
        const sub = cmd.commands.find((c) => c.name() === name);
        if (!sub) {
          console.error(`Unknown command: ${cmds.join(' ')}`);
          process.exit(1);
        }
        cmd = sub;
      }
      cmd.help();
    })
);

process.on('beforeExit', () => { void closeClient(); });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
