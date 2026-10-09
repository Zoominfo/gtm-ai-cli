import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { refreshAccessToken } from './oauth.js';
import type { Credentials, OAuthTokenResponse } from './types.js';

const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;
const GTM_CONFIG_DIR = join(homedir(), '.config', 'gtm-ai');
const CREDENTIALS_PATH = join(GTM_CONFIG_DIR, 'credentials');
const CLIENT_ID_PATH = join(GTM_CONFIG_DIR, 'client_id');

interface SaveOAuthArgs {
  clientId: string;
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export function loadSavedClientId(): string | null {
  if (!existsSync(CLIENT_ID_PATH)) return null;
  const id = readFileSync(CLIENT_ID_PATH, 'utf8').trim();
  return id || null;
}

// Write via a temp file and rename, so a concurrent reader never sees a half-written file.
function writeFileAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, path);
}

function saveClientId(clientId: string): void {
  mkdirSync(GTM_CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileAtomic(CLIENT_ID_PATH, clientId);
}

export function saveOAuthCredentials({ clientId, access_token, refresh_token, expires_in }: SaveOAuthArgs): void {
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true, mode: 0o700 });
  saveClientId(clientId);
  const payload: Credentials = {
    type: 'oauth',
    access_token,
    refresh_token,
    client_id: clientId,
    expires_at: expires_in ? Date.now() + expires_in * 1000 : null,
  };
  writeFileAtomic(CREDENTIALS_PATH, JSON.stringify(payload));
}

function isCredentials(value: unknown): value is Credentials {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === 'oauth' &&
    typeof v.access_token === 'string' &&
    typeof v.refresh_token === 'string' &&
    typeof v.client_id === 'string' &&
    (v.expires_at === null || typeof v.expires_at === 'number')
  );
}

// An unreadable or corrupt credentials file is treated as logged out.
export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isExpired(creds: Credentials): boolean {
  return creds.expires_at !== null && Date.now() >= creds.expires_at - TOKEN_EXPIRY_BUFFER_MS;
}

export async function getValidCredentials(): Promise<Credentials | null> {
  const creds = loadCredentials();
  if (!creds || !isExpired(creds)) return creds;
  return refreshCredentials(creds);
}

// Exchange the refresh token for a new access token. Also used when the server rejects
// a token before its recorded expiry (e.g. it was revoked).
export async function refreshCredentials(creds: Credentials): Promise<Credentials> {
  try {
    const refreshed: OAuthTokenResponse = await refreshAccessToken(creds.refresh_token, creds.client_id);
    saveOAuthCredentials({
      clientId: creds.client_id,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_in: refreshed.expires_in,
    });
    const saved = loadCredentials();
    if (!saved) throw new Error('could not save the refreshed credentials');
    return saved;
  } catch (err) {
    // Another process may have refreshed (and rotated) the token first; use what it saved.
    const latest = loadCredentials();
    if (latest && latest.refresh_token !== creds.refresh_token && !isExpired(latest)) return latest;
    throw new Error(`Could not refresh your session (${(err as Error).message}). Run: gtm auth login`);
  }
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) unlinkSync(CREDENTIALS_PATH);
}
