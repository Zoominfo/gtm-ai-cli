import { defineConfig } from 'vitest/config';

// Live suite: opens a real MCP session against ZoomInfo's GTM AI MCP server via the built CLI.
// Local-only (reuses `gtm auth login` credentials), never run in CI.
// Runs serially with long timeouts to respect rate limits.
export default defineConfig({
  test: {
    include: ['src/live/**/*.live.test.ts'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
