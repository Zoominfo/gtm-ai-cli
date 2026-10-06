import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const refreshAccessToken = vi.fn();
vi.mock('./oauth.js', () => ({ refreshAccessToken }));

const HOUR = 60 * 60 * 1000;
let home: string;
let configDir: string;

// credentials.ts resolves its paths from $HOME at import time, so import it fresh per test.
async function load() {
  vi.resetModules();
  return import('./credentials.js');
}

function writeCreds(overrides: Record<string, unknown> = {}): void {
  writeFileSync(join(configDir, 'credentials'), JSON.stringify({
    type: 'oauth',
    access_token: 'old-access',
    refresh_token: 'old-refresh',
    client_id: 'client',
    expires_at: Date.now() - 1000,
    ...overrides,
  }));
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'gtm-creds-'));
  configDir = join(home, '.config', 'gtm-ai');
  mkdirSync(configDir, { recursive: true });
  vi.stubEnv('HOME', home);
  refreshAccessToken.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

describe('loadCredentials', () => {
  it('treats a corrupt credentials file as logged out', async () => {
    writeFileSync(join(configDir, 'credentials'), '{"type":"oauth","access_tok');
    const { loadCredentials } = await load();
    expect(loadCredentials()).toBeNull();
  });
});

describe('getValidCredentials', () => {
  it('returns unexpired credentials without refreshing', async () => {
    writeCreds({ expires_at: Date.now() + HOUR });
    const { getValidCredentials } = await load();
    expect((await getValidCredentials())?.access_token).toBe('old-access');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes and saves expired credentials, leaving no temp files behind', async () => {
    writeCreds();
    refreshAccessToken.mockResolvedValue({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
    const { getValidCredentials, loadCredentials } = await load();
    expect((await getValidCredentials())?.access_token).toBe('new-access');
    expect(loadCredentials()?.refresh_token).toBe('new-refresh');
    expect(readdirSync(configDir).filter(f => f.endsWith('.tmp'))).toEqual([]);
  });

  it('uses credentials another process refreshed while this refresh failed', async () => {
    writeCreds();
    refreshAccessToken.mockImplementation(async () => {
      writeCreds({ access_token: 'other-access', refresh_token: 'other-refresh', expires_at: Date.now() + HOUR });
      throw new Error('token refresh failed: invalid_grant');
    });
    const { getValidCredentials } = await load();
    expect((await getValidCredentials())?.access_token).toBe('other-access');
  });

  it('reports why the refresh failed', async () => {
    writeCreds();
    refreshAccessToken.mockRejectedValue(new Error('fetch failed'));
    const { getValidCredentials } = await load();
    await expect(getValidCredentials()).rejects.toThrow(/Could not refresh your session \(fetch failed\)\. Run: gtm auth login/);
  });
});

describe('withSession', () => {
  beforeEach(() => {
    writeCreds({ expires_at: Date.now() + HOUR });
    refreshAccessToken.mockResolvedValue({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
  });

  it('runs the request with the saved token', async () => {
    const { withSession } = await load();
    await expect(withSession(async creds => creds.access_token)).resolves.toBe('old-access');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes once and retries when the token is rejected', async () => {
    const { withSession, SessionRejected } = await load();
    const request = vi.fn(async (creds: { access_token: string }) => {
      if (creds.access_token === 'old-access') throw new SessionRejected();
      return creds.access_token;
    });
    await expect(withSession(request)).resolves.toBe('new-access');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('asks the user to log in when the refreshed token is also rejected', async () => {
    const { withSession, SessionRejected } = await load();
    await expect(withSession(async () => { throw new SessionRejected(); }))
      .rejects.toThrow('Your session is no longer valid. Run: gtm auth login');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('passes other errors through without refreshing', async () => {
    const { withSession } = await load();
    await expect(withSession(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('asks the user to log in when there is no saved session', async () => {
    rmSync(join(configDir, 'credentials'));
    const { withSession } = await load();
    await expect(withSession(async () => 'unreachable')).rejects.toThrow('Not logged in. Run: gtm auth login');
  });
});
