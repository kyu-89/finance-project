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
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAal2Exempt = AAL2_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));

  // Public routes do not consume session state, so avoid an auth round trip for them.
  if (!isProtected) {
    return response;
  }

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

  // One verified JWT-claims read supplies both identity and MFA assurance level.
  // Previously getUser() and getAuthenticatorAssuranceLevel() ran sequentially.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isAal2Exempt && claims.aal !== 'aal2') {
    return NextResponse.redirect(new URL('/mfa/verify', request.url));
  }

  return response;
}
