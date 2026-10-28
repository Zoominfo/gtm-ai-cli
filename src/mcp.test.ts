import { describe, it, expect } from 'vitest';
import { filterWarnings, tryParseJson } from './mcp.js';

describe('tryParseJson', () => {
  it('parses plain JSON', () => {
    expect(tryParseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('strips a prose preamble ending in a single newline', () => {
    const txt = 'Lookup successful for 1 field [industries] - found 2 total items:\n{"industries":[]}';
    expect(tryParseJson(txt)).toEqual({ ok: true, value: { industries: [] } });
  });

  it('strips a prose preamble separated by a blank line', () => {
    expect(tryParseJson('Found 1 item:\n\n[{"id":1}]')).toEqual({ ok: true, value: [{ id: 1 }] });
  });

  it('rejects plain prose, including [bracketed] words', () => {
    expect(tryParseJson('No results for [industries].')).toEqual({ ok: false });
  });
});

describe('filterWarnings', () => {
  const dropped = 'None of the provided values for "industryList" could be matched ("IT Services"), so this filter was omitted from the search.';

  it('reports a dropped filter with a pointer to lookup', () => {
    const data = { data: [], meta: { fieldResolution: { industryList: { warning: dropped } } } };
    expect(filterWarnings(data)).toEqual([
      `Warning: ${dropped}\n  → Run \`gtm lookup --field industries\` to see valid values.`,
    ]);
  });

  it("puts the server's hint before the lookup pointer", () => {
    const data = { meta: { fieldResolution: { employeeCount: { warning: 'Omitted.', hint: 'Valid values are: "1to4".' } } } };
    expect(filterWarnings(data)).toEqual([
      'Warning: Omitted.\n  → Valid values are: "1to4".\n  → Run `gtm lookup --field employee-count` to see valid values.',
    ]);
  });

  it('reports only the warning for a field with no lookup', () => {
    const data = { meta: { fieldResolution: { someNewFilter: { warning: 'Omitted.' } } } };
    expect(filterWarnings(data)).toEqual(['Warning: Omitted.']);
  });

  it('ignores filters that were applied', () => {
    const data = { meta: { fieldResolution: { country: { summary: 'The "country" filter was applied.' } } } };
    expect(filterWarnings(data)).toEqual([]);
  });

  it('ignores responses without fieldResolution', () => {
    for (const data of [null, 'plain text', [{ id: 1 }], { data: [] }, { meta: { fieldResolution: null } }]) {
      expect(filterWarnings(data)).toEqual([]);
    }
  });
});
