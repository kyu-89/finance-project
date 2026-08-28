# 인수인계 문서 (HANDOFF)

> 최종 갱신: 2026-08-28 · 현재 기능 HEAD `f85f8ea` · 직전 운영 배포 `df1f031` Ready
> 소분류 이름 변경 UI와 이 문서 갱신을 push하면 Vercel 자동 배포가 시작된다.
> 다음 작업자(다른 AI 세션 또는 사람)가 이 문서만 읽고 이어서 작업할 수 있도록 작성됨

## 0. 최신 연속 작업 상태 (2026-08-28 Codex)

> ⚠️ 아래 §3의 Task 6·7 상세는 구현 전 기록이다. 현재 상태는 이 섹션과 §2 표를 우선한다.

### 구현 완료 (`317e7cb`)

- `listRecentUsage` 실제 UI 연결: 최근 대분류 5개, 소분류, 결제수단 우선 정렬
- quick-add 연속 입력 + 생성 ID를 이용한 5초 Undo (소프트 삭제)
- quick-add/월간 행 추가의 `costBehaviorOverride` 저장
- 월간입력에 비용성격 컬럼·행별 수정 UI 추가
- 전체내역 합계를 `posted + consumption`만 확정 소비로 계산; `planned`는 실적 미포함으로 별도 표시
- 합계 정합성 순수 함수 + 회귀 테스트 2개 추가
- transaction/category/payment-method 생성 액션의 household 조회를 `try/catch` 안으로 이동

### 검증

- `npm run lint` ✅
- `npm run build` ✅ (Next.js 16.3.3)
- `npx vitest run tests/unit` ✅ — 9 files, 28 tests
- 로컬 브라우저 읽기 검증 ✅: 최근 정렬, 소분류 선택 표시, 비용성격 입력·행별 수정 UI, 확정 소비 합계 라벨
- **미수행:** 실제 거래 생성 → 5초 안에 Undo 클릭. 운영 Supabase 데이터를 변경하므로 자동 실행하지 않음.
- 전체 통합 테스트는 Supabase Auth 429 주의 때문에 재실행하지 않음.

### 추가 설치 (`47325db`)

- `npx.cmd skills add CaesiumY/ko-design-md`로 `.agents/skills/use-design-md` 설치
- `skills-lock.json` 추가. 다음 턴부터 한국 서비스 `design.md` 스타일 적용 요청에 사용 가능

### Toss 디자인 시스템 적용 완료 (`929fa2e`, `df1f031`)

- 기준 파일: 루트 `design_system_toss.txt` (사용자 지정)
- 전역 OKLCH 시맨틱 컬러, Pretendard 대체 서체, 4px spacing, 12~24px radius, 44px touch target, 120ms motion 토큰 적용
- 전역 input/select focus, disabled, table 숫자 표시, page/card/title/primary-button/chip primitive 추가
- 데스크톱 사이드바와 모바일 하단 내비게이션을 Toss 톤으로 변경
- `/quick-add`와 `/monthly` 헤더·탭·핵심 입력·칩·CTA·테이블 밀도 적용
- 로그인·회원가입·MFA 등록/검증을 공통 인증 카드 패턴과 해요체로 통일
- 설정 홈·카테고리·결제수단 폼/목록, 비활성화 44px 터치 영역 적용
- 대시보드·자산 빈 상태, 앱 오류 화면, 메시지/로그아웃 버튼 적용
- 브라우저 확인: Pretendard stack, grey-50 배경, input radius 12px, primary CTA 56px, 해요체 타이틀 정상 렌더링
- 최신 확장분은 브라우저 제어 세션 타임아웃으로 시각 재검증하지 못했지만 lint/build/unit test는 모두 통과했다.

### 운영 배포 (`df1f031`)

- Vercel Production: **Ready**
- 배포 URL: `https://personal-finance-4vc5krt7u-kyu17.vercel.app`
- 운영 alias: `https://personal-finance-one-virid.vercel.app`
- 검증: `npm run lint` ✅ / `npm run build` ✅ / unit 9 files, 28 tests ✅

### 다음 작업

