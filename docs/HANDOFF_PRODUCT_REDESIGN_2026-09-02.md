# 제품 전면 재설계 — 인수인계 (2026-09-02, Claude → Codex)

이 문서는 토큰 소진으로 세션을 넘길 때 Codex가 바로 이어받을 수 있도록 정리한 것이다. 순서대로 읽으면 지금 상태를 그대로 재구성할 수 있다.

## 0. 한 줄 요약

**Phase 1(감사) ~ Phase 8(설정↔거래 연결) 완료, 전부 `main`에 직접 커밋됨(브랜치 분리 없음).** Phase 9(Legacy Cleanup)는 조사만 마쳤고 구현은 시작 전. Phase 10(QA)은 손도 안 댐. **다음에 할 일은 아래 6절.**

이 재설계는 사용자가 준 매우 상세한 §0~§38 한국어 스펙(“Senior Product Designer + Design System Architect + Frontend Engineer 역할 수행”)을 `docs/superpowers/specs/2026-09-02-product-redesign-phase1-audit.md`에 Phase 1 감사 문서로 정리하고, 사용자 승인 후 Phase 2부터 Phase별로 subagent를 dispatch하며 진행한 것이다. **이전에 있었던 "웹 디자인 시스템 통일" 작업(`docs/HANDOFF_DESIGN_SYSTEM_2026-09-02.md`)과는 다른, 그보다 훨씬 큰 범위의 후속 작업**이다 — 그 작업은 이미 `main`에 머지되어 있고, 그 작업의 미해결 리뷰 findings는 아래 5.3절에서 이번 재설계와의 관계를 정리했다.

## 1. 문서 위치

- **권위 있는 스펙(Phase 1 감사 + §14~16 추가분)**: `docs/superpowers/specs/2026-09-02-product-redesign-phase1-audit.md` — §1~13이 원본 감사, §14(아이콘 시스템)/§15(일러스트레이션 원칙)/§16(모바일·웹 화면 레퍼런스)은 사용자가 나중에 추가 지시한 내용을 그대로 반영한 것. **새 코드를 쓰기 전에 관련 섹션을 반드시 먼저 읽을 것.**
- **Phase별 구현 브리프/리포트** (`main`에는 커밋 안 됨, `.gitignore` 대상 아니지만 그냥 한 번도 add 안 한 상태로 디스크에 남아있음 — 삭제하지 말 것): `.superpowers/phase{2..8}-*-brief.md` / `.superpowers/phase{2..8}-*-report.md`. 각 Phase의 정확한 요구사항(브리프)과 담당 subagent가 실제로 무엇을 했고 어떤 판단을 내렸는지(리포트)가 여기 다 있다. **이 세션의 "원장(ledger)"에 해당하는 파일들이다.**
- **이전 작업의 인수인계 문서(참고용, 이미 완료된 작업)**: `docs/HANDOFF_DESIGN_SYSTEM_2026-09-02.md` — 5.3절 참고.

## 2. 작업 방식 (Codex도 이어서 이 패턴을 따를 것)

이번 세션은 `subagent-driven-development` 스킬의 정식 ledger 워크플로 대신, 더 가벼운 자체 패턴을 썼다 — Phase가 8개나 되고 각각 성격이 달라서 매번 별도 계획 문서를 만드는 대신:

1. 컨트롤러(나)가 해당 Phase의 audit 섹션(§N)과 **관련된 실제 코드 파일들을 전부 직접 Read**해서 진짜 중복/문제를 확인.
2. 정확한 파일 경로·기존 함수 시그니처·유지해야 할 동작을 명시한 `.superpowers/phaseN-*-brief.md`를 작성.
3. `Agent` 도구로 subagent 1개를 dispatch(모델은 판단 난이도에 따라 `opus`(디자인 판단 필요) 또는 `sonnet`(브리프가 명확한 경우)). 브리프에 "먼저 실제 파일을 읽고 시작할 것", "범위 밖 파일 건드리지 말 것", "판단이 필요하면 스스로 결정하고 근거를 리포트에 기록할 것"을 항상 명시.
4. subagent 완료 알림 오면: `git show --stat <sha>`로 커밋 스코프 확인 → 실제 diff를 `git show <sha> -- <path>`로 직접 읽고 검증 → 필요하면 컨트롤러가 직접 소규모 수정(예: Phase 5 후 라벨 버그 수정, 기본 탭 변경 — 각 1~2줄, 별도 커밋)  → `npx tsc --noEmit` 직접 재확인.
5. 문제 있으면 그 자리에서 직접 고치거나(작은 것) 재dispatch(큰 것) — 이번 세션에서는 전부 1회 dispatch + 컨트롤러 직접 검증/소규모 수정으로 끝났고, 재dispatch가 필요했던 Phase는 없었다.

