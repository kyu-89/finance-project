# 웹 디자인 시스템 재정의 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `personal-finance` 웹(≥768px)의 타이포·버튼·배지·필드·선택/호버·간격·오버레이·헤더·차트 규칙을 화면별 임의값 대신 하나의 전역 토큰·클래스 체계로 통일한다.

**Architecture:** 새 React 컴포넌트는 만들지 않는다. `src/app/globals.css`의 `:root`에 누락된 primitive 색상 토큰을 보강하고, `src/app/design-system.css`에 semantic 토큰(타이포/간격/상태/elevation/차트)과 컴포넌트 클래스(`tds-badge`, `tds-button-ghost`, `tds-text-link`, `tds-page-header`)를 추가한 뒤, `globals.css`의 화면별 클래스들이 이 토큰을 참조하도록 값만 치환한다. 모바일 미디어 쿼리(`@media (max-width: 640px/767px)`) 블록은 건드리지 않는다.

**Tech Stack:** Next.js 16 / React 19, Tailwind v4(`@import "tailwindcss"` + `@theme inline`), plain CSS custom properties. 테스트는 Vitest(비즈니스 로직용, 이번 작업과 무관)와 `npx tsc --noEmit` / `npm run lint` / `npm run build`.

**Spec:** `docs/superpowers/specs/2026-09-02-web-design-system-design.md`

## Global Constraints

- 범위는 웹(≥768px)만. 모바일 전용 값(`@media (max-width: 640px)`, `@media (max-width: 767px)` 블록 내부)은 이번 계획에서 변경하지 않는다.
- 전체 레이아웃 최대폭은 **1920px**(LNB 포함), 초과분은 좌우 여백으로 흡수한다.
- "선택됨(selected)" 상태는 예외 없이 `background: var(--tds-blue-50); color: var(--tds-blue-600)`로 통일한다. 반전 검정(`grey-900`+흰 텍스트), 흰색+그림자 스타일은 전부 제거한다.
- 새 React 컴포넌트를 만들지 않는다 — CSS 클래스·토큰 추가 및 기존 클래스의 값 치환만 한다.
- 각 작업 후 `npx tsc --noEmit`과 `npm run lint`가 통과해야 한다(둘 다 사전 조건 없이 실행 가능, `.env.local` 존재 확인됨).
- 커밋은 작업 단위로 나눠서 한다 (`git commit`), 브랜치는 `design-system-web`(이미 생성·체크아웃됨).

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/app/globals.css` | `:root` primitive 토큰(`--tds-*`) 보강분 추가. 화면별 클래스(`home-*`, `monthly-*`, `settings-*`, `dashboard-*`)의 하드코딩 값을 토큰 참조로 치환. |
| `src/app/design-system.css` | semantic 토큰(`--text-*`, `--state-*`, `--ui-elevation-*`, `--chart-*`, `--ui-space-7~9`, `--app-max-width`) 신설. `tds-badge`, `tds-button-ghost`, `tds-text-link`, `tds-page-header`/`tds-eyebrow`/`tds-page-subtitle` 클래스 신설. |
| `src/components/nav/AppShell.tsx` | 최상위 레이아웃에 `max-width: var(--app-max-width)` 래퍼 적용. |
| `src/app/(app)/dashboard/page.tsx` | `home-header`/`home-eyebrow`/`home-subtitle` → `tds-page-header`/`tds-eyebrow`/`tds-page-subtitle`로 클래스명 교체. |
| `docs/DESIGN_SYSTEM.md` | 사용자 대상 규칙 문서를 최종 상태로 갱신. |

---

### Task 1: 레이아웃 토큰 + 전체 최대폭 1920px 적용

**Files:**
- Modify: `src/app/design-system.css:9-25` (`:root` 블록)
- Modify: `src/components/nav/AppShell.tsx:6-11`

**Interfaces:**
- Produces: CSS 커스텀 프로퍼티 `--bp-md`(768px), `--bp-lg`(1280px), `--app-max-width`(1920px). `--ui-page-gutter`를 `clamp(20px, 1.5vw, 28px)` → `clamp(20px, 2vw, 40px)`로 변경.

- [ ] **Step 1: `design-system.css`의 `:root`에 레이아웃 토큰 추가**

`src/app/design-system.css`의 기존 `:root` 블록(9번째 줄부터) 안, `--ui-page-gutter` 선언을 아래로 교체:

```css
--ui-page-gutter: clamp(20px, 2vw, 40px);
--bp-md: 768px;
--bp-lg: 1280px;
--app-max-width: 1920px;
```

- [ ] **Step 2: `AppShell`에 최대폭 래퍼 적용**

`src/components/nav/AppShell.tsx`를 아래로 교체 (바깥 `div`는 배경을 뷰포트 전체로 유지하고, 안쪽 wrapper가 폭을 제한한다):

```tsx
import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[var(--tds-grey-50)]">
      <div className="flex w-full max-w-[var(--app-max-width)]">
        <DesktopSidebar />
        <main className="app-main min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
