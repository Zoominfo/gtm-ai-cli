import type { Command } from 'commander';
import { apiCall, listQuery, type ListOptions } from '../api.js';
import { print, FORMAT_OPTION, SELECT_OPTION, type OutputOptions } from '../output.js';
import { parseId, splitList } from '../utils.js';

interface Execution {
  data: { id: string; attributes: { status: string } };
}

// Any other status (COMPLETED, FAILED, STOPPED, or one added later) ends the wait.
const RUNNING_STATUSES = ['PENDING', 'IN_PROGRESS'];
const POLL_INTERVAL_MS = 3000;

interface RunOptions {
  companyIds?: string[];
  contactIds?: string[];
}

// Pure mapper from CLI flags to the execute request body. Exported for unit tests.
export function buildExecuteBody({ companyIds, contactIds }: RunOptions): Record<string, unknown> {
  const ids = companyIds ?? contactIds;
  if (!ids || (companyIds && contactIds)) throw new Error('provide exactly one of --company-ids or --contact-ids');
  const flag = companyIds ? '--company-ids' : '--contact-ids';
  return {
    data: {
      type: 'ExecuteExportRequest',
      attributes: {
        objectType: companyIds ? 'COMPANY' : 'CONTACT',
        ids: ids.flatMap(splitList).map(id => parseId(id, flag)),
      },
    },
  };
}

const exportPath = (id: string) => `/platform/v1/exports/${encodeURIComponent(id)}`;
const executionPath = (id: string) => `/platform/v1/exports/executions/${encodeURIComponent(id)}`;

// Poll a run until it reaches a final status, reporting each status change on stderr.
export async function waitForExecution(execution: Execution, intervalMs = POLL_INTERVAL_MS): Promise<Execution> {
  let status = execution.data.attributes.status;
  console.error(`Export run ${execution.data.id}: ${status}`);
  while (RUNNING_STATUSES.includes(status)) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    execution = await apiCall<Execution>(executionPath(execution.data.id));
    const next = execution.data.attributes.status;
    if (next !== status) console.error(`Export run ${execution.data.id}: ${next}`);
    status = next;
  }
  return execution;
}

export function registerExports(program: Command): void {
  const exportsCommand = program
    .command('exports')
    .description('Send ZoomInfo companies or contacts to your connected systems, such as a CRM (beta)');

  exportsCommand
    .command('list')
    .description('List the exports you can run')
    .option('--name <text>', 'Only exports whose name contains this text')
    .option('--sort <field>', 'name | updatedAt (prefix with - for descending)')
    .option('--page <n>', 'Page number')
    .option('--page-size <n>', 'Results per page')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ListOptions & OutputOptions) => {
      print(await apiCall('/platform/v1/exports', { query: listQuery(opts) }), opts.format, opts.select);
    });

  exportsCommand
    .command('get')
    .description('Get one export, including its category and connected accounts')
    .requiredOption('--id <id>', 'Export ID from `gtm exports list`')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: OutputOptions & { id: string }) => {
      print(await apiCall(exportPath(opts.id)), opts.format, opts.select);
    });

  exportsCommand
    .command('run')
    .description('Send up to 50 companies or contacts through an export as a single run')
    .requiredOption('--id <id>', 'Export ID from `gtm exports list`')
    .option('--company-ids <ids...>', 'ZoomInfo company IDs to send')
    .option('--contact-ids <ids...>', 'ZoomInfo contact IDs to send')
    .option('--wait', 'Wait for the run to finish; exits non-zero if it fails or is stopped')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: RunOptions & OutputOptions & { id: string; wait?: boolean }) => {
      let execution = await apiCall<Execution>(`${exportPath(opts.id)}/actions/execute`, {
        method: 'POST',
        body: buildExecuteBody(opts),
      });
      if (opts.wait) {
        execution = await waitForExecution(execution);
        if (execution.data.attributes.status !== 'COMPLETED') process.exitCode = 1;
      }
      print(execution, opts.format, opts.select);
    });

  exportsCommand
    .command('status')
    .description('Get the status of an export run: PENDING | IN_PROGRESS | COMPLETED | FAILED | STOPPED')
    .requiredOption('--id <id>', 'Run ID returned by `gtm exports run`')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: OutputOptions & { id: string }) => {
      print(await apiCall(executionPath(opts.id)), opts.format, opts.select);
    });
}
