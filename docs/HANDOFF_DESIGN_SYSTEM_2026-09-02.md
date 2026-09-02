# 웹 디자인 시스템 통일 작업 — 인수인계 (2026-09-02, Claude → Codex)

이 문서는 토큰 소진으로 세션을 넘길 때 Codex가 바로 이어받을 수 있도록 정리한 것이다. 순서대로 읽으면 지금 상태를 그대로 재구성할 수 있다.

## 0. 한 줄 요약

**12개 태스크 전부 구현 + 개별 리뷰 완료, 최종 전체 브랜치 리뷰도 완료.** 리뷰 결과는 "Ready to merge — With fixes" — Critical 1건 + Important 7건이 아직 수정 안 된 채로 남아있다. 브랜치: `design-system-web` (현재 체크아웃됨). **새 작업/새 태스크는 없다. 5.1절의 fix wave 1회 + scoped re-review 1회만 하면 끝난다.**

## 1. 문서 위치 (전부 이 브랜치에 커밋되어 있음)

- **스펙(권위 있는 결정 사항)**: `docs/superpowers/specs/2026-09-02-web-design-system-design.md`
- **구현 계획(12개 태스크 상세, 각 태스크마다 파일·정확한 코드)**: `docs/superpowers/plans/2026-09-02-web-design-system.md`
- **사용자 대상 최종 규칙 문서(이미 갱신 완료)**: `docs/DESIGN_SYSTEM.md`
- **SDD 진행 원장(ledger, 태스크별 완료 기록·발견한 버그·판단 근거 전부 기록됨)**: `.superpowers/sdd/2026-09-02-web-design-system/progress.md` — **이 파일이 가장 중요하다. 무엇을 왜 결정했는지 전부 여기 있다.**
- 각 태스크의 brief/report 파일도 같은 디렉터리(`.superpowers/sdd/2026-09-02-web-design-system/task-N-brief.md`, `task-N-report.md`)에 있음 — 특정 태스크의 세부 내역이 궁금하면 여기를 본다.

## 2. 지금까지 한 일

### 2.1 브레인스토밍 → 스펙 → 계획 → 실행 (superpowers 워크플로)

사용자가 "가로 영역 확장에 따른 전역 디자인 시스템 정의"를 요청 → `brainstorming` 스킬로 architectural 경로 선택 → 사용자와 질문/답변으로 확정한 사항:
1. **전체 레이아웃 최대폭 1920px** (LNB 포함), 초과분은 좌우 여백
2. **선택(selected) 상태 전부 브랜드 블루로 통일** (blue-50 배경/blue-600 텍스트) — 탭·칩·필터 예외 없음, 기존 반전검정/흰색+그림자 스타일 폐기
3. **접근 방식은 "토큰·CSS 클래스 정비"** — 새 React 컴포넌트 신설 없음
4. 이어서 오버레이(토스트/모달/드로어), 헤더, 차트도 포함해달라는 추가 요청 반영

→ 스펙 문서 작성 → `writing-plans` 스킬로 12개 태스크 계획 작성 → `subagent-driven-development` 스킬로 태스크마다 subagent 구현 + subagent 리뷰(발견된 이슈는 수정 라운드) 반복.

### 2.2 완료된 12개 태스크 (커밋 순서대로, 브랜치 `design-system-web`)

