'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded bg-black px-3 py-2 text-white"
    >
      로그아웃
    </button>
  );
}
