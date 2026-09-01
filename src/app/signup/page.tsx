'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push('/login?confirm=1');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
      <div><p className="mb-2 text-sm font-semibold text-[var(--tds-blue-500)]">우리집 재무</p><h1 className="tds-title">우리 집 재무를 시작해요</h1><p className="mt-2 text-sm text-[var(--tds-grey-700)]">수입·지출부터 자산 변화까지 한 흐름으로 관리해요.</p></div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-4 py-3"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-3"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="tds-primary-button mt-2 px-5"
        >
          {submitting ? '가입 중...' : '가입하기'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--tds-grey-700)]">
        이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-[var(--tds-blue-600)] underline-offset-4 hover:underline">로그인</Link>
      </p>
      </section>
    </main>
  );
}
