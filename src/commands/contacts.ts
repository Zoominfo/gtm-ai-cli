import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';
import { requireSearchFilters } from '../utils.js';

interface ContactsSearchOptions {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  jobTitle?: string;
  exactJobTitle?: string;
  managementLevel?: string;
  department?: string;
  jobFunction?: string;
  companyId?: string;
  companyName?: string;
  companyDomain?: string;
  industry?: string;
  metro?: string;
  state?: string;
  country?: string;
  employees?: string;
  revenue?: string;
  tech?: string;
  accuracyMin?: string;
  accuracyMax?: string;
  required?: string;
  executivesOnly?: boolean;
  sort?: string;
  page?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

interface ContactsEnrichOptions {
  id?: string;
  email?: string;
  hashedEmail?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  companyId?: string;
  jobTitle?: string;
  file?: string;
  fields?: string[];
  format?: string;
  select?: string;
}

interface ContactsSimilarOptions {
  personId: string;
  companyId?: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

interface ContactsRecommendedOptions {
  companyId: string;
  useCase: string;
  pageSize?: string;
  format?: string;
  select?: string;
}

export function buildContactsSearchArgs(opts: ContactsSearchOptions): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  if (opts.firstName) args.firstName = opts.firstName;
  if (opts.lastName) args.lastName = opts.lastName;
  if (opts.fullName) args.fullName = opts.fullName;
  if (opts.email) args.emailAddress = opts.email;
  if (opts.jobTitle) args.jobTitle = opts.jobTitle;
  if (opts.exactJobTitle) args.exactJobTitle = opts.exactJobTitle;
  if (opts.managementLevel) args.managementLevel = opts.managementLevel;
  if (opts.department) args.department = opts.department;
  if (opts.jobFunction) args.jobFunction = opts.jobFunction;
  if (opts.companyId) args.companyId = opts.companyId;
  if (opts.companyName) args.companyName = opts.companyName;
  if (opts.companyDomain) args.companyWebsite = opts.companyDomain;
  if (opts.industry) args.industryCodes = opts.industry;
  if (opts.metro) args.metroRegion = opts.metro;
  if (opts.state) args.state = opts.state;
  if (opts.country) args.country = opts.country;
  if (opts.employees) args.employeeCount = opts.employees;
  if (opts.revenue) args.revenue = opts.revenue;
  if (opts.tech) args.techAttributeTagList = opts.tech;
  if (opts.accuracyMin) args.contactAccuracyScoreMin = opts.accuracyMin;
  if (opts.accuracyMax) args.contactAccuracyScoreMax = opts.accuracyMax;
  if (opts.required) args.requiredFields = opts.required;
  if (opts.executivesOnly) args.executivesOnly = true;
  if (opts.sort) args.sort = opts.sort;
  if (opts.page) args.page = parseInt(opts.page, 10);
  if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);

  return args;
}

export function buildContactsEnrichEntry(opts: ContactsEnrichOptions): Record<string, unknown> | null {
  const entry: Record<string, unknown> = {};
  if (opts.id) entry.personId = opts.id;
  if (opts.email) entry.email = opts.email;
  if (opts.hashedEmail) entry.hashedEmail = opts.hashedEmail;
  if (opts.phone) entry.phone = opts.phone;
  if (opts.firstName) entry.firstName = opts.firstName;
  if (opts.lastName) entry.lastName = opts.lastName;
  if (opts.fullName) entry.fullName = opts.fullName;
  if (opts.company) entry.companyName = opts.company;
  if (opts.companyId) entry.companyId = opts.companyId;
  if (opts.jobTitle) entry.jobTitle = opts.jobTitle;
  return Object.keys(entry).length > 0 ? entry : null;
}

