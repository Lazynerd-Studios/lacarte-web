import { resolveApiUrl } from './config';

export class ApiException extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor({
    statusCode,
    message,
    code,
  }: {
    statusCode: number;
    message: string;
    code?: string;
  }) {
    super(message);
    this.name = 'ApiException';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Global bridge that lets lower-level HTTP code notify the auth layer when
 * a protected endpoint returns 401 mid-session.
 */
class AuthSessionGuard {
  onUnauthorized: (() => void) | null = null;

  notifyUnauthorized() {
    if (this.onUnauthorized) {
      this.onUnauthorized();
    }
  }
}

export const authSessionGuard = new AuthSessionGuard();

const TOKEN_STORAGE_KEY = 'lacarte_bearer_token';

export const TokenStorage = {
  save(token: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  read(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  delete(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

export interface RequestOptions {
  token?: string | null;
  body?: unknown;
  queryParams?: Record<string, string | undefined>;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  triggerUnauthorizedGuard?: boolean;
}

export async function apiRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    token = TokenStorage.read(),
    body,
    queryParams,
    extraHeaders,
    timeoutMs = 12000,
    triggerUnauthorizedGuard = true,
  } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(resolveApiUrl(normalizedPath));
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (response.status >= 200 && response.status < 300) {
      return (parsed ?? {}) as T;
    }

    const errMap =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    const message =
      typeof errMap.message === 'string' && errMap.message.trim()
        ? errMap.message
        : undefined;
    const code = typeof errMap.code === 'string' ? errMap.code : undefined;

    if (response.status === 400) {
      throw new ApiException({
        statusCode: 400,
        message: message ?? 'Bad request',
        code,
      });
    }
    if (response.status === 401) {
      if (triggerUnauthorizedGuard) {
        authSessionGuard.notifyUnauthorized();
      }
      throw new ApiException({
        statusCode: 401,
        message: triggerUnauthorizedGuard
          ? (message ?? 'Unauthorized')
          : (message ?? 'Invalid credentials'),
        code,
      });
    }
    if (response.status === 403) {
      throw new ApiException({
        statusCode: 403,
        message: message ?? 'Forbidden',
        code,
      });
    }
    if (response.status === 500) {
      throw new ApiException({
        statusCode: 500,
        message: 'Server error, please try again',
        code,
      });
    }
    throw new ApiException({
      statusCode: response.status,
      message: message ?? `Unexpected error (${response.status})`,
      code,
    });
  } catch (err) {
    if (err instanceof ApiException) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiException({
        statusCode: 0,
        message: 'No internet connection (request timed out)',
      });
    }
    throw new ApiException({
      statusCode: 0,
      message: 'No internet connection',
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiRequestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const {
    token = TokenStorage.read(),
    timeoutMs = 15000,
  } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = resolveApiUrl(normalizedPath);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });

    if (response.status === 401) {
      authSessionGuard.notifyUnauthorized();
      throw new ApiException({ statusCode: 401, message: 'Unauthorized' });
    }
    if (!response.ok) {
      throw new ApiException({
        statusCode: response.status,
        message: `Failed to download file (${response.status})`,
      });
    }
    return await response.blob();
  } finally {
    clearTimeout(timer);
  }
}

