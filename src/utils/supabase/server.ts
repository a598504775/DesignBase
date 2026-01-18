import { cookies } from 'next/headers';
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

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // setAll can be called from a Server Component where setting cookies is not allowed.
        // This is safe to ignore if you have middleware/proxy session refresh.
      }
    },
  };

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: cookieMethods,
  });
}
