# 작업 인수인계 (Claude → Codex)

작성일: 2026-09-04. 이 문서는 Claude Code 세션에서 진행한 작업을 다른 에이전트(Codex)가
이어받기 위한 인수인계 문서다. 아래 내용은 전부 실제로 완료되어 `main`에 푸시된 상태이며,
"진행 중/미완료"로 표시된 항목만 남은 작업이다.

## 0. 반드시 먼저 읽을 것 — 이 프로젝트의 절대 규칙

- **실 서비스, 실 가계 데이터다. 테스트 데이터 없음.** 가계 `household_id =
  558ae2c6-79b3-43db-9809-ee55d5dd24f2` 하나만 존재하는 개인용 배포다. DB에 손대는 작업은
  전부 실제 사용자의 돈 데이터를 건드리는 것이라고 생각하고 접근할 것.
- **스키마/데이터 변경은 반드시 새 마이그레이션 파일로.** 기존 `supabase/migrations/*.sql`
  파일을 절대 수정하지 않는다. 새 타임스탬프 파일을 만들고(파일명은 반드시 `ls supabase/migrations
  | tail`로 확인한 최신 파일보다 뒤 시각으로 — 실제 달력 날짜가 아니라 기존 파일들과의 정렬
  순서가 기준이다), `npx supabase db push --linked`로 적용한다.
- **데이터 변경 전후 반드시 직접 검증.** `npx supabase db query --linked "<한 줄 SQL>"`로
  건수/합계를 적용 전·후 비교해서 실제로 의도대로 바뀌었는지 확인한다. SQL은 항상 한 줄로
  작성한다(heredoc 금지 — 이 CLI에서 멀티라인이 깨진다). 여러 SELECT를 한 번에 보내면 마지막
  문장의 결과만 반환되니 각각 따로 실행할 것.
- **커밋 전 항상 전체 검증 통과.** 순서: `npx tsc --noEmit` → `npx eslint <변경된 파일들>`
  (전체 대상 아님, 변경 파일만) → `npx vitest run tests/unit` → `npx vitest run tests/integration`
  → `npm run build`. 전부 통과해야 커밋한다.
- **git push가 자동 분류기에 막힐 수 있다.** 직접 `git push`가 거부되면 사용자에게
  `! git push origin main`으로 직접 실행해달라고 요청한다(이 세션 중 여러 번 발생했었음).
- **커밋 시 스테이징 주의.** 저장소 루트에 사용자가 의도적으로 커밋하지 않은 파일들이
  있다: `ChatGPT Image *.png` 2개, `docs/*.md` 4개(Excel 마이그레이션/Supabase 공유 기능/
  백로그 분석/PWA 관련 — 전부 사용자가 직접 만든 메모, 이 세션 작업과 무관). `git add`는 항상
  이번에 실제로 건드린 파일만 명시적으로 지정해서 스테이징한다(`git add .` 금지).
- **디자인 변경은 공통 규칙(design-system.css/globals.css의 토큰·클래스)을 먼저 찾아 따르고,
  없으면 공통 규칙을 추가**해서 반영한다(사용자가 여러 번 강조한 규칙). 화면마다 임의로 다른
  스타일을 만들지 않는다.
- **Vercel 자동 배포**: `main` 푸시 후 1~2분 내 `personal-myhome.vercel.app`(Basic Auth로
  보호됨, 로그인 시스템 없음)에 반영된다.

## 1. 이번 세션에서 완료한 작업 (커밋 순서대로)

### 1-1. `거래 구분`(income_group/expense_group) UX 통일 — 커밋 `d10386a`
- **배경**: `income_group`('fixed'|'additional', 유저가 직접 고름, DB 컬럼)과
  `expense_group`('savings'|'consumption', DB 트리거가 category_id로 자동 결정 — 유저가
  직접 값 저장 불가, 모순 저장 방지)이 이전 세션에서 이미 도입돼 있었다. 이번엔 이 두 값을
  등록/수정/빠른입력 3개 폼에서 **완전히 동일한 자리·순서·워딩**으로 보여주는 작업.
