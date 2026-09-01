# 웹 전역 디자인 시스템 재정의 — 설계 문서

- 날짜: 2026-09-02
- 범위: **웹(≥768px)만**. 모바일(`@media (max-width: 767px)`) 값은 이번 변경에서 건드리지 않는다.
- 관련 파일: `docs/DESIGN_SYSTEM.md`(사용자 대상 규칙 문서, 이번 스펙 반영 후 갱신), `src/app/design-system.css`, `src/app/globals.css`

## 배경

`docs/DESIGN_SYSTEM.md`와 `src/app/design-system.css`에 레이아웃·버튼·입력 규칙이 일부 정의돼 있지만, `src/app/globals.css`(1,133줄)에는 화면별(`home-*`, `monthly-*`, `settings-*`) 클래스마다 폰트 크기(9~38px), radius(8~26px), 여백, 색상이 토큰 없이 하드코딩돼 있다. 화면을 만들 때마다 그 화면에서만 통하는 값을 새로 정했기 때문에, 같은 역할(선택됨, 카드 호버, 카드 그리드 등)이 화면마다 다른 방식으로 구현돼 있다. 또한 데스크톱 웹의 가로 영역이 넓어지면서(→ LNB 포함 전체 폭 1920px까지 사용) 모바일 우선으로 설계된 고정 4열 그리드 등이 와이드 화면에서 부자연스럽게 늘어나는 문제가 있다.

이 문서는 화면마다 다시 정의하지 않고 전역적으로 재사용할 디자인 규칙(토큰 + 컴포넌트 클래스)을 확정한다.

## 목표

- 폰트/사이즈/버튼/위계/배지/라벨링/필드/선택/호버/스페이싱/패딩/오버레이/헤더/차트까지, 화면 전반에 반복되는 시각 규칙을 하나의 토큰·클래스 체계로 통일한다.
- 기존에 화면마다 임의로 지정된 값을 이 체계로 스윕(sweep)해 정리한다.
- 데스크톱 와이드 뷰포트(≥1280px, 최대 1920px)에 맞는 레이아웃 규칙을 추가한다.

## 비목표 (이번 범위 아님)

- 모바일 스타일 변경.
- `Badge`/`Amount`/`TableCard` 같은 새 React 컴포넌트 신설 (CSS 클래스까지만; 컴포넌트화는 후속 작업).
- 다크 모드.
- recharts 등 차트 라이브러리 도입 (현재 커스텀 CSS/SVG 차트 유지, 색상·형태 규칙만 통일).

## 확정된 결정 사항

1. **전체 레이아웃 최대폭 1920px** (LNB 포함). 그 이상은 좌우 여백으로 흡수, 콘텐츠는 중앙 정렬.
2. **선택(selected) 상태는 전부 브랜드 블루로 통일** — `background: var(--tds-blue-50); color: var(--tds-blue-600)`. 탭/세그먼트/필터칩/월 선택기 등 예외 없이 적용. 기존의 반전 검정(`grey-900`+흰 텍스트)과 흰색+그림자 탭 스타일은 폐기한다.
3. **접근 방식은 "토큰·CSS 클래스 정비"** — 새 React 컴포넌트를 만들지 않고, `design-system.css`/`globals.css`를 토큰 기반으로 재정비한다. 컴포넌트화는 이후 단계(HANDOFF 문서의 기존 백로그 항목)로 남긴다.

## 1. 레이아웃 & 브레이크포인트

| 토큰 | 값 | 설명 |
|---|---|---|
| `--bp-md` | 768px | 모바일/웹 경계 (기존 Tailwind `md:`와 동일) |
| `--bp-lg` | 1280px | 웹-와이드 시작점. 카드 그리드 열 수가 늘어날 수 있는 기준 |
| `--app-max-width` | 1920px | LNB 포함 전체 레이아웃 최대폭 |
| `--ui-page-gutter` | `clamp(20px, 2vw, 40px)` | 기존 `clamp(20px, 1.5vw, 28px)`에서 상한 확장 |

