import { describe, it, expect } from 'vitest';
import { buildCompaniesSearchArgs, buildCompaniesEnrichEntry, normalizeCompaniesEnrichEntries } from './companies.js';

describe('buildCompaniesSearchArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildCompaniesSearchArgs({})).toEqual({});
  });

  it('maps simple flags to MCP arg names (kebab to camel)', () => {
    expect(buildCompaniesSearchArgs({
      name: 'Acme',
      domain: 'https://acme.com',
      industry: 'Computer Software',
      metro: 'CA - San Francisco',
    })).toEqual({
      companyName: 'Acme',
      companyWebsite: 'https://acme.com',
      industryCodes: 'Computer Software',
      metroRegion: 'CA - San Francisco',
    });
  });

  it('coerces numeric flags to integers', () => {
    expect(buildCompaniesSearchArgs({
      revenueMin: '1000',
      revenueMax: '5000',
      fundingMin: '500',
      fundingMax: '10000',
      page: '2',
      pageSize: '50',
    })).toEqual({
      revenueMin: 1000,
      revenueMax: 5000,
      fundingAmountMin: 500,
      fundingAmountMax: 10000,
      page: 2,
      pageSize: 50,
    });
  });

  it('passes ticker arrays through unchanged', () => {
    expect(buildCompaniesSearchArgs({ ticker: ['ZI', 'CRM'] })).toEqual({ companyTicker: ['ZI', 'CRM'] });
  });

  it('drops empty strings (falsy in TS so they are skipped)', () => {
    expect(buildCompaniesSearchArgs({ name: '', domain: 'https://acme.com' })).toEqual({
      companyWebsite: 'https://acme.com',
    });
  });
});

describe('buildCompaniesEnrichEntry', () => {
  it('returns null when no identifier is provided', () => {
    expect(buildCompaniesEnrichEntry({})).toBeNull();
  });

  it('maps identifier flags to the MCP enrich entry shape', () => {
    expect(buildCompaniesEnrichEntry({
      id: '12345',
      name: 'Acme',
      domain: 'acme.com',
      website: 'https://acme.com',
      ticker: 'ACME',
      ip: '8.8.8.8',
    })).toEqual({
      companyId: '12345',
      companyName: 'Acme',
      domain: 'acme.com',
      companyWebsite: 'https://acme.com',
      companyTicker: 'ACME',
      ipAddress: '8.8.8.8',
    });
  });

  it('returns a single-key entry when only one identifier is provided', () => {
    expect(buildCompaniesEnrichEntry({ id: '12345' })).toEqual({ companyId: '12345' });
  });
});

describe('normalizeCompaniesEnrichEntries', () => {
  it('passes MCP identifier keys through unchanged', () => {
    const entries = [{ domain: 'stripe.com' }, { companyWebsite: 'https://acme.com' }, { companyId: '12345' }];
    expect(normalizeCompaniesEnrichEntries(entries)).toEqual(entries);
  });

  it('maps flag-style aliases to MCP keys', () => {
    expect(normalizeCompaniesEnrichEntries([
      { website: 'https://stripe.com' },
      { id: '12345', name: 'Acme', ticker: 'ACME', ip: '8.8.8.8' },
    ])).toEqual([
      { companyWebsite: 'https://stripe.com' },
      { companyId: '12345', companyName: 'Acme', companyTicker: 'ACME', ipAddress: '8.8.8.8' },
    ]);
  });

  it('rejects unsupported keys instead of dropping them', () => {
    expect(() => normalizeCompaniesEnrichEntries([{ domain: 'stripe.com' }, { url: 'acme.com' }]))
      .toThrow(/entry 2 has unsupported key\(s\): url/);
  });

  it('rejects empty and non-object entries', () => {
    expect(() => normalizeCompaniesEnrichEntries([{}])).toThrow(/entry 1 has no identifier/);
    expect(() => normalizeCompaniesEnrichEntries(['stripe.com'])).toThrow(/entry 1 must be an object/);
  });
});
