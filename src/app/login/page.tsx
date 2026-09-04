'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSignedUp = searchParams.get('confirm') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push('/mfa/verify');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
      <div><p className="mb-2 text-sm font-semibold text-[var(--tds-blue-500)]">우리집 가계부</p><h1 className="tds-title">다시 만나요</h1><p className="mt-2 text-sm text-[var(--tds-grey-700)]">우리 집 돈의 흐름과 자산을 이어서 살펴보세요.</p></div>
      {justSignedUp && (
        <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">
          가입 확인 이메일을 보냈어요. 이메일을 확인한 뒤 로그인해요.
        </p>
      )}
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
          placeholder="비밀번호"
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
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--tds-grey-700)]">
        처음 이용하시나요? <Link href="/signup" className="font-semibold text-[var(--tds-blue-600)] underline-offset-4 hover:underline">회원가입</Link>
      </p>
      </section>
    </main>
  );
}
