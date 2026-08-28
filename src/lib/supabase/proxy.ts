import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

// Protected app routes — must match the 4 menus + quick-add entry point (PRD §19.1),
// plus /mfa itself: an anonymous visitor must still be bounced to /login from /mfa/*.
const PROTECTED_PREFIXES = ['/dashboard', '/monthly', '/finance', '/settings', '/quick-add', '/mfa'];
// Routes reachable while only at AAL1 (mid-MFA-flow) even though they're "protected".
const AAL2_EXEMPT_PREFIXES = ['/mfa'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAal2Exempt = AAL2_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isProtected && user && !isAal2Exempt) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Fail closed: if the AAL lookup itself errors (aal === null), treat it as "not aal2"
    // rather than silently skipping the check and letting the request through.
    if (!aal || aal.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/mfa/verify', request.url));
    }
  }

  return response;
}
