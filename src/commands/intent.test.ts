import { describe, it, expect } from 'vitest';
import { buildIntentSearchArgs } from './intent.js';

describe('buildIntentSearchArgs', () => {
  it('requires topics and passes them through as an array', () => {
    expect(buildIntentSearchArgs({ topics: ['Cloud Applications', 'Java'] })).toEqual({
      topics: ['Cloud Applications', 'Java'],
    });
  });

  it('coerces signal-score flags to integers and passes audience-strength letters as-is', () => {
    expect(buildIntentSearchArgs({
      topics: ['Mobile Apps'],
      signalScoreMin: '70',
      signalScoreMax: '95',
      audienceStrengthMin: 'D',
      audienceStrengthMax: 'B',
    })).toEqual({
      topics: ['Mobile Apps'],
      signalScoreMin: 70,
      signalScoreMax: 95,
      audienceStrengthMin: 'D',
      audienceStrengthMax: 'B',
    });
  });

  it('renames signal date / industry / metro flags to MCP arg names', () => {
    expect(buildIntentSearchArgs({
      topics: ['Cloud Applications'],
      signalStart: '2026-01-01',
      signalEnd: '2026-01-31',
      industry: 'Computer Software',
      metro: 'CA - San Francisco',
    })).toEqual({
      topics: ['Cloud Applications'],
      signalStartDate: '2026-01-01',
      signalEndDate: '2026-01-31',
      industryCodes: 'Computer Software',
      metroRegion: 'CA - San Francisco',
    });
  });

  it('sets findRecommendedContacts only when the flag is truthy', () => {
    const noFlag = buildIntentSearchArgs({ topics: ['Java'] });
    expect(noFlag).not.toHaveProperty('findRecommendedContacts');

    const withFlag = buildIntentSearchArgs({ topics: ['Java'], recommendedContacts: true });
    expect(withFlag.findRecommendedContacts).toBe(true);
  });
});
