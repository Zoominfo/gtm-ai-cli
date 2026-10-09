import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const connect = vi.fn();
const callTool = vi.fn();
const close = vi.fn();
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class { connect = connect; callTool = callTool; close = close; },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  StreamableHTTPClientTransport: class {},
}));

const creds = { type: 'oauth', access_token: 'a', refresh_token: 'r', client_id: 'c', expires_at: null };
const getValidCredentials = vi.fn();
const loadCredentials = vi.fn();
const refreshCredentials = vi.fn();
vi.mock('./credentials.js', () => ({ getValidCredentials, loadCredentials, refreshCredentials }));

const unauthorized = () => new StreamableHTTPError(401, 'Error POSTing to endpoint: invalid token');
const ok = { content: [{ type: 'text', text: '{"ok":true}' }] };

// mcp.ts caches its client per process, so import it fresh per test.
async function load() {
  vi.resetModules();
  return import('./mcp.js');
}

beforeEach(() => {
  for (const fn of [connect, callTool, close, getValidCredentials, loadCredentials, refreshCredentials]) fn.mockReset();
  getValidCredentials.mockResolvedValue(creds);
  loadCredentials.mockReturnValue(creds);
  refreshCredentials.mockResolvedValue({ ...creds, access_token: 'fresh' });
});

describe('mcpCall session handling', () => {
  it('refreshes once and retries when the server rejects the token', async () => {
    connect.mockRejectedValueOnce(unauthorized());
    callTool.mockResolvedValue(ok);
    const { mcpCall } = await load();
    await expect(mcpCall('search_companies', {})).resolves.toEqual({ ok: true });
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
  });

  it('asks the user to log in when the refreshed token is also rejected', async () => {
    connect.mockRejectedValue(unauthorized());
    const { mcpCall } = await load();
    await expect(mcpCall('search_companies', {})).rejects.toThrow(/no longer valid\. Run: gtm auth login/);
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on other errors', async () => {
    connect.mockRejectedValue(new StreamableHTTPError(502, 'Bad gateway'));
    const { mcpCall } = await load();
    await expect(mcpCall('search_companies', {})).rejects.toThrow(/Bad gateway/);
    expect(refreshCredentials).not.toHaveBeenCalled();
  });

  it('allows tool calls more than the SDK default 60s', async () => {
    callTool.mockResolvedValue(ok);
    const { mcpCall } = await load();
    await mcpCall('account_research', {});
    expect(callTool.mock.calls[0][2].timeout).toBeGreaterThan(60_000);
  });
});
