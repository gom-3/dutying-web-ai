# 병동 게시판 글 작성 500 오류 전달 문서

작성일: 2026-06-02

## 요약

병동 게시판에서 글 작성 시 아래 API가 500을 반환합니다.

```http
POST https://dev.api.dutying.net/wards/287/board/posts
```

응답:

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버에 오류가 발생하였습니다."
}
```

프론트 요청 형식은 백엔드 컨트롤러 스펙에 맞게 수정/확인되었습니다. 현재는 서버가 요청을 받은 뒤 게시글 저장 과정에서 실패하는 것으로 보입니다.

## 재현 상황

1. 웹 앱에서 병동 게시판 진입
2. 제목 `123`, 내용 `123` 입력
3. 글 작성 요청
4. `POST /wards/287/board/posts`가 500 반환

브라우저 콘솔:

```text
POST https://dev.api.dutying.net/wards/287/board/posts 500 (Internal Server Error)
code: "INTERNAL_SERVER_ERROR"
message: "서버에 오류가 발생하였습니다."
```

## 프론트 요청 확인

현재 프론트는 query string이 아니라 JSON body로 전송합니다.

```http
POST /wards/287/board/posts
Content-Type: application/json
```

```json
{
  "title": "123",
  "content": "123"
}
```

선택 필드가 있을 때만 아래 값이 body에 포함됩니다.

```json
{
  "deadlineDate": "2026-06-10",
  "imageUrls": ["https://example.com/post.png"]
}
```

프론트 수정 파일:

```text
apps/app/src/shared/api/board/index.ts
apps/app/src/shared/api/board/__tests__/index.test.ts
```

프론트 단위 테스트:

```text
pnpm --dir .\apps\app test:run src/shared/api/board/__tests__/index.test.ts
```

결과: 통과

## 백엔드 스펙과 요청 형식 비교

백엔드 컨트롤러는 JSON body를 받도록 되어 있습니다.

```java
@PostMapping(value = "/posts", consumes = MediaType.APPLICATION_JSON_VALUE)
public WardBoardPostResDto createPost(
        @AuthUser Account account,
        @PathVariable Long wardId,
        @RequestBody @Valid WardBoardPostReqDto.Create reqDto) {
    return wardBoardService.createPost(account, wardId, reqDto);
}
```

관련 파일:

```text
src/main/java/com/gom3/dutying/domain/wardBoard/api/WardBoardController.java
src/main/java/com/gom3/dutying/domain/wardBoard/dto/WardBoardPostReqDto.java
```

`WardBoardPostReqDto.Create`는 아래 필드를 기대합니다.

```text
title: required, max 100
content: required, max 5000
deadlineDate: optional LocalDate
imageUrls: optional list, max 5
```

따라서 현재 프론트 요청 `{ title, content }`는 백엔드 DTO와 맞습니다.

## 유력한 원인

병동 관리자 계정으로 작성할 때, 게시글 작성자 저장 과정에서 `author_account_id` FK가 깨지는 것으로 의심됩니다.

### 1. `@AuthUser`는 principal의 `account`를 꺼냄

```java
@AuthenticationPrincipal(expression = "#this == 'anonymousUser' ? null : account")
public @interface AuthUser {
}
```

관련 파일:

```text
src/main/java/com/gom3/dutying/domain/auth/service/AuthUser.java
```

### 2. 병동 관리자 principal은 호환용 `Account` 객체를 새로 만듦

```java
public Account getAccount() {
    Account account = Account.builder()
            .email(wardAdminAccount.getEmail())
            .name(wardAdminAccount.getName())
            .provider("WARD_ADMIN")
            .providerId(String.valueOf(wardAdminAccount.getId()))
            .build();

    account.updateIsManager(true);

    try {
        Field idField = account.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(account, wardAdminAccount.getId());
    } catch (Exception ignored) {
    }

    return account;
}
```

관련 파일:

```text
src/main/java/com/gom3/dutying/domain/wardAdmin/service/WardAdminAccountAdapter.java
```

이 객체는 실제 `account` 테이블에 존재하는 row가 아닐 수 있습니다.

### 3. 게시글 저장은 이 `Account`를 author로 그대로 저장함

```java
WardBoardPost post = postRepository.save(WardBoardPost.builder()
        .ward(ward)
        .author(account)
        .title(...)
        .content(...)
        .deadlineDate(reqDto.getDeadlineDate())
        .imageUrls(...)
        .build());
