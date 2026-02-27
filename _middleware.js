/**
 * AutoScrip — Vercel Middleware
 * ফাইল: _middleware.js
 * CORS headers + UTF-8 charset for HTML pages
 */
import { NextResponse } from 'next/server';

export function middleware(request) {
  const origin = request.headers.get('origin') || '*';
  const url = request.nextUrl.pathname;

  // ── Handle preflight OPTIONS ──────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':      origin,
        'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age':           '86400',
      }
    });
  }

  // ── API routes: শুধু CORS ─────────────────────────────────────────
  if (url.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin',  origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    return response;
  }

  // ── HTML pages: charset=utf-8 সেট করো ───────────────────────────
  const isHtmlPage =
    url === '/' ||
    url === '/admin' ||
    url === '/user' ||
    url.endsWith('.html');

  if (isHtmlPage) {
    const response = NextResponse.next();
    response.headers.set('Content-Type', 'text/html; charset=utf-8');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin', '/user', '/api/:path*', '/(.*)\\.html'],
};
