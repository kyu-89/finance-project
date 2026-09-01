import Link from 'next/link';

export function SettingsBackLink() {
  return (
    <Link
      href="/settings"
      className="settings-back-link"
      aria-label="설정 메인으로 돌아가기"
    >
      <span aria-hidden="true">←</span>
      <span>설정으로 돌아가기</span>
    </Link>
  );
}