1. 실기기에서 quick-add 저장 → 5초 Undo → 월간내역 제거 확인 (운영 데이터 변경이므로 자동화하지 않음)
2. Sprint 2 반복항목 CRUD·월간 materialize 서비스 구현
3. planned 거래 수정·확정·skip UI와 중복 후보 연결 구현

### Sprint 2 시작 상태

- 계획: `docs/superpowers/plans/2026-08-28-sprint2-recurring-engine.md`
- migration: `20260831010000_recurring_engine.sql`
  - `recurring_rules` / `recurring_occurrences`
  - owner RLS, hard-delete 차단, 교차 household trigger
  - `(rule, occurrence_date)` 및 회차당 활성 transaction 유일성
  - 기존 transactions의 recurring FK 연결
- 일정 계산: `src/lib/recurrence.ts`
  - monthly / weekly / yearly / custom 일 간격
  - 월말 clamp, 윤년, 종료일/조회범위 처리
- 검증: lint/build ✅, unit **10 files / 32 tests** ✅, Supabase `db push --dry-run` ✅
- 아직 원격 DB에는 migration을 적용하지 않았다. 커밋 후 `npx supabase db push`로 적용할 것.

---

## 1. 프로젝트 개요

**개인 가계부/자산관리 웹 서비스.** 기존 Excel 가계부(`2026년 (1).xlsm`)를 웹으로 이관하는 프로젝트.

- **기준 문서(가장 중요):** `docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md` — 2,271줄. 단순 참고자료가 아니라 **구현 기준서**다. 모든 결정은 이 문서를 근거로 해야 한다.
- **우선순위(PRD 명시):** 정확성 > 보안 > 입력 편의성 > 조회 편의성 > 시각화
- **1차 메뉴는 4개로 고정:** 대시보드 / 월간관리 / 자산·금융 / 설정. **새 1차 메뉴를 만들지 말 것.**

### 스택 / 인프라

| 항목 | 값 |
|---|---|
| 프레임워크 | Next.js **16.3.3** (App Router, TypeScript strict) |
| DB/인증 | Supabase (project ref `lshqugxbddcpwugadjxe`, 리전 ap-northeast-1) |
| 배포 | Vercel — **main에 push하면 자동 배포** (GitHub 연동) |
| 프로덕션 URL | https://personal-finance-one-virid.vercel.app |
| 저장소 | https://github.com/kyu-89/finance-project (Private) |
| 테스트 | Vitest — 유닛 + 실제 Supabase에 붙는 통합 테스트 |

### ⚠️ Next.js 16 주의사항 (중요)

이 버전은 학습 데이터의 Next.js와 **다르다.** 프로젝트 루트 `AGENTS.md`가 이를 명시하고 있고, 실제로 이 프로젝트에서 여러 번 문제가 됐다:

- **`middleware.ts`가 아니라 `proxy.ts`** (`export function proxy`). middleware는 deprecated.
- `cookies()`, `searchParams` 등은 **Promise** — 반드시 `await`.
- 확실하지 않으면 **`node_modules/next/dist/docs/`의 실제 문서를 읽을 것.** 기억에 의존하지 말 것.
- `@tanstack/react-table`은 **v9** (v8 아님). API가 다르다: `tableFeatures({})`, `columnHelper.columns([...])`, `useTable({...})`, `table.FlexRender`, `row.getAllCells()`. 패키지 자체가 `node_modules/@tanstack/react-table/skills/`에 문서를 포함하고 있다.

---

## 2. 현재까지 완료된 것

### Sprint 0 — 뼈대/보안 ✅ 완료·배포됨

- Next.js 스캐폴딩 (TypeScript strict)
- Supabase 클라이언트 (`src/lib/supabase/{client,server,proxy}.ts`)
- `households` / `household_members` 스키마 + RLS
- 이메일 인증 + **TOTP MFA 강제 (AAL2)** — `src/proxy.ts`가 보호 경로를 게이팅
- 가구 자동 생성 (`src/lib/household.ts`)
- 4메뉴 반응형 앱 셸 + 로그아웃
- RLS 교차사용자 격리 통합 테스트

### Sprint 1 — 거래 원장 + 월간관리 뼈대 ✅ 완료·배포됨

