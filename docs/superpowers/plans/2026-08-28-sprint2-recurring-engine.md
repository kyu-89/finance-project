# Sprint 2 — 반복항목 자동생성 엔진

기준: PRD §5.5, §5.6, §6.1, §23.9, §35.

## 완료 조건

- 활성 규칙이 월 진입 시 `planned` 거래를 회차당 정확히 1건 생성한다.
- `recurring_rule_id + occurrence_date` 중복과 회차당 활성 거래 중복을 DB가 차단한다.
- 사용자는 예정건을 수정 후 `posted`로 확정하거나 `skipped`로 건너뛸 수 있다.
- 일시중지·종료 이후에는 새 회차를 만들지 않고 과거 `posted`는 보존한다.
- 모든 테이블은 owner 기반 RLS와 교차 테넌트 FK 검증을 갖는다.
- 소비 합계는 계속 `posted + consumption`만 포함한다.

## 작업 순서

1. `recurring_rules`, `recurring_occurrences`, transaction FK/unique/RLS/tenant trigger migration
2. monthly/weekly/yearly/custom(interval days) 일정 계산 순수 함수와 월말 회귀 테스트
3. 규칙 CRUD 및 월 범위 idempotent materialize 서비스
4. 설정 > 반복항목 관리 UI
5. 월간 진입 시 planned 생성, 예정 배지, 수정·확정·skip UI
6. pause/resume/end 및 이번 달만/이후 모두 변경
7. 직접 입력 posted 거래 중복 후보 탐지와 연결
8. RLS·동시성 통합 테스트, 운영 migration 및 배포

## 불변조건

- 금액은 원 단위 양의 `bigint`.
- 규칙/회차는 hard delete하지 않는다.
- 회차 identity는 `(recurring_rule_id, occurrence_date)`.
- 한 회차에 soft-delete되지 않은 생성 거래는 최대 1건.
- 규칙·분류·결제수단·가구원·회차는 모두 같은 household여야 한다.
- 상품 연동형의 `source_id`는 상품 테이블 도입 전 nullable 참조값이며 원천 계약정보를 복제하지 않는다.