```

`MobileBottomNav`는 `position: fixed` 하단바이므로 wrapper 밖에 그대로 둔다(폭 제한과 무관하게 화면 전체 하단에 고정돼야 함 — 기존 CSS에 이미 `fixed` 처리돼 있는지 `src/components/nav/MobileBottomNav.tsx`에서 확인 후, 아니라면 `position: fixed` 유지 확인만 하고 수정하지 않는다).

- [ ] **Step 3: 빌드 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음.

- [ ] **Step 4: 개발 서버로 시각 확인**

Run: `npm run dev` 실행 후 브라우저 폭을 2560px로 늘려 콘텐츠가 1920px에서 멈추고 좌우로 `--tds-grey-50` 배경만 남는지 확인. `MobileBottomNav`가 아직 뷰포트 폭에서 보이는 상태라면(개발 중 md 이하로 좁혀서) 정상적으로 하단에 고정되는지도 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/app/design-system.css src/components/nav/AppShell.tsx
git commit -m "feat(design-system): cap app layout width at 1920px"
```

---

### Task 2: 타이포그래피 스케일 토큰 정의 + 헤딩/이름 있는 클래스 적용

**Files:**
- Modify: `src/app/design-system.css:9-25` (`:root`), `:66-71` (`.tds-title`)
- Modify: `src/app/globals.css` (아래 명시된 선택자들)

**Interfaces:**
- Produces: `--text-display`, `--text-title-1`, `--text-title-2`, `--text-title-3`, `--text-body-1`, `--text-body-2`, `--text-caption`, `--text-micro` (모두 `font-size` 값만 담는 토큰; weight는 각 규칙에서 그대로 지정).

- [ ] **Step 1: `design-system.css`의 `:root`에 타이포 토큰 추가**

```css
--text-display: clamp(28px, 2.4vw, 36px);
--text-title-1: clamp(25px, 2vw, 30px);
--text-title-2: 20px;
--text-title-3: 16px;
--text-body-1: 15px;
--text-body-2: 14px;
--text-caption: 13px;
--text-micro: 11px;
```

- [ ] **Step 2: `.tds-title`을 토큰 참조로 교체**

`src/app/design-system.css`:

```css
.tds-title {
  font-size: var(--text-title-1);
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.028em;
}
```

- [ ] **Step 3: 명시적으로 지정된 헤딩/이름 있는 클래스 치환**

`src/app/globals.css`에서 아래 선택자의 `font-size`를 지정된 토큰으로 치환한다(다른 속성은 그대로 둔다):

| 선택자 | 기존 | 변경 |
|---|---|---|
| `.monthly-command-copy h2` | `font-size: 20px;` | `font-size: var(--text-title-2);` |
| `.monthly-report-lead h2` | `font-size: 20px;` | `font-size: var(--text-title-2);` |
| `.home-section-heading h2` | `font-size: 19px;` | `font-size: var(--text-title-2);` |
| `.home-risk-intro h2` | (모바일 미디어쿼리 내부이므로 제외) | 변경 없음 |
| `.home-html-title h2` | `font-size: 16px;` | `font-size: var(--text-title-3);` (값 동일, 토큰 참조로만 교체) |
| `.recurring-form legend` | `font-size: 14px;` | `font-size: var(--text-body-2);` (값 동일, 토큰 참조로만 교체) |
| `.home-eyebrow` | `font-size: 13px; font-weight: 700;` | `font-size: var(--text-caption); font-weight: 650;` |
| `.home-subtitle` | `font-size: 14px;` | `font-size: var(--text-body-2);` |
| `.home-card-heading strong` | `font-size: clamp(27px, 3vw, 38px);` | `font-size: var(--text-display);` |
| `.monthly-summary-card strong` | `font-size: 19px;` | `font-size: var(--text-title-2);` |
| `.home-html-kpi strong` | `font-size: 24px;` | `font-size: var(--text-title-1);` |
| `.home-flow-kpi strong` | `font-size: clamp(18px, 2vw, 24px);` | `font-size: var(--text-title-1);` |
| `.home-debt-primary strong` | `font-size: 24px;` | `font-size: var(--text-title-1);` |

- [ ] **Step 4: `input.quick-add-amount` 예외는 유지 확인**

`src/app/globals.css`의 `input.quick-add-amount { min-height: 64px; font-size: 28px; }` (라인 343 부근)와 모바일 오버라이드(60px/26px)는 문서화된 유일한 예외이므로 **변경하지 않는다**. 그대로 둔 것을 diff에서 확인만 한다.

- [ ] **Step 5: 폼 라벨/힌트 크기를 캡션/마이크로 토큰으로 정렬**

`src/app/design-system.css`의 `.form-field`(약 188번째 줄)와 `.form-field-hint`(약 231번째 줄)를 아래로 교체:

```css
.form-field {
  display: grid;
  min-width: 0;
  gap: 8px;
  color: var(--tds-grey-700);
  font-size: var(--text-caption);
  font-weight: 650;
  line-height: 1.35;
  white-space: normal;
}
```

```css
.form-field-hint {
  color: var(--tds-grey-500);
  font-size: var(--text-micro);
  font-weight: 500;
  line-height: 1.45;
}
```

같은 파일의 `form label:not(.tds-primary-button)...` 트랜지션 규칙(약 239번째 줄)의 `font-size: 13px`도 `font-size: var(--text-caption)`로 교체한다.

