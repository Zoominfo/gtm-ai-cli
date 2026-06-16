import http from 'http';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';
import type { OAuthLoginResult, OAuthTokenResponse } from './types.js';
import { loadSavedClientId } from './credentials.js';
import { randomUUID } from 'node:crypto';
import { clearTimeout } from 'node:timers';

// Endpoints discovered from https://mcp.zoominfo.com/.well-known/oauth-authorization-server
const AUTHORIZE_URL = 'https://mcp.zoominfo.com/oauth/authorize';
const REGISTER_URL = 'https://mcp.zoominfo.com/oauth/register';
const TOKEN_URL = 'https://okta-login.zoominfo.com/oauth2/default/v1/token';
const REVOKE_URL = 'https://okta-login.zoominfo.com/oauth2/default/v1/revoke';

const REDIRECT_PORT = 9876;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

// Registered with ZoomInfo's MCP server as a native/public client
// (token_endpoint_auth_method: "none"), allowing a PKCE-only flow with no client_secret.
const VENDOR_NAME = 'GTM AI CLI';

const SCOPES = 'openid offline_access api:data:mcp zi_mcp profile email';
const REDIRECT_SERVER_TIMEOUT_MS = 5 * 60 * 1000;

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function isOAuthTokenResponse(value: unknown): value is OAuthTokenResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.access_token === 'string' &&
    typeof v.refresh_token === 'string' &&
    typeof v.expires_in === 'number'
  );
}

async function registerClient(): Promise<string> {
  const res = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: VENDOR_NAME,
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`Client registration failed: ${await res.text()}`);
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || typeof (data as Record<string, unknown>).client_id !== 'string') {
    throw new Error('Client registration response missing client_id');
  }
  return (data as { client_id: string }).client_id;
}

async function exchangeCode(code: string, clientId: string, verifier: string): Promise<OAuthTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data: unknown = await res.json();
  if (!isOAuthTokenResponse(data)) throw new Error('Token exchange returned unexpected payload');
  return data;
}

export async function refreshAccessToken(refreshToken: string, clientId: string): Promise<OAuthTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data: unknown = await res.json();
  if (!isOAuthTokenResponse(data)) throw new Error('Token refresh returned unexpected payload');
  return data;
}

export async function revokeToken(accessToken: string, clientId: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: accessToken,
      client_id: clientId,
    }),
  });
}

function openBrowser(url: string): void {
  // Avoid cmd.exe on Windows: it parses `&` as a command separator, and every OAuth
  // URL contains `&` between query params. rundll32 → ShellExecute is the safe path
  // (no shell parsing) and is what Microsoft documents for "open URL in default browser".
  const result =
    process.platform === 'darwin' ? spawnSync('open', [url]) :
    process.platform === 'win32'  ? spawnSync('rundll32', ['url.dll,FileProtocolHandler', url]) :
                                    spawnSync('xdg-open', [url]);
  if (result.error || result.status !== 0) {
    console.log(`\nCould not open browser automatically. Visit:\n${url}\n`);
  }
}

export async function oauthLogin(): Promise<OAuthLoginResult> {
  const clientId = loadSavedClientId() ?? await registerClient();
  const { verifier, challenge } = generatePKCE();
  const state = randomUUID().toString();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  const authUrl = `${AUTHORIZE_URL}?${params.toString()}`;

  return new Promise<OAuthLoginResult>((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => done(() => reject(new Error('Authorization timed out'))), REDIRECT_SERVER_TIMEOUT_MS);

    const done = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close(fn);
    };

    const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`);

      // Reject anything that isn't a GET /callback — closes the side-channel that
      // would otherwise let a local probe observe "OAuth login is in progress" via
      // hung connections during the 5-minute server window.
      if (req.method !== 'GET' || url.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authorization complete. You can close this tab.</h2></body></html>');

      if (error) {
        const msg = errorDescription ? `${error}: ${errorDescription}` : error;
        return done(() => reject(new Error(`Authorization denied: ${msg}`)));
      }
      if (returnedState !== state) return done(() => reject(new Error('State mismatch — possible CSRF attack')));
      if (!code) return done(() => reject(new Error('No authorization code received')));

      try {
        const tokens = await exchangeCode(code, clientId, verifier);
        done(() => resolve({ clientId, ...tokens }));
      } catch (err) {
        done(() => reject(err instanceof Error ? err : new Error(String(err))));
      }
    });

    server.on('error', (err: Error) => done(() => reject(err)));

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      console.log('Opening browser for ZoomInfo login...');
      openBrowser(authUrl);
      console.log('Waiting for authorization...');
    });
  });
}