- `src/app/(app)/monthly/MonthlyDrawerForm.tsx`, `TransactionDetailDrawer.tsx`,
  `src/app/(app)/quick-add/QuickAddForm.tsx` 세 폼 전부: "거래 유형" 바로 다음에 "거래 구분"
  드롭다운(수입=고정수입/부가 수입, 지출=소비성지출/저축성지출) — **지출의 드롭다운은 실제로
  제출되는 필드가 아니다.** `expense_group`은 여전히 DB 트리거가 `category_id`로만 결정한다.
  이 드롭다운은 그 아래 `CategoryPicker`에 넘기는 `availableCategories`를 "저축성지출 하나"
  또는 "나머지 전부"로 좁히는 **순수 클라이언트 필터**일 뿐이다 — 그래서 사용자가 고른 구분과
  실제 저장 카테고리가 항상 저절로 일치한다. `CategoryPicker`의 `key`를
  `` `${transactionType}-${expenseGroup}` ``로 둬서 필터가 바뀌면 선택 상태를 리셋한다.
- 워딩: "추가수입" → "**부가 수입**"(공백 포함, 사용자 지정 정확한 표기)로 전체 교체 —
  드로어 2곳, `MonthlyInputTab.tsx`의 `INCOME_GROUP_LABEL`, `src/app/(app)/reports/income/page.tsx`
  KPI·표 전부.
- `MonthlyInputTab.tsx`: 월간관리 거래 목록에 **"거래 구분" 독립 컬럼**을 "유형" 컬럼
  오른쪽에 신설(전엔 유형 셀 안에 끼워 넣었었는데, 사용자가 "컬럼 넣으라고 했잖아"라고
  재지시해서 진짜 TanStack `columnHelper.display({ id: 'transactionGroup', ... })` 컬럼으로
  분리). 데스크톱은 `design-system.css`의 `--ui-ledger-column-group` 폭 토큰을
  `--ui-ledger-columns`에 추가. 모바일 카드에서는 "유형" 값과 같은 그리드 셀(2행 1열)을
  공유하고 `justify-self: start`/`end`로 좌우 배치해서 "지출/수입 옆에 나란히" 보이게 함(진짜
  별도 컬럼이면서도 시각적으로는 배지처럼 붙어 보임).
- 거래 조회 필터에 "유형" 필터 오른쪽으로 "거래 구분" 필터 신설 — 유형→대분류→소분류와 같은
  종속 필터 패턴(유형이 수입이면 고정수입/부가 수입, 지출이면 소비성지출/저축성지출만 후보).

### 1-2. "연간 리포트" 신설 — 커밋 `e1562a6`
- **배경**: 이전에 만든 "히트맵" 표(카테고리를 값 기준으로 재집계)가 원본 엑셀 `[연간_항목별수입]
  /[연간_카드별지출]/[연간_항목별지출]/[연간_세부항목별지출]` 4개 시트를 그대로 반영하지 못해
  (계좌이체·상품권류 누락, 소계/합계/비율/체크섬 행 없음, 대분류 위계 붕괴) 사용자가 지적함.
  실제 4개 연도(2023~2026) 엑셀 셀 값을 직접 역산해서 검증한 뒤, "시트 템플릿" 방식으로
  새로 만듦.