- [ ] **Step 6: 나머지 소형(9~12px) 텍스트를 micro 토큰으로 스냅**

`src/app/globals.css`에서 아래 선택자들의 `font-size`를 `var(--text-micro)`로 치환한다(현재 값이 9~12px인 것들 — 값 차이가 2px 이내라 시맨틱 재분류 없이 스냅 가능):

`.home-allocation-legend p`, `.home-line-label`, `.home-line-target-label`, `.home-trend-month > span`, `.home-cashflow-chart small`, `.home-rate-chart small`, `.home-debt-chart small`, `.home-asset-trend small`, `.home-flow-trend-value`, `.home-flow-trend-labels`, `.home-explorer-children small`, `.home-monthly-subcategory-children a`, `.home-rank`, `.home-ranked-row small`

- [ ] **Step 7: 검증**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음.

Run: `grep -n "font-size: 1[789]px\|font-size: 2[1-9]px\|font-size: 3[2-9]px" src/app/globals.css`
Expected: `@media` 블록(모바일 전용) 안의 결과만 남아야 한다. 웹 기본 규칙(미디어쿼리 밖)에 남아있다면 위 표에 빠진 케이스이므로 같은 방식으로 토큰에 매핑해 추가로 치환한다.

- [ ] **Step 8: 커밋**

```bash
git add src/app/design-system.css src/app/globals.css
git commit -m "feat(design-system): unify typography scale to 8 tokens"
```

---

### Task 3: 색상 primitive 보강 + 상태·elevation·차트 토큰 정의

**Files:**
- Modify: `src/app/globals.css:3-31` (`:root`)
- Modify: `src/app/design-system.css:9-25` (`:root`)

**Interfaces:**
- Produces: `--tds-yellow-50`, `--tds-yellow-700`, `--tds-blue-700`, `--tds-green-600`, `--tds-red-600` (primitive), `--state-selected-bg`, `--state-selected-fg`, `--state-selected-border`, `--ui-elevation-0~3`, `--ui-elevation-toast`, `--chart-income`, `--chart-expense`, `--chart-wealth`, `--chart-target`, `--chart-current-bg` (semantic).

**현재 문제**: `var(--tds-yellow-700)`, `var(--tds-yellow-50, #fffaf0)`, `var(--tds-blue-700)`, `var(--tds-green-600, var(--tds-green-500))`가 `globals.css`에서 참조되지만 `:root`에 정의돼 있지 않다(fallback이 있는 곳은 fallback값으로 렌더링되고 있었을 뿐).

- [ ] **Step 1: `globals.css`의 `:root`에 누락 primitive 추가**

`src/app/globals.css`의 `:root` 블록, `--tds-green-500: oklch(0.493 0.143 154);` 다음 줄에 추가:

```css
--tds-green-600: oklch(0.438 0.143 154);
--tds-red-600: oklch(0.558 0.218 22);
--tds-blue-700: oklch(0.462 0.176 258);
--tds-yellow-500: oklch(0.795 0.16 92);
--tds-yellow-50: oklch(0.97 0.03 92);
--tds-yellow-700: oklch(0.52 0.13 78);
```

- [ ] **Step 2: `design-system.css`의 `:root`에 상태/elevation/차트 토큰 추가**

```css
--state-selected-bg: var(--tds-blue-50);
--state-selected-fg: var(--tds-blue-600);
--state-selected-border: var(--tds-blue-500);

--ui-elevation-0: none;
--ui-elevation-2: 0 8px 24px oklch(0.155 0.06 261 / .06);
--ui-elevation-3: 0 12px 32px oklch(0.155 0.06 261 / .10), 0 2px 6px oklch(0.155 0.06 261 / .06);
--ui-elevation-toast: 0 12px 36px rgb(0 0 0 / .2);

--chart-income: var(--tds-blue-500);
--chart-expense: var(--tds-red-500);
--chart-wealth: var(--tds-green-500);
--chart-target: oklch(0.75 0.1 254);
--chart-current-bg: var(--tds-blue-50);
```

(`--ui-elevation-1`은 이미 파일에 정의돼 있으므로 그대로 둔다.)

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음. (CSS 변수 추가만이므로 타입/린트 영향 없음 — 실패 시 문법 오류 확인.)

- [ ] **Step 4: 커밋**

```bash
git add src/app/globals.css src/app/design-system.css
git commit -m "feat(design-system): define missing color primitives and state/elevation/chart tokens"
```

---

### Task 4: 선택(selected) 상태 통일

**Files:**
- Modify: `src/app/globals.css` (아래 선택자 전부)

**Interfaces:**
- Consumes: Task 3에서 정의한 `--state-selected-bg`/`--state-selected-fg`.

- [ ] **Step 1: 홈 멤버 필터(반전 검정) 교체**

`.home-filter-chip.is-selected { background: var(--tds-grey-900); color: white; }` →

```css
.home-filter-chip.is-selected { background: var(--state-selected-bg); color: var(--state-selected-fg); }
```

- [ ] **Step 2: 탭류(흰색+그림자) 전부 교체**

아래 각 규칙을 동일 패턴으로 교체한다 — `background: var(--tds-white); color: var(--tds-blue-600); box-shadow: ...` 조합을 `background: var(--state-selected-bg); color: var(--state-selected-fg);`로, `box-shadow` 선언은 제거한다.

