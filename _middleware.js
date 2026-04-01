// AutoScrip — Vercel Edge Middleware
// Admin route protect + Security headers

export const config = { matcher: ['/admin', '/admin.html'] };

export default function middleware(request) {
  // Admin route — no server-side auth here (Firebase handles client auth)
  // Just add security headers
  const response = new Response(null, { status: 200 });
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