**중요**: 각 Phase는 `main`에 직접 커밋됐다(별도 브랜치나 worktree 없음) — Phase 4~8 사이에 컨트롤러가 이미 완료된 이전 Phase의 커밋 위에 다음 Phase를 순서대로 쌓은 것. **Phase 9를 시작하기 전에 반드시 `git log --oneline -15`로 지금 HEAD가 Phase 8 커밋(`44a1919`)인지 확인할 것.**

## 3. 완료된 Phase (커밋 순서대로)

| Phase | 커밋 | 내용 |
|---|---|---|
| 1 | `86df227`, `d3c1505` | Phase 1 감사 문서 작성(§1~13) + §14~16 추가(아이콘/일러스트/레퍼런스) |
| 2 | `a8bdaf6` | Design Token 확장: `--amount-large/medium/small`, `--color-positive/negative/asset/liability/warning/primary/text/text-secondary/background/surface/border/disabled` (기존 토큰의 semantic alias, 신규 primitive 없음) |
| — | `24c4741` | `lucide-react` 설치 + `--icon-xs/sm/md/lg/xl`(14/16/20/24/32px) 토큰 추가. **주의: 설치만 했고 실제로 아이콘을 쓰는 화면은 아직 없다 — §14의 "Icon Audit"(라이브러리 혼용/필드 아이콘 오남용 점검)는 미착수.** |
| 3 | `7163d96` | Primitive 컴포넌트: `src/components/{Amount,Badge,Chip,Button,EmptyState,Divider}.tsx` 신설. 정확한 props는 4절 참고. |
| 4 | `e4d0cae` | Composite 컴포넌트: `src/components/{StatCard,SectionHeader,ListItem}.tsx` 신설. |
| 5 | `cfea940`, `a66560d` | 대시보드 전면 개편: `recharts` 최초 도입(손으로 계산하던 CSS/SVG 차트 전부 교체), §7 정보 순서 재배치(이번 달 요약 3칸 최상단 고정 → 예산 바 → 수입/지출 추이 → 카테고리별 지출 → 예정 거래 → 최근 거래 → 드릴다운), 신규 `src/components/ChartCard.tsx`. `a66560d`는 컨트롤러가 리뷰 중 발견해서 직접 고친 2건(자산 변동 차트 라벨이 실제 데이터와 안 맞던 기존 버그 수정, 탭 기본값을 `asset`→`monthly`로 변경해 §7 순서가 첫 화면에 보이도록). |
| 6 | `bb10b99` | Transaction UX: `status='planned'`이고 `recurringRuleId`가 있는 행에 한해 상태 select 대신 [확정]/[이번달 제외] 버튼 2개(`TransactionStatusEditor.tsx`). `TransactionDetailDrawer.tsx`의 버튼들을 `Button` 컴포넌트로 교체. |
| 7 | `518368e` | Asset UX: 계좌/예금/적금/대출/보험/기타자산 6개 카드가 공유하는 셸 컴포넌트 `src/components/AssetItem.tsx`(+ `AssetMetric`) 신설, 6개 화면 전부 적용. 카드는 정보 축소 없이 슬롯(banner/metrics/detail)으로 상품별 고유 정보(대출 상환표, 보험 만기 배지, 예적금 이자 계산) 그대로 유지. |
| 8 | `44a1919` | Settings↔Transaction 연결: `src/components/PaymentMethodPicker.tsx` 신설(`CategoryPicker.tsx`의 자매 컴포넌트, 칩 UI). `QuickAddForm`/`MonthlyDrawerForm`/`TransactionDetailDrawer` 3곳의 제각각이던 select/칩을 `CategoryPicker`+`PaymentMethodPicker`로 통일. **부수 효과로 기존 버그 하나 수정됨**: `TransactionDetailDrawer`의 옛 `<select defaultValue>`가 비활성화된 카테고리/결제수단을 만나면 브라우저가 조용히 첫 옵션(미분류/미지정)으로 떨어뜨려 분류가 리셋되는 데이터 손실 버그가 있었음 — 새 피커는 "현재 선택된 값이 비활성이어도 칩으로 계속 노출"해서 이 문제를 막는다. |