- **`src/lib/annual-report.ts`**(신규) — 핵심 타입:
  ```ts
  export type AnnualReportRowKind = 'item' | 'subtotal' | 'total' | 'ratio' | 'checksum';
  export type AnnualReportRow = { kind, id, label, groupLabel?, monthly: number[], total: number };
  ```
  - `buildAnnualIncomeReport`: 급여/수당/상여=**주소득**, 나머지(투자수익/이자/부수익/처분소득/
    기타 수입)=**부소득**(4개 연도 엑셀의 주소득계/부소득계 값을 역산해 검증한 매핑 —
    `income_group`(고정/부가수입)과는 **다른 축**이니 혼동 금지). "이월" 소분류는 원본 엑셀에
    없는 행이라 총계에서도 제외.
  - `buildAnnualCardReport`: **모든 결제수단**(계좌이체/현금/카드/상품권 전부, method_type
    제한 없음) 포함 — 원본 엑셀이 "체크카드/상품권 합계"에서 성북사랑상품권을 빠뜨리던 수식
    버그는 재현하지 않고 논리적으로 고침(check_card+other 타입 전부 포함). "소비 계" = 현금+
    신용카드+체크카드/상품권(계좌이체 제외 — 검산 완료).
  - `buildAnnualExpenseCategoryReport`/`buildAnnualExpenseDetailReport`: "소비성지출"은 엑셀에만
    있는 계산 행(저축성지출 제외 나머지 전체 합, 실제 카테고리 아님). 비율은 **총계가 아니라
    소비성지출 대비**(검산 완료). 모든 소계/합계는 `sumAllMonthly`로 "실제 거래 전체 합"을
    anchor로 잡아서, 표시 목록에 없는 카테고리(시스템 폴백 "미분류")나 표시에서만 뺀 소분류에
    걸린 돈이 총계에서 새지 않게 했다.
  - 보험비 아래 중복 소분류 "변액연금"(저축성지출에 이미 있는 이름과 중복)은 **표시에서만
    제외**(데이터는 그대로 — 실거래 32건 ₩5,006,080이 존재하며 보험비 대분류 합계엔 여전히
    포함된다. 세부항목별지출의 보험비 소분류 나열 합만 대분류 합보다 작아 보일 수 있음 — 의도된
    예외).
- **`src/app/(app)/analysis/AnnualReportTable.tsx`**(신규) — item 행은 클릭→개별거래 드릴다운
  (기존 히트맵과 같은 색상 강도 셀), subtotal/total/ratio/checksum 행은 굵게+옅은 배경의
  정적 값(퍼센트 포맷)으로 렌더링. `HeatmapTransactionRows`(개별거래 표)를 이 파일 안에 내장.
- **`src/app/(app)/analysis/AnnualReportView.tsx`**(신규) — 4개 표를 엑셀 탭 순서 그대로 배치.
- **DB 마이그레이션**(`20260909140000_consolidate_husband_allowance_subcategory.sql`,
  `20260909150000_fix_husband_allowance_display_order.sql`): "남편 용돈"이 문화생활비/용돈지출
  두 군데에 중복 소분류로 있던 것을 정리. 실거래 34건(₩9,794,413)은 이미 용돈지출→남편 용돈에
  정상적으로 있었고, 문화생활비→남편 용돈엔 예전 오분류 1건(₩300,000)만 있어서 그 1건을
  옮기고 문화생활비 쪽은 `is_active=false`로 비활성화(삭제 아님). 용돈지출 대분류의
  `display_order`를 99(임시값)에서 14(이벤트지출 다음)로 정정. `src/lib/categories.ts`의
  `DEFAULT_EXPENSE_CATEGORIES`에도 용돈지출을 정식 추가(새 가계 시드 대비).

### 1-3. 분석 화면 재정리 — 커밋 `3d10060`
- **배경**: 사용자가 화면 위계가 다시 꼬였다고 판단 — 연간 스코프인데도 수입/지출/참고거래/
  카드사용/연간리포트 5개 탭을 또 골라야 했음.
- **최종 구조**: `src/app/(app)/analysis/AnalysisWorkspace.tsx`에서 `type` 탭 상태를
  완전히 제거하고 **스코프(연간/월간) 하나로 대체**.
  - **연간 스코프**: `AnnualReportView` 단독 표시(더 이상 scope 분기를 갖지 않음 — 항상
    연간 스코프에서만 마운트됨).
  - **월간 스코프**: `<details className="tds-accordion">` 4개를 **수입 → 지출 → 카드 사용 →
    참고 거래** 순서로 배치(사용자 지시 순서 그대로). `.tds-accordion`/`.tds-accordion-body`는
    원래 "monthly-section"이라는 이름의 **죽은 CSS**(어디서도 안 쓰이고 있었음)를 재사용하며
    이름을 일반화한 것 — `src/app/globals.css`에 정의.
  - `src/app/(app)/analysis/page.tsx`: URL의 `?type=` 파라미터는 이제 "어느 아코디언을 펼친
    채로 시작할지"를 의미(대시보드/월간관리에서 걸어오는 기존 딥링크 `?type=expense`,
    `?type=reference`가 계속 동작하도록 이름은 유지하되 의미만 바꿈). 타입은 `OpenSection =
    'income'|'expense'|'card'|'reference'`.
