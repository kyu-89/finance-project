# 우리집 재무 제품 리디자인 — Codex 인수인계 (2026-09-02)

## 1. 인수인계 목적

Claude가 완료한 제품 리디자인 Phase 1–8 이후 작업을 Codex가 이어받아 Phase 9를 구현했고, Phase 10 실제 브라우저 QA를 시작한 시점에서 사용자가 작업 중단 및 Claude용 인수인계를 요청했다.

이 문서 기준으로 현재 미커밋 변경을 보존한 채 이어서 진행한다. 기존 PRD를 다시 처음부터 해석하거나 Phase 1–8을 재구현하지 않는다.

## 2. 사용자가 지정한 기준 문서

- `docs/HANDOFF_PRODUCT_REDESIGN_2026-09-02.md`
- `docs/superpowers/specs/2026-09-02-product-redesign-phase1-audit.md`
- 웹 디자인 시스템 참고: `docs/HANDOFF_DESIGN_SYSTEM_2026-09-02.md`
- 사용자가 새로 제공한 시각 품질 참고 이미지:
  - `C:\Users\미니쉬테크놀로지-김규남\Downloads\ChatGPT Image 2026년 9월 2일 오후 07_55_57.png`
  - 화면을 그대로 복제하라는 뜻이 아니라, 모바일의 높은 정보 밀도·명확한 계층과 웹의 효율적인 가로 공간 사용 수준을 품질 기준으로 참고하라는 요청이다.

## 3. 저장소 상태

- 작업 경로: `C:\Users\미니쉬테크놀로지-김규남\Desktop\dev\personal-finance`
- 브랜치: `main`
- 현재 HEAD: `efaf5c0 docs: add Codex handoff for product redesign (Phase 1-8 done, 9-10 remaining)`
- 원격 대비: `main...origin/main [ahead 12]`
- `.superpowers/`는 기존부터 untracked인 Claude 작업 자료다. 삭제하거나 임의로 커밋하지 않는다.
- 아래 Phase 9 변경은 **아직 커밋·푸시·배포하지 않았다.**

현재 `git status --short`의 의도된 변경:

```text
 D src/app/(app)/dashboard/DashboardIncomeExplorer.tsx
 D src/app/(app)/dashboard/DashboardPeriodFilters.tsx
 D src/app/(app)/dashboard/DashboardSpendingExplorer.tsx
 D src/app/(app)/dashboard/MobileDashboardFilters.tsx
 M src/app/(app)/monthly/MonthlyInputTab.tsx
 M src/app/(app)/settings/recurring/RecurringRuleStatusSelect.tsx
 M src/app/globals.css
 D src/components/CurrencyInput.tsx
 M src/components/StatusSelect.tsx
 M src/components/TransactionStatusEditor.tsx
 M src/components/nav/MobileBottomNav.tsx
?? .superpowers/
?? src/components/InlineActionSelect.tsx
?? docs/HANDOFF_CODEX_PRODUCT_REDESIGN_2026-09-02.md
```

## 4. 이번 세션에서 확인한 프레임워크/스킬 규칙

- `AGENTS.md`의 Next.js 규칙에 따라 아래 Next.js 16.3.3 문서를 읽고 작업했다.
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
- 사용한 설계 기준:
  - `.agents/skills/design-system/SKILL.md`
  - `.agents/skills/design-system/references/token-architecture.md`
  - `.agents/skills/ui-ux-pro-max/SKILL.md`
- 실제 브라우저 검수는 Chrome 연결 브라우저를 사용했다.

## 5. 완료한 Phase 9 작업 (미커밋)

### 5.1 미사용 파일 재검증 및 삭제

전체 `src/**/*.ts(x)`에서 import/사용처를 다시 검색했고, 아래 파일은 자기 선언 외 참조가 없음을 확인한 뒤 삭제했다.

- `src/components/CurrencyInput.tsx`
- `src/app/(app)/dashboard/DashboardPeriodFilters.tsx`
- `src/app/(app)/dashboard/MobileDashboardFilters.tsx`
- `src/app/(app)/dashboard/DashboardSpendingExplorer.tsx`
- `src/app/(app)/dashboard/DashboardIncomeExplorer.tsx`

### 5.2 구형 대시보드 전용 CSS 제거

