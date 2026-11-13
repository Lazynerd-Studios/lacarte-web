import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from './route';

let capturedFetch: {
  url: string;
  method: string;
  headers: Headers;
  body: ArrayBuffer | undefined;
} | null = null;

beforeEach(() => {
  capturedFetch = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      capturedFetch = {
        url: String(input),
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: init?.body as ArrayBuffer | undefined,
      };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/api/[...path] proxy route handler', () => {
  it('rewrites the browser Origin header to the upstream origin so Better Auth does not reject with INVALID_ORIGIN', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'http://localhost:3000/sign-in',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'user@example.com', password: 'secret' }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ path: ['auth', 'sign-in', 'email'] }),
    });

    expect(res.status).toBe(200);
    expect(capturedFetch).not.toBeNull();
    expect(capturedFetch?.url).toBe(
      'https://lacarteprod.lazynerdstudios.com/api/auth/sign-in/email',
    );
    expect(capturedFetch?.headers.get('origin')).toBe(
      'https://lacarteprod.lazynerdstudios.com',
    );
    expect(capturedFetch?.headers.get('referer')).toBeNull();
  });

  it('preserves trailing slashes and query parameters when forwarding to the backend', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/notifications/customer/?page=1&limit=20',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
    );

    const res = await GET(req, {
      params: Promise.resolve({ path: ['notifications', 'customer'] }),
    });

    expect(res.status).toBe(200);
    expect(capturedFetch?.url).toBe(
      'https://lacarteprod.lazynerdstudios.com/api/notifications/customer/?page=1&limit=20',
    );
    expect(capturedFetch?.headers.get('authorization')).toBe('Bearer test-token');
  });

  it('forwards DELETE requests without a body', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/store-orders/cart/',
      {
        method: 'DELETE',
        headers: { Origin: 'http://localhost:3000' },
      },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ path: ['store-orders', 'cart'] }),
    });

    expect(res.status).toBe(200);
    expect(capturedFetch?.method).toBe('DELETE');
    expect(capturedFetch?.url).toBe(
      'https://lacarteprod.lazynerdstudios.com/api/store-orders/cart/',
    );
    expect(capturedFetch?.body).toBeUndefined();
  });
});
