import { describe, it, expect } from 'vitest';
import { buildCompaniesSearchArgs, buildCompaniesEnrichEntry, buildCompaniesSimilarArgs } from './companies.js';

describe('buildCompaniesSearchArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildCompaniesSearchArgs({})).toEqual({});
  });

  it('maps simple flags to MCP arg names (kebab to camel)', () => {
    expect(buildCompaniesSearchArgs({
      name: 'Acme',
      domain: 'https://acme.com',
      industry: 'software,software.health',
      metro: 'CA - San Francisco',
    })).toEqual({
      companyName: 'Acme',
      companyWebsite: 'https://acme.com',
      industryList: ['software', 'software.health'],
      metroRegion: 'CA - San Francisco',
    });
  });

  it('coerces numeric flags to integers', () => {
    expect(buildCompaniesSearchArgs({
      employeesMin: '100',
      employeesMax: '500',
      revenueMin: '1000',
      revenueMax: '5000',
      page: '2',
      pageSize: '50',
    })).toEqual({
      employeeRangeMinimum: 100,
      employeeRangeMaximum: 500,
      revenueMin: 1000,
      revenueMax: 5000,
      page: 2,
      pageSize: 50,
    });
  });

  it('maps zip radius alongside zip', () => {
    expect(buildCompaniesSearchArgs({ zip: '02110', zipRadius: '50' })).toEqual({
      zipCode: '02110',
      zipCodeRadiusMiles: '50',
    });
  });

  it('maps ticker and type to their *List variants', () => {
    expect(buildCompaniesSearchArgs({ ticker: ['ZI', 'CRM'], type: 'private,public' })).toEqual({
      companyTickerList: ['ZI', 'CRM'],
      companyTypeList: ['private', 'public'],
    });
  });

  it('maps funding round flags to their typed list params', () => {
    expect(buildCompaniesSearchArgs({ recentFundingRound: 'Series A, Series B' })).toEqual({
      recentFundingRoundTypes: ['Series A', 'Series B'],
    });
    expect(buildCompaniesSearchArgs({ anyFundingRound: 'Angel/Seed' })).toEqual({
      allFundingRoundTypes: ['Angel/Seed'],
    });
  });

  it('rejects recent and any funding round filters together', () => {
    expect(() => buildCompaniesSearchArgs({ recentFundingRound: 'Seed', anyFundingRound: 'IPO' })).toThrow(/not both/);
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

describe('buildCompaniesSimilarArgs', () => {
  it('coerces --id to an integer zoominfoCompanyId', () => {
    expect(buildCompaniesSimilarArgs({ id: '344589814' })).toEqual({ zoominfoCompanyId: 344589814 });
  });

  it('falls back to companyName when no id is given', () => {
    expect(buildCompaniesSimilarArgs({ name: 'Stripe' })).toEqual({ companyName: 'Stripe' });
  });

  it('sets same-attribute filters only when passed, and coerces page size', () => {
    expect(buildCompaniesSimilarArgs({
      id: '1',
      sameIndustry: true,
      sameCountry: true,
      sameRevenueRange: true,
      sameEmployeeRange: true,
      pageSize: '10',
    })).toEqual({
      zoominfoCompanyId: 1,
      sameIndustry: true,
      sameCountry: true,
      sameRevenueRange: true,
      sameEmployeeRange: true,
      pageSize: 10,
    });
  });

  it('requires --id or --name', () => {
    expect(() => buildCompaniesSimilarArgs({})).toThrow(/--id or --name/);
  });

  it('rejects non-integer ids', () => {
    expect(() => buildCompaniesSimilarArgs({ id: 'stripe.com' })).toThrow(/integer/);
  });
});