| 커밋 | 내용 |
|---|---|
| `cabd694` | 스펙 문서 추가 |
| `8bf095c` | 구현 계획 추가 |
| `d98987e` | **베이스라인 커밋** (아래 3절 참고 — 매우 중요) |
| `9350f30` | Task 1: 레이아웃 토큰 + 전체 최대폭 1920px |
| `7aa5879` | 계획 문서 보정 (Task 1 리뷰에서 발견한 항목을 Task 3/9에 반영) |
| `37be761`, `17b1c22` | Task 2: 타이포그래피 8단 스케일 통일 |
| `a90228f` | **디자인 시스템과 무관한 별도 커밋** (아래 4절 참고) |
| `5a92aab` | Task 3: 색상 primitive 보강 + 상태/elevation/차트 토큰 |
| `ccac7f4` | Task 4: 선택 상태 전부 브랜드 블루 통일 |
| `90703a8` | Task 5: 카드 호버 → elevation 토큰 |
| `610e95a` | Task 6: ghost 버튼/text-link 계층 추가 |
| `b2e55a3`, `31261be` | Task 7: 배지 시스템 도입 |
| `3ff9bb8` | Task 8: 간격 스케일 확장(32/40/48px) + 여백 스냅 |
| `69d17a8` | Task 9: 드로어/토스트 폭 통일, elevation 토큰화 |
| `3f3f0a6` | Task 10: `home-header` → 범용 `tds-page-header` |
| `e38a8c5`, `72f3529` | Task 11: 차트 색상 토큰화, 고정 그리드 → auto-fit |
| `f3035a3`, `4c6cf25` | Task 12: `DESIGN_SYSTEM.md` 최종 갱신 + 전체 검증 |

**모든 태스크는 `npx tsc --noEmit`, `npm run lint` 통과 확인됨. Task 6·10·12는 `npm run build`까지 통과(32개 라우트 생성) 확인됨.**

각 태스크는 개별 리뷰(spec 준수 + 코드 품질)를 거쳤고, 발견된 이슈는 수정 라운드로 해결했다. 남은 건 "Minor(보류)"로 원장에 기록된 것들뿐이며, 아래 5절에 정리했다.

## 3. 중요한 발견 사항 — 반드시 알아야 할 것

### 3.1 이 세션 시작 전 이미 존재했던 미커밋 상태 (베이스라인 커밋의 배경)

세션을 시작해보니 다음 파일들이 **한 번도 git에 커밋된 적이 없었다** (완전 untracked):
- `src/app/design-system.css` (이미 459줄짜리 "우리집 재무 UI foundation" 파일이 작성되어 있었음 — 이전 세션의 결과물로 추정)
- `docs/DESIGN_SYSTEM.md`
- `src/components/FormField.tsx`

그리고 `src/app/globals.css`, `src/app/layout.tsx`(design-system.css import 추가)는 tracked이지만 마지막 커밋 대비 로컬 수정이 쌓여 있었다.

Task 1 담당 subagent가 계획서 지시대로 `git add src/app/design-system.css`를 실행했는데, 이 파일이 커밋된 적이 없다 보니 **기존 455줄 전체가 "Task 1" 커밋에 신규 작성물처럼 통째로 딸려 들어가는 사고**가 있었다. 리뷰에서 이걸 잡아냈고, 사용자 승인을 받아 `d98987e` 커밋으로 "기존 미커밋 작업을 정직하게 베이스라인으로 먼저 커밋"한 뒤, Task 1의 실제 변경분(4줄)만 별도 커밋(`9350f30`)으로 재구성했다. **앞으로 이 두 파일(`design-system.css`, `globals.css`)을 수정할 때는 항상 `git status --short`/`git diff --stat`로 스테이징 범위를 확인하고, 의도한 파일만 명시적으로 `git add <path>`할 것.**

### 3.2 CSS 파일 로드 순서 (매우 중요 — 캐스케이드 이해에 필수)

`src/app/layout.tsx`가 `globals.css`를 먼저, `design-system.css`를 나중에 import한다. 즉 **같은 커스텀 프로퍼티/선택자를 두 파일이 동시에 정의하면 `design-system.css` 쪽이 항상 이긴다.** 이 때문에 실제로 여러 개의 "죽은 코드" 중복 정의가 있었다:
- `globals.css`의 `--ui-control-height`(48px)는 죽은 값이었고 실제로는 `design-system.css`의 44px가 항상 적용되고 있었다 (Task 3에서 `globals.css`의 죽은 6개 선언 삭제로 정리함).
- `.app-drawer` 폭이 `globals.css`는 620px, `design-system.css`는 640px로 서로 달랐는데, 실제 라이브 동작은 이미 640px였다 (Task 9에서 정합성만 맞춤, 기능 변화 없음).
- `.app-toast` 폭도 유사한 불일치가 있었다 (Task 9 Step 2.5에서 정리).