**모든 Phase가 `npx tsc --noEmit` 클린, `npm run lint` 클린, `npm run build` 성공(31개 라우트), `npm test`(39 files/171 tests) 통과를 개별 확인했다.** 브라우저 실물 확인은 전 Phase에서 불가능했다(Supabase 인증 + Basic Auth 게이트, 이 세션에 로그인 자격증명 없음) — **Codex가 로그인 가능한 환경이 있다면 반드시 실제 화면을 한 번 훑어볼 것**, 특히 Phase 5의 recharts 차트 렌더링과 Phase 6의 모바일 카드 안 버튼 2개 레이아웃.

## 4. 지금까지 만들어진 컴포넌트 인벤토리 (재구현 금지, 전부 `src/components/`)

| 컴포넌트 | 핵심 props | 비고 |
|---|---|---|
| `Amount` | `value, type='income'\|'expense'\|'neutral', size='large'\|'medium'\|'small', showSign, className` | 모든 금액 렌더링은 이걸 거쳐야 함. `type`에 `liability`가 없어서 Phase 7은 대출 잔액에 `type="expense"`(빨강)를 썼다 — 의도된 판단, `--color-liability` 토큰은 있지만 아직 `Amount`가 노출 안 함. |
| `Badge` | `children, variant='neutral'\|'info'\|'positive'\|'negative'\|'warning', className` | 상태 pill 전용. |
| `Chip` | `children, selected, onClick, type, className` | `'use client'`. |
| `Button` | `children, variant='primary'\|'secondary'\|'ghost'\|'danger', type, onClick, disabled, className, ...rest` | `...rest`가 네이티브 `<button>`에 전달되므로 `formAction`/`name`/`value` 등도 그대로 씀. |
| `EmptyState` | `title, description, action, className` | 아이콘/일러스트 없음(§15 원칙). |
| `Divider` | `className` | |
| `StatCard` | `label, value, meta, tone, className` | |
| `SectionHeader` | `title, description, action, className` | |
| `ListItem` | `title, description, metadata, badge, trailing, onClick, className` | **자체 카드 테두리/그림자 없음** — 반드시 `.tds-card`/`.tds-section-card` 등 안에서만 쓸 것. |
| `ChartCard` | `title, description?, action?, children, className` + 같은 파일의 `ChartTooltip`/`compactAxisValue` | recharts 차트 공용 래퍼. 차트 색은 recharts props가 아니라 CSS(`.tds-chart-series-*`)로 지정 — SVG presentation attribute는 specificity 0이라 스타일시트가 항상 이긴다는 이유. |
| `AssetItem` (+`AssetMetric`) | `title, subtitle, headingLevel, statusBadge, banner, meta, primaryLabel, primaryValue, primaryNote, metrics, footnote, detail, actions, dimmed, className` | 계좌/예금/적금/대출/보험/기타자산 6개 카드 셸. **카드(신용/체크)와 투자(거래 역산값)는 의도적으로 이 컴포넌트를 안 쓴다** — §10이 명시적으로 제외. |
| `CategoryPicker` | `categories, recentCategoryIds?, recentSubcategoryIdsByCategory?, initialCategoryId?, initialSubcategoryId?, allowClearCategory?, allowClearSubcategory?, onSelect` | 칩 UI, `initialXxxId`는 uncontrolled(useState 초기값 1회 read) — 다른 항목으로 바뀌면 호출부가 `key`를 바꿔 remount시켜야 함(`TransactionDetailDrawer.tsx`가 실제 예시). |
| `PaymentMethodPicker` | `paymentMethods, selectedId, onSelect, allowClear` | `CategoryPicker`와 달리 **controlled**(내부 state 없음) — 두 컴포넌트의 상태 모델이 다르다는 게 Phase 8 리포트에 기록된 판단 사항 중 하나, 후속 통일 후보. |

디자인 토큰: `src/app/design-system.css` 최상단 `:root`에 전부 있음. `--tds-*`(primitive) → `--text-*`/`--color-*`/`--amount-*`/`--icon-*`/`--ui-*`/`--chart-*`(semantic) 순서로 참고할 것. **`globals.css`가 먼저 로드되고 `design-system.css`가 나중에 로드된다(같은 이름 있으면 후자가 이긴다)** — 이전 핸드오프 문서(3.2절)에 이미 자세히 적혀있음, 여전히 유효.

## 5. Phase 9 — Legacy Cleanup (조사 완료, 구현 미착수)

세션이 중단된 시점의 정확한 상태다. 아래를 그대로 이어받으면 된다.

### 5.1 죽은 파일 5개 — 삭제만 하면 됨(확인 완료, 안전)