- `.home-networth-tabs button.is-selected`
- `.home-primary-tab-list button.is-selected`
- `.home-explorer-tabs button.is-selected`
- `.settings-month-switcher button.is-selected`
- `.monthly-workspace-tabs button[data-selected='true']`

예:
```css
.home-networth-tabs button.is-selected { background: var(--state-selected-bg); color: var(--state-selected-fg); }
```

- [ ] **Step 3: 월 선택기(강한 채움형) 교체**

`.home-month-selector button.is-selected { border-color: var(--tds-blue-500); background: var(--tds-blue-500); color: var(--tds-white); }` →

```css
.home-month-selector button.is-selected { border-color: var(--state-selected-border); background: var(--state-selected-bg); color: var(--state-selected-fg); }
```

- [ ] **Step 4: 필터 프리셋/기간 토글 교체**

- `.dashboard-period-presets a.is-selected { border-color: var(--tds-blue-500); background: var(--tds-blue-500); color: var(--tds-white); }` → `border-color: var(--state-selected-border); background: var(--state-selected-bg); color: var(--state-selected-fg);`
- `.monthly-ledger-period-toggle button[data-selected='true'] { background: var(--tds-blue-500); color: var(--tds-white); }` → `background: var(--state-selected-bg); color: var(--state-selected-fg);`

- [ ] **Step 5: `design-system.css`의 `.tds-chip[data-selected="true"]` 확인**

이미 `border-color: var(--tds-blue-500); background: var(--tds-blue-50); color: var(--tds-blue-600);`로 되어 있어 규칙과 일치한다 — 값을 토큰 참조로만 정리:

```css
.tds-chip[data-selected="true"],
.tds-chip.is-selected {
  border-color: var(--state-selected-border);
  background: var(--state-selected-bg);
  color: var(--state-selected-fg);
}
```

- [ ] **Step 6: 시각 확인**

Run: `npm run dev`. 대시보드(순자산 탭), 월간 관리(작업 탭), 설정(월 스위처), 거래 검색(기간 프리셋) 화면에서 선택된 항목이 전부 동일한 blue-50/blue-600 조합으로 보이는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/app/globals.css src/app/design-system.css
git commit -m "feat(design-system): unify all selected states to brand blue"
```

---

### Task 5: 호버 상태 통일 (카드 vs 컨트롤)

**Files:**
- Modify: `src/app/globals.css:130-137` (`.home-flow-card:hover` 등)

**Interfaces:**
- Consumes: Task 3의 `--ui-elevation-2`.

- [ ] **Step 1: 클릭 가능 카드 호버를 elevation 토큰으로 정리**

`src/app/globals.css`의 아래 규칙:

```css
.home-flow-card:hover,
.home-detail-card:hover,
.home-networth-card:hover,
.home-cash-card:hover,
.home-flow-summary:hover {
  border-color: color-mix(in oklab, var(--tds-blue-500) 28%, var(--tds-grey-200));
  box-shadow: 0 8px 24px rgb(13 25 43 / 0.06);
}
```

`box-shadow` 값을 `var(--ui-elevation-2)`로 교체:

```css
.home-flow-card:hover,
.home-detail-card:hover,
.home-networth-card:hover,
.home-cash-card:hover,
.home-flow-summary:hover {
  border-color: color-mix(in oklab, var(--tds-blue-500) 28%, var(--tds-grey-200));
  box-shadow: var(--ui-elevation-2);
}
```

- [ ] **Step 2: 컨트롤류 호버는 배경 틴트만 유지 확인**

아래는 이미 "배경만 변경" 규칙이라 그대로 둔다(수정 없음, 확인만): `.tds-primary-button:hover`(색상 전환), `.secondary-button:hover`/`.tds-button-secondary:hover`(`background: var(--tds-grey-100)`), `.home-arrow:hover`, `.home-filter-chip:hover`, `.settings-month-switcher button:hover`, `.dashboard-period-presets a:hover`. 이 규칙들에 `box-shadow`가 섞여 있지 않은지 grep으로 확인:

Run: `grep -n ":hover" src/app/globals.css | grep "box-shadow"`
Expected: 카드류(Step 1에서 처리한 5개)를 제외하면 결과 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/globals.css
git commit -m "feat(design-system): route card hover shadows through elevation token"
```

---

### Task 6: 버튼 위계에 ghost/text-link 추가

**Files:**
- Modify: `src/app/design-system.css` (버튼 규칙 근처, 약 73-113번째 줄)
- Modify: `src/app/globals.css` (`.settings-back-link`, `.home-section-heading > a`, `.monthly-description-button`, `.home-debt-view a`, `.home-html-link`, `.dashboard-alert-strip a`)

**Interfaces:**
- Produces: `.tds-button-ghost`, `.tds-text-link` 클래스.

- [ ] **Step 1: `design-system.css`에 두 클래스 추가**

`.secondary-button, .tds-button-secondary:hover...` 블록 뒤에 추가:

