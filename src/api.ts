import { SessionRejected, withSession } from './credentials.js';
import { debugLog } from './debug.js';
import { parseInteger } from './utils.js';
import { USER_AGENT } from './pkg.js';

// ZoomInfo GTM REST API, for capabilities the MCP server doesn't expose. It shares the
// MCP client's OAuth session.
const API_URL = 'https://api.zoominfo.com/gtm';
const JSON_API = 'application/vnd.api+json';

// Rate limits are tenant-wide. A 429 means the request was not processed, so it is always
// safe to retry; other failures are not retried, so a non-idempotent call never repeats.
const MAX_RATE_LIMIT_RETRIES = 3;

export type Query = Record<string, string | number | undefined>;

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
}

export async function apiCall<T = unknown>(path: string, { method = 'GET', query = {}, body }: ApiRequest = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  debugLog(`${method} ${url.pathname}${url.search}`, body ?? '');

  const res = await withSession(async creds => {
    const res = await send(url, method, body, creds.access_token);
    if (res.status === 401) throw new SessionRejected();
    return res;
  });

  debugLog(`response ${res.status}`, res.text);
  if (!res.ok) throw new Error(apiErrorMessage(res.status, res.text));
  if (!res.text) return null as T;
  try {
    return JSON.parse(res.text) as T;
  } catch {
    throw new Error(`the ZoomInfo API returned a response that isn't JSON (HTTP ${res.status})`);
  }
}

interface ApiResponse {
  status: number;
  ok: boolean;
  text: string;
}

async function send(url: URL, method: string, body: unknown, token: string): Promise<ApiResponse> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: JSON_API,
          'User-Agent': USER_AGENT,
          ...(body !== undefined && { 'Content-Type': JSON_API }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      text = await res.text();
    } catch (err) {
      // fetch reports every network failure as "fetch failed"; surface the underlying cause.
      const { message, cause } = err as Error & { cause?: Error };
      throw new Error(`could not reach the ZoomInfo API (${cause?.message ?? message})`);
    }
    if (res.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return { status: res.status, ok: res.ok, text };
    // Honour Retry-After (seconds, capped at 30s); otherwise back off exponentially.
    const delaySeconds = Math.min(Number(res.headers.get('Retry-After')) || 2 ** attempt, 30);
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  }
}

// JSON:API error documents: { errors: [{ title, detail, source: { pointer | parameter } }] }.
export function apiErrorMessage(status: number, body: string): string {
  let error: { title?: string; detail?: string; source?: { pointer?: string; parameter?: string } | null } | undefined;
  try {
    error = (JSON.parse(body) as { errors?: (typeof error)[] }).errors?.[0];
  } catch { /* not JSON */ }
  const detail = error?.detail ?? error?.title;
  if (!detail) return `HTTP ${status}${body ? ` ${body.slice(0, 300)}` : ''}`;
  const title = error?.title && error.title !== detail ? ` ${error.title}` : '';
  const context = [`${status}${title}`, error?.source?.pointer ?? error?.source?.parameter].filter(Boolean).join(', ');
  return `${detail} (${context})`;
}

// JSON:API list parameters shared by the REST list endpoints.
export interface ListOptions {
  name?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

export function listQuery(opts: ListOptions): Query {
  return {
    'filter[name]': opts.name,
    sort: opts.sort,
    'page[number]': opts.page === undefined ? undefined : parseInteger(opts.page, '--page'),
    'page[size]': opts.pageSize === undefined ? undefined : parseInteger(opts.pageSize, '--page-size'),
  };
}
