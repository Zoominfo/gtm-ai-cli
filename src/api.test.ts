import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The refresh policy is tested in credentials.test.ts; here withSession just runs the request.
vi.mock('./credentials.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  withSession: async (request: (creds: { access_token: string }) => Promise<unknown>) => request({ access_token: 'token' }),
}));

const { apiCall, apiErrorMessage, listQuery } = await import('./api.js');
const { SessionRejected } = await import('./credentials.js');

const fetchMock = vi.fn();
const response = (status: number, body = '', headers: Record<string, string> = {}) => new Response(body || null, { status, headers });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ toFake: ['setTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('apiCall', () => {
  it('sends JSON:API requests to the GTM API with the session token', async () => {
    fetchMock.mockResolvedValue(response(200, '{"data":[]}'));
    await expect(apiCall('/platform/v1/exports', { query: { 'page[size]': 5, sort: undefined } })).resolves.toEqual({ data: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.zoominfo.com/gtm/platform/v1/exports?page%5Bsize%5D=5');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token', Accept: 'application/vnd.api+json' });
  });

  it('reports a rejected token to the session handler', async () => {
    fetchMock.mockResolvedValue(response(401));
    await expect(apiCall('/x')).rejects.toBeInstanceOf(SessionRejected);
  });

  it('retries a rate-limited request, honouring Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(response(429, '', { 'Retry-After': '2' })).mockResolvedValueOnce(response(204));
    const call = apiCall('/x', { method: 'DELETE' });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(call).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry server errors, so a non-idempotent call never repeats', async () => {
    fetchMock.mockResolvedValue(response(500, '{"errors":[{"title":"Internal Server Error","detail":"boom"}]}'));
    await expect(apiCall('/x', { method: 'POST', body: {} })).rejects.toThrow('boom (500 Internal Server Error)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the cause of a network failure instead of "fetch failed"', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND api.zoominfo.com') }));
    await expect(apiCall('/x')).rejects.toThrow('could not reach the ZoomInfo API (getaddrinfo ENOTFOUND api.zoominfo.com)');
  });

  it('reports a non-JSON success body clearly', async () => {
    fetchMock.mockResolvedValue(response(200, '<html>portal</html>'));
    await expect(apiCall('/x')).rejects.toThrow("returned a response that isn't JSON (HTTP 200)");
  });
});

describe('apiErrorMessage', () => {
  it('reports the first JSON:API error with its status and source', () => {
    const body = JSON.stringify({ errors: [{ title: 'Bad Request', detail: 'size must be between 1 and 30', source: { pointer: 'data/attributes/items' } }] });
    expect(apiErrorMessage(400, body)).toBe('size must be between 1 and 30 (400 Bad Request, data/attributes/items)');
    expect(apiErrorMessage(400, '{"errors":[{"detail":"invalid sort","source":{"parameter":"sort"}}]}')).toBe('invalid sort (400, sort)');
  });

  it('falls back to the title, then to the status and raw body', () => {
    expect(apiErrorMessage(403, '{"errors":[{"title":"Forbidden"}]}')).toBe('Forbidden (403)');
    expect(apiErrorMessage(502, 'Bad gateway')).toBe('HTTP 502 Bad gateway');
  });
});

describe('listQuery', () => {
  it('maps list flags to JSON:API query parameters', () => {
    expect(listQuery({ name: 'sales', page: '2', pageSize: '10', sort: 'name' })).toEqual({
      'filter[name]': 'sales', sort: 'name', 'page[number]': 2, 'page[size]': 10,
    });
    expect(() => listQuery({ page: 'two' })).toThrow(/--page must be an integer/);
  });
});