```

관련 파일:

```text
src/main/java/com/gom3/dutying/domain/wardBoard/service/WardBoardService.java
```

### 4. DB는 `author_account_id`가 실제 `account.account_id`를 참조해야 함

```sql
author_account_id bigint not null,
constraint fk_ward_board_post_author
    foreign key (author_account_id) references account (account_id)
```

관련 파일:

```text
src/main/resources/db/migration/V31__ward_board_mvp.sql
```

즉, 병동 관리자 계정 ID가 `ward_admin_account_id` 기준이면 `account.account_id`에 존재하지 않을 수 있고, 이 경우 게시글 insert 시 FK 위반으로 500이 발생할 수 있습니다.

## 왜 이 원인이 유력한가

- 접근 권한 체크는 병동 관리자 계정을 별도로 허용합니다.
- 하지만 게시글 저장은 작성자를 일반 `Account`로만 저장합니다.
- 같은 백엔드의 병동 캘린더 일정 저장 로직은 관리자 principal일 때 `createdByAccount`를 `null`로 처리하는 방어 코드가 있습니다.

예시:

```java
private Account mutableEventActor(Account account) {
    return wardCalendarAccessService.isWardAdminPrincipal(account) ? null : account;
}
```

관련 파일:

```text
src/main/java/com/gom3/dutying/domain/wardCalendar/service/WardCalendarEventService.java
```

게시판 쪽에는 이와 같은 관리자 작성자 처리 로직이 빠져 있는 것으로 보입니다.

## 확인 요청

백엔드 로그에서 아래 키워드를 확인 부탁드립니다.

```text
DataIntegrityViolationException
fk_ward_board_post_author
author_account_id
ward_board_post
ConstraintViolationException
```

추가 확인:

- 일반 간호사/병동 구성원 계정으로 글 작성하면 성공하는지
- 병동 관리자 계정으로 글 작성할 때만 실패하는지
- 실패한 관리자 계정의 `ward_admin_account_id`가 `account.account_id`에도 존재하는지

## 수정 방향 제안

### 권장 방향

게시판 작성자 모델에서 일반 `Account` 작성자와 병동 관리자 작성자를 구분해서 저장하는 것이 안전합니다.

예시 방향:

- `ward_board_post.author_account_id`를 nullable로 변경
- `ward_board_post.author_admin_account_id` 추가
- 작성자가 일반 계정이면 `author_account_id` 저장
- 작성자가 병동 관리자면 `author_admin_account_id` 저장
- 응답 DTO의 `authorName`, `isMine` 계산도 두 작성자 타입을 모두 처리

댓글, 좋아요, 확인 기능도 동일하게 `Account` FK를 사용하는지 함께 점검이 필요합니다.

### 임시 방향

병동 관리자 계정에 `migratedFromAccount`가 존재한다면, 게시글 저장 시 호환용 `Account` 대신 실제 persisted `Account`를 사용하도록 치환할 수 있습니다.

단, `migratedFromAccount`가 없는 신규 관리자 계정은 여전히 처리 방식이 필요합니다. 이 경우 500 대신 명확한 400/403 응답을 반환하거나, 위 권장 방향처럼 관리자 작성자를 별도로 저장해야 합니다.

## 결론

프론트 요청 형식은 백엔드 JSON 스펙과 일치합니다.

현재 500은 백엔드에서 병동 관리자 principal을 게시글 작성자 `Account`로 저장하려다 DB FK가 맞지 않아 발생하는 문제로 추정됩니다. 서버 로그에서 `author_account_id` 관련 FK 오류가 확인되면 이 원인이 확정됩니다.
