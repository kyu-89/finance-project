# Phase 1 — 제품 전면 재설계: Audit & 방향 (구현 전 승인용)

이 문서는 코드를 한 줄도 바꾸기 전에 검토받기 위한 문서다. 모든 데이터 구조(거래 유형/상태/정기거래/성격/계좌/자산 등)는 실제 `supabase/migrations/*.sql`과 `src/lib/*.ts`를 전수조사해서 확인한 것이며, 추측으로 만든 구조는 없다.

---

## 1. 현재 Design System 분석

**토큰 레이어는 이미 상당히 탄탄하다.** 이번 세션에서 `src/app/design-system.css`(852줄)에 spacing(4/8/12/16/20/24/32/40/48), radius, elevation(4단계), typography(8단계: display/title-1~3/body-1~2/caption/micro), 색상 semantic 토큰(`--state-selected-*`, `--chart-income/expense/wealth`)까지 정의해뒀다.

**진짜 문제는 토큰이 아니라 "이걸 강제하는 컴포넌트 레이어가 없다"는 것.** 토큰은 CSS 변수로만 존재하고, 이걸 소비하는 게 React 컴포넌트가 아니라 **각 페이지가 직접 짠 CSS 클래스**다. 그래서 토큰을 정의해도 페이지마다 다시 카드/배지/버튼을 손으로 만드는 걸 막지 못한다. 이번 재설계의 핵심은 CSS 토큰 위에 **실제 강제력을 가진 React 컴포넌트 레이어**를 얹는 것이다.

---

## 2. 현재 Component Architecture

`src/components/*.tsx`에 있는 전부(14개):

| 컴포넌트 | 용도 | 실사용처 |
|---|---|---|
| `Drawer.tsx`(`AddDrawer`) | 슬라이드오버 + 트리거 버튼 | 12개 파일 |
| `FormField.tsx` | 라벨+힌트 래퍼 (이번 세션에 전체 통일함) | 14개 파일 |
| `FormMessage.tsx` | ActionResult → Toast/에러 텍스트 | ~30개 파일, 가장 많이 재사용됨 |
| `ConfirmSubmitButton.tsx` | 파괴적 액션 확인 다이얼로그 | 4개 파일 (나머지 파괴적 액션은 확인 없이 실행 — 불일치) |
| `Toast.tsx` | 자동소멸 토스트 | `FormMessage` 통해서만 |
| `CategoryPicker.tsx` | 대분류→소분류 2단 칩 선택기 | `QuickAddForm.tsx` 단 1곳 |
| `StatusSelect.tsx` / `TransactionStatusEditor.tsx` / `RecurringRuleStatusSelect.tsx` | "숨김 id + select + onChange 자동제출" 패턴 3벌 | 각각 다른 화면 |
| `CurrencyInput.tsx` | 콤마 포맷 금액 입력 | **어디서도 안 씀 — 죽은 코드** |
| `ProductRecurringInfo.tsx`/`History.tsx` | 상품에 연결된 정기거래/변경이력 | 보험·대출·적금 3곳 |

**9개 화면(약 25개 라우트)에 대해 공유 컴포넌트가 14개뿐**이고, 그중 절반은 1~2곳에서만 쓰인다. Amount, Badge, ListItem, StatCard, SectionHeader, EmptyState — 이 앱에서 가장 많이 반복되는 6가지 패턴이 **단 하나도 컴포넌트로 존재하지 않는다.**

---

## 3. 중복 컴포넌트 / 중복 스타일 (실제 코드 기준, 전수조사 결과)

