import { describe, it, expect } from 'vitest';
import { buildSignalsArgs } from './signals.js';

describe('buildSignalsArgs', () => {
  it('coerces company IDs to integers', () => {
    expect(buildSignalsArgs({ companyIds: ['344589814', '123456'] })).toEqual({
      zoominfoCompanyIds: [344589814, 123456],
    });
  });

  it('uppercases and passes signal types', () => {
    expect(buildSignalsArgs({ companyIds: ['1'], types: ['news', 'Scoop'] })).toEqual({
      zoominfoCompanyIds: [1],
      signalTypes: ['NEWS', 'SCOOP'],
    });
  });

  it('omits signalTypes when --types is not passed', () => {
    expect(buildSignalsArgs({ companyIds: ['1'] })).not.toHaveProperty('signalTypes');
  });

  it('rejects more than 10 company IDs', () => {
    const ids = Array.from({ length: 11 }, (_, i) => String(i + 1));
    expect(() => buildSignalsArgs({ companyIds: ids })).toThrow(/1-10/);
  });

  it('rejects non-integer company IDs', () => {
    expect(() => buildSignalsArgs({ companyIds: ['acme.com'] })).toThrow(/integer/);
  });

  it('rejects unknown signal types', () => {
    expect(() => buildSignalsArgs({ companyIds: ['1'], types: ['PRESS'] })).toThrow(/INTENT, NEWS, SCOOP/);
  });
});