- `AppShell`(또는 최상위 레이아웃 wrapper)에 `max-width: var(--app-max-width); margin-inline: auto`를 적용한다. 배경(`--tds-grey-50`)은 뷰포트 전체로 유지하고, 콘텐츠 컨테이너만 폭을 제한한다.
- **고정 열 그리드 금지 원칙**: `home-flow-cards`, `home-html-kpi-grid`, `home-flow-kpi-grid`, `home-flow-trend-grid`, `monthly-summary-grid` 등 `repeat(N, 1fr)`로 고정된 카드 그리드는 `repeat(auto-fit, minmax(220px, 1fr))` 계열로 교체한다. 셀 최소폭은 카드 성격에 따라 200~260px 범위에서 정한다.
- 읽기 폭이 중요한 화면(`quick-add-shell` 등 720px 제한)은 예외로 유지한다.

## 2. 타이포그래피

폰트 스택은 변경하지 않는다(Pretendard). 아래 8단 스케일로 기존 산발적 크기(9~38px)를 대체한다.

| 토큰 | `font-size` | `font-weight` | 용도 | 대체 대상(예) |
|---|---|---|---|---|
| `--text-display` | `clamp(28px,2.4vw,36px)` | 700 | 순자산 등 헤드라인 숫자 | `home-card-heading strong`(clamp 27~38px) |
| `--text-title-1` | `clamp(25px,2vw,30px)` | 750 | 페이지 타이틀 | `.tds-title` (기존 그대로 토큰화) |
| `--text-title-2` | 20px | 700 | 섹션 헤딩(h2) | `monthly-command-copy h2`, `monthly-report-lead h2` |
| `--text-title-3` | 16px | 750 | 카드/서브섹션 헤딩(h3) | `home-html-title h2`(16px 그대로), `recurring-form legend` |
| `--text-body-1` | 15px | 500 | 기본 본문/컨트롤 | `body`(기존 15px 유지) |
| `--text-body-2` | 14px | 500 | 보조 본문 | `home-subtitle`, `confirm-dialog p` |
| `--text-caption` | 13px | 650 | 라벨, 메타 | `form-field`, `home-eyebrow`(700→650 통일) |
| `--text-micro` | 11px | 650 | 칩/배지/타임스탬프 | `home-flow-card > span`, `home-line-label` |

- 문서화된 예외 2개만 유지: `.tds-title`(=`--text-title-1`, 이미 스케일에 포함이므로 실질적 예외 없음), `input.quick-add-amount`(28px/64px, 금액 입력 강조).
- 금액·통계 수치는 `font-variant-numeric: tabular-nums`를 전역 규칙(`[data-numeric], .is-amount` 또는 기존 `font-variant-numeric` 적용 위치 전수 점검)으로 강제한다.

## 3. 색상 · 상태 토큰

```css
--state-selected-bg: var(--tds-blue-50);
--state-selected-fg: var(--tds-blue-600);
--state-selected-border: var(--tds-blue-500); /* outline이 필요한 칩류에만 */

--ui-elevation-0: none;                         /* 평면 표면 기본값 */
--ui-elevation-1: 0 1px 2px oklch(0.155 0.06 261 / .04), 0 4px 12px oklch(0.155 0.06 261 / .06); /* 메뉴/드롭다운 */
--ui-elevation-2: 0 8px 24px oklch(0.155 0.06 261 / .06);   /* 카드 호버 */
--ui-elevation-3: 0 12px 32px oklch(0.155 0.06 261 / .10), 0 2px 6px oklch(0.155 0.06 261 / .06); /* 드로어/다이얼로그 */
--ui-elevation-toast: 0 12px 36px rgb(0 0 0 / .2);

--chart-income: var(--tds-blue-500);
--chart-expense: var(--tds-red-500);
--chart-wealth: var(--tds-green-500);
--chart-target: var(--tds-blue-300, #93c5fd);
--chart-current-bg: var(--tds-blue-50);          /* "현재 기간" 강조는 지표와 무관하게 항상 blue */
```