```css
.tds-button-ghost {
  display: inline-flex;
  min-height: var(--ui-control-height);
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  padding: 0 12px;
  border-radius: var(--ui-control-radius);
  background: transparent;
  color: var(--tds-blue-600);
  font-size: var(--text-body-2);
  font-weight: 700;
  white-space: nowrap;
}

.tds-button-ghost:hover:not(:disabled) {
  background: var(--tds-grey-100);
}

.tds-text-link {
  color: var(--tds-blue-600);
  font-size: var(--text-caption);
  font-weight: 700;
}

.tds-text-link:hover {
  color: var(--tds-blue-700);
}
```

- [ ] **Step 2: 기존 "더보기"류 링크를 `tds-text-link`로 흡수**

`src/app/globals.css`에서 아래 규칙들의 개별 `color`/`font-size`/`font-weight` 선언을 제거하고, 각 선택자가 이미 갖는 다른 레이아웃 속성(예: `display: inline-flex`, `min-height`)은 그대로 둔다 — 텍스트 스타일만 `.tds-text-link`에 위임하는 것이므로, 실제 JSX에서 `className`에 `tds-text-link`를 추가해야 완전히 적용된다. 이번 CSS 작업 범위에서는 **중복 선언 제거**만 수행한다:

- `.settings-back-link { ... color: var(--tds-blue-600); font-size: 14px; font-weight: 700; }` → `color`/`font-size`/`font-weight` 세 줄 삭제 (레이아웃 속성만 남김), `:hover` 규칙(`color: var(--tds-blue-700)`)도 삭제.
- `.home-section-heading > a { ... color: var(--tds-blue-600); font-size: 13px; font-weight: 700; }` → 동일하게 텍스트 속성 3줄 삭제.
- `.home-debt-view a { ... color: var(--tds-blue-600); font-size: 13px; font-weight: 700; }` → 동일.
- `.home-html-link { ... color: var(--tds-blue-600); font-size: 12px; font-weight: 700; }` → 동일(폭이 12px→13px로 1px 커짐, 허용 범위).
- `.dashboard-alert-strip a { ... color: var(--tds-blue-600); font-size: 12px; font-weight: 750; }` → 동일.

