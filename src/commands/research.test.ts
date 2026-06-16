import { describe, it, expect } from 'vitest';
import { buildAccountResearchArgs, buildContactResearchArgs } from './research.js';

describe('buildAccountResearchArgs', () => {
  it('maps query and coerces the company ID to an integer', () => {
    expect(buildAccountResearchArgs({ companyId: '344589814', query: 'prep for renewal' })).toEqual({
      query: 'prep for renewal',
      zoominfoCompanyId: 344589814,
    });
  });

  it('throws on a non-numeric company ID', () => {
    expect(() => buildAccountResearchArgs({ companyId: 'abc', query: 'x' })).toThrow(/--company-id/);
  });

  it('throws on a zero or negative company ID', () => {
    expect(() => buildAccountResearchArgs({ companyId: '0', query: 'x' })).toThrow(/--company-id/);
  });
});

describe('buildContactResearchArgs', () => {
  it('maps query and coerces the contact ID to an integer', () => {
    expect(buildContactResearchArgs({ contactId: '123456789', query: 'who is this' })).toEqual({
      query: 'who is this',
      zoominfoContactId: 123456789,
    });
  });

  it('throws on a non-numeric contact ID', () => {
    expect(() => buildContactResearchArgs({ contactId: '12.5', query: 'x' })).toThrow(/--contact-id/);
  });
});
