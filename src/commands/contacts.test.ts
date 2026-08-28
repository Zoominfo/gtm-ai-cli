import { describe, it, expect } from 'vitest';
import { buildContactsSearchArgs, buildContactsEnrichEntry } from './contacts.js';

describe('buildContactsSearchArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildContactsSearchArgs({})).toEqual({});
  });

  it('maps contact-specific flags to MCP arg names, splitting lists into arrays', () => {
    expect(buildContactsSearchArgs({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      jobTitle: 'VP Engineering',
      managementLevel: 'VP Level Exec',
      department: 'Engineering & Technical',
    })).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      emailAddress: 'jane@acme.com',
      jobTitleList: ['VP Engineering'],
      managementLevelList: ['VP Level Exec'],
      departmentList: ['Engineering & Technical'],
    });
  });

  it('splits " OR "-joined job titles as well as comma-joined ones', () => {
    expect(buildContactsSearchArgs({ jobTitle: 'CFO OR VP Finance OR Treasurer' })).toEqual({
      jobTitleList: ['CFO', 'VP Finance', 'Treasurer'],
    });
  });

  it('maps company filters through, converting company-id to an integer array', () => {
    expect(buildContactsSearchArgs({
      companyId: '12345,67890',
      companyName: 'Acme',
      companyDomain: 'https://acme.com',
    })).toEqual({
      companyIdList: [12345, 67890],
      companyName: 'Acme',
      companyWebsite: 'https://acme.com',
    });
  });

  it('coerces accuracy + range + paging flags to integers', () => {
    expect(buildContactsSearchArgs({
      accuracyMin: '80',
      accuracyMax: '99',
      employeesMin: '100',
      employeesMax: '500',
      revenueMin: '1000',
      revenueMax: '5000',
      page: '3',
      pageSize: '50',
    })).toEqual({
      contactAccuracyScoreMin: 80,
      contactAccuracyScoreMax: 99,
      employeeRangeMin: 100,
      employeeRangeMax: 500,
      revenueMin: 1000,
      revenueMax: 5000,
      page: 3,
      pageSize: 50,
    });
  });

  it('splits the required-fields flag into an array', () => {
    expect(buildContactsSearchArgs({ required: 'email,phone' })).toEqual({
      requiredFieldsList: ['email', 'phone'],
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
