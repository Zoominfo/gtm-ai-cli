import { Argument, type Command } from 'commander';
import { apiCall, listQuery, type ListOptions, type Query } from '../api.js';
import { print, FORMAT_OPTION, SELECT_OPTION, type OutputOptions } from '../output.js';
import { readJsonArray, readJsonObject, splitList } from '../utils.js';

// Prepare domains: request resource type, raw-value field, and whether custom rules apply.
const PREPARE_TYPES = {
  email: { type: 'EmailPrepareRequest', field: 'email', rules: false },
  phone: { type: 'PhonePrepareRequest', field: 'phone', rules: true },
  address: { type: 'AddressPrepareRequest', field: 'address', rules: true },
  'job-title': { type: 'JobTitlePrepareRequest', field: 'jobTitle', rules: true },
  'person-name': { type: 'PersonNamePrepareRequest', field: 'name', rules: true },
} as const;

type PrepareType = keyof typeof PREPARE_TYPES;

interface PrepareOptions {
  lineType?: boolean;
  verify?: boolean;
  configId?: string;
  rules?: Record<string, unknown>;
}

// Pure mapper from CLI input to the prepare request body. Exported for unit tests.
// A string is a raw value; anything else is pre-parsed `components` (skips the parse step).
export function buildPrepareBody(prepareType: PrepareType, values: unknown[], opts: PrepareOptions = {}): Record<string, unknown> {
  const domain = PREPARE_TYPES[prepareType];
  if (values.length === 0) throw new Error('provide values to prepare, or --file');
  if (opts.lineType && prepareType !== 'phone') throw new Error('--line-type applies to phone only');
  if (opts.verify && prepareType !== 'address') throw new Error('--verify applies to address only');
  if (opts.configId && opts.rules) throw new Error('use either --config-id or --rules, not both');
  if ((opts.configId || opts.rules) && !domain.rules) throw new Error(`${prepareType} has no custom normalization`);

  const items = values.map(value => (typeof value === 'string' ? { [domain.field]: value } : { components: value }));
  const attributes: Record<string, unknown> = { items };
  if (opts.lineType) attributes.enrichments = ['LINE_TYPE'];
  if (opts.verify) attributes.enrichments = ['VERIFY'];
  if (opts.configId) attributes.config = { normalizationRules: { configId: opts.configId } };
  if (opts.rules) attributes.config = { normalizationRules: { rules: opts.rules } };
  return { data: { type: domain.type, attributes } };
}

type RunKind = 'score' | 'segment';

export function buildRunBody(kind: RunKind, configIds: string[], records: unknown[]): Record<string, unknown> {
  return {
    data: {
      type: kind === 'score' ? 'ScoreRunRequest' : 'SegmentRunRequest',
      attributes: { configIds: configIds.flatMap(splitList), records },
    },
  };
}

// Saved configurations: normalization rules (used by prepare), score models, and segment rules.
const CONFIG_KINDS = {
  normalize: { path: '/data-quality/v1/prepare/normalize/configs', type: 'NormalizeConfig' },
  score: { path: '/data-quality/v1/score/configs', type: 'ScoreConfig' },
  segment: { path: '/data-quality/v1/segment/configs', type: 'SegmentConfig' },
} as const;

type ConfigKind = keyof typeof CONFIG_KINDS;

function configPath(kind: ConfigKind, id?: string): string {
  const base = CONFIG_KINDS[kind].path;
  return id === undefined ? base : `${base}/${encodeURIComponent(id)}`;
}

export function buildConfigBody(kind: ConfigKind, attributes: Record<string, unknown>, id?: string): Record<string, unknown> {
  return { data: { ...(id !== undefined && { id }), type: CONFIG_KINDS[kind].type, attributes } };
}

interface ConfigsListOptions extends ListOptions {
  status?: string;
}

export function buildConfigsListQuery(kind: ConfigKind, opts: ConfigsListOptions): Query {
  if (opts.status && kind !== 'normalize') throw new Error('--status applies to normalize configs only');
  return { ...listQuery(opts), 'filter[status]': opts.status?.toUpperCase() };
}

const kindArgument = () => new Argument('<kind>', 'Config kind').choices(Object.keys(CONFIG_KINDS));

