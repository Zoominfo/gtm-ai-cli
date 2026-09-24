import { describe, it, expect } from 'vitest';
import { buildEngagementsListArgs, buildEngagementsAskArgs } from './engagements.js';

describe('buildEngagementsListArgs', () => {
  it('omits all keys when no flags are passed', () => {
    expect(buildEngagementsListArgs({})).toEqual({});
  });

  it('maps flags to MCP arg names with IDs and limit coerced', () => {
    expect(buildEngagementsListArgs({
      companyId: '344589814',
      start: '2026-06-01T00:00:00Z',
      end: '2026-06-30T00:00:00Z',
      type: 'meetings',
      limit: '25',
      sort: '-chronological',
    })).toEqual({
      zoominfoCompanyId: 344589814,
      engagementDateStart: '2026-06-01T00:00:00Z',
      engagementDateEnd: '2026-06-30T00:00:00Z',
      engagementType: 'MEETINGS',
      engagementLimit: 25,
      sort: '-chronological',
    });
  });

  it('rejects a non-integer company ID', () => {
    expect(() => buildEngagementsListArgs({ companyId: 'acme' })).toThrow(/integer/);
  });
});

describe('buildEngagementsAskArgs', () => {
  it('requires exactly one scope', () => {
    expect(() => buildEngagementsAskArgs({ query: 'q' })).toThrow(/exactly one/);
    expect(() => buildEngagementsAskArgs({ query: 'q', companyId: '1', contactId: '2' })).toThrow(/exactly one/);
  });

  it('passes engagement IDs verbatim (angle brackets and all)', () => {
    expect(buildEngagementsAskArgs({
      query: 'What were the objections?',
      engagementId: '<abc123@mail.example.com>',
    })).toEqual({
      query: 'What were the objections?',
      engagementId: '<abc123@mail.example.com>',
    });
  });

  it('coerces contact scope to an integer and forwards includeContent', () => {
    expect(buildEngagementsAskArgs({
      query: 'What do they care about?',
      contactId: '1260398587',
      includeContent: true,
    })).toEqual({
      query: 'What do they care about?',
      zoominfoContactId: 1260398587,
      includeContent: true,
    });
  });
});
