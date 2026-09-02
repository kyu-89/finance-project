# personal-finance — Claude CLI 인수인계

작성일: 2026-08-31
프로젝트 경로: C:\Users\미니쉬테크놀로지-김규남\Desktop\dev\personal-finance
원본 Excel: 2026년 (1).xlsm

이 문서는 Claude CLI가 현재 상태를 파악하고 바로 다음 작업을 이어가기 위한 작업 문서다.

## 1. 현재 상태

- main 브랜치는 origin/main과 일치한다.
- Excel 월별 거래 import 개선사항이 적용·push·Production 배포되어 있다.
- UI/UX 개선 patch도 이미 적용·push·Production 배포되어 있다.
- 현재 Production alias: https://personal-finance-one-virid.vercel.app
- 최근 커밋:
  d56a3b1 feat: improve monthly and settings ui
  d093f14 docs: add current project handoff
  0c9f4d3 fix: import monthly workbook categories safely
  10be653 fix: normalize empty import UUID values
  02e11e9 fix: keep recurring duplicate matching flow-safe

## 2. UI improvement patch

원본 파일은 ui-improvements.patch이며 현재 untracked로 보존되어 있다. 내용은 이미 d56a3b1에 적용됐으므로 다시 git apply하지 않는다. 재적용하면 충돌한다.

변경 파일:
- src/app/(app)/monthly/AllTransactionsTab.tsx
- src/app/(app)/monthly/MonthlyInputTab.tsx
- src/app/(app)/monthly/MonthlyPageTabs.tsx
- src/app/(app)/monthly/TransactionDetailDrawer.tsx
- src/app/(app)/settings/data/page.tsx
- src/app/globals.css
- src/components/Toast.tsx
- src/components/nav/MobileBottomNav.tsx

변경 내용:
- 월간관리의 기존 세 탭을 기능 삭제 없이 접기/펼치기 섹션으로 재배치했다.
- 월간입력은 기본 open, 전체내역과 예산·결산은 필요할 때 open이다.
- planned 거래 액션 문구를 실제 의미가 드러나도록 변경했다.
- 거래 상세 drawer에서 정부지원금/경조사 상세 영역을 관련 거래에만 노출한다.
- 모바일 drawer를 bottom sheet 형태로 보이게 했다.
- 설정 > 데이터 관리의 고급 import/audit 항목을 접을 수 있게 했다.
- spacing, control height, radius, focus/hover/active 스타일을 CSS 변수와 공통 규칙으로 정리했다.
- 모바일 하단 내비게이션, safe-area, textarea, Toast 표시 시간과 aria-live를 개선했다.
- 데이터 모델, API, Server Action, DB migration은 변경하지 않았다.
- 고급 import 기능도 삭제하지 않았다.

## 3. Excel import 개선

주요 커밋은 0c9f4d3다.
- transaction-import.ts: 월별 좌측 수입표/우측 지출표 분리 파싱
- 수입/지출 대분류와 소분류 분리 저장
- 빈 날짜, 0원, 템플릿, 문자형 주석 행 제외
- 수입 카테고리 import 지원
- WorkbookMonthlyImport.tsx: 결제수단·카테고리·소분류 매핑
- transactions.ts: subcategoryId를 subcategory_id에 저장
- recurring-duplicates.ts: flowClass가 다른 거래를 중복 후보에서 제외
- 빈 문자열 UUID를 null로 정규화

원본 파일 위치:
C:\Users\미니쉬테크놀로지-김규남\Desktop\dev\personal-finance\2026년 (1).xlsm

## 4. 검증 결과

- Unit test: 33 files / 131 tests passed
- git diff --check: passed
- local next build: passed
- Vercel Production build: passed
- TypeScript 및 29개 라우트 생성: passed
- Production에서 로그인 후 /dashboard, /monthly, /finance, /settings, /settings/data 확인
- 배포 후 브라우저 console error 없음

주의: 전체 npm test를 한 번에 실행하면 공유 Supabase DB integration 테스트가 병렬 실행되어 실패한 적이 있다. tests/integration/rls-households.test.ts를 단독 실행하면 8개 모두 통과했다. Integration 테스트는 파일별 또는 직렬 실행으로 확인한다.

## 5. 아직 남은 작업

1. UI 변경의 모바일/PC 실제 시각 검수
2. 월간관리 접기/펼치기와 planned → posted 흐름 E2E
3. 모바일 빠른 입력 10초 UX 검증
4. 대시보드/월간 결산 공통 집계 정합성 검증
5. 보험·예적금·대출 lifecycle 및 반복거래 중복 방지 E2E
6. MFA, RLS, export AAL2, 계좌번호 마스킹 최종 점검
7. 필요할 때 원본 Excel preview 건수/오류 건수 재확인

Excel은 preview만 확인할 때 실제 가져오기 버튼을 누르지 않는다.

## 6. 다음 작업 시작 명령

Set-Location 'C:\Users\미니쉬테크놀로지-김규남\Desktop\dev\personal-finance'
git status --short --branch
git log -5 --oneline
npm.cmd exec -- vitest run tests/unit
npm.cmd run build

수정 후:
git diff --check
git diff --stat

다음 untracked 파일은 기존 산출물로 취급하고 임의로 삭제하거나 commit하지 않는다.
- .artifacts/
- docs/HANDOFF_2026-08-30.md
- finance-project-source.zip
- ui-improvements.patch

## 7. 배포

GitHub push:
git config --global http.sslBackend openssl
git push origin main

Production:
npx.cmd --yes vercel@latest --prod --yes

새 deployment URL은 기존 호스트와 달라 로그인 세션이 공유되지 않을 수 있다. 배포 후 새 URL에서 다시 로그인해 화면을 확인한다.

## 8. PRD 핵심 정책

- 1차 메뉴는 대시보드 / 월간관리 / 자산·금융 / 설정 4개다.
- 집계의 source of truth는 raw transaction이다.
- planned는 예정 거래이며 실제 실적에 포함하지 않는다.
- posted만 실제 실적에 포함한다.
- 소비, 저축, 투자, 대출원금, 금융비용을 구분한다.
- 계좌 간 transfer는 소비/수입으로 집계하지 않는다.
- 대출 원금상환은 소비가 아니며 자산형성에 포함한다.
- 보험/예적금/대출 종료 후 planned 생성을 중단한다.
- 개인 데이터 테이블은 RLS로 격리한다.
- service role key와 금융 비밀정보를 client bundle, Git, 문서에 기록하지 않는다.

## 9. 보안 메모

이전 대화에서 Supabase service_role JWT가 노출된 이력이 있으므로 Supabase에서 revoke/rotate해야 한다. 새 키는 채팅이나 문서에 넣지 않는다.

.env*, 원본 Excel, export 파일은 Git에 넣지 않는다.

