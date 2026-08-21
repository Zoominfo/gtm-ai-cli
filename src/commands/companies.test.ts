import { describe, it, expect } from 'vitest';
import { buildCompaniesSearchArgs, buildCompaniesEnrichEntry } from './companies.js';

describe('buildCompaniesSearchArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildCompaniesSearchArgs({})).toEqual({});
  });

  it('maps simple flags to MCP arg names, splitting comma lists into arrays', () => {
    expect(buildCompaniesSearchArgs({
      name: 'Acme',
      domain: 'https://acme.com',
      industry: 'Computer Software, Information Technology Services',
      metro: 'CA - San Francisco',
    })).toEqual({
      companyName: 'Acme',
      companyWebsite: 'https://acme.com',
      industryList: ['Computer Software', 'Information Technology Services'],
      metroRegion: 'CA - San Francisco',
    });
  });

  it('coerces numeric range flags to integers', () => {
    expect(buildCompaniesSearchArgs({
      revenueMin: '1000',
      revenueMax: '5000',
      employeesMin: '100',
      employeesMax: '500',
      page: '2',
      pageSize: '50',
    })).toEqual({
      revenueMin: 1000,
      revenueMax: 5000,
      employeeRangeMin: 100,
      employeeRangeMax: 500,
      page: 2,
      pageSize: 50,
    });
  });

  it('passes ticker arrays through renamed to companyTickerList', () => {
    expect(buildCompaniesSearchArgs({ ticker: ['ZI', 'CRM'] })).toEqual({ companyTickerList: ['ZI', 'CRM'] });
  });

  it('parses --ids into an integer companyIdList', () => {
    expect(buildCompaniesSearchArgs({ ids: ['344589814', '12345'] })).toEqual({
      companyIdList: [344589814, 12345],
    });
  });

  it('splits comma-separated type/tech flags into arrays', () => {
    expect(buildCompaniesSearchArgs({ type: 'public,private', tech: 'abc123,def456' })).toEqual({
      companyTypeList: ['public', 'private'],
      techAttributeTagList: ['abc123', 'def456'],
    });
  });

  it('passes funding round type arrays through renamed', () => {
    expect(buildCompaniesSearchArgs({
      recentFundingTypes: ['Series A'],
      allFundingTypes: ['Series A', 'Series B'],
    })).toEqual({
      recentFundingRoundTypes: ['Series A'],
      allFundingRoundTypes: ['Series A', 'Series B'],
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
