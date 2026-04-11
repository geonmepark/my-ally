import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_ACT_NAME = 'cmact';
const COOKIE_RFT_NAME = 'cmrft';

const authPaths = ['/login', '/reset-password'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(COOKIE_ACT_NAME)?.value;
  const refreshToken = request.cookies.get(COOKIE_RFT_NAME)?.value;
  const isAuthenticated = !!(accessToken || refreshToken);

  if (isAuthenticated && authPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (!isAuthenticated && !authPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*$).*)'],
};