- `categories` / `subcategories` / `payment_methods` / `transactions` 스키마 + RLS
- PRD §4.3 기본 분류 자동 시딩 (가구 최초 로그인 시)
- 설정 > 카테고리·결제수단 관리
- 모바일 빠른입력 (`/quick-add`)
- PC 월간관리 (`/monthly`) — 월간입력 / 전체내역 탭
- RLS 통합 테스트 12개

### Sprint 1.5 — 이월 항목 정리 ✅ **Task 1~7 구현 완료**

계획서: `docs/superpowers/plans/2026-08-28-sprint1_5-carryover.md`

| Task | 내용 | 상태 |
|---|---|---|
| 1 | 스키마 강화 (updated_at 트리거, self 멤버 유니크, 테넌트 일관성 FK 트리거) | ✅ 완료·리뷰됨 |
| 2 | cost_behavior 잘못된 데이터 1회성 복구 | ✅ 완료·리뷰됨·**실제 DB 검증됨** |
| 3 | flow_class 매핑 + 소프트삭제 불변조건 테스트 | ✅ 완료 (46 테스트) |
| 4 | `ActionResult` — 검증 메시지가 사용자에게 보이도록 | ✅ 완료·리뷰됨 |
| 5 | 카테고리 편집 + 소분류 CRUD | ✅ 완료 (리뷰 미실시) |
| **6** | **PRD §5.1 속도 정책 (최근사용 우선/연속입력/5초 Undo)** | ✅ 완료 (`317e7cb`) |
| **7** | **거래별 고정/변동 수정 + 월간관리 합계 필터링** | ✅ 완료 (`317e7cb`) |

---

## 3. Task 6 + 7 구현 전 기록 (현재 완료됨)

**데이터 접근 함수는 이미 작성되어 커밋됨** (`ea2d4f9`). `src/lib/transactions.ts`에 있고, **아직 아무도 호출하지 않는 상태**:

- `listRecentUsage(householdId, limit)` → `RecentUsage` (최근 사용 카테고리/소분류/결제수단)
- `undoTransaction(id)` (소프트 삭제로 위임)
- `updateTransactionCostBehavior(id, costBehavior)`

**남은 작업은 전부 이 함수들을 UI에 연결하는 것.** 상세 코드는 계획서의 Task 6·7 섹션에 그대로 있음:
`docs/superpowers/plans/2026-08-28-sprint1_5-carryover.md`

### Task 6 남은 것
1. `createQuickTransactionAction`의 redirect에 `&undo=<생성된 id>` 추가 → 클라이언트가 취소할 수 있게
2. `undoTransactionAction` 서버 액션 추가 (`ActionResult` 형태로)
3. `CategoryPicker.tsx`에 **최근 사용 우선 정렬** 추가
   - ⚠️ **소분류 선택 하이라이트는 이미 되어 있음** (사용자 제보로 먼저 수정함). 정렬만 추가하면 됨.
4. `quick-add/page.tsx`에서 `listRecentUsage` 호출해서 내려주기
5. `QuickAddForm.tsx` 저장 배너에 **실행취소 버튼** + 자동 숨김 **3000ms → 5000ms**

### Task 7 남은 것
1. 두 액션에서 `costBehaviorOverride` 폼 값 읽어서 `createTransaction`에 전달 (함수는 이미 이 인자를 받는데 **아무도 안 넘기고 있음**)
2. `updateCostBehaviorAction` 추가
3. `QuickAddForm.tsx`의 `더보기` 안에 비용성격 select 추가
4. `MonthlyInputTab.tsx`에 비용성격 컬럼 추가 (**TanStack v9 API 주의**)
5. **`AllTransactionsTab.tsx`의 합계 필터링** ← 이게 제일 중요
   - 지금은 모든 행을 무조건 `reduce`로 더함
   - Sprint 2가 `planned`/`saving`/`transfer` 행을 만들기 시작하면 **소비 합계에 저축·이체가 섞여 조용히 틀린 숫자가 나옴**
   - `flowClass === 'consumption' && status === 'posted'`로 필터링하고, 예정분은 "실적 미포함"이라고 명시해서 따로 표시 (PRD §23.9)

### 추가로 같이 해야 할 것 (Task 4 리뷰에서 나온 지적)
모든 액션에서 `getCurrentHouseholdId()` / `ensureHouseholdForCurrentUser()` 호출이 **try/catch 밖**에 있음. 여기서 throw되면 Task 4가 해결하려던 "빈 에러 화면" 문제가 그대로 재현됨. **3개 액션 파일 전부**에서 감싸줘야 함.

