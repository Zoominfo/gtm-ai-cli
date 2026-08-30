import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

// GTM Studio audiences. The write tools (create/update/columns/rows) drive a downstream
// AI agent via an agentInstruction, so those commands require --instruction — a complete,
// self-contained description of what the agent should do (it has no other context).

interface AudiencesListOptions {
  search?: string;
  type?: string;
  createdBy?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

interface AudiencesGetOptions {
  id: string;
  preview?: string | boolean;
  previewColumns?: string[];
  rowFilter?: string;
  format?: string;
  select?: string;
}

interface AudiencesCreateOptions {
  name: string;
  type: string;
  instruction: string;
  description?: string;
  notes?: string;
  folderId?: string;
  searchQuery?: string;
  format?: string;
  select?: string;
}

interface AudiencesUpdateOptions {
  id: string;
  instruction: string;
  name?: string;
  description?: string;
  notes?: string;
  folderId?: string;
  format?: string;
  select?: string;
}

interface AudiencesColumnsOptions {
  id: string;
  file: string;
  format?: string;
  select?: string;
}

interface AudiencesRowsOptions {
  id: string;
  file: string;
  instruction: string;
  format?: string;
  select?: string;
}

interface AudiencesAnalyzeOptions {
  id: string;
  query: string;
  viewId?: string;
  format?: string;
  select?: string;
}

// Pure mappers from CLI flags to MCP audience-tool arguments. Exported for unit tests.
export function buildAudiencesListArgs(opts: AudiencesListOptions): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (opts.search) args.searchText = opts.search;
  if (opts.type) args.type = opts.type.toUpperCase();
  if (opts.createdBy) args.createdByName = opts.createdBy;
  if (opts.page) args.pageNumber = parseInt(opts.page, 10);
  if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);
  return args;
}

export function buildAudiencesGetArgs(opts: AudiencesGetOptions): Record<string, unknown> {
  const args: Record<string, unknown> = { audienceId: opts.id };
  if (opts.preview !== undefined) {
    args.previewRows = true;
    // --preview with a value sets the row limit; bare --preview uses the server default (5).
    if (typeof opts.preview === 'string') args.previewRowLimit = parseInt(opts.preview, 10);
    if (opts.previewColumns && opts.previewColumns.length > 0) args.previewColumnIds = opts.previewColumns;
    if (opts.rowFilter) args.rowFilter = JSON.parse(opts.rowFilter);
  }
  return args;
}

export function buildAudiencesUpsertArgs(opts: Partial<AudiencesCreateOptions> & Partial<AudiencesUpdateOptions>): Record<string, unknown> {
  const args: Record<string, unknown> = { agentInstruction: opts.instruction };
  if (opts.id) args.audienceId = opts.id;
  if (opts.name) args.name = opts.name;
  if (opts.type) args.type = opts.type.toUpperCase();
  if (opts.description) args.description = opts.description;
  if (opts.notes) args.notes = opts.notes;
  if (opts.folderId) args.folderId = opts.folderId;
  if (opts.searchQuery) args.searchQuery = opts.searchQuery;
  return args;
}

export function buildAudiencesAnalyzeArgs(opts: AudiencesAnalyzeOptions): Record<string, unknown> {
  // The audience id doubles as the workbook sheet id — the audience tools don't
  // expose a separate sheet-id field.
  const agentProps: Record<string, unknown> = { entityId: opts.id, workbookSheetId: opts.id };
  if (opts.viewId) agentProps.view_id = opts.viewId;
  return { query: opts.query, agentProps };
}

// Reads a JSON file containing an array, optionally wrapped in { "<key>": [...] }.
async function readJsonArray(path: string, key: string): Promise<unknown[]> {
  const text = await readFile(path, 'utf8');
  const parsed: unknown = JSON.parse(text);
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>)[key];
  if (!Array.isArray(arr)) {
    console.error(`Error: --file must contain a JSON array of ${key} (or { "${key}": [...] })`);
    process.exit(1);
  }
  return arr;
}