삭제된 컴포넌트 외 TSX에서 사용되지 않는 것을 재확인한 뒤 `src/app/globals.css`에서 다음 계열을 제거했다.

- 구형 기간 필터: `dashboard-period-*`, `dashboard-filters`, 관련 `home-month-row` 자식 규칙
- 구형 대시보드 필터 바: `home-filter-bar`
- 삭제된 수입/지출 explorer 전용 규칙:
  - `home-spending-explorer`
  - `home-explorer-controls/list/row/track/children/chevron`
  - `home-monthly-spending-*`
  - `home-monthly-category-*`
  - `home-monthly-subcategory-*`
- 구형 수기 차트/뷰 규칙:
  - `home-cashflow-*`
  - `home-rate-chart`
  - `home-networth-line-chart`
  - `home-html-flow-detail`
  - `home-flow-trend-*`
  - `home-flow-cards` 및 관련 구형 summary 카드 규칙
  - `home-networth-tabs`
  - `home-chart-legend`

제거 후 위 문자열이 `globals.css`에 남지 않았고, TypeScript/lint/build가 모두 통과했다.

### 5.3 미정의 primitive token 해소

전체 `src/app/*.css`의 `var(--*)` 사용과 정의를 합쳐 검사했다. 실제로 남아 있던 미정의 토큰을 `globals.css :root`에 추가했다.

```css
--tds-grey-800: oklch(0.34 0.03 254);
--tds-grey-600: oklch(0.552 0.024 253);
--tds-green-700: oklch(0.374 0.128 154);
--tds-orange-500: #f59e0b;
```

`--tds-red-400`은 삭제된 구형 explorer CSS에서만 쓰였으므로 토큰을 추가하지 않고 사용처와 함께 제거했다. 현재 전체 앱 CSS 기준 미정의 `var()`는 0개다.

### 5.4 자동 저장 셀렉트 공용화

신규 파일:

- `src/components/InlineActionSelect.tsx`

목적:

- 서버 액션 기반 auto-submit `<select>`의 폼, hidden field, pending/disabled, 성공/오류 피드백을 공통화한다.
- `feedback="toast" | "compact"`를 지원해 설정 목록은 기존 토스트 정책을 유지하고, 거래 테이블 셀은 레이아웃을 깨지 않는 compact feedback을 유지한다.

적용 완료:

- `src/components/StatusSelect.tsx`
  - 카테고리/소분류/결제수단 활성·비활성
- `src/app/(app)/settings/recurring/RecurringRuleStatusSelect.tsx`
  - 사용 중/일시 중지/종료
  - 종료 상태의 disabled 동작 보존
- `src/components/TransactionStatusEditor.tsx`
  - 일반 거래 상태 드롭다운
  - 예정 반복거래의 `[확정] [이번달 제외]` 특수 분기는 그대로 보존
- `src/app/(app)/monthly/MonthlyInputTab.tsx`
  - 비용성격 드롭다운

서버 액션 시그니처와 데이터 로직은 변경하지 않았다.

### 5.5 모바일 LNB 아이콘 통일

- `src/components/nav/MobileBottomNav.tsx`
- 자체 인라인 SVG `NavIcon`을 제거했다.
- 이미 설치된 `lucide-react`의 `Home`, `CalendarDays`, `Plus`, `WalletCards`, `Settings`로 통일했다.
- `--icon-lg` 토큰과 동일한 stroke width 1.8을 사용한다.
- 특히 기존 설정 아이콘이 톱니바퀴처럼 보이지 않던 문제를 해결한다.

### 5.6 선택 상태 대비 개선

회색 segmented-control 트랙 위에서 선택 pill이 거의 보이지 않던 기존 감사의 Critical 항목을 해결했다. 아래 세 선택 상태에 `inset` border를 추가했다.

- `.home-primary-tab-list button.is-selected`
- `.home-explorer-tabs button.is-selected`
- `.monthly-workspace-tabs button[data-selected='true']`

사용 토큰: `--state-selected-border`

## 6. 검증 결과

Phase 9 변경 반영 후 실행 결과:

| 검증 | 결과 |
| --- | --- |
| `npx tsc --noEmit` | 통과 |
| `npm run lint` | 통과 |
| `npm test` | **39 files / 171 tests 모두 통과** |
| `npm run build` | Next.js 16.3.3 운영 빌드 성공, 전체 라우트 생성 완료 |
| `git diff --check` | 통과 (autocrlf 안내만 있음) |
| 전체 CSS 미정의 `var()` 검사 | 0개 |

