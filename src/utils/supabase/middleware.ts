import { NextResponse, type NextRequest } from 'next/server';
import {
  createServerClient,
  type CookieOptions,
  type CookieMethodsServer,
} from '@supabase/ssr';

function getSupabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ''
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
      cookiesToSet.forEach(({ name, value }) => {
        request.cookies.set(name, value);
      });

      response = NextResponse.next({ request });

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  };

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: cookieMethods,
  });

  // Trigger a read so Supabase can refresh the session cookies if needed.
  await supabase.auth.getUser();

  return response;
}
