import { describe, it, expect } from 'vitest';
import { buildContactsSearchArgs, buildContactsEnrichEntry, normalizeContactsEnrichEntries } from './contacts.js';

describe('buildContactsSearchArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildContactsSearchArgs({})).toEqual({});
  });

  it('maps contact-specific flags to MCP arg names', () => {
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
      jobTitle: 'VP Engineering',
      managementLevel: 'VP Level Exec',
      department: 'Engineering & Technical',
    });
  });

  it('maps company filters through with website renamed', () => {
    expect(buildContactsSearchArgs({
      companyId: '12345',
      companyName: 'Acme',
      companyDomain: 'https://acme.com',
    })).toEqual({
      companyId: '12345',
      companyName: 'Acme',
      companyWebsite: 'https://acme.com',
    });
  });

  it('coerces accuracy + paging flags to numbers/booleans correctly', () => {
    expect(buildContactsSearchArgs({
      accuracyMin: '80',
      accuracyMax: '99',
      executivesOnly: true,
      page: '3',
      pageSize: '50',
    })).toEqual({
      contactAccuracyScoreMin: '80',
      contactAccuracyScoreMax: '99',
      executivesOnly: true,
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

describe('normalizeContactsEnrichEntries', () => {
  it('passes MCP identifier keys through unchanged', () => {
    const entries = [{ email: 'jane@acme.com' }, { firstName: 'Jane', lastName: 'Doe', companyName: 'Acme' }];
    expect(normalizeContactsEnrichEntries(entries)).toEqual(entries);
  });

  it('maps flag-style aliases to MCP keys', () => {
    expect(normalizeContactsEnrichEntries([{ id: '1260398587' }, { fullName: 'Jane Doe', company: 'Acme' }]))
      .toEqual([{ personId: '1260398587' }, { fullName: 'Jane Doe', companyName: 'Acme' }]);
  });

  it('rejects unsupported keys instead of dropping them', () => {
    expect(() => normalizeContactsEnrichEntries([{ emailAddress: 'jane@acme.com' }]))
      .toThrow(/entry 1 has unsupported key\(s\): emailAddress/);
  });
});
