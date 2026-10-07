// `--debug` / GTM_DEBUG=1: log MCP and REST traffic to stderr, truncated to keep output readable.
export function debugLog(label: string, payload: unknown): void {
  if (process.env.GTM_DEBUG !== '1') return;
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const truncated = body.length > 2000 ? `${body.slice(0, 2000)}… (${body.length} chars total)` : body;
  console.error(`[gtm-debug] ${label}: ${truncated}`);
}