---

## 4. ⚠️ 알려진 미해결 이슈 / 주의사항

### 미검증
- **`/quick-add` 실제 브라우저 저장 검증이 불완전함.** 사용자가 두 번 테스트했고 두 번 다 실제 버그가 나왔다(아래 참조). 코드가 컴파일된다는 것과 실제로 동작한다는 것은 다르다 — **UI 변경 후엔 반드시 실기기 테스트를 요청할 것.**

### 사용자 제보로 이미 고친 것 (참고용 — 같은 실수 반복 방지)
1. **소분류 선택이 안 먹힘** → 실제로는 클릭이 되고 있었고, **선택 하이라이트가 없어서** 안 먹히는 것처럼 보였음. 데이터·로직 문제가 아니라 UI 피드백 문제였음.
2. **저장이 느림** → 저장 1회에 Supabase 왕복 **약 19회**. 가구 초기설정 검사 6회가 매 요청마다 순차 실행되고 있었음. 병렬화 + 액션에서는 초기설정 건너뛰기로 **약 11회로 감소.** 아직 더 줄일 여지 있음 (미들웨어 2회, 리다이렉트 후 재렌더링 등).

### 미구현 (PRD 요구사항인데 아직 없음)
- 거래 **수정/삭제 UI** 없음 (soft delete 함수는 있는데 호출하는 UI가 없음)
- 명의자/태그 입력 (`더보기`가 "명의자/비고/태그"라고 써있는데 실제로는 비고만 있음)
- PRD §5.3의 엑셀형 그리드 UX (셀 키보드 이동, 붙여넣기, 이전 행 복사)
- PRD §4.3의 15번째 지출 대분류 `용돈지출` (PRD에 소분류 목록이 없어서 의도적으로 제외 — 이제 사용자가 직접 추가 가능)
- 소분류 이름 변경 UI는 `f85f8ea`에서 연결 완료. 활성 소분류는 인라인 수정, 비활성 소분류는 읽기 전용으로 표시한다.

### 데이터 관련 주의
- **`supabase/migrations/20260830020000_repair_cost_behavior.sql`을 절대 수동으로 재실행하지 말 것.** 카테고리 편집 UI가 생긴 지금은, 사용자가 의도적으로 설정한 값을 덮어쓸 수 있다. 파일 내부에 경고 주석 있음.
- `cost_behavior`는 거래 생성 시점에 **스냅샷**된다. 카테고리 기본값을 바꿔도 과거 거래는 안 바뀐다 (PRD §35). 이건 의도된 동작이다.

---

## 5. 절대 어기면 안 되는 제약 (PRD 기반)

| 제약 | 근거 |
|---|---|
| 금액은 `bigint` (원 단위). float 금지, 정수만 | §3.2, §27 |
| 모든 사용자 데이터 테이블 RLS 활성화 + `auth.uid()` 격리 | §0.6, §16.2 |
| `service_role` 키는 **`tests/integration/`에서만.** `src/` 절대 금지 | §0.7, §27 |
| `transactions` **하드 삭제 금지** — DELETE 정책이 아예 없음. `deleted_at` UPDATE만 | §5.4 |
| 카테고리/소분류/결제수단 **삭제 금지** — `is_active = false`만 | §4.3, §23.2 |
| 저축/투자/대출원금/이체를 **소비(consumption)와 섞지 말 것** — `flow_class`로 구분 | §23.5, §23.6, §35 |
| `planned` 거래는 **실적/예산소진에 포함 금지** | §23.9 |
| TypeScript `strict: true` 유지. 타입 shim `.d.ts` 추가 금지 | §17 + 이 프로젝트에서 2번 회귀함 |
| 카테고리/결제수단 하드코딩 금지 — DB에서 CRUD | §4.3, §27 |

---

