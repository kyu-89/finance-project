'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function MfaEnrollPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enroll() {
      const supabase = createClient();

      const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        return;
      }

      const totpFactors = factorsData.all.filter((factor) => factor.factor_type === 'totp');
      const verifiedFactor = totpFactors.find((factor) => factor.status === 'verified');

      if (verifiedFactor) {
        router.replace('/mfa/verify');
        return;
      }

      const unverifiedFactor = totpFactors.find((factor) => factor.status === 'unverified');
      if (unverifiedFactor) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: unverifiedFactor.id,
        });
        if (unenrollError) {
          setError(unenrollError.message);
          return;
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (enrollError) {
        setError(enrollError.message);
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }

    enroll();
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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">2단계 인증(TOTP) 설정</h1>
      <p className="text-sm text-gray-600">
        Google Authenticator, 1Password 등 인증 앱으로 아래 QR 코드를 스캔하세요.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {qrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCode} alt="TOTP QR 코드" className="h-48 w-48 self-center" />
      )}
      {secret && (
        <p className="break-all text-xs text-gray-500">수동 입력 키: {secret}</p>
      )}
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          required
          placeholder="6자리 코드"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          확인 및 활성화
        </button>
      </form>
    </main>
  );
}
