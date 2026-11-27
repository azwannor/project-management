import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, encrypt } from '@/lib/auth';

const protectedRoutes = ['/', '/dashboard', '/projects', '/support', '/assets', '/maintenance', '/settings'];
const publicPrefixes = ['/login', '/assets/q/', '/api/', '/_next', '/brand/', '/manifest.webmanifest', '/sw.js', '/favicon.ico', '/apple-icon.png'];

/**
 * Next.js 16 request proxy enforcing rolling JWT session auth on protected app routes.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;
  const session = await decrypt(sessionCookie);

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  try {
    const newToken = await encrypt(session);
    response.cookies.set('session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });
  } catch {
    // Keep existing valid session cookie if refresh signing fails
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
