import { describe, it, expect } from 'vitest';
import { buildSignalsEnrichArgs } from './signals.js';

describe('buildSignalsEnrichArgs', () => {
  it('parses company IDs into an integer zoominfoCompanyIds array', () => {
    expect(buildSignalsEnrichArgs({ companyId: ['344589814', '12345'] })).toEqual({
      zoominfoCompanyIds: [344589814, 12345],
    });
  });

  it('omits signalTypes when --types is not passed', () => {
    const args = buildSignalsEnrichArgs({ companyId: ['344589814'] });
    expect(args).not.toHaveProperty('signalTypes');
  });

  it('passes --types through verbatim as signalTypes', () => {
    expect(buildSignalsEnrichArgs({ companyId: ['344589814'], types: ['INTENT', 'NEWS'] })).toEqual({
      zoominfoCompanyIds: [344589814],
      signalTypes: ['INTENT', 'NEWS'],
    });
  });
});
