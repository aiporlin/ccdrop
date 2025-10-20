import { NextRequest, NextResponse } from 'next/server';

// List of supported locales
const locales = ['en', 'zh'];
const defaultLocale = 'en';

// Get the preferred locale from the request or use default
export function middleware(request: NextRequest) {
  // Check if there's any supported locale in the pathname
  const pathname = request.nextUrl.pathname;
  
  // Skip API routes and static files
  if (pathname.startsWith('/api/') || pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Check if the pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  
  if (pathnameHasLocale) {
    return NextResponse.next();
  }
  
  // Redirect to default locale if no locale in path
  const locale = defaultLocale;
  return NextResponse.redirect(
    new URL(`/${locale}${pathname === '/' ? '' : pathname}`, request.url)
  );
}

export const config = {
  matcher: ['/((?!_next).*)']
};