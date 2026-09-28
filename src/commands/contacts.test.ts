import { describe, it, expect } from 'vitest';
import { buildContactsSearchArgs, buildContactsEnrichEntry } from './contacts.js';

describe('buildContactsSearchArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildContactsSearchArgs({})).toEqual({});
  });

  it('maps contact-specific flags to the active *List MCP arg names', () => {
    expect(buildContactsSearchArgs({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      jobTitle: 'VP Engineering',
      managementLevel: 'VP Level Exec,C Level Exec',
      department: 'Engineering & Technical',
    })).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      emailAddress: 'jane@acme.com',
      jobTitleList: ['VP Engineering'],
      managementLevelList: ['VP Level Exec', 'C Level Exec'],
      departmentList: ['Engineering & Technical'],
    });
  });

  it('splits OR-separated job titles into jobTitleList entries', () => {
    expect(buildContactsSearchArgs({ jobTitle: 'CFO OR VP Finance OR Treasurer' })).toEqual({
      jobTitleList: ['CFO', 'VP Finance', 'Treasurer'],
    });
  });

  it('maps company filters through with website renamed and IDs coerced', () => {
    expect(buildContactsSearchArgs({
      companyId: '12345,67890',
      companyName: 'Acme',
      companyDomain: 'https://acme.com',
      industry: 'software,software.health',
    })).toEqual({
      companyIdList: [12345, 67890],
      companyName: 'Acme',
      companyWebsite: 'https://acme.com',
      industryList: ['software', 'software.health'],
    });
  });

  it('maps geographic flags including location scope', () => {
    expect(buildContactsSearchArgs({
      metro: 'MA - Boston',
      zip: '02110',
      zipRadius: '25',
      locationType: 'Person',
    })).toEqual({
      metroRegion: 'MA - Boston',
      zipCode: '02110',
      zipCodeRadiusMiles: '25',
      locationSearchType: 'Person',
    });
  });

  it('coerces accuracy, range, and paging flags to numbers', () => {
    expect(buildContactsSearchArgs({
      accuracyMin: '80',
      accuracyMax: '99',
      employeesMin: '100',
      employeesMax: '500',
      revenueMin: '1000',
      required: 'email,phone',
      page: '3',
      pageSize: '50',
    })).toEqual({
      contactAccuracyScoreMinimum: 80,
      contactAccuracyScoreMaximum: 99,
      employeeRangeMinimum: 100,
      employeeRangeMaximum: 500,
      revenueMin: 1000,
      requiredFieldsList: ['email', 'phone'],
      page: 3,
      pageSize: 50,
    });
  });
});

describe('buildContactsEnrichEntry', () => {
  it('returns null when no identifier is provided', () => {
    expect(buildContactsEnrichEntry({})).toBeNull();
  });

  it('maps id-based identifiers correctly', () => {
    expect(buildContactsEnrichEntry({ id: 'p-123' })).toEqual({ personId: 'p-123' });
    expect(buildContactsEnrichEntry({ email: 'jane@acme.com' })).toEqual({ email: 'jane@acme.com' });
  });

  it('maps the name + company combination', () => {
    expect(buildContactsEnrichEntry({
      firstName: 'Jane',
      lastName: 'Doe',
      company: 'Acme',
    })).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: 'Acme',
    });
  });

  it('renames --company-id to companyId in the entry', () => {
    expect(buildContactsEnrichEntry({
      fullName: 'Jane Doe',
      companyId: '12345',
    })).toEqual({
      fullName: 'Jane Doe',
      companyId: '12345',
    });
  });
});