**교훈: 두 파일에 같은 이름이 있으면 반드시 import 순서 기준으로 "누가 실제로 이긴다"를 먼저 확인하고 나서 값을 정하거나 삭제할 것.**

### 3.3 `core.autocrlf=true`로 인한 가짜 `git status` 노이즈

이 저장소는 `git config core.autocrlf`가 `true`다. 그래서 실제 내용은 커밋 상태와 완전히 동일한데도 `git status --short`에는 계속 `M`으로 표시되는 파일들이 있다. **내용이 진짜로 다른지는 반드시 `git diff <base> -- <path>`로 확인할 것 — 결과가 비어있으면 실제 차이는 없는 것이다.** (아래 4절에서 실제로 이 방식으로 44개 파일을 확인했다.)

### 3.4 리뷰 diff 생성 시 주의 — 무관한 커밋이 범위 사이에 끼어들 수 있음

`a90228f`(4절 참고)처럼 이 계획과 무관한 커밋이 태스크 커밋들 사이에 끼어 있으면, `git diff BASE..HEAD`로 범위를 잡을 때 그 무관한 커밋의 변경분(123개 파일, 84,085줄)까지 통째로 딸려 들어온다. 이럴 때는 `git diff BASE..HEAD -- <path1> <path2> ...`처럼 **경로를 명시해서 필터링**해야 리뷰 diff가 오염되지 않는다. 이 세션에서 Task 2 재리뷰, Task 12 재리뷰, 최종 전체 리뷰 모두 이 방식으로 diff 파일을 수작업으로 만들었다.

## 4. 이번 계획과 무관하게 사용자 지시로 처리한 저장소 정리 작업

작업 중 저장소에 이번 계획과 무관한 미커밋/untracked 항목이 약 68개 발견되어, 사용자에게 보고 후 지시받은 대로 처리했다:

- **커밋함** (`a90228f`): `.agents/skills/{banner-design,brand,design,design-system,slides,ui-styling,ui-ux-pro-max}/**` (이미 커밋된 `use-design-md`와 같은 패턴의 스킬 패키지), `docs/HANDOFF_2026-08-30.md`/`HANDOFF_CLAUDE_CLI_2026-08-31.md`/`HANDOFF_UIUX_2026-08-31.md`, `.gitignore` 갱신
- **`.gitignore`에 추가**: `/output/`, `/.artifacts/`, `/.playwright-cli/` (스크린샷·디버그 로그, 커밋 대상 아님)
- **삭제함**: `ui-improvements.patch`(더 이상 깨끗하게 apply 안 됨, 죽은 파일), `finance-project-source.zip`(저장소 자체 압축본, git과 중복), `x.textContent)`(이름 깨진 0바이트 파일)
- **되돌림(discard)**: "가구 구성원 귀속(member attribution) 제거" 리팩터 — `src/actions/*`, `src/lib/*`, `src/app/(app)/**` 등 약 44개 파일 + 3개 파일 삭제 + 미커밋 Supabase 마이그레이션 1개. 이 변경은 어차피 한 번도 커밋/배포된 적이 없어(운영 배포는 `main`의 마지막 커밋 `3e14295` 기준) 사용자가 "제거해"라고 명시적으로 승인해서 `git restore --source=main --worktree`로 44개 파일을 `main` 상태로 되돌렸다. **지금 `git status --short`에 이 44개 파일이 여전히 `M`으로 뜨는데, 이건 3.3절의 autocrlf 노이즈다 — `git diff main -- <path>`로 확인하면 실제 차이는 0이다. 손대지 말 것.**
- **손대지 않음(사용자 지시)**: `supabase/migrations/20260907000000_remove_member_attribution.sql` — 여전히 untracked 상태로 남아있음. 커밋하지 말라고 명시적으로 지시받았다.

## 5. 남은 작업

### 5.1 최우선 — 최종 전체 브랜치 리뷰 결과 처리 (리뷰는 완료됨, 수정은 아직 안 함)

