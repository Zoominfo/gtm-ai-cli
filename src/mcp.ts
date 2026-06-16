import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getValidCredentials } from './credentials.js';
import { pkg } from './pkg.js';

// TODO(phase-1-discovery): confirm the MCP endpoint URL.
const MCP_URL = new URL('https://mcp.zoominfo.com/mcp');

let cached: Client | null = null;

async function getClient(): Promise<Client> {
  if (cached) return cached;

  const creds = await getValidCredentials();
  if (!creds) {
    console.error('Not logged in. Run: gtm auth login');
    process.exit(1);
  }
  if (creds.expires_at !== null && Date.now() >= creds.expires_at) {
    console.error('Session expired. Run: gtm auth login');
    process.exit(1);
  }

  const transport = new StreamableHTTPClientTransport(MCP_URL, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        'User-Agent': `gtm-ai-cli/${pkg.version}`,
      },
    },
  });

  const client = new Client(
    { name: 'gtm-ai-cli', version: pkg.version },
    { capabilities: {} },
  );
  await client.connect(transport);
  cached = client;
  return client;
}

interface McpToolContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface McpToolResult {
  content?: McpToolContent[];
  isError?: boolean;
  structuredContent?: unknown;
}

// Best-effort parse: handles plain JSON, double-encoded JSON strings, and prose
// preambles followed by JSON (e.g. `lookup` returns "Found 17 items:\n\n{...}").
function tryParseJson(txt: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: JSON.parse(txt) }; } catch { /* fall through */ }
  // Strip a prose preamble separated from JSON by a blank line.
  // We use `\n\n` as the boundary because `[brackets]` show up in prose (e.g. "[industries]")
  // and would mislead a naive first-bracket scan.
  const sep = txt.indexOf('\n\n');
  if (sep >= 0) {
    const tail = txt.slice(sep + 2).trimStart();
    if (tail.startsWith('{') || tail.startsWith('[')) {
      try { return { ok: true, value: JSON.parse(tail) }; } catch { /* fall through */ }
    }
  }
  return { ok: false };
}

// Unwrap a tool result into a plain JSON value for the output formatter.
// Prefers structuredContent, then a single text content block parsed as JSON,
// then falls back to the raw content array.
function unwrap(res: McpToolResult): unknown {
  if (res.structuredContent !== undefined) return res.structuredContent;
  const blocks = res.content ?? [];
  if (blocks.length === 1 && blocks[0]?.type === 'text' && typeof blocks[0].text === 'string') {
    const txt = blocks[0].text;
    const first = tryParseJson(txt);
    if (!first.ok) return txt;
    // Some tools double-encode (JSON string of a JSON value); peel one more layer.
    if (typeof first.value === 'string') {
      const second = tryParseJson(first.value);
      return second.ok ? second.value : first.value;
    }
    return first.value;
  }
  return blocks;
}

// Map MCP error field names → corresponding `gtm lookup --field <name>` for hints.
const LOOKUP_FIELD_FOR: Record<string, string> = {
  topics: 'intent-topics',
  intentTopic: 'intent-topics',
  industry: 'industries',
  industries: 'industries',
  industryCode: 'industries',
  industryCodes: 'industries',
  department: 'departments',
  departments: 'departments',
  metro: 'metro-regions',
  metroRegion: 'metro-regions',
  metroRegions: 'metro-regions',
  managementLevel: 'management-levels',
  managementLevels: 'management-levels',
  scoopType: 'scoop-types',
  scoopTypes: 'scoop-types',
  scoopTopic: 'scoop-topics',
  scoopTopics: 'scoop-topics',
  techProduct: 'tech-products',
  techProductId: 'tech-products',
  techVendor: 'tech-vendors',
  techVendorId: 'tech-vendors',
};

// Strip the layers of wrapping the MCP server adds to error messages and tack
// on a contextual hint when we recognise the pattern. Reduces this:
//   "Failed to call downstream tool: MCP error 400: Search intent failed: Bad Request: Invalid 'topics' requested: [X] (field: topics)"
// to this:
//   "Invalid 'topics' requested: [X] (field: topics)\n  → Run `gtm lookup --field intent-topics` to see valid values."
function friendlyError(raw: string): string {
  const stripped = raw
    .replace(/^Failed to call downstream tool:\s*/i, '')
    .replace(/^MCP error \d+:\s*/i, '')
    .replace(/^[\w\s]+? failed:\s*/i, '')
    .replace(/^Bad Request:\s*/i, '')
    .trim();

  const hints: string[] = [];

  // Invalid lookup value → point at the lookup command.
  const invalidField = stripped.match(/Invalid '?(\w+)'? (?:requested|value)/i)
    ?? stripped.match(/\(field:\s*(\w+)\)/i);
  if (invalidField) {
    const field = invalidField[1];
    const lookup = LOOKUP_FIELD_FOR[field];
    if (lookup) hints.push(`Run \`gtm lookup --field ${lookup}\` to see valid values.`);
  }

  // Auth-shaped errors.
  if (/\b(unauthor[iz]ed|invalid token|token (expired|invalid))/i.test(stripped)) {
    hints.push('Run `gtm auth login` to re-authenticate.');
  }

  // Rate limit.
  if (/rate.?limit|too many requests|429/i.test(stripped)) {
    hints.push('You\'ve hit a rate limit. Wait a moment and retry.');
  }

  const head = `Error: ${stripped || 'unknown error'}`;
  return hints.length ? `${head}\n  → ${hints.join('\n  → ')}` : head;
}

function debugEnabled(): boolean {
  return process.env.GTM_DEBUG === '1';
}

function debugLog(label: string, payload: unknown): void {
  if (!debugEnabled()) return;
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const truncated = body.length > 2000 ? `${body.slice(0, 2000)}… (${body.length} chars total)` : body;
  console.error(`[gtm-debug] ${label}: ${truncated}`);
}

export async function mcpCall<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  debugLog(`call ${name}`, args);
  const client = await getClient();
  const res = await client.callTool({ name, arguments: args }) as McpToolResult;
  debugLog(`response ${name}`, res);

  if (res.isError) {
    const raw = res.content?.map(c => c.text ?? JSON.stringify(c)).join('\n') ?? 'Unknown error';
    console.error(friendlyError(raw));
    process.exit(1);
  }

  return unwrap(res) as T;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, { type?: string; description?: string; items?: { type?: string } }>;
    required?: string[];
  };
}

export async function listMcpTools(): Promise<McpTool[]> {
  const client = await getClient();
  const res = await client.listTools();
  return res.tools as McpTool[];
}

export async function closeClient(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