- 탭이 사라지면서 4개 뷰가 갖고 있던 "연간 스코프면 매트릭스 히트맵도 보여준다" 분기가 전부
  죽은 코드가 됨 → `src/lib/analysis.ts`의 `summarizeIncomeMatrix`/`summarizeExpenseMatrix`/
  `summarizeExpenseSubcategoryMatrix`/`summarizeCardUsageMatrix`/`MatrixRow`/`buildMatrix`와
  `AnalysisHeatmapTable.tsx`(파일 자체 삭제) 제거. `HeatmapTransactionRows`는 유일한
  소비처인 `AnnualReportTable.tsx`로 이동.
- 4개 뷰 컴포넌트(`AnalysisIncomeView`/`AnalysisExpenseView`/`AnalysisCardView`/
  `AnalysisReferenceView`)의 미사용 props(`scope`/`year`/`months`/`monthCount`/
  `allTransactions`/`savingsCategoryId`) 정리.

### 1-4. 월간 드릴다운 4종 컬럼/구조 통일 — 커밋 `eb57a94`
- **배경**: 4개 아코디언을 나란히 놓고 보니 "항목 클릭 → 개별 거래" 표의 컬럼·구조가
  서로 달랐음(사용자가 "원인 파악하고 개선안 도출해서 제안해"라고 요청 → 조사 후 4가지
  제안 → 사용자가 A/B/C/D 전부 승인).
- **A**: 참고거래 컬럼 라벨 "분류" → "소분류"로 통일(수입/지출과 동일한 subcategoryId 조회).
- **B**: 소분류를 못 찾았을 때 대체 문구를 전부 "기타"로 통일(수입만 "기타 수입"이었음).
- **C**: 카드 사용의 extraColumn을 "구분"(실제지출/참고거래 텍스트) → "카테고리"(대분류)로
  교체 — 실제지출/참고거래 구분은 이미 금액 색상(참고 거래=회색 neutral)으로 표현되므로 텍스트
  컬럼 중복 불필요. `AnalysisCardView`에 `categoryNames` prop 추가(참고 거래는 수입/지출
  대분류 어느 쪽이든 categoryId를 가질 수 있어서, `AnalysisWorkspace.tsx`에 수입+지출 전체를
  합친 `allCategoryNames` 맵을 새로 만들어 전달).
- **D**: 지출만 대분류→소분류→개별거래 **3단계**였던 걸 나머지와 같은 대분류→개별거래
  **1단계**로 통일(사용자 지시: "저축성 지출 클릭하면 소분류 컬럼 달아서 쭉 보여줘"). 소분류
  정보는 사라지지 않고 개별 거래 표의 "소분류" 컬럼(extraColumn)으로 옮김.
  `AnalysisDrilldown.tsx`의 `ExpenseDrilldown` 컴포넌트, `summarizeExpenseByCategory`의
  소분류 중첩 집계(이제 `AnalysisRow[]` 평평한 구조만 반환, `ExpenseCategoryRow` 타입 제거),
  관련 CSS(`.analysis-drilldown-sub`, `.analysis-drilldown-row.is-sub`)를 전부 제거.
- 결과: 4개 아코디언 전부 **"1클릭 → 소분류(카드는 카테고리) 컬럼이 붙은 개별 거래 표"**로
  완전히 동일한 구조.

## 2. 지금 시점의 핵심 아키텍처 요약

- **거래 유형/구분**: `transactionType`('income'|'expense'|'reference') + `flowClass`
  ('cash_in'|'consumption'|'excluded') + `income_group`('fixed'|'additional', 저장값) +
  `expense_group`('savings'|'consumption', **트리거 자동 계산, 앱 코드에서 절대 직접 쓰지
  않음** — `src/lib/transactions.ts`의 `Transaction` 타입 주석 참고).
