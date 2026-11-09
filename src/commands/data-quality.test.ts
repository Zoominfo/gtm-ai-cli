import { describe, it, expect } from 'vitest';
import { buildPrepareBody, buildRunBody, buildConfigBody, buildConfigsListQuery } from './data-quality.js';

describe('buildPrepareBody', () => {
  it('maps raw values and component objects to typed items', () => {
    expect(buildPrepareBody('phone', ['(617) 555-0123', { number: '6175550199', countryCode: 'US' }])).toEqual({
      data: {
        type: 'PhonePrepareRequest',
        attributes: { items: [{ phone: '(617) 555-0123' }, { components: { number: '6175550199', countryCode: 'US' } }] },
      },
    });
  });

  it('uses each domain\'s raw-value field', () => {
    expect(buildPrepareBody('job-title', ['VP Sales'])).toMatchObject({
      data: { type: 'JobTitlePrepareRequest', attributes: { items: [{ jobTitle: 'VP Sales' }] } },
    });
    expect(buildPrepareBody('person-name', ['Jane Doe'])).toMatchObject({
      data: { type: 'PersonNamePrepareRequest', attributes: { items: [{ name: 'Jane Doe' }] } },
    });
  });

  it('uses the raw-value field of the company-name and url types', () => {
    expect(buildPrepareBody('company-name', ['Acme, Inc.'])).toEqual({
      data: { type: 'CompanyNamePrepareRequest', attributes: { items: [{ companyName: 'Acme, Inc.' }] } },
    });
    expect(buildPrepareBody('url', ['example.com'])).toMatchObject({
      data: { type: 'UrlPrepareRequest', attributes: { items: [{ url: 'example.com' }] } },
    });
  });

  it('maps each enrichment flag to its API enrichments', () => {
    expect(buildPrepareBody('phone', ['1'], { lineType: true, verify: true })).toMatchObject({ data: { attributes: { enrichments: ['LINE_TYPE', 'VERIFICATION'] } } });
    expect(buildPrepareBody('email', ['a@b.co'], { verify: true, threat: true })).toMatchObject({ data: { attributes: { enrichments: ['VERIFICATION', 'THREAT'] } } });
    expect(buildPrepareBody('address', ['1 Main St'], { verify: true })).toMatchObject({ data: { attributes: { enrichments: ['VERIFICATION'] } } });
    expect(buildPrepareBody('job-title', ['CEO'], { classify: true })).toMatchObject({ data: { attributes: { enrichments: ['CLASSIFICATION'] } } });
  });

  it('requests THREAT along with --threat-type, once', () => {
    expect(buildPrepareBody('email', ['a@b.co'], { threatType: true })).toMatchObject({ data: { attributes: { enrichments: ['THREAT', 'THREAT_TYPE'] } } });
    expect(buildPrepareBody('email', ['a@b.co'], { threat: true, threatType: true })).toMatchObject({ data: { attributes: { enrichments: ['THREAT', 'THREAT_TYPE'] } } });
  });

  it('rejects an enrichment flag on a type it does not apply to', () => {
    expect(() => buildPrepareBody('email', ['a@b.co'], { lineType: true })).toThrow('--line-type applies to phone only');
    expect(() => buildPrepareBody('job-title', ['CEO'], { verify: true })).toThrow('--verify applies to phone, email, address only');
    expect(() => buildPrepareBody('phone', ['1'], { threat: true })).toThrow(/email only/);
    expect(() => buildPrepareBody('person-name', ['Jane Doe'], { classify: true })).toThrow(/job-title only/);
  });

  it('applies a saved config or inline rules, not both', () => {
    const rules = { phone: [{ type: 'INT_FORMAT', value: 'E164' }] };
    expect(buildPrepareBody('phone', ['1'], { configId: '7' })).toMatchObject({
      data: { attributes: { config: { normalizationRules: { configId: '7' } } } },
    });
    expect(buildPrepareBody('phone', ['1'], { rules })).toMatchObject({
      data: { attributes: { config: { normalizationRules: { rules } } } },
    });
    expect(() => buildPrepareBody('phone', ['1'], { configId: '7', rules })).toThrow(/not both/);
    expect(() => buildPrepareBody('email', ['a@b.co'], { configId: '7' })).toThrow(/no custom normalization/);
  });

  it('rejects empty input', () => {
    expect(() => buildPrepareBody('email', [])).toThrow(/provide values/);
  });
});

describe('buildRunBody', () => {
  it('builds score and segment run requests, splitting comma-separated config IDs', () => {
    const records = [{ industry: 'Software' }];
    expect(buildRunBody('score', ['12,13', '14'], records)).toEqual({
      data: { type: 'ScoreRunRequest', attributes: { configIds: ['12', '13', '14'], records } },
    });
    expect(buildRunBody('segment', ['7'], records)).toMatchObject({ data: { type: 'SegmentRunRequest' } });
  });
});

describe('configs', () => {
  it('wraps attributes in the kind\'s resource, with the id on updates', () => {
    expect(buildConfigBody('score', { name: 'ICP fit' })).toEqual({ data: { type: 'ScoreConfig', attributes: { name: 'ICP fit' } } });
    expect(buildConfigBody('normalize', { name: 'Phones' }, '9')).toEqual({
      data: { id: '9', type: 'NormalizeConfig', attributes: { name: 'Phones' } },
    });
  });

  it('adds the status filter for normalize configs only', () => {
    expect(buildConfigsListQuery('normalize', { name: 'icp', status: 'active' })).toMatchObject({ 'filter[name]': 'icp', 'filter[status]': 'ACTIVE' });
    expect(() => buildConfigsListQuery('score', { status: 'ACTIVE' })).toThrow(/normalize configs only/);
  });
});
