import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiRequest,
  ApiException,
  authSessionGuard,
  TokenStorage,
} from '@/lib/api-client';

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  };
}

let lastRequest: { url: string; headers: Record<string, string> } | null = null;

beforeEach(() => {
  lastRequest = null;
  TokenStorage.delete();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit) => {
      lastRequest = {
        url: String(input),
        headers: (init.headers ?? {}) as Record<string, string>,
      };
      return jsonResponse(200, { ok: true }) as never;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transport', () => {
  it('calls the API same-origin so the browser never needs backend CORS', async () => {
    await apiRequest('GET', '/api/customer/types');
    expect(lastRequest?.url).toMatch(/^https?:\/\/[^/]+\/api\/customer\/types$/);
    expect(lastRequest?.url).not.toContain('lacarteprod');
  });

  it('sends no Authorization header when there is no stored token', async () => {
    await apiRequest('GET', '/api/customer/types');
    expect(lastRequest?.headers.Authorization).toBeUndefined();
  });

  it('injects the bearer token once one is stored', async () => {
    TokenStorage.save('abc123');
    await apiRequest('GET', '/api/pickup-requests/');
    expect(lastRequest?.headers.Authorization).toBe('Bearer abc123');
  });
});

describe('selective 401 teardown (spec §2.4)', () => {
  let fired: number;
  beforeEach(() => {
    fired = 0;
    authSessionGuard.onUnauthorized = () => {
      fired += 1;
    };
  });
  afterEach(() => {
    authSessionGuard.onUnauthorized = null;
  });

  it('does NOT sign the user out for an anonymous endpoint, and keeps the server message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, {
        message: 'Invalid email or password',
        code: 'INVALID_EMAIL_OR_PASSWORD',
      }) as never,
    );

    const err = await apiRequest<never>('POST', '/api/auth/sign-in/email', {
      triggerUnauthorizedGuard: false,
    }).catch((e) => e as ApiException);

    expect(err).toBeInstanceOf(ApiException);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid email or password');
    expect(err.code).toBe('INVALID_EMAIL_OR_PASSWORD');
    expect(fired).toBe(0);
  });

  it('DOES tear the session down for a protected endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, {}) as never);

    await apiRequest('GET', '/api/pickup-requests/').catch(() => undefined);
    expect(fired).toBe(1);
  });

  it('falls back to "Invalid credentials" when the guard is suppressed and no message is sent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, {}) as never);

    const err = await apiRequest<never>('POST', '/api/auth/email-otp/check-verification-otp', {
      triggerUnauthorizedGuard: false,
    }).catch((e) => e as ApiException);

    expect(err.message).toBe('Invalid credentials');
    expect(fired).toBe(0);
  });
});

describe('offline tolerance (spec §5.3)', () => {
  it('maps a transport failure to statusCode 0 rather than signing anyone out', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed') as never);

    const err = await apiRequest<never>('GET', '/api/pickup-requests/').catch((e) => e as ApiException);

    expect(err).toBeInstanceOf(ApiException);
    expect(err.statusCode).toBe(0);
    expect(err.message).toBe('No internet connection');
  });

  it('maps an aborted request to the same offline shape', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }) as never,
    );

    const err = await apiRequest<never>('GET', '/api/pickup-requests/').catch((e) => e as ApiException);

    expect(err.statusCode).toBe(0);
    expect(err.message).toContain('No internet connection');
  });
});