- **Kpi/통계 카드**: `finance/page.tsx`(Kpi,Mini), `InvestmentTradeManager`(Kpi), `LoanManagerDrawer`(Metric), `SavingsProductManager`(Metric), `reports/income`(Kpi), `DashboardAssetOverview`(HtmlKpi), `DashboardDebtOverview`(Kpi), `DashboardRiskOverview`(Kpi), `DashboardMonthlyDetail`(Kpi) — **11곳 독립 구현**, 전부 `<article><span/><strong/><small/></article>` 동형.
- **Field 라벨 래퍼**: `AccountCardManager`/`AssetManager`/`InsuranceManagerDrawer`/`LoanManagerDrawer`/`SavingsProductManager`/`InvestmentTradeManager` — **6곳**이 각자 로컬 `Field()`를 선언해 결국 `FormField`를 다시 감싸기만 함.
- **상태 배지(pill)**: `AccountCardManager`, `AssetManager`, `InsuranceManagerDrawer`(+ 별도 만기경고 노란pill), `LoanManagerDrawer`, `SavingsProductManager` — **5곳**이 `rounded-full bg-grey-100 px-2 py-1 text-xs`를 그대로 복붙. `payment-methods`/`CategoryEditor`는 또 다른(파란/회색) 배지를 독자적으로 만듦.
- **리스트 행(카드)**: `AccountRow`/`CardRow`/`AssetCard`/`InsuranceRow`/`LoanRow`/`DepositCard`/`SavingsCard`/`TradeRow` — **6개 파일에서 독립 구현**, 헤더+배지+금액+액션 구조가 동일한데 공유 안 함.
- **섹션 헤더**: `Section`/`Heading`/`SectionHeader`/`ProductHeader`(같은 파일 안에 헤더 헬퍼가 2개!) + 대시보드 곳곳의 인라인 `<h2><p>` — **6곳 이상**.
- **빈 상태(Empty)**: 파일마다 다른 마크업/카피 — 공유 `EmptyState` 없음.
- **인라인 상태 select(자동제출)**: `StatusSelect`/`TransactionStatusEditor`/`RecurringRuleStatusSelect` + `MonthlyInputTab.tsx` 내부에 export도 안 된 4번째 `CostBehaviorEditor` — **사실상 같은 컴포넌트를 4번 재발명**.
- **죽은 코드**: `CurrencyInput.tsx`(미사용), `DashboardPeriodFilters.tsx`/`MobileDashboardFilters.tsx`/`DashboardSpendingExplorer.tsx`/`DashboardIncomeExplorer.tsx`(전부 어디서도 import 안 됨), `recharts`(package.json에 있지만 실사용 0건 — 대시보드 차트는 전부 손으로 짠 CSS/SVG).
- `PaymentMethodForm.tsx`/`CategoryForm.tsx`는 로컬 래퍼 없이 `FormField`만 쓰는 **가장 깨끗한 예외** — 이게 나머지 9개 파일이 따라가야 할 기준.

---

## 4. 현재 UI/UX 문제점

1. **컴포넌트 레이어 부재**가 근본 원인 — 위 3번의 모든 중복은 "공유할 컴포넌트가 없어서" 생긴 결과다.
2. **차트가 전부 손으로 짠 CSS/SVG 막대·선**이다. `recharts`는 설치만 되고 안 쓰인다. "촌스럽다"는 지적이 정확히 이 지점.
3. **관리자 페이지들(계좌/카드/보험/대출/적금/투자)의 리스트 행이 Label:Value로 나열**되는 경우가 많다 — 정보 계층이 없다.
4. **파괴적 액션의 확인 UX가 불일치**: 4곳은 `ConfirmSubmitButton`으로 확인받고, 나머지는 그냥 실행됨.
5. **모바일 거래 카드는 이번 세션에 좌/우 분리 구조로 이미 재설계**했지만, 이건 CSS 클래스(`.tds-ledger-table`) 기반이지 재사용 가능한 React 컴포넌트가 아니다 — 다른 리스트(계좌/자산 등)에 그대로 못 씀.
6. **Dashboard가 4개 탭(자산/월별상세/부채/리스크)으로 나뉘어 있는데, 정작 "이번 달 요약"이 가장 먼저 보이지 않는다** — 탭을 열어야 수입/지출/잔액을 알 수 있음.

---

## 5. 새로운 Design Token 구조

기존 토큰(이미 있는 것)을 **버리지 않고 확장**한다.

**Typography** — 기존 8단(display/title-1~3/body-1~2/caption/micro)에 **Amount 전용 스케일**을 추가한다(금액은 일반 텍스트와 다른 체계로 관리):
```
--amount-large   34px / 700 / tabular-nums   → 대시보드 헤드라인, 상세 화면 잔액
--amount-medium  20px / 700 / tabular-nums   → 리스트 카드의 금액
--amount-small   15px / 700 / tabular-nums   → 인라인/보조 금액
```