**최종 리뷰(Opus)가 완료됐다.** 결과: **"Ready to merge — With fixes."** 전체 리포트는 `.superpowers/sdd/2026-09-02-web-design-system/progress.md` 맨 아래("Final whole-branch review: complete" 항목)에 요약돼 있고, 원본 전체 텍스트는 이 세션의 대화 로그에만 있다(파일로 저장 안 해뒀음 — 아래 요약이 실질적으로 전부다). **아직 아무 수정도 하지 않았다. Codex가 이어서 fix를 진행해야 한다.**

**Critical (반드시 고칠 것) — 1건:**
- 회색 트랙 위 세그먼트 컨트롤 3곳에서 통일된 선택 상태가 거의 안 보임: `.home-primary-tab-list button.is-selected`(`globals.css:531`), `.home-explorer-tabs button.is-selected`(`:666`), `.monthly-workspace-tabs button[data-selected='true']`(`:1030`). 트랙 배경(`--tds-grey-100`)과 선택 pill 배경(`--tds-blue-50`)의 명도차가 거의 없음(ΔL≈0.008). 이 계획의 핵심 결정("선택 상태 전부 블루로 통일")이 대시보드 메인 탭, explorer 탭, 월간 워크스페이스 탭에서 실질적으로 실패한 상태.
  - **수정안**: 선택된 pill에 `box-shadow: inset 0 0 0 1px var(--state-selected-border);` 추가하거나, 위 3개 트랙의 배경을 `--tds-grey-100` → `--tds-white`/`--tds-grey-50`로 변경. (리뷰어는 후자를 권장 — 스펙의 "블루만" 규칙을 그대로 유지하면서 컨테이너만 바꾸는 방식.)

**Important (고쳐야 함) — 7건:**
1. `--tds-red-400`(`globals.css:676`, `.home-monthly-spending-track span`)이 어디에도 정의 안 됨 → 실제로 투명하게 렌더링되어 대시보드 지출 탐색기 막대가 안 보임. Task 3이 놓친 것. `--tds-grey-600`(14곳)·`--tds-grey-800`(1곳)도 미정의 — `color`라 상속되어 조용히 잘못된 색으로 보임. `globals.css:15` 근처에 `--tds-red-400`, `--tds-grey-600: oklch(0.552 0.024 253)`, `--tds-grey-800: oklch(0.34 0.03 254)` 추가 필요.
2. Task 1/3/8에서 정의한 토큰 9개가 Task 12 시점까지 아무 데서도 안 쓰임: `--text-body-1`, `--chart-target`(스펙 위반 — `globals.css:563` `.home-line-target`은 여전히 정의 안 된 `--tds-blue-300` 폴백 하드코딩 중, `stroke: var(--chart-target);`로 교체 필요), `--ui-space-7/8/9`(Task 8의 존재 이유인데 실제 적용 안 됨 — 적용하거나 삭제 결정 필요), `--ui-elevation-0/1`, `--bp-md`/`--bp-lg`(CSS 커스텀 프로퍼티는 애초에 `@media` 조건에 못 쓰므로 구조적으로 죽은 토큰 — 삭제 권장).
3. 이번에 정리한 셀렉터의 약 40%가 `src/` 어디에서도 JSX로 안 쓰이는 죽은 CSS(`home-flow-cards`, `home-networth-tabs`, `home-filter-chip`, `home-chart-legend`, `home-flow-trend-*` 전체 등). 계획이 렌더링되는 실제 사용처가 아니라 CSS 파일 텍스트 기준으로 대상 목록을 만들었기 때문. 여러 태스크의 변경이 사실상 화면에 아무 영향 없는 no-op이었음. → 별도 후속 작업으로 죽은 CSS 삭제 필요(이번 fix wave에서는 하지 말 것, 범위 분리).
4. `font-size: 12px` 선언 49개가 "8단 스케일" 스윕에서 살아남음(12px는 스케일에 없는 값). Task 2의 검증 grep이 애초에 12px를 못 잡는 패턴이었음. → 9번째 단계(`--text-caption-2: 12px`)를 추가할지, 스케일을 "새 화면 한정" 규칙으로 문서화만 할지 결정 필요.
5. 스펙이 명시한 hex `#76dfad`/`#8ec5ff`가 토큰화 안 됨(`#ff8f95`만 처리됨). `src/app/(app)/dashboard/page.tsx:128`에 인라인 hex 차트 색상이 TSX 안에 그대로 있음(Task 11은 `globals.css`만 봤음).
6. `docs/DESIGN_SYSTEM.md` 자체 모순: 옛 "tds-chip: 정보 배지는 30px" 문장과 새 "tds-badge/tds-chip 역할 분리" 문장이 3줄 간격으로 공존, 옛 "hover는 색상+그림자만" 문장이 새 hover 분리 규칙(카드=elevation/컨트롤=배경만)과 모순. `tds-page-header`/`tds-eyebrow`/`tds-page-subtitle`, auto-fit 그리드 규칙, `--state-*`/`--ui-elevation-*`/`--chart-*` 토큰이 문서에 전혀 언급 안 됨. 레이아웃 표의 "20~28px" 여백 행도 낡음(현재 `clamp(20px, 2vw, 40px)`).

