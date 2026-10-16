'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect('/login?error=E-mail%20inv%C3%A1lido');

  const h = await headers();
  const origin = h.get('origin') ?? `http://${h.get('host')}`;

  const { error } = await (await createClient()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect('/login?error=N%C3%A3o%20foi%20poss%C3%ADvel%20enviar%20o%20link');

  redirect('/login?sent=1');
}