## 7. Phase 10 실제 브라우저 QA 진행 상태

### 7.1 로컬 서버

- 기존 Next dev 서버가 PID 7808로 실행 중이었다.
- 주소: `http://localhost:3000`
- `/dashboard` HTTP 200 확인.
- 별도로 3001 서버를 띄우려 했으나 Next가 기존 3000 서버를 안내하고 종료했다. 기존 서버를 그대로 사용했다.

### 7.2 데스크톱 대시보드 — 1440 × 900

확인 결과:

- 좌측 LNB 240px, 메인 영역 약 1185px로 가로 공간은 정상 사용.
- 전체 문서 가로 오버플로 없음.
- 상단 3개 KPI와 4개 주 탭의 정렬 및 선택 상태 정상.
- 빈 예산 카드와 빈 차트 카드가 지나치게 높은 면적을 차지해, 사용 데이터가 적을 때 첫 화면의 정보 밀도가 낮다.
- 현재 화면은 사용자가 준 참고 이미지보다 카드 높이와 수직 여백이 크다. 이후 density 조정 시 공통 empty/chart/card 규칙으로 해결해야 하며 화면별 margin 땜질은 금지한다.

### 7.3 모바일 대시보드 — 375 × 812

확인 결과:

- 문서 자체 가로 스크롤은 없음(`scrollWidth 360`, viewport 콘텐츠 폭 기준).
- 월 선택 버튼 중 화면 밖에 있는 버튼은 의도된 내부 가로 스크롤 항목이며 문서 overflow는 아니다.
- 상단 `이번 달 수입/지출/잔액` StatCard가 **한 줄에 하나씩 3개** 쌓여 첫 화면을 과도하게 차지한다.
- 사용자가 준 참고 이미지처럼 모바일에서는 3개 핵심 KPI를 한 행에서 비교할 수 있도록 밀도를 높이는 편이 타당하다.
- 현재 `.tds-summary-grid { repeat(auto-fit, minmax(200px, 1fr)) }` 때문에 375px에서 1열이 된다.
- 권장 수정:
  - 모바일 전용 공통 규칙으로 `.tds-summary-grid`를 3열로 전환.
  - `.tds-summary-grid .tds-stat-card`의 padding/gap과 이 영역의 amount/label/meta typography를 함께 compact token으로 조정.
  - 금액·라벨은 줄바꿈/말줄임으로 정보를 숨기지 않도록 `clamp()` 기반 responsive type을 사용하고 실제 큰 금액 데이터로 재검증.
- 하단 LNB의 새 Lucide 아이콘은 화면에 정상 표시됐다. 설정 아이콘도 정상 톱니바퀴다.

### 7.4 모바일 월간관리 — 375 × 812

확인 결과:

- 문서 가로 오버플로 없음.
- 헤더 → 월 선택 → 월간 요약 → 수입·지출 관리/분석 탭 → 수입/지출 CTA → 거래 필터 순서가 명확하다.
- 월간 요약 4개 KPI는 2×2로 compact하게 배치되어 대시보드 상단 KPI보다 훨씬 효율적이다. 대시보드 모바일 KPI 정리 시 좋은 내부 기준이다.
- 화면 첫 viewport 기준 CTA와 검색 시작 지점까지 보이며, 이전 구조보다 정보 흐름은 양호하다.
- 거래 카드, 상태/성격 드롭다운, 예정거래 `[확정] [이번달 제외]`, 상세 드로어는 아직 아래로 스크롤하여 육안 검증하지 못했다. 다음 작업의 최우선이다.

## 8. 사용자 시각 품질 기준 해석

사용자가 제공한 참고 이미지에서 그대로 가져올 원칙:

1. 모바일 첫 화면은 핵심 숫자를 즉시 비교할 수 있어야 한다.
2. 카드 한 장이 불필요하게 한 화면을 점유하지 않도록 높은 정보 밀도를 유지한다.
3. 웹은 넓어진 메인 영역을 표·필터·요약 카드가 실제로 사용해야 한다.
4. 수입은 blue, 지출은 red, 자산 증가는 green처럼 의미 색을 일관되게 사용한다.
5. 모바일 LNB는 5개 이하, 중앙 추가 CTA, 동일 아이콘 패밀리를 유지한다.
6. 목록은 제목/보조정보/금액의 시각 위계와 한 행 정렬이 명확해야 한다.
7. 공통 token/component/media rule로 해결하며 화면별 임의 margin/padding 보정은 금지한다.