**Minor (참고, 상세는 원장 참고) — 6건**: `.form-field`가 두 파일에 중복 정의(하나는 죽은 코드), `.home-flow-kind`가 `tds-badge` 변형 2개를 손으로 재구현(사용하면 되는데), elevation 토큰군이 rgb/oklch 표기 혼용, 토큰 접두사 관례(`--tds-`/`--ui-`/`--text-`/`--state-`/`--chart-` 등)가 완전히 통일되진 않음(단, 실제 충돌 없음 확인됨), 모바일 미디어쿼리 안에 82px/84px 토스트 위치 잔여 불일치(범위 밖이라 방치), 문서의 weight 범위 표기가 스펙의 단일 weight와 다르고 새로 추가된 3줄만 문체(한다체/합니다체)가 다름.

**보류 항목 6개 재심사 결과**: 5개는 "그대로 보류" 확정(판단 타당함). 단 **"tds-badge-* 5개 변형이 아직 아무데도 안 쓰임"은 "머지 전에 고치기"로 격상** — `.home-flow-kind`가 실제로 이 변형들을 손으로 복제하고 있어서, `src/app/(app)/dashboard/DashboardMonthlyDetail.tsx:19` 근처에서 className을 `home-flow-kind` → `tds-badge tds-badge-info`/`tds-badge-negative`로 바꾸고 `globals.css`의 중복 CSS 3줄을 지우면 저렴하게 해결됨.

**리뷰 프로세스 참고사항**: 리뷰용 diff 경로 목록(`design-system.css`/`globals.css`/`AppShell.tsx`/`dashboard page.tsx`/`DashboardRiskOverview.tsx`/`DESIGN_SYSTEM.md`)이 Task 6의 실제 JSX 변경 파일(`DashboardAssetOverview.tsx` 등 5개)을 빠뜨려서 리뷰어가 직접 트리를 읽어 확인해야 했다. 이런 종류의 계획에서 리뷰 패키지를 만들 때는 계획 문서의 파일 목록이 아니라 `git log --name-only`로 범위를 훑어서 경로를 뽑아낼 것.

