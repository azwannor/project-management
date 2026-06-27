import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, encrypt } from '@/lib/auth';

const protectedRoutes = ['/', '/dashboard', '/projects', '/settings', '/support'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Periksa apakah ini adalah protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Jangan redirect untuk public API atau static assets
  if (!isProtectedRoute || pathname.startsWith('/api/') || pathname.startsWith('/_next') || pathname === '/login') {
    return NextResponse.next();
  }

  // Cek token session
  const sessionCookie = request.cookies.get('session')?.value;
  const session = await decrypt(sessionCookie);

  if (!session) {
    // Redirect ke login jika tidak ada session valid
    const loginUrl = new URL('/login', request.url);
    // Simpan return URL
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Biarkan request lanjut dan update rolling session
  const response = NextResponse.next();
  try {
    const newToken = await encrypt(session);
    response.cookies.set('session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/',
    });
  } catch (e) {
    // Abaikan jika gagal memperbarui token
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