- **선택 상태**: 탭(`home-networth-tabs`, `home-explorer-tabs`, `home-primary-tab-list`, `settings-month-switcher`, `monthly-workspace-tabs`, `monthly-ledger-period-toggle`), 필터칩(`tds-chip[data-selected]`, `dashboard-period-presets a.is-selected`), 홈 멤버 필터(`home-filter-chip.is-selected`), 월 선택기(`home-month-selector button.is-selected`) — 전부 `--state-selected-bg`/`--state-selected-fg`로 교체. 지금 각기 다른 `background: var(--tds-white)/var(--tds-grey-900)/var(--tds-blue-500)` 조합을 제거한다.
- **호버 규칙 2종**:
  - 클릭 가능한 카드/행(`home-flow-card`, `home-detail-card`, `home-networth-card`, `home-cash-card`, `home-flow-summary`, 테이블 행): `border-color` 블루 틴트 + `box-shadow: var(--ui-elevation-2)`.
  - 버튼/칩/탭/메뉴 아이템: `background: var(--tds-grey-100)`만, 그림자 없음.
- **차트 색상**: `--chart-income`/`--chart-expense`/`--chart-wealth`/`--chart-target`/`--chart-current-bg`로 전 차트 공통 적용. `home-rate-chart > div.is-current`의 `green-50`을 `--chart-current-bg`(blue-50)로 교정.

## 4. 버튼 위계

| 클래스 | 용도 | 스펙 | 비고 |
|---|---|---|---|
| `tds-primary-button` | 화면당 대표 행동 1개 | 44px, 블루 채움 | 기존 유지 |
| `tds-button-secondary` | 보조 행동 | 44px, 흰 배경+테두리 | 기존 유지 |
| 파괴 행동 | 삭제·해지 | secondary 규격 + `--tds-red-500` 텍스트 | 기존 유지 |
| `tds-button-ghost` (신설) | 툴바 3차 행동 | 배경/테두리 없음, `--tds-blue-600` 텍스트, `hover: var(--tds-blue-700)`, 패딩으로 44px 클릭 영역 확보 | 신설 |
| `tds-text-link` (신설) | "더보기" 등 인라인 링크 | 클릭 영역 규정 없음(인라인), `--text-caption` 크기, `--tds-blue-600` → hover `--tds-blue-700` | `home-section-heading > a`, `settings-back-link`, `monthly-description-button` 등을 이 규칙으로 흡수 |

## 5. 배지 · 칩

- **`tds-badge` (신설)**: 높이 22px, radius 6px, 비대화형 상태 표시 전용.
  - `neutral`: `--tds-grey-100` / `--tds-grey-700`
  - `info`: `--tds-blue-50` / `--tds-blue-600`
  - `positive`: green 워시 / `--tds-green-600`(없으면 `--tds-green-500`)
  - `negative`: red 워시 / `--tds-red-600`(없으면 `--tds-red-500`)
  - `warning`: yellow 워시 / `--tds-yellow-700`
  - `home-flow-kind`, `transaction-status-feedback`, `monthly-planned-queue`의 상태 표기 등 지금 텍스트 색상만 바꾸던 곳을 `tds-badge`로 전환.
- **`tds-chip`**: 클릭 가능한 필터·선택 전용으로 역할을 좁힌다(정보 표시용으로 쓰이던 곳은 `tds-badge`로 이동). 선택 상태는 3절의 통일 규칙 적용.

## 6. 라벨링 · 필드 규칙

`docs/DESIGN_SYSTEM.md`의 기존 규칙(라벨 우측 상단 `필수` 표기, `FormField` 사용, 44px/48px 높이, 12px 좌우 패딩, select는 별도 필수 표기 없음)을 그대로 승계한다. 크기만 2절 타이포 토큰에 맞춘다: 라벨 = `--text-caption`, hint = `--text-micro`.

## 7. 간격 · 패딩

기존 `4/8/12/16/20/24px`(`--ui-space-1`~`--ui-space-6`) 스케일 유지. 와이드 화면 섹션 간 간격용으로 3단을 추가한다.

```css
--ui-space-7: 32px;
--ui-space-8: 40px;
--ui-space-9: 48px;
```

`globals.css`의 비표준 값(`margin-top: 22px/23px/27px/28px` 등)을 가장 가까운 토큰(20/24/32px)으로 스냅한다.

## 8. 오버레이 (토스트 · 모달 · 드로어)