각 선택자가 쓰이는 JSX 파일(`grep -rn "settings-back-link\|home-section-heading\|home-debt-view\|home-html-link\|dashboard-alert-strip" src/app --include=*.tsx`로 찾는다)에서 해당 `<a>`/`<Link>`의 `className`에 `tds-text-link`를 추가한다.

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 오류 없음. 빌드 후 해당 링크들이 이전과 동일한 파란색/굵기로 보이는지(클래스가 두 곳에서 동일 값을 내므로) 개발 서버에서 육안 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/design-system.css src/app/globals.css $(git diff --name-only -- 'src/app/**/*.tsx')
git commit -m "feat(design-system): add ghost button and text-link tiers"
```

---

### Task 7: 배지 시스템 도입 + 칩 역할 축소

**Files:**
- Modify: `src/app/design-system.css` (칩 규칙 뒤, 약 263-291번째 줄)
- Modify: `src/app/globals.css` (`.home-flow-kind`, `.transaction-status-feedback`, `.monthly-planned-queue.has-items`)

**Interfaces:**
- Produces: `.tds-badge`, `.tds-badge-neutral`, `.tds-badge-info`, `.tds-badge-positive`, `.tds-badge-negative`, `.tds-badge-warning`.

- [ ] **Step 1: `design-system.css`에 배지 클래스 추가**

```css
.tds-badge {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 6px;
  padding: 0 8px;
  font-size: var(--text-micro);
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.tds-badge-neutral { background: var(--tds-grey-100); color: var(--tds-grey-700); }
.tds-badge-info { background: var(--tds-blue-50); color: var(--tds-blue-600); }
.tds-badge-positive { background: color-mix(in oklab, var(--tds-green-500) 16%, white); color: var(--tds-green-600); }
.tds-badge-negative { background: color-mix(in oklab, var(--tds-red-500) 14%, white); color: var(--tds-red-600); }
.tds-badge-warning { background: var(--tds-yellow-50); color: var(--tds-yellow-700); }
```

- [ ] **Step 2: 상태 표시 색상 전용 클래스를 배지로 전환**

`src/app/globals.css`의 `.home-flow-kind`(수입/지출 표시)를 아래로 교체:

```css
.home-flow-kind { display: inline-flex; min-height: 22px; align-items: center; border-radius: 6px; padding: 0 8px; font-size: var(--text-micro); font-weight: 800; }
.home-flow-kind.is-income { background: var(--tds-blue-50); color: var(--tds-blue-600); }
.home-flow-kind.is-expense { background: color-mix(in oklab, var(--tds-red-500) 14%, white); color: var(--tds-red-600); }
```

`.transaction-status-feedback`은 배경이 없는 인라인 피드백 문구이므로 배지로 바꾸지 않고 색상 토큰만 정리(`color: var(--tds-green-500)` → `color: var(--tds-green-600)`, `.is-error { color: var(--tds-red-500) }`는 유지).

`.monthly-planned-queue.has-items`는 카드 전체 톤 표시(배지가 아님)이므로 변경하지 않는다.

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: 커밋**

```bash
git add src/app/design-system.css src/app/globals.css
git commit -m "feat(design-system): introduce badge system, migrate flow-kind indicator"
```

---

### Task 8: 간격 스케일 확장 + 여백 스냅

**Files:**
- Modify: `src/app/design-system.css:17-22` (`:root`)
- Modify: `src/app/globals.css` (아래 선택자)

**Interfaces:**
- Produces: `--ui-space-7`(32px), `--ui-space-8`(40px), `--ui-space-9`(48px).

- [ ] **Step 1: 토큰 추가**

`src/app/design-system.css`의 `:root`, `--ui-space-6: 24px;` 다음 줄에 추가:

```css
--ui-space-7: 32px;
--ui-space-8: 40px;
--ui-space-9: 48px;
```

- [ ] **Step 2: 비표준 마진을 가장 가까운 토큰으로 스냅**

`src/app/globals.css`에서 아래 `margin-top` 값을 치환한다(다른 속성은 유지):

| 선택자 | 기존 | 변경 |
|---|---|---|
| `.home-card-heading strong` | `margin-top: 7px;` | `margin-top: var(--ui-space-2);` (8px) |
| `.home-asset-summary` | `margin-top: 24px;` | 변경 없음(이미 토큰값) |
| `.home-allocation-bar` | `margin-top: 23px;` | `margin-top: var(--ui-space-6);` (24px) |
| `.home-networth-tabs` | `margin-top: 22px;` | `margin-top: var(--ui-space-6);` (24px) |
| `.home-debt-view` | `margin-top: 28px;` | 변경 없음(이미 토큰값) |
| `.home-flow-list` | `margin-top: 22px;` | `margin-top: var(--ui-space-6);` |
| `.home-insight` | `margin-top: 19px;` | `margin-top: var(--ui-space-5);` (20px) |
| `.home-primary-tabs` | `margin-top: 22px;` | `margin-top: var(--ui-space-6);` |
| `.home-cost-split` | `margin-top: 22px;` | `margin-top: var(--ui-space-6);` |
| `.home-analysis-note` | `margin-top: 18px;` | `margin-top: var(--ui-space-4);` (16px) |
| `.home-budget-summary` | `margin-top: 22px;` | `margin-top: var(--ui-space-6);` |

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: 커밋**

```bash
git add src/app/design-system.css src/app/globals.css
git commit -m "feat(design-system): extend spacing scale, snap stray margins"
```

---

### Task 9: 오버레이 정합성 수정 (드로어 폭, 토스트/다이얼로그 elevation)

**Files:**
- Modify: `src/app/globals.css:751,757-758,983-984` (드로어/다이얼로그 폭)
- Modify: `src/app/globals.css:737-748` (토스트/컨펌 다이얼로그 shadow)

**Interfaces:**
- Consumes: Task 3의 `--ui-elevation-3`, `--ui-elevation-toast`.

- [ ] **Step 1: 드로어 폭 620px → 640px로 통일**

`src/app/globals.css`에서 아래 3곳의 `min(620px, 100vw)`를 `min(640px, 100vw)`로 교체:

- `.app-drawer { width: min(620px, 100vw); ... }`
- `aside[role="dialog"][aria-modal="true"]:not(.app-drawer) { width: min(620px, 100vw); }`
- `[aria-label="거래 상세"] { width: min(620px, 100vw); }`

(모바일 미디어쿼리 안의 `width: 100%` 규칙들은 폭 지정이 아니므로 변경 대상 아님.)

- [ ] **Step 2: 토스트/다이얼로그 shadow를 토큰으로 교체**

- `.app-toast { ... box-shadow: 0 12px 36px rgb(0 0 0 / .2); ... }` → `box-shadow: var(--ui-elevation-toast);`
- `.confirm-dialog { ... box-shadow: 0 20px 60px rgb(13 25 43 / .22); }` → `box-shadow: var(--ui-elevation-3);`

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npm run lint`

개발 서버에서 거래 추가 드로어와 "거래 상세" 패널의 폭이 동일한지(640px) 육안 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/globals.css
git commit -m "fix(design-system): unify drawer width to 640px, route overlay shadows through elevation tokens"
```

---

### Task 10: 페이지 헤더 일반화

**Files:**
- Modify: `src/app/globals.css:428-430,894-895` (`.home-header`/`.home-eyebrow`/`.home-subtitle`)
- Modify: `src/app/(app)/dashboard/page.tsx:59`

**Interfaces:**
- Produces: `.tds-page-header`, `.tds-eyebrow`, `.tds-page-subtitle` (기존 `.home-header`/`.home-eyebrow`/`.home-subtitle`와 동일한 스타일, 이름만 일반화).

- [ ] **Step 1: 클래스 선택자 이름 변경 (웹 기본 규칙)**

`src/app/globals.css`의 아래 규칙:

```css
.home-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
```

를

```css
.tds-page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
```

로, 그 아래 있는 `.home-eyebrow`/`.home-subtitle` 규칙(Task 2에서 이미 토큰 참조로 값을 바꾼 상태)의 선택자를 각각 `.tds-eyebrow`/`.tds-page-subtitle`로 변경한다.

- [ ] **Step 2: 모바일 오버라이드 선택자도 함께 변경**

`@media (max-width: 640px)` 블록 안의 `.home-header { align-items: flex-start; }`와 `.home-header .tds-title { max-width: 310px; font-size: 25px; }`도 각각 `.tds-page-header`, `.tds-page-header .tds-title`로 선택자만 변경한다(값은 그대로 — 모바일 값은 이번 범위에서 변경 금지 원칙과 별개로, 이건 "값 변경"이 아니라 이름 동기화이므로 허용).

- [ ] **Step 3: 사용처 클래스명 교체**

`src/app/(app)/dashboard/page.tsx`의 아래 줄:

```tsx
<header className="home-header"><div><p className="home-eyebrow">우리집 재무</p><h1 className="tds-title">가계 재무 대시보드</h1><p className="home-subtitle">기준 월: {monthLabel(month)} · 실제로 확정된 데이터를 기준으로 보여줍니다.</p></div></header>
```

를

```tsx
<header className="tds-page-header"><div><p className="tds-eyebrow">우리집 재무</p><h1 className="tds-title">가계 재무 대시보드</h1><p className="tds-page-subtitle">기준 월: {monthLabel(month)} · 실제로 확정된 데이터를 기준으로 보여줍니다.</p></div></header>
```

로 교체한다.

- [ ] **Step 4: 다른 사용처가 없는지 확인**

Run: `grep -rn "home-header\|home-eyebrow\|home-subtitle" src/app src/components`
Expected: 결과 없음(전부 교체 완료).

- [ ] **Step 5: 검증**

Run: `npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 6: 커밋**

```bash
git add src/app/globals.css "src/app/(app)/dashboard/page.tsx"
git commit -m "refactor(design-system): generalize dashboard header into tds-page-header"
```

---

### Task 11: 차트 색상 토큰화 + 그리드 auto-fit 전환

**Files:**
- Modify: `src/app/globals.css` (차트 인라인 hex, 고정 열 그리드)

**Interfaces:**
- Consumes: Task 3의 `--chart-income`/`--chart-expense`/`--chart-wealth`/`--chart-current-bg`.

- [ ] **Step 1: "현재 기간" 강조색 불일치 수정**

`.home-rate-chart > div.is-current { background: var(--tds-green-50, #effaf3); }` →

```css
.home-rate-chart > div.is-current { background: var(--chart-current-bg); }
```

같은 패턴의 `.home-trend-month.is-current`, `.home-cashflow-chart > div.is-current`, `.home-monthly-spending-list > div.is-current`, `.dashboard-period-custom` 안 `.is-current`류(있다면)도 `var(--chart-current-bg)`로 통일한다(이미 `--tds-blue-50` 리터럴을 쓰는 곳은 `var(--chart-current-bg)`로 참조만 교체).

- [ ] **Step 2: 인라인 hex 차트 색을 토큰으로 교체**

아래 선택자의 인라인 hex를 시맨틱 토큰으로 치환:

- `.home-flow-visual .is-income { background: #8ec5ff; }` → 강조가 필요한 보조색이므로 `background: color-mix(in oklab, var(--chart-income) 60%, white);`
- `.home-flow-visual .is-expense { background: #ff8f95; }` → `background: color-mix(in oklab, var(--chart-expense) 55%, white);`
- `.home-cost-track .is-fixed { background: #7c9cf5; }` → `background: color-mix(in oklab, var(--chart-income) 65%, white);`
- `.home-cost-track .is-variable { background: #ff9a9f; }` → `background: color-mix(in oklab, var(--chart-expense) 55%, white);`
- `.home-trend-bars .is-expense { background: #ff8f95; }` → `background: color-mix(in oklab, var(--chart-expense) 55%, white);`

`.home-cashflow-bars i { background: var(--tds-blue-500); }` / `i + i { background: var(--tds-red-500); }` → `var(--chart-income)` / `var(--chart-expense)`로 참조 교체. `.home-debt-chart i { background: var(--tds-blue-500); }` → `var(--chart-income)`. `.home-rate-chart i { background: var(--tds-green-500); }` → `var(--chart-wealth)`. `.home-trend-bars .is-income`/`.is-wealth`, `.home-chart-legend .is-income`/`.is-expense`/`.is-wealth`, `.home-html-legend i.is-blue`/`i.is-red`도 동일하게 `--chart-*` 참조로 교체한다.

- [ ] **Step 3: 고정 열 그리드를 auto-fit으로 전환**

아래 5개 선택자의 `grid-template-columns: repeat(N, ...)`(웹 기본 규칙만, 모바일 미디어쿼리 내부는 제외)를 `repeat(auto-fit, minmax(Xpx, 1fr))`로 교체:

- `.monthly-summary-grid` (line 183): `repeat(4, minmax(0, 1fr))` → `repeat(auto-fit, minmax(220px, 1fr))`
- `.home-flow-cards` (line 502): `repeat(4, 1fr)` → `repeat(auto-fit, minmax(220px, 1fr))`
- `.home-html-kpi-grid` (line 551): `repeat(4, minmax(0, 1fr))` → `repeat(auto-fit, minmax(220px, 1fr))`
- `.home-flow-kpi-grid` (line 643): `repeat(4, minmax(0, 1fr))` → `repeat(auto-fit, minmax(220px, 1fr))`
- `.home-flow-trend-grid` (line 651): `repeat(3, minmax(0, 1fr))` → `repeat(auto-fit, minmax(260px, 1fr))`

모바일 미디어쿼리(`@media (max-width: 640px)`) 안에 있는 같은 이름의 `grid-template-columns: repeat(2, ...)` 오버라이드는 **변경하지 않는다** — 미디어쿼리가 나중에 적용되어 auto-fit을 덮어쓰므로 모바일 동작은 그대로 유지된다.

- [ ] **Step 4: 검증**

Run: `npx tsc --noEmit && npm run lint && npm run build`

개발 서버에서 브라우저 폭 1920px일 때 `home-flow-cards`(대시보드 하단 카드)가 4개 고정이 아니라 카드 폭이 220px 이상을 유지하며 필요시 5~6열까지 늘어나는지 확인. 폭 768~1279px에서는 기존과 동일하게 보이는지(카드가 최소 220px를 유지하며 2~3열)도 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/app/globals.css
git commit -m "fix(design-system): tokenize chart colors, switch fixed grids to auto-fit"
```

---

### Task 12: `docs/DESIGN_SYSTEM.md` 갱신 + 전체 검증

**Files:**
- Modify: `docs/DESIGN_SYSTEM.md` (전체)

- [ ] **Step 1: 문서 갱신**

`docs/DESIGN_SYSTEM.md`의 "레이아웃" 표에 아래 행을 추가:

```markdown
| 웹(≥1280px) | 최대 1920px(LNB 포함), 초과분은 좌우 여백 | 20~40px | 28px |
```

"간격과 모서리" 절에 아래 문장을 추가: `간격 스케일은 4/8/12/16/20/24px에 더해 와이드 화면 섹션 간격용 32/40/48px을 포함한다.`

새 절 "타이포그래피"를 "레이아웃" 절 다음에 추가하고, Task 2의 8단 스케일 표(display/title-1~3/body-1~2/caption/micro, 크기·weight·용도)를 그대로 옮겨 적는다.

"버튼과 상태" 절에 아래 문장 추가: `tds-button-ghost는 툴바 안 3차 행동에, tds-text-link는 인라인 텍스트 링크("더보기" 등)에 사용한다.` 및 `tds-badge는 비대화형 상태 표시(수입/지출/완료/예정 등)에, tds-chip은 클릭 가능한 필터·선택에만 사용한다.`

"선택 상태" 관련 문장을 "탭·필터칩·월 선택기 등 모든 선택 상태는 브랜드 블루(blue-50 배경/blue-600 텍스트) 하나로 통일한다."로 명시적으로 추가.

"오버레이와 피드백" 절의 드로어 폭 문장을 "웹에서는 우측 640px"로 유지(이미 그렇게 적혀 있으므로 실제 CSS와 이제 일치함을 확인만 한다).

- [ ] **Step 2: 전체 검증 실행**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: 셋 다 오류 없이 통과. (`npm run build`는 Supabase 환경변수 미설정으로 데이터 수집 단계에서 멈출 수 있음 — 기존 HANDOFF 문서에 기록된 기존 동작이며, 컴파일 자체가 성공하는지만 확인한다.)

- [ ] **Step 3: 잔여 하드코딩 값 스캔**

Run: `grep -n "background: var(--tds-white); color: var(--tds-blue-600)" src/app/globals.css`
Expected: `tds-chip`/`state-selected` 관련 정식 규칙 외에 개별 화면에 남아있는 유사 패턴이 없는지 확인 — 있다면 Task 4의 패턴대로 `--state-selected-*`로 치환한다.

Run: `grep -n "width: min(620px" src/app/globals.css`
Expected: 결과 없음.

- [ ] **Step 4: 커밋**

```bash
git add docs/DESIGN_SYSTEM.md
git commit -m "docs: sync DESIGN_SYSTEM.md with unified web design tokens"
```

---

## Self-Review 결과

- **스펙 커버리지**: 레이아웃/타이포/색상·상태/버튼/배지·칩/필드·라벨/간격/오버레이/헤더/차트 — 스펙의 1~10절 전부 Task 1~11에 매핑됨. 마이그레이션 범위 5개 항목(design-system.css 재작성, globals.css 스윕, DESIGN_SYSTEM.md 갱신, dashboard 클래스 교체, 모바일 불변)도 각각 대응 Task 있음.
- **플레이스홀더 스캔**: "TBD"/"나중에" 없음. 모든 치환 규칙에 구체적인 선택자·기존값·변경값 명시.
- **타입/이름 일관성**: 토큰명(`--text-*`, `--state-*`, `--ui-elevation-*`, `--chart-*`, `--ui-space-7~9`, `--app-max-width`, `--bp-*`)이 Task 1~3에서 정의된 이름과 Task 4~11에서 참조하는 이름이 동일함을 확인함.

## 실행 방식

**Plan complete and saved to `docs/superpowers/plans/2026-09-02-web-design-system.md`. 두 가지 실행 방식 중 선택해 주세요:**

1. **Subagent-Driven (권장)** — Task마다 새 subagent를 붙여 실행하고, 두 단계 리뷰를 거칩니다.
2. **Inline Execution** — 이 세션에서 배치 단위로 실행하고 체크포인트마다 검토합니다.

어느 쪽으로 진행할까요?
