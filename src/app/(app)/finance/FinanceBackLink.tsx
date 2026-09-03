import Link from 'next/link';

// 2026-09(사용자 지시): 자산/금융 하위 화면마다 뒤로가기 링크가 화살표 있음/없음/아예 없음으로
// 제각각이었다 — 공통 컴포넌트 하나로 통일해서 앞으로도 갈라지지 않게 한다. 항상 페이지의
// 가장 첫 요소(제목보다 위)로 사용한다.
export function FinanceBackLink() {
  return (
    <Link href="/finance" className="text-sm font-semibold text-[var(--tds-blue-500)]">
      ← 자산·금융 전체
    </Link>
  );
}
