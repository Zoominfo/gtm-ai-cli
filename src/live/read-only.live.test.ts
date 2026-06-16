import { it, expect, beforeAll } from 'vitest';
import { liveDescribe, runJson, records, pickField } from './helpers.js';

// Read-only end-to-end coverage: one live call per non-mutating command, chaining real
// ZoomInfo IDs derived from preceding searches. Assertions are deliberately tolerant of
// response shape and empty result sets — the goal is to catch auth failures, crashes, and
// MCP argument-schema rejections (which surface as a non-zero exit), not to pin field names.
//
// Tests that depend on a derived ID call ctx.skip() (registering as skipped) when the lookup
// turned up nothing, rather than passing vacuously.
//
// Skips entirely unless `gtm auth login` credentials exist. Run with:
//   GTM_CLI_CMD="node dist/js/index.js" npm run test:live

const COMPANY_ID_KEYS = ['companyId', 'id', 'zoominfoCompanyId', 'companyID'];
const PERSON_ID_KEYS = ['personId', 'id', 'contactId', 'zoominfoContactId'];
const NAME_KEYS = ['name', 'topic', 'companyName'];

liveDescribe('ZoomInfo CLI — read-only live coverage', () => {
  let companyId: string | undefined;
  let personId: string | undefined;
  let intentTopic: string | undefined;

  beforeAll(() => {
    const co = runJson(['companies', 'search', '--name', 'ZoomInfo', '--page-size', '1']);
    companyId = pickField(records(co.data)[0], COMPANY_ID_KEYS);

    const ct = runJson(['contacts', 'search', '--company-name', 'ZoomInfo', '--page-size', '1']);
    personId = pickField(records(ct.data)[0], PERSON_ID_KEYS);

    const topics = runJson(['lookup', '--field', 'intent-topics', '--fuzzy', 'cloud']);
    intentTopic = pickField(records(topics.data)[0], NAME_KEYS);
  }, 90_000);

  it('lookup industries returns reference values', () => {
    const { status, data } = runJson(['lookup', '--field', 'industries', '--fuzzy', 'software']);
    expect(status).toBe(0);
    expect(data).not.toBeNull();
  });

  it('companies search', () => {
    const { status, data } = runJson(['companies', 'search', '--industry', 'Software', '--page-size', '3']);
    expect(status).toBe(0);
    expect(data).not.toBeNull();
  });

  it('companies enrich (by derived id)', (ctx) => {
    if (!companyId) return ctx.skip();
    const { status, data } = runJson(['companies', 'enrich', '--id', companyId]);
    expect(status).toBe(0);
    expect(data).not.toBeNull();
  });

  it('companies similar (by derived id)', (ctx) => {
    if (!companyId) return ctx.skip();
    const { status } = runJson(['companies', 'similar', '--id', companyId]);
    expect(status).toBe(0);
  });

  it('contacts search', () => {
    const { status, data } = runJson(['contacts', 'search', '--company-name', 'ZoomInfo', '--page-size', '3']);
    expect(status).toBe(0);
    expect(data).not.toBeNull();
  });

  it('contacts enrich (by derived id)', (ctx) => {
    if (!personId) return ctx.skip();
    const { status, data } = runJson(['contacts', 'enrich', '--id', personId]);
    expect(status).toBe(0);
    expect(data).not.toBeNull();
  });

  it('contacts similar (by derived id)', (ctx) => {
    if (!personId) return ctx.skip();
    const { status } = runJson(['contacts', 'similar', '--person-id', personId]);
    expect(status).toBe(0);
  });

  it('contacts recommended (by derived company id)', (ctx) => {
    if (!companyId) return ctx.skip();
    const { status } = runJson(['contacts', 'recommended', '--company-id', companyId, '--use-case', 'PROSPECTING']);
    expect(status).toBe(0);
  });

  it('intent search (by derived topic)', (ctx) => {
    if (!intentTopic) return ctx.skip();
    const { status } = runJson(['intent', 'search', '--topics', intentTopic, '--page-size', '3']);
    expect(status).toBe(0);
  });

  it('intent enrich (by derived topic + company id)', (ctx) => {
    if (!intentTopic || !companyId) return ctx.skip();
    const { status } = runJson(['intent', 'enrich', '--topics', intentTopic, '--company-id', companyId]);
    expect(status).toBe(0);
  });

  it('scoops search', () => {
    const { status } = runJson(['scoops', 'search', '--scoop-types', 'Funding', '--page-size', '3']);
    expect(status).toBe(0);
  });

  it('scoops enrich (by derived company id)', (ctx) => {
    if (!companyId) return ctx.skip();
    const { status } = runJson(['scoops', 'enrich', '--company-id', companyId]);
    expect(status).toBe(0);
  });

  it('news enrich (by derived company id)', (ctx) => {
    if (!companyId) return ctx.skip();
    const { status } = runJson(['news', 'enrich', '--company-id', companyId]);
    expect(status).toBe(0);
  });

  it('gtm-context get', () => {
    const { status } = runJson(['gtm-context', 'get']);
    expect(status).toBe(0);
  });

  it('research account (by derived company id)', (ctx) => {
    if (!companyId) return ctx.skip();
    const { status } = runJson(
      ['research', 'account', '--company-id', companyId, '--query', 'Brief overview of this company and any recent developments.'],
      120_000,
    );
    expect(status).toBe(0);
  }, 130_000);

  it('research contact (by derived person id)', (ctx) => {
    if (!personId) return ctx.skip();
    const { status } = runJson(
      ['research', 'contact', '--contact-id', personId, '--query', 'Who is this person and what is their role?'],
      120_000,
    );
    expect(status).toBe(0);
  }, 130_000);

  it('raw list-tools exposes the MCP tool surface', () => {
    const { status, data } = runJson(['raw', 'list-tools']);
    expect(status).toBe(0);
    expect(records(data).length).toBeGreaterThan(0);
  });

  it('raw call search_companies', () => {
    const { status } = runJson(['raw', 'call', 'search_companies', '--args', '{"companyName":"ZoomInfo","pageSize":1}']);
    expect(status).toBe(0);
  });

  it('--select projects fields from a search result', () => {
    const { status, data } = runJson(['companies', 'search', '--industry', 'Software', '--page-size', '2', '--select', 'id,name']);
    expect(status).toBe(0);
    expect(data).not.toBeNull();
  });
});
