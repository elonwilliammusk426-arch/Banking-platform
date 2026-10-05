import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
  if (demoMode || request.cookies.has('access_token') || request.cookies.has('session_hint')) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('returnTo', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/', '/admin/:path*', '/onboarding/:path*'],
};