참고 이미지의 구체적인 숫자, 메뉴 구성, 밝은 배경, 카드 모양을 그대로 복사할 필요는 없다. 현재 `우리집 재무`의 데이터 모델과 기존 디자인 토큰을 우선한다.

## 9. 바로 이어서 할 작업 순서

1. **현재 미커밋 Phase 9 diff 코드 리뷰**
   - `InlineActionSelect`의 client/server boundary, action prop 직렬화, FormMessage/compact feedback을 확인.
   - `git diff --check`, tsc/lint/test/build가 이미 통과했지만 실제 상태 변경 1회 검증 필요.
2. **모바일 대시보드 KPI 공통 밀도 개선**
   - 375px, 390px, 430px에서 금액 최대 길이를 포함해 3열 비교 가능 여부 확인.
   - 한 화면별 땜질이 아니라 `.tds-summary-grid`/`.tds-stat-card` 공통 responsive rule로 구현.
3. **월간관리 실제 거래 영역 검증**
   - 거래 카드의 날짜/유형/대분류/소분류/내용/금액/결제수단/성격/상태 정렬.
   - 상태와 성격 select의 동일 높이/폭/폰트.
   - 예정 반복거래의 2개 버튼이 375px 카드에서 겹치거나 잘리지 않는지 확인.
   - 상세 내역 버튼 → 거래 상세 드로어 열기, 피커 및 필수 표시 확인.
4. **자산/금융 6개 화면 모바일 검증**
   - `/finance/accounts`
   - `/finance/savings`
   - `/finance/loans`
   - `/finance/insurances`
   - `/finance/assets`
   - `/finance/investments`
   - AssetItem 정렬, 금액 줄바꿈, CTA/드로어, 긴 이름을 실제 데이터로 확인.
5. **설정 주요 화면 모바일 검증**
   - `/settings`
   - `/settings/categories`
   - `/settings/payment-methods`
   - `/settings/recurring`
   - `/settings/goals`, `/settings/tasks`, `/settings/data`
   - 메뉴 진입, 목록/CTA 위계, 활성 상태 select, 카테고리 펼침 중첩, drawer/form 필수 표시 확인.
6. **반응형 폭 확대 검증**
   - 375, 390, 430, 768, 1024, 1440.
   - horizontal overflow, sticky/fixed UI 가림, touch target 44px 이상, 선택/hover/focus/disabled 확인.
7. **최종 정적 검증**
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm test`
   - `npm run build`
8. **커밋·푸시·운영 배포는 사용자 지시 후 진행**
   - 현재 사용자는 이번 메시지에서 인수인계 문서 작성만 요청했다.

## 10. 주의사항

- 기능/데이터 로직을 디자인 정리 명목으로 변경하지 않는다.
- 사용자 데이터가 있는 select/button을 브라우저에서 검증할 때 실제 변경을 발생시키는 클릭은 신중히 한다. 읽기/열기/레이아웃 검증을 우선한다.
- `.superpowers/`는 보존한다.
- 운영 배포는 아직 하지 않는다.
- `main`이 원격보다 12커밋 앞서 있으므로 푸시 전 커밋 목록과 배포 기준 SHA를 반드시 확인한다.
- Phase 8 concern이었던 `MonthlyDrawerForm` 필수 picker 미선택 시 제출 버튼 disabled 사유 안내도 시각 QA 때 확인한다.
- `CategoryPicker`는 uncontrolled, `PaymentMethodPicker`는 controlled라는 Phase 8의 의도적 차이가 있으므로 임의로 상태 모델을 합치지 않는다.

## 11. 현재 작업 상태 요약

- Phase 1–8: Claude 완료 및 기존 커밋 상태.
- Phase 9: Codex 구현 완료, 정적 검증 완료, **미커밋**.
- Phase 10: 대시보드(1440/375) 및 월간관리 상단(375) 실제 브라우저 확인까지 진행, 나머지 화면 미완료.
- 다음 담당자는 Phase 9 diff를 보존한 채 Phase 10의 모바일 거래 카드/드로어 검수부터 이어가면 된다.