- **드로어 폭 불일치 수정**: `design-system.css`(640px)와 `globals.css`(620px)가 다르게 정의돼 있다 → **640px로 통일**(`aside[role="dialog"]`, `[aria-label="거래 상세"]` 포함 전부).
- **Dialog**: `confirm-dialog` 420px, radius 20px, `box-shadow: var(--ui-elevation-3)`, 액션 2열 그리드(취소=secondary/확인=primary 또는 danger). 기존 값 유지, 그림자만 토큰 참조로 교체.
- **Toast**: 위치·타이밍(우하단 고정 24px, 성공 4.2s/오류 5.6s, 모바일은 하단 LNB 위) 기존 유지. `--toast-success-bg: var(--tds-grey-900)`, `--toast-error-bg: var(--tds-red-500)` 토큰화. `box-shadow: var(--ui-elevation-toast)`.

## 9. 페이지 헤더

`home-header`/`home-eyebrow`/`home-subtitle` 조합(아이브로우 + `--text-title-1` + 서브타이틀 + 우측 액션)을 일반화한 `tds-page-header`/`tds-eyebrow`/`tds-page-subtitle` 클래스로 승격한다. 현재 사용처(`src/app/(app)/dashboard/page.tsx`)의 클래스명을 교체하고, 이후 새 화면은 이 클래스를 기본 헤더로 사용한다.

## 10. 차트 · 그래프

- 시맨틱 컬러를 `--chart-income`/`--chart-expense`/`--chart-wealth`/`--chart-target`로 고정하고, 하드코딩된 `#ff8f95`, `#76dfad`, `#8ec5ff` 등 인라인 hex를 토큰 참조로 교체한다.
- "현재 기간" 강조는 지표 색과 무관하게 항상 `--chart-current-bg`(blue-50). `home-rate-chart`의 `green-50` 예외를 제거한다.
- 막대는 상단 모서리만 라운드(4~6px), 축/그리드선은 1px `--tds-grey-200`, 범례는 6~8px 원 도트 + `--text-micro`.

## 마이그레이션 범위

1. `src/app/design-system.css` 재작성: 위 토큰 전부 추가, 버튼/배지/칩/오버레이/헤더 클래스 정의.
2. `src/app/globals.css` 스윕:
   - 스케일 밖 폰트 크기 → 8단 타이포 토큰
   - 스케일 밖 margin/padding → 간격 토큰
   - 고정 4열 그리드 → `auto-fit` 그리드
   - 선택/호버 스타일 → 통일 규칙
   - 드로어 폭 620px → 640px
   - `home-rate-chart` 현재 강조 색 → blue-50
   - 인라인 hex 차트 색상 → `--chart-*` 토큰
3. `docs/DESIGN_SYSTEM.md` 갱신 — 이번 스펙의 확정 규칙을 사용자 대상 문서로 반영.
4. `src/app/(app)/dashboard/page.tsx`의 `home-header`류 클래스명을 `tds-page-header`류로 교체.
5. 모바일 미디어 쿼리 블록(`@media (max-width: 767px/640px)`)은 값 변경 없음 — 웹 전용 규칙만 추가/치환.

## 검증 계획

- `npx tsc --noEmit`, `npm run lint`, `npm run build` (기존 HANDOFF 검증 루틴과 동일).
- 데스크톱 뷰포트(768/1280/1920/2560px)에서 대시보드·월간 관리·설정 화면 스크린샷 비교(카드 그리드 열 수, 선택 상태 색상, 드로어 폭 확인).
- 회귀 위험이 큰 지점: 고정 그리드 → auto-fit 전환 시 열 개수 변화(레이아웃 흔들림), 선택 상태 색상 변경으로 인한 대비(contrast) 저하 여부.

## 스펙 셀프 리뷰

- 플레이스홀더/TBD 없음.
- 내부 모순 없음 — 결정 사항(1920px 캡, 블루 통일 선택 상태) 전 섹션에 일관 반영.
- 범위: 웹 전용, 토큰·클래스 정비로 한정 — 단일 구현 계획으로 다루기 적절한 크기.
- 모호성: "카드 최소폭 200~260px"은 카드 종류별로 구현 계획 단계에서 구체값을 정한다(스펙 단계에서는 범위로 명시).