**Semantic Color** — 이미 존재하는 `--chart-income`(blue)/`--chart-expense`(red)/`--chart-wealth`(green)를 역할명으로 재노출하고, 부족한 것만 추가:
```
--color-positive  = var(--chart-income)   (수입, 증가)
--color-negative  = var(--chart-expense)  (지출, 감소)
--color-asset     = var(--chart-wealth)   (자산)
--color-liability = var(--tds-red-600)    (부채) — 신규
--color-warning   = var(--tds-yellow-700) (만기 임박 등 경고) — 이미 tds-badge-warning에 있음, 재사용
```
`primary`/`text`/`text-secondary`/`background`/`surface`/`border`는 이미 `--tds-grey-900/700/500/50`, `--tds-white`, `--background` 등으로 존재 — 이름만 역할 기반 alias로 재노출.

Spacing/Radius/Elevation은 **기존 것을 그대로 사용**(4/8/12/16/20/24/32/40/48, 3단 radius, 4단 elevation) — 이미 원칙에 맞게 되어 있어 재작업 불필요.

---

## 6. 새로운 Component Hierarchy

기존 CSS 클래스(`tds-badge`, `tds-chip`, `tds-primary-button` 등)는 **버리지 않고 컴포넌트 내부 구현으로 재사용**한다 — CSS를 다시 쓰는 게 아니라 그 위에 React API를 씌운다.

**Primitive** (기존 CSS 클래스 → 새 컴포넌트로 승격)
```
Button        (variant: primary|secondary|ghost|danger)   ← 기존 tds-primary/secondary/ghost 클래스 재사용
IconButton    (신규)
Input / Select / SegmentedControl                          ← 기존 input/select CSS + tds 탭 CSS 재사용
Badge         (variant: neutral|positive|negative|warning|info) ← 기존 tds-badge-* 그대로
Chip          (selected: boolean)                          ← 기존 tds-chip 재사용
Amount        (value, type: income|expense|neutral, size: large|medium|small)  ← 신규, 최우선
Divider / Avatar / Icon / Progress / Skeleton               (신규)
EmptyState    (신규 — 6곳 이상의 중복 제거)
```

**Composite** (11곳+ 중복을 각각 흡수)
```
ListItem      (title, description, metadata, trailing, badge?)  ← AccountRow/CardRow/AssetCard/InsuranceRow/LoanRow/DepositCard/SavingsCard/TradeRow 6개 대체
StatCard      (label, value: Amount, meta?)                     ← Kpi/Metric 11개 대체
SectionHeader (title, description?, action?)                    ← Section/Heading/ProductHeader 등 6개 대체
TransactionItem (ListItem 기반, 정보계층 규칙 내장 — §11 참고)
ChartCard     (title, chart, legend?)                            ← recharts 기반
BudgetProgress (기존 home-budget-track CSS 재사용)
FilterBar / DateSelector (신규)
```

**Page Pattern**: `Page → Section → List → ListItem` (§27 원칙 그대로). Card는 "정말 독립된 정보 그룹"에만 쓴다 — nested card 제거 대상 1순위는 계좌/자산/보험/대출/적금 관리 화면들(현재 `tds-card` 안에 또 `tds-card` 행이 들어있는 구조).

---

## 7. Dashboard 정보 구조

`dashboard_home_summary` RPC(유일하게 홈에서 쓰는 서버 집계)가 이미 정확히 필요한 데이터를 반환한다: `monthly`(월별 수입/소비/고정·변동소비/저축/투자/원금/이자), `categories`(카테고리별 지출), `payments`(결제수단별 지출), `recent`(최근 거래 5건), `reviewCount`/`plannedCount`, `budgetTotal`/`budgetActual`. **새 API가 필요 없다 — 지금 데이터로 원하는 정보구조를 그대로 만들 수 있다.**

