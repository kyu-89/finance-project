# 웹 디자인 시스템 통일 작업 — 인수인계 (2026-09-02, Claude → Codex)

이 문서는 토큰 소진으로 세션을 넘길 때 Codex가 바로 이어받을 수 있도록 정리한 것이다. 순서대로 읽으면 지금 상태를 그대로 재구성할 수 있다.

## 0. 한 줄 요약

**12개 태스크 전부 구현 + 개별 리뷰 완료.** 남은 건 마지막 "전체 브랜치 통합 리뷰" 결과 확인과, 거기서 나온 지적 처리뿐이다. 브랜치: `design-system-web` (현재 체크아웃됨). 새로 만들 작업은 없다 — 이미 끝난 작업의 마무리만 남았다.

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

### 5.1 최우선 — 최종 전체 브랜치 리뷰 확인

세션 종료 시점에 **최종 리뷰(Opus 모델, subagent)가 백그라운드에서 실행 중**이었다. 이 리뷰는 12개 태스크의 개별 리뷰에서는 안 보였던 "전체 diff 관점" 이슈(토큰 이름 일관성, 파일 간 경계, 문서-코드 불일치 등)를 잡기 위한 것이다.

**Codex가 할 일:**
1. 이 리뷰 subagent가 완료됐는지 확인한다(세션이 끊기면서 결과를 못 받았을 가능성이 높다). 완료 결과가 없으면, `subagent-driven-development` 스킬의 "Final Review" 절차대로 **다시 한 번 최종 리뷰를 돌린다.**
2. 리뷰용 diff 파일은 이미 만들어져 있다: `.superpowers/sdd/2026-09-02-web-design-system/final-review-d98987e..4c6cf25.diff` (아직 유효함 — 그 이후 이 계획 관련 커밋은 없었음). 이 파일을 그대로 재사용해도 되고, 최신 상태 확인을 위해 새로 만들어도 된다:
   ```bash
   git diff -U10 d98987e..HEAD -- src/app/design-system.css src/app/globals.css src/components/nav/AppShell.tsx "src/app/(app)/dashboard/page.tsx" "src/app/(app)/dashboard/DashboardRiskOverview.tsx" docs/DESIGN_SYSTEM.md
   ```
   (반드시 경로를 지정할 것 — 4절의 무관한 커밋 `a90228f`가 범위 안에 끼어 있다.)
3. 리뷰 프롬프트는 `.claude/skills/requesting-code-review/code-reviewer.md` 템플릿 + 아래 "이미 알려진 Minor 항목"을 triage 대상으로 전달한다(구체적 프롬프트 예시는 원장 파일 맨 아래, 또는 이 세션이 마지막으로 던진 프롬프트를 그대로 재사용해도 됨 — 원장에 전체 맥락이 있음).
4. 리뷰에서 Critical/Important가 나오면: **fix 1회 dispatch + scoped re-review 1회**만 진행한다(2차 fix 라운드 없음 — `subagent-driven-development` 스킬 규칙). 잔여 이슈는 사용자에게 최종 보고.
5. 리뷰가 깨끗하면(또는 fix까지 끝나면): 이 계획의 워크스페이스(`.superpowers/sdd/2026-09-02-web-design-system/`)를 삭제하고(`rm -rf`), `finishing-a-development-branch` 스킬로 브랜치 통합 방법(merge/PR 등)을 사용자와 결정한다.

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