**Codex가 할 일 (순서대로):**
1. **fix subagent 1회**를 위 Critical 1건 + Important 7건 + 격상된 Minor(badge 미사용) 1건 전체를 한 번에 담아서 dispatch한다 (건별로 나누지 말 것 — `subagent-driven-development` 스킬 규칙: "dispatch ONE fix subagent with the complete findings list"). 문서(#6, `DESIGN_SYSTEM.md`) 수정도 같은 wave에 포함하되, "고치거나 명시적으로 문서화" 방식 중 택1해서 처리(예: 12px 스케일 갭은 토큰 추가 대신 "이 스케일은 신규 화면 기준" 문장을 doc에 추가하는 것도 유효한 해결책).
2. fix가 끝나면 `scripts/review-package`로 fix 범위만 스코프한 diff를 만들어 **scoped re-review 1회**만 진행한다.
3. re-review에서 남는 이슈는 "1차 fix wave 이후 잔여 이슈는 2차 fix wave 없이 사용자에게 보고"하는 규칙대로 처리 — park하거나 판단(ruling)만 하고 더 반복하지 않는다.
4. 죽은 CSS 삭제(Important #3)는 **이번 fix wave에 포함하지 말고 별도 후속 작업으로 남긴다** — 리뷰어의 명시적 권고.
5. 전부 끝나면 이 계획의 워크스페이스(`.superpowers/sdd/2026-09-02-web-design-system/`)를 삭제하고(`rm -rf`), `finishing-a-development-branch` 스킬로 브랜치 통합 방법을 사용자와 결정한다.

### 5.2 이미 원장에 기록된, 보류 중인 Minor 항목들 (최종 리뷰에서 triage됨)

이 항목들은 각 태스크 리뷰에서 이미 발견했고, "블로킹 아님"으로 보류해둔 것들이다. 최종 리뷰 subagent에게 이미 넘겼으니 그 결과(keep-deferred/fix-before-merge)를 확인하면 된다:

1. `.mobile-lnb-item.is-selected`(`globals.css`)가 여전히 `--tds-blue-50`/`--tds-blue-600`을 하드코딩(공유 토큰 미사용). `md:hidden`이라 웹 스코프 밖 — 값 자체는 이미 토큰값과 동일해서 시각적 문제 없음.
2. `.settings-back-link`가 14px→13px, `.dashboard-alert-strip a`가 weight 750→700으로 `.tds-text-link` 통합 과정에서 미세하게 바뀜(계획서 자체의 고정값 때문, 구현 오류 아님).
3. `.home-debt-view a` — 실제 사용처가 코드베이스 어디에도 없는 죽은 CSS로 확인됨(색상만 정리, JSX 연결 대상 없음).
4. Task 6 계획서에 `.monthly-description-button`이 언급됐지만 실제 Step에는 없던 항목 — 계획서 오탈자, 손대지 않은 게 맞음.
5. 새로 만든 `.tds-badge-*` 5개 변형 클래스가 아직 어떤 컴포넌트에서도 쓰이지 않음(정의만 완료, 적용은 범위 밖).
6. `.home-flow-trend-legend .is-income::before`/`.is-expense::before`가 이미 토큰화된 `.home-chart-legend` 형제 선택자와 구조는 같은데 Task 11의 명시적 목록에 없어서 아직 `--tds-*` 직접 참조로 남아있음.

### 5.3 이번 계획 범위 밖 — HANDOFF 문서(`docs/HANDOFF_UIUX_2026-08-31.md`)에 이미 있던 백로그

이건 이번 세션이 만든 게 아니라 원래 있던 후속 작업 목록이다. 참고만 할 것:
- `Badge`, `Amount`, `ConfirmButton`, `FormField`, `TableCard` 같은 React 컴포넌트화 (이번 계획은 CSS 클래스까지만 정의했고 컴포넌트 신설은 의도적으로 범위 밖으로 뒀다 — 이제 `tds-badge` CSS가 있으니 `Badge` 컴포넌트를 만들기 좋은 시점)
- 투자·대출·리포트·전체 거래 표의 모바일 카드화
- 상태 변경 되돌리기/변경 이력

### 5.4 세션이 처리하지 못한, 사용자가 별도로 봐야 할 것

- `supabase/migrations/20260907000000_remove_member_attribution.sql`: 여전히 untracked. 이 마이그레이션을 실행/커밋할지는 사용자 판단 필요(4절 참고, 손대지 말라고 지시받은 상태 그대로 둠).

## 6. 검증 명령 모음 (그대로 복사해서 쓰면 됨)

```bash
cd "/c/Users/미니쉬테크놀로지-김규남/Desktop/dev/personal-finance"
git branch --show-current   # design-system-web 이어야 함
npx tsc --noEmit
npm run lint
npm run build   # Supabase 환경변수 미설정으로 데이터 수집 단계에서 멈출 수 있음(기존부터 있던 동작) — 컴파일 자체 성공만 확인
```

## 7. 이 문서 자체에 대해

이 문서는 인수인계용이며 최종 사용자 문서가 아니다. 작업이 끝나면(최종 리뷰 클린 + 브랜치 정리 완료) 삭제하거나 `docs/HANDOFF.md`에 요약을 흡수시켜도 된다.
