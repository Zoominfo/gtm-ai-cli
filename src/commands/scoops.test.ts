import { describe, it, expect } from 'vitest';
import { buildScoopsSearchArgs } from './scoops.js';

describe('buildScoopsSearchArgs', () => {
  it('accepts comma-separated and space-separated list values alike', () => {
    const args = buildScoopsSearchArgs({
      scoopTypes: ['Funding,New Hire'],
      employees: ['100to249', '250to499,500to999'],
      metro: ['usa.newyork.newyork, usa.california.losangeles'],
    });
    expect(args.scoopTypes).toEqual(['Funding', 'New Hire']);
    expect(args.employeeCount).toEqual(['100to249', '250to499', '500to999']);
    expect(args.metroRegions).toEqual(['usa.newyork.newyork', 'usa.california.losangeles']);
  });

  it('passes job titles verbatim, since a title can contain a comma', () => {
    expect(buildScoopsSearchArgs({ jobTitle: ['VP, Sales'] }).jobTitle).toEqual(['VP, Sales']);
  });
});
