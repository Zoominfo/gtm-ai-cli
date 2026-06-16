import { describe, it, expect } from 'vitest';
import { projectFields, normalizeRows, toTable } from './output.js';

describe('projectFields', () => {
  it('projects dotted paths from an array of records', () => {
    const data = [
      { id: 1, name: 'Acme', company: { id: 10, sector: 'tech' } },
      { id: 2, name: 'Globex', company: { id: 20, sector: 'finance' } },
    ];
    expect(projectFields(data, ['id', 'company.id'])).toEqual([
      { id: 1, 'company.id': 10 },
      { id: 2, 'company.id': 20 },
    ]);
  });

  it('unwraps a response envelope and projects over the record array', () => {
    const data = { maxResults: 2, data: [{ id: 1, name: 'Acme' }, { id: 2, name: 'Globex' }] };
    expect(projectFields(data, ['name'])).toEqual([{ name: 'Acme' }, { name: 'Globex' }]);
  });

  it('projects a single object without wrapping it in an array', () => {
    const data = { id: 1, name: 'Acme', extra: 'x' };
    expect(projectFields(data, ['id', 'name'])).toEqual({ id: 1, name: 'Acme' });
  });

  it('yields undefined for missing paths', () => {
    expect(projectFields({ id: 1 }, ['id', 'missing.deep'])).toEqual({ id: 1, 'missing.deep': undefined });
  });
});

describe('normalizeRows', () => {
  it('unwraps a single-key envelope holding an array of objects', () => {
    expect(normalizeRows({ industries: [{ id: 'a' }, { id: 'b' }] })).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('hoists JSON:API attributes to top-level columns', () => {
    const rows = [{ id: '1', type: 'industry', attributes: { name: 'Software' } }];
    expect(normalizeRows(rows)).toEqual([{ name: 'Software', id: '1', type: 'industry' }]);
  });
});

describe('toTable', () => {
  const widthOf = (table: string): number => Math.max(...table.split('\n').map(l => l.length));

  it('reports when there are no rows', () => {
    expect(toTable([], 80)).toBe('(no results)');
  });

  it('renders a normal grid when content fits the terminal', () => {
    const out = toTable([{ name: 'Acme', score: 92 }], 80);
    expect(out).toContain('| name | score |');
    expect(out).toContain('| Acme | 92    |');
    expect(widthOf(out)).toBeLessThanOrEqual(80);
  });

  it('shrinks wide columns to fit the terminal and ellipsises them', () => {
    const long = 'x'.repeat(200);
    const out = toTable([{ id: 1, note: long }], 40);
    expect(widthOf(out)).toBeLessThanOrEqual(40);
    expect(out).toContain('…');
    // the narrow `id` column is preserved intact
    expect(out).toMatch(/\|\s+1\s+\|/);
  });

  it('falls back to a vertical record view when columns cannot fit', () => {
    const row = { aaaa: 1, bbbb: 2, cccc: 3, dddd: 4, eeee: 5, ffff: 6 };
    const out = toTable([row], 24);
    expect(out).toContain('─── 1 ');
    expect(out).toContain('aaaa');
    expect(out).not.toContain('+--'); // no grid border
    expect(widthOf(out)).toBeLessThanOrEqual(24);
  });

  it('separates multiple records in the vertical view', () => {
    const rows = [
      { aaaa: 1, bbbb: 2, cccc: 3, dddd: 4 },
      { aaaa: 5, bbbb: 6, cccc: 7, dddd: 8 },
    ];
    const out = toTable(rows, 16);
    expect(out).toContain('─── 1 ');
    expect(out).toContain('─── 2 ');
  });

  it('preserves the legacy fixed-width grid when piped (no terminal width)', () => {
    const out = toTable([{ name: 'Acme', score: 92 }], undefined);
    expect(out).toBe(
      '+------+-------+\n' +
      '| name | score |\n' +
      '+------+-------+\n' +
      '| Acme | 92    |\n' +
      '+------+-------+',
    );
  });
});