권장 순서 (탭 구조는 유지하되 각 탭 내부와 최상단 요약을 재배치):
```
1. 이번 달 요약 (수입 / 지출 / 잔액) — 지금은 탭 안에 숨어 있음, 최상단 고정으로 이동
2. 예산 vs 지출 (budgetTotal/budgetActual — 이미 계산됨)
3. 수입 vs 지출 추이 (monthly 12개월)
4. 카테고리별 지출 (categories)
5. 예정 거래 (plannedCount + recent 중 status=planned) — 지금은 alert strip 텍스트로만 존재, 실제 리스트로 승격
6. 최근 거래 (recent)
7. 자산 변화 — 현재 "자산" 탭에 있음, snapshot 트렌드(asset_value_history) 그대로 사용
```
부채/리스크(보험)는 별도 탭으로 유지 — 이번달 재무 판단에는 부가 정보라 §14의 "이번 달" 질문 흐름과 분리하는 게 맞다.

---

## 8. Chart Design 방향

**제안: `recharts`(이미 설치돼 있고 미사용) 도입.** 지금처럼 막대/선을 CSS `style={{width:'%'}}`로 손으로 계산하는 방식은 유지보수 비용이 크고 정확히 "장식적 차트"로 보이는 원인이다. `recharts`로 교체하면:
- 월별 지출 추이 → `LineChart`(단색 선, 그리드 최소화, 값 라벨은 hover에만)
- 카테고리별 지출 → `BarChart`(horizontal, 카테고리당 1색, 축 텍스트 최소화)
- 수입 vs 지출 → `BarChart` 그룹형, 색은 `--color-positive`/`--color-negative` 2색만
- 자산 변화 → `LineChart` 단일 라인
- 자산 구성비 → 지금처럼 stacked bar 유지(도넛은 "비중 이해에 실제 도움될 때만" 원칙에 따라 자산 3~4종 구성 정도에서만 검토)

모든 차트는 하나의 `ChartCard` 컴포넌트 + 공유 색상 팔레트(§5)로 감싼다. grid/axis/legend/animation은 최소화, 3D·gradient·rainbow 금지.

---

## 9. Transaction UX 구조

**실제 DB의 거래 유형은 9종**(사용자 브리핑의 예시 "급여/용돈" 등은 실제 시드 데이터와 다름 — 착오 방지를 위해 명시):
`income, expense, saving, investment, debt_principal, finance_cost, transfer, asset_adjustment, refund`

이 중 사용자가 거래 추가 화면에서 직접 고르는 건 실질적으로 **수입/지출**이 중심(나머지는 각 관리 화면·정기거래에서 자동/특수 생성). 카테고리는 **거래유형별로 완전히 분리**되어 있음(DB check 제약 `transaction_type in ('income','expense')`) — 수입 카테고리는 시드상 `수입` 1개 + 하위 9종(이월/급여/수당/상여/투자수익/이자/부수익/처분소득/기타), 지출 카테고리는 14개(식비/주거비/보험비 등, 사용자가 자유롭게 추가/수정 가능). **재설계 시 이 실제 카테고리를 그대로 쓴다.**

**거래 성격(성격=`cost_behavior`, 고정비/변동비)은 카테고리에 기본값이 세팅**돼 있고(예: 주거비→고정, 식비→변동) 거래별로 오버라이드 가능 — 사용자 브리핑의 "거래 유형≠거래 성격" 원칙이 DB 설계와 정확히 일치한다. 재정의 불필요, UI로 명확히 구분만 하면 됨.

**예정→확정/이번달제외**: 현재는 `TransactionStatusEditor`라는 select 드롭다운(예정/확정/이번 달 제외/취소) 하나로 앱 전체의 "인라인 상태변경" 관례를 따르고 있다. 사용자 브리핑은 명시적 **[확정] [이번달 제외] 버튼**을 원한다 — 이건 앱의 다른 모든 상태변경(select 자동제출)과는 다른 패턴이 된다. **제안**: `status='planned'`인 행에 한해서만 버튼 2개로 전환(확정·이번달제외는 이 상태에서만 의미있는 "결정이 필요한 순간"이므로 예외를 둘 만함), 그 외 상태(취소 등 드문 case)는 계속 select 유지. 이건 디자인 결정이라 승인 필요.

---

## 10. Asset UX 구조