- **분석 화면**(`src/app/(app)/analysis/`): scope(연간/월간) 하나로 전환. 연간=`AnnualReportView`
  (엑셀 그대로), 월간=4개 아코디언(수입→지출→카드사용→참고거래, 전부 `SimpleDrilldown` +
  `TransactionRows` 공유).
- **월간관리 거래 목록**(`src/app/(app)/monthly/MonthlyInputTab.tsx`): 날짜·유형·거래구분·
  대분류·소분류·내용·금액·결제수단·비고·성격·상태 컬럼 순서(`--ui-ledger-columns`,
  `design-system.css`). `getRowId: row => row.id`로 인덱스 기반 아이덴티티 버그 방지.
  `useOptimistic` 기반 상태 select(`TransactionStatusEditor`).
- **카테고리 구조**(`src/lib/categories.ts`): 지출 대분류 15개(저축성지출, 식비, 주거비, 협찬,
  생활용품비, 보험비, 의류비, 미용비, 교육계발비, 문화생활비, 의료비, 유류교통비, 통신비,
  이벤트지출, 용돈지출 — display_order 0~14). "미분류"는 시스템 폴백 카테고리(display_order
  99, 실제 데이터 항목 아님 — 리포트에서 제외 대상).

## 3. 알아두어야 할 함정/특이사항

- `payment_methods.display_order`는 대부분 99(미설정)라 신뢰할 수 없다 —
  `buildAnnualCardReport`는 `method_type` 우선순위(account_transfer→cash→credit_card→
  check_card→other)로 순서를 정한다. 필요하면 실제 display_order를 채워 넣는 정리 작업을
  고려할 수 있음(미완료, 요청받지 않았음).
- 2023~2025년 엑셀과 DB 합계 대조 시 78건 불일치가 있었는데, 이는 앱 버그가 아니라 (1) 엑셀
  수식 범위가 나중에 추가된 행을 못 잡음, (2) 빈 날짜 미래 placeholder 행, (3) 2026년 워크북의
  일부 미계산 셀 — 세 가지 **엑셀 쪽 사전 존재 이슈**로 이미 조사·확정됐다. 재조사 불필요.
- 참고 거래(`transactionType==='reference'`)는 categories 테이블에서 income/expense 어느
  쪽 대분류든 가질 수 있다(대분류 필수 아님, `categories.filter(c => c.transactionType===type)`
  가드 없이 전체 후보를 보여주는 화면들이 있음 — 의도된 설계).
- Excel 마이그레이션 스크립트(`scripts/excel-migration/*.cjs`)는 실행 후 임시 파일을 남기지
  않도록 정리했다 — 새로 유사 스크립트를 짤 때도 `scripts/excel-migration/_tmp_*.cjs` 같은
  임시 파일은 작업 후 삭제할 것.

## 4. 남은 작업 (있다면 사용자에게 먼저 확인)

이 세션에서 사용자가 명시적으로 요청한 작업은 위 1번 항목까지 전부 완료·검증·배포됐다.
아래는 진행 중 발견했지만 **범위 밖이라 손대지 않은** 것들 — 다음 작업자가 참고만 하고,
사용자에게 확인 없이 임의로 진행하지 말 것:
- `payment_methods.display_order` 미설정(위 3번 참고) — 카드별 지출 표의 항목 순서를 더
  세밀하게 제어하고 싶다면 정리가 필요.
- 이 세션 시작 시점의 원래 대형 스펙("데이터 계산·집계·연동 로직 전면 점검", §1~§14)의 개별
  항목이 전부 완료됐는지는 이 문서만으로 100% 확인 불가 — 이전 대화 요약(있다면)이나 사용자
  확인이 필요.

## 5. 참고 커밋 (최신 순)

```
eb57a94 fix(analysis): 월간 드릴다운 4종의 개별 거래 컬럼·구조 통일
3d10060 refactor(analysis): 스코프 기반 재정리 — 연간=리포트 하나, 월간=아코디언 4종
e1562a6 feat(analysis): 엑셀 [연간_*] 4개 시트를 그대로 재현하는 "연간 리포트" 섹션
d10386a feat(transactions): 거래 구분(income_group/expense_group) UX 통일
7862442 chore(data): backfill missing 부가수입 + income_group across 2023-2026
```
