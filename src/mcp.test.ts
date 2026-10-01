import { describe, it, expect } from 'vitest';
import { tryParseJson } from './mcp.js';

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