아래 5개 파일은 자기 자신 외에는 프로젝트 어디에서도 import/참조되지 않음(파일 경로 grep + export 이름 grep 둘 다로 확인됨):

```
src/components/CurrencyInput.tsx
src/app/(app)/dashboard/DashboardPeriodFilters.tsx
src/app/(app)/dashboard/MobileDashboardFilters.tsx
src/app/(app)/dashboard/DashboardSpendingExplorer.tsx
src/app/(app)/dashboard/DashboardIncomeExplorer.tsx
```

삭제 후 `npx tsc --noEmit`으로 끊어진 import 없는지 재확인할 것.

**추가로 확인이 필요한 죽은 CSS**: Phase 5 구현 리포트(`.superpowers/phase5-dashboard-report.md`)가 "Phase 5에서 `DashboardCashflowOverview`/`DashboardNetWorthLineChart`를 recharts로 갈아끼우면서 `globals.css`의 `.home-cashflow-*`/`.home-networth-line-*`/`.home-html-flow-detail { order: -1 }` 규칙이 이제 죽은 코드가 됐다"고 명시적으로 남겨뒀다 — 삭제 전에 각 셀렉터를 `grep -rn`으로 재확인(실제 JSX에서 클래스명이 안 쓰이는지)하고 지울 것.

### 5.2 중복 inline-select 4벌 — 조사만 완료, 통합 미착수

아래 4개 파일이 전부 "hidden id input + sr-only label + `onChange`에서 `requestSubmit()` 자동 제출 + `FormMessage`" 골격을 거의 동일하게 재구현하고 있다:

- `src/components/StatusSelect.tsx` — 이미 일반화 시도된 흔적이 있지만 `isActive`(활성/비활성)에 하드코딩됨. **실제 사용처가 있는지 먼저 확인할 것**(이 세션에서 사용처를 못 찾았다 — 죽은 파일일 수도 있음, 5.1의 5개 목록에 없었던 건 시간이 없어 확인을 못 했기 때문이지 "사용 중"이 확인돼서가 아니다).
- `src/components/TransactionStatusEditor.tsx` — Phase 6에서 `planned` + `recurringRuleId` 있는 행은 버튼 2개로 분기(그대로 유지해야 함), 그 외는 여전히 select.
- `src/app/(app)/monthly/MonthlyInputTab.tsx`의 로컬 `CostBehaviorEditor` 함수(파일 상단) — `costBehavior`(고정비/변동비) select.
- `src/app/(app)/settings/recurring/RecurringRuleStatusSelect.tsx` — `status`(active/paused/ended) select, `status === 'ended'`일 때 disabled인 특수 조건 있음.

**제안(미승인, Codex가 판단)**: `StatusSelect`를 제네릭하게 만들어(`options: {value, label}[]`, `name`, `disabled` prop 추가) 나머지 3곳이 그 위에 얇게 얹히도록 리팩터링. `TransactionStatusEditor`의 버튼-분기 로직(Phase 6)은 그대로 유지하고 select인 분기만 제네릭 컴포넌트로 교체.

### 5.3 이전 웹 디자인 시스템 작업의 미해결 리뷰 findings — 이번 Phase에 포함할지 재확인 필요

`docs/HANDOFF_DESIGN_SYSTEM_2026-09-02.md`(이전 세션, 이미 `main`에 머지된 작업)의 5.1절에 **Critical 1건 + Important 7건**이 "머지 전에 고칠 것"으로 남아있었다. 그 문서가 쓰인 뒤 `250d860`(테이블/인라인 상태 컨트롤 통일)과 `bc1d91d`(웹 디자인 시스템 통합) 커밋이 추가로 있었는데, **이 두 커밋이 그 findings를 실제로 고쳤는지 이번 세션에서 검증하지 못했다.** 딱 하나만 빠르게 grep해본 결과, Important #1(`--tds-red-400`, `--tds-grey-600`, `--tds-grey-800` 미정의 토큰)은 **여전히 미정의 상태로 확인됨**(`globals.css:642`가 여전히 `var(--tds-red-400)`를 씀, 정의는 어디에도 없음) — 즉 최소 1건은 여전히 살아있는 버그다.

