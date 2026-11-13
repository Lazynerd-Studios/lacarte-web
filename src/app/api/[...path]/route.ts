import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_API_BASE_URL = 'https://lacarteprod.lazynerdstudios.com';

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'origin',
  'referer',
  'content-length',
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
]);

function getUpstreamBaseUrl(): string {
  const configured = process.env.LACARTE_API_BASE_URL?.trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path = [] } = await context.params;
  const upstreamBase = getUpstreamBaseUrl();

  // Preserve whether the client called `/api/foo` or `/api/foo/`
  const incomingPathname = request.nextUrl.pathname;
  const hasTrailingSlash =
    incomingPathname.length > 1 && incomingPathname.endsWith('/');
  const joinedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const upstreamPathname = `/api/${joinedPath}${hasTrailingSlash && joinedPath ? '/' : ''}`;

  const targetUrl = new URL(upstreamPathname, `${upstreamBase}/`);
  targetUrl.search = request.nextUrl.search;

  const upstreamHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      upstreamHeaders.set(key, value);
    }
  });

  // Better Auth CSRF check validates the Origin header against the backend's
  // trustedOrigins. When browser requests are proxied through Next.js, the
  // browser's Origin (e.g. http://localhost:3000) is not on the backend's
  // allowlist and triggers {"message":"Invalid origin","code":"INVALID_ORIGIN"}.
  // Setting Origin to the upstream origin satisfies Better Auth's origin check.
  upstreamHeaders.set('Origin', targetUrl.origin);

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method,
      headers: upstreamHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Upstream API unreachable';
    return NextResponse.json(
      { message, code: 'UPSTREAM_UNAVAILABLE' },
      { status: 502 },
    );
  }
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyRequest(request, context);
}
