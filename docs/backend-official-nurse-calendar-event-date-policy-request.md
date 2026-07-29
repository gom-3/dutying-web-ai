# 백엔드 요청: 공식 간호 행사/연수 캘린더 날짜 기준 수정

## 배경

현재 듀팅 공식 간호 행사/연수 캘린더는 외부 수집기를 통해 간호 교육, 연수, 세미나, 행사 정보를 수집한 뒤 서버의 공식 캘린더에 import하고 있습니다.

이때 캘린더에 표시되는 날짜는 실제 행사일 또는 교육일이어야 합니다.

하지만 현재 서버 import 로직에서는 수집 데이터에 실제 행사일(`startDate`)이 없을 경우 신청 종료일(`applicationEndDate`) 또는 신청 시작일(`applicationStartDate`)을 캘린더 날짜로 대신 사용하고 있습니다.

이로 인해 실제 행사일이 아닌 신청 마감일이 캘린더에 행사일처럼 표시될 수 있습니다.

## 현재 동작

현재 import 로직은 아래와 같은 우선순위로 캘린더 시작일을 결정합니다.

```java
LocalDate startDate = firstNonNull(
    item.getStartDate(),
    item.getApplicationEndDate(),
    item.getApplicationStartDate()
);
```

즉, 실제 행사일이 없으면 신청기간 날짜가 캘린더 날짜로 사용됩니다.

## 원하는 동작

공식 간호 행사/연수 캘린더에는 실제 행사일 또는 교육일만 표시되어야 합니다.

- 행사일 있음: 캘린더에 표시
- 행사일 없음, 신청기간만 있음: 캘린더에 표시하지 않음
- 신청기간 있음: 상세 보기에서만 표시
- 신청기간 없음: 상세 보기에서 신청기간 항목을 비우거나 표시하지 않음

예시:

```text
행사일: 2026-08-20
신청기간: 2026-08-01 ~ 2026-08-10
```

위 데이터는 캘린더에서 `2026-08-20`에 표시되어야 합니다.

신청기간 `2026-08-01 ~ 2026-08-10`은 상세 보기에서만 보여야 하며, 캘린더 표시 날짜로 사용하면 안 됩니다.

## 수정 요청

서버 import 로직에서 신청기간 fallback을 제거해 주세요.

현재:

```java
LocalDate startDate = firstNonNull(
    item.getStartDate(),
    item.getApplicationEndDate(),
    item.getApplicationStartDate()
);
```

변경 방향:

```java
LocalDate startDate = item.getStartDate();
if (startDate == null) {
    skippedCount++;
    continue;
}
```

`endDate`는 기존처럼 없거나 `startDate`보다 빠르면 `startDate`로 보정해도 됩니다.

```java
LocalDate endDate = item.getEndDate() == null || item.getEndDate().isBefore(startDate)
        ? startDate
        : item.getEndDate();
```

## 신청기간 표시

신청기간은 캘린더 날짜가 아니라 상세 정보로만 사용해야 합니다.

현재 import description 생성 시 신청기간을 넣고 있으므로, 최소 수정 기준으로는 DB 컬럼 추가 없이도 요구사항을 만족할 수 있습니다.

```java
appendLine(description, "신청기간", periodText(item.getApplicationStartDate(), item.getApplicationEndDate()));
```

## DB 수정 여부

필수 DB 수정은 없습니다.

현재 구조에서는 신청기간을 `descriptionKo`에 포함해 상세에서 보여줄 수 있습니다.

다만 앱 상세 화면에서 신청기간을 별도 필드로 구조화해서 보여줘야 한다면 아래 컬럼 추가를 검토할 수 있습니다.

```sql
application_start_date date null
application_end_date date null
```

이 경우 엔티티, DTO, import 저장 로직, 응답 스펙도 함께 수정해야 합니다.

현재 요청 범위에서는 DB 변경 없이 서버 import 로직 수정만으로 충분합니다.

## 기존 데이터 처리

코드 수정 후 새로 수집되는 데이터는 정상 처리됩니다.

다만 이미 신청기간이 캘린더 날짜로 저장된 기존 자동 수집 일정은 그대로 남아 있을 수 있습니다.

따라서 배포 후 한 번의 데이터 정리가 필요합니다.

권장 방식:

1. 외부 수집으로 들어온 공식 일정 중 잘못된 데이터를 soft delete 또는 정리합니다.
2. 수정된 수집/import 로직으로 다시 수집합니다.

자동 수집 데이터는 `external_source`, `external_event_key`, `external_content_hash` 값을 가지고 있으므로, 수동 등록 일정과 구분해서 정리할 수 있습니다.

## 검수 기준

아래 케이스가 만족되면 됩니다.

1. `startDate`가 있는 수집 일정은 해당 날짜에 캘린더 표시됩니다.
2. `startDate`가 없고 `applicationStartDate/applicationEndDate`만 있는 수집 일정은 import 시 skip됩니다.
3. 신청기간은 캘린더 날짜로 사용되지 않습니다.
4. 신청기간은 상세 보기 또는 설명 영역에서만 확인됩니다.
5. 기존 정상 일정의 다국어 제목, 장소, 출처 URL, read-only 속성은 유지됩니다.

## 관련 코드 위치

- 서버 import 로직: `dutying-server/src/main/java/com/gom3/dutying/domain/calendar/service/OfficialCalendarEventService.java`
- 공식 캘린더 엔티티: `dutying-server/src/main/java/com/gom3/dutying/domain/calendar/domain/OfficialCalendarEvent.java`
- 공식 캘린더 응답 DTO: `dutying-server/src/main/java/com/gom3/dutying/domain/calendar/dto/OfficialCalendarEventResDto.java`
- 외부 수집기: `dutying-server/tools/nurse-calendar`

## 요약

공식 간호 행사/연수 캘린더의 날짜 기준은 반드시 실제 행사일/교육일이어야 합니다.

신청기간은 캘린더 표시 날짜로 대체 사용하지 않고, 상세 보기용 부가 정보로만 사용해야 합니다.
