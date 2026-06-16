# Live MCP tests

These tests open a **real MCP session** against ZoomInfo's GTM AI MCP server using the built
CLI's auth tokens. They catch bugs the mocked unit suite can't — most importantly, tool
argument schemas that the MCP rejects with a validation error.

Implemented suites:
- `helpers.ts` — spawns the CLI as a subprocess, parses JSON output, gates on login state.
- `read-only.live.test.ts` — one call per non-mutating command (companies/contacts
  search·enrich·similar·recommended, intent search·enrich, scoops search·enrich, news
  enrich, lookup, gtm-context get, research account·contact, raw list-tools·call, plus a
  `--select` projection check). IDs are chained from preceding searches; assertions tolerate
  empty result sets and varying response shapes.
- `writes.live.test.ts` — mutating tools (`feedback submit`, `gtm-context update`), gated.

They are **local-only** and never run in CI. The regular `npm test` (unit/mocked) excludes
this directory.

## Running

```bash
gtm auth login        # one-time; the suite reuses these OAuth credentials
npm run test:live
```

If you're not logged in (no `~/.config/gtm-ai/credentials`), the suite **skips** rather than
fails. Set `GTM_SKIP_LIVE=1` to force-skip.

The CLI is invoked as `bun run src/index.ts` by default. Override with
`GTM_CLI_CMD` (e.g. `GTM_CLI_CMD="node dist/js/index.js"`).

## Tiers (opt-in — writes/side effects are off by default)

| Tier | Enable with | Covers |
|---|---|---|
| **Read-only** (default) | nothing | searches, enrich, lookup, list/usage — zero side effects |
| **Writes** | `GTM_LIVE_WRITES=1` | mutating tools like `update_gtm_context` |

> ⚠️ Write tier mutates real data and **consumes credits**. Run only against a dedicated
> throwaway tenant.