계좌/예금/적금/대출/보험/기타자산 6개 테이블 모두 **잔액/현재가치를 직접 저장**하고(`current_balance`, `current_savings`, `current_value` 등 — 거래로부터 역산하지 않음) 사용자가 수동으로 갱신하는 구조다. 전부 `updated_at`이 있어 "마지막 업데이트" 표시가 항상 가능하다. **자산 카드에 필요한 것**: 현재 잔액(Amount-large) + 마지막 업데이트일 + [잔액 수정] 액션 — 6개 상품 타입이 전부 이 패턴을 공유할 수 있다(`AssetItem` 컴포넌트 1개로 통일).

---

## 11. Settings ↔ Transaction 데이터 연결 구조

이미 DB 레벨에서 정확히 사용자 브리핑대로 연결되어 있다: `payment_methods`(Settings에서 등록) → `transactions.payment_method_id`(거래 등록 시 select) / `categories`+`subcategories`(Settings에서 관리) → 거래 등록의 대분류/소분류 선택. **새로 만들 구조가 아니라 지금 각 화면이 따로 구현한 select/chip을 하나의 `EntitySelect`류 컴포넌트로 통일하는 문제**다.

---

## 12. 정기거래 → 예정거래 → 확정/이번달제외 Flow (실제 메커니즘, 정확 확인됨)

```
recurring_rules (매월 N일 = day_of_month, status: active/paused/ended)
        │  materializeRecurringRulesForRange()
        ▼
transactions.status = 'planned'  ← "예정 거래"
        │
        ├── 확정 → status = 'posted'  (TransactionStatusEditor select)
        │
        └── 이번달 제외 → recurring_rule_pauses 테이블에 (rule_id, start_date, end_date) 행 추가
                          + 해당 기간의 planned 거래를 status='skipped'로 일괄 변경
                          (add_recurring_pause_period RPC, 정기거래 규칙 자체는 안 건드림)
```
사용자 브리핑의 "8월 제외 → 9월엔 다시 생성" 요구사항과 **정확히 일치**하는 구조가 이미 구현돼 있다(날짜 범위 테이블 방식이라 특정 월만 배제 가능). 재설계는 UI(버튼화, §9)만 해당하고 백엔드 로직은 그대로 둔다.

---

## 13. 전체 개편 Rollout Plan

사용자 브리핑의 Phase 2~10을 그대로 채택하되, 규모가 매우 크므로(전체 스크린 25개+, 신규 컴포넌트 15개+) **여러 세션에 걸쳐 단계별로 진행**할 것을 제안한다. 각 Phase는 이전 세션들처럼 subagent-driven-development로 실행 가능하다.

```
Phase 2  Design Tokens 확장        (§5) — 작음, 1세션 내 완료 가능
Phase 3  Primitive Components      (§6 상단) — Amount/Badge/ListItem 우선
Phase 4  Composite Components      (§6 하단) — StatCard/SectionHeader/EmptyState
Phase 5  Dashboard 전면 개편       (§7~8) — recharts 도입 포함, 규모 큼
Phase 6  Transaction (리스트/등록/수정) — §9~12 반영
Phase 7  Asset (계좌/투자/대출/보험/기타자산) — §10, 6개 화면을 AssetItem으로 통일
Phase 8  Settings                  — §11 연결 구조 반영
Phase 9  Legacy Cleanup            — 죽은 코드 제거(CurrencyInput, DashboardPeriodFilters 등 4개), 3중 status-select 통합
Phase 10 QA                        — 모바일 기준 전 화면 검수
```

**Phase 3~4가 선행되지 않으면 Phase 5~8은 또 "페이지마다 새로 만들기"가 재발한다** — 반드시 이 순서를 지킨다.

---

## 14. Icon Design System (사용자 추가 지시, §37-38 원문 반영)

아이콘은 페이지마다 임의로 고르지 않는다. **Outline / Monoline 하나의 스타일, 하나의 라이브러리**만 쓴다. Emoji, filled/outline 혼용, 3D, 컬러 아이콘 남발, 아이콘+원형배경(circle+color+icon) 남발을 금지한다. 거래 리스트에서 카테고리마다 다른 색 아이콘을 붙이는 "가계부 앱" 패턴은 명시적으로 금지.

