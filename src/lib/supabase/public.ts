import { createClient } from '@supabase/supabase-js';

/** Cliente anônimo, sem cookies: permite cache (ISR) nas páginas públicas. */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