export function registerAudiences(program: Command): void {
  const audiences = program.command('audiences').description('GTM Studio audiences — list-building workbooks of contacts or companies');

  audiences
    .command('list')
    .description('Browse GTM Studio audiences (the returned id is the audienceId for the other subcommands)')
    .option('--search <text>', 'Filter by audience name (case-insensitive contains match)')
    .option('--type <type>', 'CONTACT (person-level rows) | COMPANY (account-level rows)')
    .option('--created-by <name>', 'Filter by creator name (first, last, or full)')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page (max 25)', '10')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesListOptions) => {
      const data = await mcpCall('browse_audiences', buildAudiencesListArgs(opts));
      print(data, opts.format, opts.select);
    });

  audiences
    .command('get')
    .description('Fetch an audience: column definitions plus an optional row preview')
    .requiredOption('--id <uuid>', 'Audience ID from `gtm audiences list`')
    .option('--preview [n]', 'Include a row preview; optionally set the row count (max 25, default 5)')
    .option('--preview-columns <ids...>', 'Column IDs to include in the preview (default: all)')
    .option('--row-filter <json>', 'Row filter JSON, e.g. \'{"operator":"AND","filters":[{"columnId":"…","filterOperator":"CONTAINS","values":["…"]}]}\' (requires --preview)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesGetOptions) => {
      const data = await mcpCall('get_audience', buildAudiencesGetArgs(opts));
      print(data, opts.format, opts.select);
    });

  audiences
    .command('create')
    .description('Create a new audience')
    .requiredOption('--name <name>', 'Display name (max 100 chars)')
    .requiredOption('--type <type>', 'CONTACT | COMPANY (immutable after creation)')
    .requiredOption('--instruction <text>', 'Complete, self-contained instruction for the downstream audience agent (it has no other context)')
    .option('--description <text>', 'Audience summary shown in the GTM Studio UI (max 500 chars)')
    .option('--notes <text>', 'Reference notes (max 1000 chars)')
    .option('--folder-id <uuid>', 'Folder to create the audience in')
    .option('--search-query <json>', 'Exact searchCompaniesV2 / searchContactsV2 input params as JSON, when prospecting from ZoomInfo search criteria')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesCreateOptions) => {
      const data = await mcpCall('upsert_audience', buildAudiencesUpsertArgs(opts));
      print(data, opts.format, opts.select);
    });

  audiences
    .command('update')
    .description('Update an audience (rename, move folder, edit description/notes) — omitted fields are preserved')
    .requiredOption('--id <uuid>', 'Audience ID from `gtm audiences list`')
    .requiredOption('--instruction <text>', 'Complete, self-contained instruction for the downstream audience agent')
    .option('--name <name>', 'New display name')
    .option('--description <text>', 'New description')
    .option('--notes <text>', 'New notes')
    .option('--folder-id <uuid>', 'Move to this folder')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesUpdateOptions) => {
      const data = await mcpCall('upsert_audience', buildAudiencesUpsertArgs(opts));
      print(data, opts.format, opts.select);
    });

  audiences
    .command('columns')
    .description('Create or update audience columns from a JSON file (mix of creates and updates allowed)')
    .requiredOption('--id <uuid>', 'Audience ID from `gtm audiences list`')
    .requiredOption('--file <path>', 'JSON array of column definitions: { name, dataType, agentInstruction } to create; add columnId to update (or { "columns": [...] })')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesColumnsOptions) => {
      const columns = await readJsonArray(opts.file, 'columns');
      const data = await mcpCall('manage_audience_columns', { audienceId: opts.id, columns });
      print(data, opts.format, opts.select);
    });

  audiences
    .command('rows')
    .description('Create or update audience rows from a JSON file (max 50 per call; mix of creates and updates allowed)')
    .requiredOption('--id <uuid>', 'Audience ID from `gtm audiences list`')
    .requiredOption('--file <path>', 'JSON array of rows: { values: [{ columnId, value }] } to create; add rowId to update (or { "rows": [...] })')
    .requiredOption('--instruction <text>', 'Complete, self-contained instruction for the downstream audience agent, including the row data intent')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesRowsOptions) => {
      const rows = await readJsonArray(opts.file, 'rows');
      const data = await mcpCall('manage_audience_rows', {
        audienceId: opts.id,
        rows,
        agentInstruction: opts.instruction,
      });
      print(data, opts.format, opts.select);
    });

  audiences
    .command('analyze')
    .description('Ask the audience analysis agent for counts, summaries, distributions, segments, rankings, or comparisons')
    .requiredOption('--id <uuid>', 'Audience ID from `gtm audiences list`')
    .requiredOption('--query <text>', 'Complete analysis request — include exact column names when known')
    .option('--view-id <id>', 'Analyze a specific saved audience view')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: AudiencesAnalyzeOptions) => {
      const data = await mcpCall('query_audience_analysis_agent', buildAudiencesAnalyzeArgs(opts));
      print(data, opts.format, opts.select);
    });
}
