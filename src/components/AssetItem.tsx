import { Amount } from './Amount';

/**
 * Phase 7 — 계좌·예금·적금·대출·보험·기타자산 6개 상품이 공유하는 자산 카드 셸(§10).
 *
 * 6개 테이블 모두 잔액/현재가치를 직접 저장하고 사용자가 수동으로 갱신하므로
 * "제목 + 상태 + 핵심 금액 + 액션"이라는 동일한 뼈대를 갖는다. 이 컴포넌트는
 * 그 뼈대(카드 크롬 + 슬롯 사이 수직 리듬)만 소유하고, 상품마다 다른 정보는
 * 슬롯으로 그대로 받는다 — 대출의 상환표, 보험의 만기 임박 배지, 예금·적금의
 * 이자 계산 결과는 정보 축소 없이 전부 유지된다.
 *
 * 카드 크롬은 `.tds-card`를 조합해서 얻는다(radius/border/background 정의는
 * 계속 한 곳에만 존재). 호출부는 더 이상 `<article className="tds-card p-5">`을
 * 직접 쓰지 않는다.
 *
 * 슬롯 순서: header → banner → meta → primary → metrics → footnote → detail → actions
 */
export function AssetItem({
  title,
  subtitle,
  headingLevel = 3,
  statusBadge,
  banner,
  meta,
  primaryLabel,
  primaryValue,
  primaryNote,
  metrics,
  footnote,
  detail,
  actions,
  dimmed = false,
  className = '',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode; // 기관명 등 — "신한은행 · 1234-**-5678"
  headingLevel?: 2 | 3 | 4; // 카드가 놓인 화면의 제목 계층에 맞춘다(기본 h3)
  statusBadge?: React.ReactNode; // <Badge>, 카드 우상단
  banner?: React.ReactNode; // 강조 배지 — 보험 만기 임박 등, 있을 때만
  meta?: React.ReactNode; // 헤더 바로 아래 캡션 한 줄 — 예금·적금의 기간/남은 개월
  primaryLabel?: React.ReactNode; // "현재 잔액" 등
  primaryValue?: React.ReactNode; // <Amount size="medium" />
  primaryNote?: React.ReactNode; // 핵심 금액 아래 캡션 — 취득가, 납입일 등
  metrics?: React.ReactNode; // 상품별 지표 — <AssetMetric>들, <dl>로 감싸진다
  footnote?: React.ReactNode; // 카드 하단 보조 문단/캡션(여러 개면 fragment)
  detail?: React.ReactNode; // 펼침 영역 — 대출 상환표 <details> 등
  actions?: React.ReactNode; // 잔액 수정/해지 등 폼 그대로
  dimmed?: boolean; // 해지·처분·만기 상태
  className?: string;
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const classes = ['tds-card', 'tds-asset-item', dimmed && 'tds-asset-item-dimmed', className]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes}>
      <div className="tds-asset-item-header">
        <div className="tds-asset-item-heading">
          <Heading className="tds-asset-item-title">{title}</Heading>
          {subtitle && <p className="tds-asset-item-subtitle">{subtitle}</p>}
        </div>
        {statusBadge && <div className="tds-asset-item-status">{statusBadge}</div>}
      </div>
      {banner && <div className="tds-asset-item-banner">{banner}</div>}
      {meta && <p className="tds-asset-item-meta">{meta}</p>}
      {primaryValue && (
        <div className="tds-asset-item-primary">
          {primaryLabel && <span className="tds-asset-item-primary-label">{primaryLabel}</span>}
          {primaryValue}
          {primaryNote && <span className="tds-asset-item-primary-note">{primaryNote}</span>}
        </div>
      )}
      {metrics && <dl className="tds-asset-item-metrics">{metrics}</dl>}
      {footnote}
      {detail}
      {actions && <div className="tds-asset-item-actions">{actions}</div>}
    </article>
  );
}

/**
 * `AssetItem`의 `metrics` 슬롯에 들어가는 지표 한 칸. 예금/적금/대출이 각자
 * 로컬 `Metric`을 중복 정의하던 것을 하나로 합친 것으로, 금액은 반드시
 * `Amount`를 거친다.
 */
export function AssetMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="tds-asset-item-metric-label">{label}</dt>
      <dd className="tds-asset-item-metric-value">
        <Amount value={value} size="small" />
      </dd>
    </div>
  );
}

