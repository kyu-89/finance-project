'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFactors() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();

      if (listError) {
        setError(listError.message);
        return;
      }

      const verifiedTotp = data.totp.find((f) => f.status === 'verified');

      if (!verifiedTotp) {
        setNeedsEnrollment(true);
        router.replace('/mfa/enroll');
        return;
      }

      setFactorId(verifiedTotp.id);
    }

    loadFactors();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push('/dashboard');
  }

  if (needsEnrollment) {
    return null;
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
      <h1 className="tds-title">인증 코드를 입력해요</h1>
      <p className="text-sm text-[var(--tds-grey-700)]">인증 앱에 표시된 6자리 코드를 입력해요.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          required
          placeholder="6자리 코드"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="px-4 py-3 text-center text-lg tracking-[0.2em]"
        />
        <button type="submit" className="tds-primary-button px-5">
          확인
        </button>
      </form>
      </section>
    </main>
  );
}