export function registerDataQuality(program: Command): void {
  const dq = program
    .command('data-quality')
    .alias('dq')
    .description('Prepare, segment, and score your own records (beta; scoring, segmenting, and opt-in prepare steps use credits)');

  dq
    .command('prepare')
    .description('Parse, validate, and normalize up to 30 values of one type (free unless an opt-in step is used)')
    .addArgument(new Argument('<type>', 'Value type').choices(Object.keys(PREPARE_TYPES)))
    .argument('[values...]', 'Raw values to prepare')
    .option('--file <path>', 'JSON array of values instead of arguments: strings, or objects of pre-parsed components')
    .option('--line-type', 'Phone only: classify the line type, e.g. mobile or landline (uses credits)')
    .option('--verify', 'Address only: verify deliverability, address type, and coordinates (uses credits)')
    .option('--config-id <id>', 'Apply a saved normalization config (uses credits)')
    .option('--rules <path>', 'Apply normalization rules from a JSON file, grouped by rule group (uses credits)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (type: PrepareType, args: string[], opts: Omit<PrepareOptions, 'rules'> & OutputOptions & { file?: string; rules?: string }) => {
      if (opts.file && args.length > 0) throw new Error('provide values as arguments or --file, not both');
      const values = opts.file ? await readJsonArray(opts.file, 'values') : args;
      const rules = opts.rules ? await readJsonObject(opts.rules, '--rules') : undefined;
      const data = await apiCall('/data-quality/v1/prepare', {
        method: 'POST',
        body: buildPrepareBody(type, values, { ...opts, rules }),
      });
      print(data, opts.format, opts.select);
    });

  for (const kind of ['score', 'segment'] as const) {
    dq
      .command(kind)
      .description(kind === 'score'
        ? 'Score up to 25 records against saved score configs (uses credits)'
        : 'Assign up to 25 records to segments from saved segment configs (uses credits)')
      .requiredOption('--config-ids <ids...>', `${kind === 'score' ? 'Score' : 'Segment'} config IDs to apply, in order (up to 10; see \`gtm data-quality configs list ${kind}\`)`)
      .requiredOption('--file <path>', 'JSON array of records, keyed by the field names the configs use')
      .option(...FORMAT_OPTION)
      .option(...SELECT_OPTION)
      .action(async (opts: OutputOptions & { configIds: string[]; file: string }) => {
        const records = await readJsonArray(opts.file, 'records');
        const data = await apiCall(`/data-quality/v1/${kind}/actions/run`, {
          method: 'POST',
          body: buildRunBody(kind, opts.configIds, records),
        });
        print(data, opts.format, opts.select);
      });
  }

  const configs = dq.command('configs').description('Manage saved normalization, score, and segment configs (free)');

  configs
    .command('list')
    .description('List saved configs of one kind')
    .addArgument(kindArgument())
    .option('--name <text>', 'Only configs whose name contains this text (case-insensitive)')
    .option('--status <status>', 'Normalize configs only: ACTIVE | ARCHIVED')
    .option('--sort <field>', 'name | createdAt | updatedAt (prefix with - for descending)')
    .option('--page <n>', 'Page number')
    .option('--page-size <n>', 'Results per page (max 200)')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (kind: ConfigKind, opts: ConfigsListOptions & OutputOptions) => {
      const data = await apiCall(configPath(kind), { query: buildConfigsListQuery(kind, opts) });
      print(data, opts.format, opts.select);
    });

  configs
    .command('get')
    .description('Get one saved config, including its full rules')
    .addArgument(kindArgument())
    .requiredOption('--id <id>', 'Config ID from `gtm data-quality configs list`')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (kind: ConfigKind, opts: OutputOptions & { id: string }) => {
      print(await apiCall(configPath(kind, opts.id)), opts.format, opts.select);
    });

  configs
    .command('create')
    .description('Create a config from a JSON file of its attributes (see the Data Quality API reference for each kind)')
    .addArgument(kindArgument())
    .requiredOption('--file <path>', 'JSON object of config attributes, e.g. { "name": …, "elements": [...] } for a score config')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (kind: ConfigKind, opts: OutputOptions & { file: string }) => {
      const body = buildConfigBody(kind, await readJsonObject(opts.file));
      print(await apiCall(configPath(kind), { method: 'POST', body }), opts.format, opts.select);
    });

  configs
    .command('update')
    .description('Update a config from a JSON file of its attributes (send the complete config for score and segment configs)')
    .addArgument(kindArgument())
    .requiredOption('--id <id>', 'Config ID from `gtm data-quality configs list`')
    .requiredOption('--file <path>', 'JSON object of config attributes')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (kind: ConfigKind, opts: OutputOptions & { id: string; file: string }) => {
      const body = buildConfigBody(kind, await readJsonObject(opts.file), opts.id);
      print(await apiCall(configPath(kind, opts.id), { method: 'PATCH', body }), opts.format, opts.select);
    });

  configs
    .command('delete')
    .description('Permanently delete a config')
    .addArgument(kindArgument())
    .requiredOption('--id <id>', 'Config ID from `gtm data-quality configs list`')
    .action(async (kind: ConfigKind, opts: { id: string }) => {
      await apiCall(configPath(kind, opts.id), { method: 'DELETE' });
      console.log(`Deleted ${kind} config ${opts.id}.`);
    });
}
