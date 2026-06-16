# Agent Instructions — gtm-ai-cli

This is the ZoomInfo GTM AI CLI — a Bun-compiled TypeScript CLI that wraps ZoomInfo's
GTM AI MCP server via OAuth 2.0 + PKCE.

Layout mirrors `apolloio/apollo-io-cli`:

- `src/index.ts` — Commander root
- `src/commands/*.ts` — one file per resource group (`registerX(program)` pattern)
- `src/mcp.ts` — MCP client wrapper (`mcpCall(toolName, args)`)
- `src/oauth.ts` — PKCE login / refresh / revoke
- `src/credentials.ts` — token persistence at `~/.config/gtm-ai/`
- `src/output.ts` — json / jsonl / csv / yaml / table formatters
- `src/live/` — live integration suite (real MCP session, gated on env)

Command groups: `auth`, `companies`, `contacts`, `intent`, `scoops`, `news`, `lookup`,
`research` (account/contact — agentic, natural-language), `gtm-context`, `feedback`, and
`raw`. Most data commands also accept `--select <dotted,paths>` for client-side output
projection (distinct from enrich's `--fields`, which selects server-side `requiredFields`).

Commands map flag bundles to MCP tool arguments via pure builder functions, exported so
the Vitest unit suite can test them without a network. Hybrid approach: curated commands
for the hot path, plus `gtm raw call <tool> --args '<json>'` as the universal escape hatch.
