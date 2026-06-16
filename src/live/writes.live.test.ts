import { it, expect } from 'vitest';
import { writesDescribe, runJson } from './helpers.js';

// Write tier — mutating tools that consume credits and/or change real data. Skipped unless
// GTM_LIVE_WRITES=1 (and you're logged in). Run only against a throwaway/dedicated tenant:
//   GTM_LIVE_WRITES=1 GTM_CLI_CMD="node dist/js/index.js" npm run test:live

writesDescribe('ZoomInfo CLI — write-tier live coverage (opt-in)', () => {
  it('feedback submit', () => {
    const { status } = runJson([
      'feedback', 'submit',
      '--message', 'Automated live-test submission from gtm-ai-cli test suite.',
      '--category', 'OTHER',
    ]);
    expect(status).toBe(0);
  });

  it('gtm-context update', () => {
    const { status } = runJson([
      'gtm-context', 'update',
      '--query', 'Note our primary ICP is mid-market B2B SaaS companies in North America.',
    ], 90_000);
    expect(status).toBe(0);
  });
});
