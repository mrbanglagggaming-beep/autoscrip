/**
 * AutoScrip — Vercel CORS Middleware
 * ফাইল: api/_middleware.js
 * সব API route-এ CORS headers যোগ করে
 */

export function middleware(request) {
  const origin = request.headers.get('origin') || '*';
  
  // Handle preflight OPTIONS request
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

  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    }
  });
}

export const config = {
  matcher: '/api/:path*',
};
