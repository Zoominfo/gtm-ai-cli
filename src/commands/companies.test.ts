import { describe, it, expect } from 'vitest';
import { buildCompaniesSearchArgs, buildCompaniesEnrichEntry } from './companies.js';

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
      fundingMin: '500',
      fundingMax: '10000',
      page: '2',
      pageSize: '50',
    })).toEqual({
      employeeRangeMinimum: 100,
      employeeRangeMaximum: 500,
      revenueMin: 1000,
      revenueMax: 5000,
      fundingAmountMin: 500,
      fundingAmountMax: 10000,
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