## 6. 개발 환경 / 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 빌드 (타입체크 포함)
npm run lint     # ESLint
npx vitest run tests/unit   # 유닛 테스트만 (빠름)
npm test         # 전체 (통합 테스트 포함 — 실제 Supabase에 붙음)
```

### ⚠️ 테스트 주의
`npm test`는 **실제 Supabase 프로젝트에 임시 사용자를 만들어 로그인**한다. 연속으로 두 번 돌리면 **인증 rate limit(429)에 걸린다.** 개발 중에는 `npx vitest run tests/unit`만 쓰고, 전체 테스트는 간격을 두고 실행할 것.

### 환경변수
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (gitignored, 이미 존재)
- `.env.test.local` — `SUPABASE_SERVICE_ROLE_KEY` (gitignored, 이미 존재, 통합 테스트 전용)
- 둘 다 `.env*.example` 템플릿이 커밋되어 있음

### Supabase CLI
```bash
npx supabase db push        # 마이그레이션 적용
npx supabase config push    # ⚠️ 아래 경고 참조
```

**⚠️ `supabase config push` 위험:** 로컬 `config.toml` **전체**를 원격에 밀어넣는다. 이 프로젝트에서 실제로 **TOTP MFA가 꺼질 뻔했다** (config.toml의 템플릿 기본값이 false였고 원격은 true였음). 실행하면 **출력되는 diff를 반드시 읽고**, 의도한 항목만 바뀌는지 확인할 것.

**인증 만료 시:** Supabase 대시보드 → Account → Access Tokens에서 새 토큰 발급 → `npx supabase login --token sbp_...`. **작업 끝나면 토큰 폐기 권장.**

---

## 7. 다음 스프린트 (Sprint 2) 예정 내용

Sprint 1.5가 끝나면 **Sprint 2 — 반복항목 자동생성 엔진**으로 진행 예정이었다. PRD §5.5가 핵심 명세:

- `recurring_rules` / `recurring_occurrences` 테이블
- 보험료·적금·대출·구독·급여가 매월 `planned` 거래를 **idempotent하게 1건만** 자동 생성
- 사용자가 확인해서 `posted`로 확정하는 흐름
- 정부지원금도 같은 엔진 재사용 (§12, §34)
- skip / pause / end / 이번달만 변경 / 이후 모두 변경
- **직접 입력한 실거래와 자동 생성 예정건의 중복 방지** (§5.5.6)

### Sprint 2 시작 전 반드시 먼저 할 것
1. **Task 7의 합계 필터링** — 반복 엔진이 `planned`/`saving` 행을 만들기 시작하면 지금의 무필터 합계가 조용히 틀린 숫자를 낸다.
2. Sprint 1 최종 리뷰가 남긴 이월 항목 확인 — `docs/superpowers/plans/2026-08-28-sprint1-transactions.md` 하단의 "Carried into Sprint 2" 목록.

---

## 8. 이 프로젝트에서 쓰던 작업 방식 (참고)

계획서를 먼저 `docs/superpowers/plans/`에 쓰고, 태스크 단위로 구현 → **독립 리뷰** → 수정 루프를 돌렸다. 리뷰가 실제로 값을 했다 — 발견된 것들:

- RLS 정책이 fail-open이던 것 (AAL 조회 실패 시 통과)
- 거래 삭제가 30일 복구 보장을 우회할 수 있던 것
- 시딩이 부분 실패 시 영구히 미완성 상태로 갇히던 것
- 환경변수가 브라우저 번들에 안 들어가 앱 전체가 죽던 것
- 날짜가 UTC 기준이라 한국시간 새벽에 하루씩 밀리던 것
- 고정비/변동비 기본값이 PRD와 어긋나 데이터가 오염되던 것

**계획서에 적힌 코드라고 해서 맞는 게 아니다.** 위 항목 중 여러 개가 계획서 자체의 결함이었다. 의심스러우면 PRD 원문을 확인할 것.

---

## 9. 요약: 지금 당장 할 일

```
1. 실제 브라우저로 /quick-add 저장 → 5초 Undo 검증
   → 운영 Supabase 데이터를 변경하므로 사용자 동의/직접 확인이 필요한 유일한 검증

2. Sprint 1.5 최종 리뷰
   → Task 1~7과 소분류 이름 변경까지 구현 완료 상태에서 회귀/보안 검토

3. Sprint 2 (반복항목 엔진) 계획 수립 → PRD §5.5, §12, §34
   → recurring_rules / recurring_occurrences / planned 확정 흐름 / 중복 방지
```