**현재 상태 확인**: 아이콘 라이브러리 미설치(`package.json`에 lucide/heroicons/react-icons 등 없음). `MobileBottomNav.tsx`의 `NavIcon`만 인라인 SVG로 손으로 그려져 있음(다행히 stroke/size는 이미 일관적).

**결정**: `lucide-react`를 앱 전체의 유일한 아이콘 라이브러리로 채택한다(사용자 예시와 일치, outline/monoline, tree-shakeable). Phase 3 완료 직후 설치하고 `design-system.css`에 아이콘 크기 토큰을 추가한다:
```
--icon-xs: 14px;  --icon-sm: 16px;  --icon-md: 20px;  --icon-lg: 24px;  --icon-xl: 32px;
```
기본 UI는 16~20px, 내비게이션/주요 액션은 20~24px. 색상은 `icon-primary/secondary/muted/disabled` + 필요시에만 semantic color(income/expense/warning) — 아이콘마다 다른 색 금지.

**적용 원칙(요약)**: 아이콘은 장식이 아니라 명확화 수단이다. 리스트 전 항목에 아이콘을 붙이지 않는다. 거래 상태(예정/확정/제외)는 아이콘이 아니라 텍스트로 전달한다. 수입/지출은 아이콘(↑↓)이 아니라 `Amount`의 색상/부호로 전달한다(§5 정확히 일치). 정보 위계는 항상 `금액 > 거래내용 > 주요정보 > 보조정보 > 아이콘` 순.

**Icon Audit(향후 각 Phase 진행 시 확인)**: 라이브러리 혼용, filled/outline 혼용, stroke width 불일치, 과도한 크기, emoji, circle+color 남발, 네비게이션 아이콘 불일치 여부를 화면별로 점검하고 새 시스템으로 교체한다.

## 15. 일러스트레이션 원칙 (사용자 추가 지시)

> Decorative illustration should not be used unless it has a clear UX purpose. This is a financial product, not a lifestyle/entertainment app. Prefer typography, whitespace, data visualization, and subtle visual hierarchy over decorative graphics.

빈 상태(`EmptyState`, Phase 3에서 이미 아이콘 없는 텍스트 전용으로 구현함)나 자산 화면 등에 장식용 일러스트를 넣지 않는다 — 이미 Phase 3 구현이 이 원칙을 따르고 있음, 앞으로도 유지.

## 16. 모바일/웹 화면 레퍼런스 (사용자 첨부 이미지, 2026-09-02)

사용자가 첨부한 목업(모바일 7화면 + 웹 4화면)을 Phase 5~8의 구체적 시각 레퍼런스로 채택한다. 확인된 핵심 패턴, 이미 이 문서의 결정과 대조:

- 거래 행: 아이콘(제한적) + 제목 + 서브라벨, 우측 `Amount`(수입 파랑/지출 빨강), 하단에 상태·성격 `Badge` — §6의 `ListItem`+`Amount`+`Badge` 조합으로 정확히 구현 가능, 추가 설계 불필요.
- 정기거래 관리 화면의 예정 거래 행에 **[확정][이번달 제외] 버튼**이 실제로 쓰임 — §9에서 제안한 "planned 상태에 한해 select 대신 버튼 예외"를 이 레퍼런스로 확정한다.
- 대시보드 정보 순서(이번 달 요약 3칸 → 예산 대비 지출 바 → 카테고리별 지출 Top5 가로막대 → 최근 거래)가 §7의 우선순위와 일치. 웹은 여기에 수입/지출 추이 라인차트 + 카테고리 도넛을 우측 컬럼에 추가.
- 자산 요약: 순자산 헤드라인 카드 + 도넛(구성비) + 부채 리스트 + 최근 자산변동 — §10과 일치.
- 하단 내비게이션 5개 항목(홈/거래/+/자산/설정) — 현재 `MobileBottomNav.tsx`의 5항목(홈/입력/추가/자산/설정)과 거의 동일, "입력"→"거래", "추가"→"+"(라벨 없이 아이콘만) 정도의 라벨 조정만 필요.

---

## 승인 요청

이 문서 통과 후 **Phase 2(Design Tokens 확장)부터 시작**한다. §9의 "예정거래 버튼화(select 관례의 예외)" 는 명시적 승인이 필요한 디자인 결정이라 별도 표시했다.