export function registerContacts(program: Command): void {
  const contacts = program.command('contacts').description('Search, enrich, and find similar contacts');

  contacts
    .command('search')
    .description("Search ZoomInfo's contact database")
    .option('--first-name <name>')
    .option('--last-name <name>')
    .option('--full-name <name>')
    .option('--email <email>')
    .option('--job-title <titles>', 'Job titles (use OR for multiple: "CFO OR VP Finance")')
    .option('--exact-job-title <titles>', 'Exact job title match')
    .option('--management-level <levels>', 'C Level Exec | VP Level Exec | Director | Manager | Non Manager | Board Member (comma-separated)')
    .option('--department <depts>', 'Department(s) — use `gtm lookup --field departments` for valid values')
    .option('--job-function <funcs>', 'Job function(s)')
    .option('--company-id <id>', 'ZoomInfo company ID(s) — comma-separated')
    .option('--company-name <name>')
    .option('--company-domain <url>', 'Company website URL')
    .option('--industry <codes>', 'Industry codes (comma-separated) — use lookup industries')
    .option('--metro <regions>', 'Metro regions (comma-separated)')
    .option('--state <states>')
    .option('--country <countries>')
    .option('--employees <ranges>', 'Employee count ranges, e.g. "100to249,250to499"')
    .option('--revenue <ranges>', 'Revenue ranges, e.g. "1Mto5M,10Mto25M"')
    .option('--tech <productIds>', 'Tech product IDs (comma-separated)')
    .option('--accuracy-min <score>', 'Minimum contact accuracy score (70-99)')
    .option('--accuracy-max <score>', 'Maximum contact accuracy score (70-99)')
    .option('--required <fields>', 'Required fields: email | phone | directPhone | mobilePhone | personalEmail (comma-separated)')
    .option('--executives-only', 'Only return executives')
    .option('--sort <field>', 'Sort field (prefix - for descending). e.g. -contactAccuracyScore')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ContactsSearchOptions) => {
      const args = buildContactsSearchArgs(opts);
      requireSearchFilters(args, 'gtm contacts search', [
        '--full-name <name>           Full name (or --first-name + --last-name)',
        '--email <email>              Email address',
        '--job-title <titles>         Job titles (use OR for multiple: "CFO OR VP Finance")',
        '--management-level <levels>  C Level Exec | VP Level Exec | Director | Manager | Non Manager',
        '--company-id <id>            ZoomInfo company ID (use `gtm companies search` to find one)',
        '--company-name <name>        Company name',
        '--industry <codes>           Industry codes (use `gtm lookup --field industries`)',
        '--metro <regions>            Metro regions (use `gtm lookup --field metro-regions`)',
      ]);
      const data = await mcpCall('search_contacts', args);
      print(data, opts.format, opts.select);
    });

  contacts
    .command('enrich')
    .description('Enrich a contact (or up to 10 via --file)')
    .option('--id <personId>', 'ZoomInfo person ID (most accurate)')
    .option('--email <email>', 'Email address (business or personal)')
    .option('--hashed-email <hash>', 'Hashed email (MD5/SHA1/SHA256/SHA512)')
    .option('--phone <phone>', 'Direct or mobile phone number')
    .option('--first-name <name>', 'First name (combine with --last-name and --company / --company-id)')
    .option('--last-name <name>')
    .option('--full-name <name>')
    .option('--company <name>', 'Company name (used with first/last/full name)')
    .option('--company-id <id>', 'Company ID (used with first/last/full name)')
    .option('--job-title <title>')
    .option('--file <path>', 'JSON file with an array of identifier objects (up to 10)')
    .option('--fields <fields...>', 'Specific fields to return')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ContactsEnrichOptions) => {
      let contactsArr: unknown[];

      if (opts.file) {
        const text = await readFile(opts.file, 'utf8');
        const parsed: unknown = JSON.parse(text);
        const arr = Array.isArray(parsed)
          ? parsed
          : (parsed as { contacts?: unknown }).contacts;
        if (!Array.isArray(arr)) {
          console.error('Error: --file must contain a JSON array of contact identifier objects (or { "contacts": [...] })');
          process.exit(1);
        }
        contactsArr = arr;
      } else {
        const entry = buildContactsEnrichEntry(opts);
        if (!entry) {
          console.error('Error: provide at least one identifier (--id, --email, --phone, or name + company) or use --file');
          process.exit(1);
        }
        contactsArr = [entry];
      }

      const args: Record<string, unknown> = { contacts: contactsArr };
      if (opts.fields && opts.fields.length > 0) args.requiredFields = opts.fields;

      const data = await mcpCall('enrich_contacts', args);
      print(data, opts.format, opts.select);
    });

  contacts
    .command('similar')
    .description('Find contacts similar to a reference person')
    .requiredOption('--person-id <id>', 'Reference person ZoomInfo ID (integer)')
    .option('--company-id <id>', 'Constrain search to this target company ZoomInfo ID')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ContactsSimilarOptions) => {
      const args: Record<string, unknown> = {
        referencePersonId: parseInt(opts.personId, 10),
      };
      if (opts.companyId) args.targetCompanyId = parseInt(opts.companyId, 10);
      if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);
      const data = await mcpCall('find_similar_contacts', args);
      print(data, opts.format, opts.select);
    });

  contacts
    .command('recommended')
    .description('Get recommended contacts at a target company based on your usage history')
    .requiredOption('--company-id <id>', 'Target company ZoomInfo ID (integer)')
    .requiredOption('--use-case <case>', 'PROSPECTING | DEAL_ACCELERATION | RENEWAL_AND_GROWTH', 'PROSPECTING')
    .option('--page-size <n>', 'Results per page (max 100)', '25')
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: ContactsRecommendedOptions) => {
      const args: Record<string, unknown> = {
        ziCompanyId: parseInt(opts.companyId, 10),
        useCaseType: opts.useCase,
      };
      if (opts.pageSize) args.pageSize = parseInt(opts.pageSize, 10);
      const data = await mcpCall('get_recommended_contacts', args);
      print(data, opts.format, opts.select);
    });
}