**컨트롤러(나)의 판단**: 이 findings는 "Legacy Cleanup"이라는 이름과 성격이 맞아서 Phase 9에 흡수하는 게 자연스럽다고 잠정 결론 냈지만, **사용자에게 명시적으로 확인받지 않았다** — Codex는 Phase 9 착수 전에 이 문서 5.1절 전체(Critical 1 + Important 7 + 격상된 Minor 1)를 다시 읽고, 지금 `main` 기준으로 몇 건이 실제로 남아있는지 재조사한 뒤, (a) 이번 Phase 9에 합쳐서 처리할지 (b) 별도로 사용자에게 물어볼지 판단할 것. 최소한 위에서 확인된 Important #1(미정의 색 토큰 3개)은 Phase 9 범위에 넣는 걸 권장한다 — 이미 재발 확인된 실제 버그이기 때문.

### 5.4 아이콘 감사(§14 Icon Audit) — 미착수

`lucide-react`는 설치됐고 토큰도 있지만, **실제로 아이콘을 쓰는 화면이 하나도 없다.** `src/components/nav/MobileBottomNav.tsx`의 `NavIcon`(수작업 inline SVG)이 유일한 기존 아이콘 사용처이고 Phase 5~8 어디서도 손대지 않았다. §14가 요구하는 "라이브러리 혼용/filled·outline 혼용/stroke 불일치/이모지/circle+color 남발 점검"은 애초에 아이콘을 쓰는 곳이 거의 없어서 지금은 감사할 대상이 적다 — Phase 9 또는 Phase 10에서 `MobileBottomNav`를 lucide 아이콘으로 교체할지(그러면 손으로 그린 SVG 4개 제거 가능) 판단이 필요하다. **이건 이번 세션이 명시적으로 미룬 것이지 빠뜨린 게 아니다** — Phase 5~8이 아이콘을 새로 요구하지 않았기 때문에 자연스럽게 뒤로 밀렸다.

## 6. Codex가 할 일 (순서대로)

1. `git log --oneline -5`로 HEAD가 `44a1919`(Phase 8)인지 확인.
2. `.superpowers/phase{5,6,7,8}-*-report.md`를 훑어서 각 Phase가 남긴 "판단 필요/후속 후보" 메모를 다시 확인(이 문서가 요약은 했지만 원문이 더 상세함).
3. Phase 9 진행:
   - 5.1의 죽은 파일 5개 + 죽은 CSS 삭제(간단, 컨트롤러가 직접 해도 됨 — subagent 불필요할 정도로 기계적).
   - 5.2의 inline-select 4벌 통합(브리프 작성 후 subagent 1개 dispatch 권장, Phase 6/8과 같은 패턴).
   - 5.3의 이전 findings 재조사 후 처리 여부 결정.
   - 5.4의 아이콘 감사는 범위에 넣을지 판단(작아서 Phase 10과 합쳐도 됨).
   - 매 변경 후 `npx tsc --noEmit` / `npm run lint` / `npm run build` / `npm test` 확인, `git status --short`로 스코프 확인 후 커밋.
4. Phase 10 — QA: 모바일 뷰포트(375px) 기준으로 전 화면 훑어보기(로그인 가능하면 실물, 안 되면 최소 코드 리뷰로 §16 레퍼런스와의 정합성 확인). 이번 재설계로 손댄 화면(대시보드/월간관리/자산 6종/거래 폼)을 우선순위로.
5. 전부 끝나면 사용자에게 전체 요약 보고 — 이 재설계는 브랜치 분리 없이 `main`에 직접 쌓였으므로 별도 머지 단계는 없다. 배포(Vercel)는 이전 세션에서 이미 프로덕션 배포 절차를 밟은 적이 있으니(`docs/HANDOFF_DESIGN_SYSTEM_2026-09-02.md` 이전 맥락), 이번 재설계도 사용자가 배포를 요청하면 같은 절차(Supabase 마이그레이션 확인 → Vercel preview → 사용자 확인 → production)를 따를 것 — **사용자 명시적 승인 없이 먼저 배포하지 말 것.**

## 7. 검증 명령 모음

```bash
cd "/c/Users/미니쉬테크놀로지-김규남/Desktop/dev/personal-finance"
git branch --show-current   # main 이어야 함
git log --oneline -5        # 최신이 44a1919(Phase 8)이어야 함
npx tsc --noEmit
npm run lint
npm run build
npm test
```

## 8. 이 문서 자체에 대해

사용자가 세션 도중 "하던거 멈추고 코덱스가 바로 이어서 작업할 수 있게 인수인계 문서 남겨"라고 명시적으로 요청해서 작성됨 (Phase 9 조사 도중 중단). 인수인계용이며 최종 사용자 문서가 아니다 — Phase 9~10이 끝나면 삭제하거나 요약만 남겨도 된다.
