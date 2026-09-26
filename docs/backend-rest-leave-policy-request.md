# 병동 공통 휴무 정책: 구현된 API 계약

2026-09-20 기준. 이전의 localStorage 저장/언어별 국가 추론 요청을 대체합니다.

## 서버 및 DBA 문서

서버 저장소의 `docs/ward-rest-leave-policy-dba.md`에 전체 DDL, Flyway V45 적용, 사전/사후 검증, 롤백, API, 기존 브라우저 설정 처리 절차가 있습니다.

로컬 서버 작업 폴더는 `dutying-server-rest-leave-policy`, 브랜치는 `codex/ward-rest-leave-policy`입니다. 이 문서를 작성하면서 실제 DB에 DDL을 실행하지 않았습니다.

## API

`GET` / `PUT /wards/{wardId}/rest-leave-policy`

기존 웹 관리자 인증과 병동 ACTIVE 멤버십이 필요합니다. 401 미인증 / 403 권한 없음 / 400 값 오류 / 409 오래된 version.

```ts
type RestLeavePolicy = {
    enabled: boolean;
    targetMode: 'weekly' | 'fixed';
    weeklyOffDays: number; // 1~7
    fixedMonthlyOffDays: number; // 0~31
    includeHolidays: boolean;
    countedRestShiftTypeIds: number[] | null; // null: 기본 포함, []: 포함 없음
    leaveCountMode: 'allLeaves' | 'offOnly';
    carryOverEnabled: boolean;
    holidayCountry: string | null; // GB, IE, KR 등 지원 국가 코드
    holidayRegion: string | null; // GB의 ENG / WLS / SCT / NIR 등 국가 내부 지역 키
};
type Response = RestLeavePolicy & {wardId: number; persisted: boolean; version: number};
type PutBody = RestLeavePolicy & {version: number};
```

- 미설정 GET은 `enabled=false, persisted=false, version=0, holidayCountry=null, holidayRegion=null`.
- 첫 PUT version=0, 이후는 읽은 version. 성공 응답에서 version 증가.
- 공휴일을 포함하는 활성 정책에는 국가 필수. GB는 지역 필수.
- 국가/지역은 표시 언어 및 Accept-Language와 독립적으로 유지.
- 목록은 `holiday-location.ts`의 41개 국가와 date-holidays 3.36.1 지역 목록 사용. 서버 `WardHolidayLocation`과 함께 변경.

## 계산 및 프론트 동작

- weekly: 실제 달력의 주간 휴무일 개수. fixed: 고정 일수.
- 공휴일 추가는 기존 주간 휴무일과 겹치지 않는 날짜만 적용. fixed 모드는 기존과 같이 토·일 중복 제외.
- 공휴일 캐시는 국가+지역+연도/월로 분리.
- query key `['ward', 'restLeavePolicy', wardId]`, 30초/포커스 복귀 재조회.
- 서버 성공 후만 성공 알림. 실패 시 입력 보존, 로컬 fallback 저장 없음.
- 편집 중 재조회는 초안을 덮어쓰지 않음. 409면 명시적으로 입력 취소 후 최신값 불러오기.
- 서버 미설정일 때만 이전 localStorage 설정을 수동으로 가져올 수 있음. 자동 업로드 없음.
- `+1/-1` 월/팀별 임시 보정은 별개로 기존 localStorage 유지. 공통 정책 공유 범위에 포함되지 않음.

## 배포

DB 마이그레이션 → 서버 API → 프론트 순서. 구 API 서버에 새 프론트만 배포하면 설정 조회가 실패합니다. 첫 공통 설정 저장 전에는 휴무 체크가 비활성입니다. 기존 사용자에게 국가 확인과 첫 저장을 안내해 주세요.
