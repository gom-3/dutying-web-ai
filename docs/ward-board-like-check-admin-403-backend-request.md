# 병동 게시판 좋아요/체크 관리자 계정 403 백엔드 요청

작성일: 2026-06-06

## 요약

웹에서 관리자 계정으로 병동 게시판 글의 좋아요 또는 체크 표시를 누르면 아래 API가 403을 반환합니다.

```http
PUT https://dev.api.dutying.net/wards/326/board/posts/39/likes
PUT https://dev.api.dutying.net/wards/326/board/posts/39/checks
```

응답:

```json
{
  "code": "WARD_ADMIN_ACCOUNT_API_REQUIRED",
  "message": "관리자 계정은 관리자 계정 API를 사용해야 합니다."
}
```

관리자 계정은 병동 게시판을 실제로 사용하는 운영 주체이므로, 게시글 조회/작성뿐 아니라 좋아요와 체크 표시도 정상 동작해야 합니다. 현재는 관리자 계정 권한 또는 API 경로 계약이 맞지 않아 사용자 액션이 실패하는 상태입니다.

## 재현 상황

1. 웹 앱에서 관리자 계정으로 로그인
2. 병동 `wardId=326` 게시판 진입
3. 게시글 `postId=39`에서 좋아요 버튼 클릭
4. `PUT /wards/326/board/posts/39/likes`가 403 반환
5. 같은 게시글에서 체크 버튼 클릭
6. `PUT /wards/326/board/posts/39/checks`가 403 반환

브라우저 콘솔:

```text
PUT https://dev.api.dutying.net/wards/326/board/posts/39/checks 403 (Forbidden)
PUT https://dev.api.dutying.net/wards/326/board/posts/39/likes 403 (Forbidden)

{
  "code": "WARD_ADMIN_ACCOUNT_API_REQUIRED",
  "message": "관리자 계정은 관리자 계정 API를 사용해야 합니다."
}
```

좋아요 API는 여러 번 재시도/클릭 시도 중 반복해서 같은 403이 발생했습니다.

```text
https://dev.api.dutying.net/wards/326/board/posts/39/likes 403
```

## 현재 프론트 요청

프론트는 게시판 좋아요/체크 토글을 아래 API로 호출하고 있습니다.

```http
PUT /wards/{wardId}/board/posts/{postId}/likes
DELETE /wards/{wardId}/board/posts/{postId}/likes

PUT /wards/{wardId}/board/posts/{postId}/checks
DELETE /wards/{wardId}/board/posts/{postId}/checks
```

관련 프론트 코드:

```text
apps/app/src/shared/api/board/index.ts
```

```ts
public async likePost(wardId: number, postId: number) {
    return (await axiosInstance.put<void>(`/wards/${wardId}/board/posts/${postId}/likes`)).data;
}

public async unlikePost(wardId: number, postId: number) {
    return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}/likes`)).data;
}

public async checkPost(wardId: number, postId: number) {
    return (await axiosInstance.put<void>(`/wards/${wardId}/board/posts/${postId}/checks`)).data;
}

public async uncheckPost(wardId: number, postId: number) {
    return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}/checks`)).data;
}
```

게시판 화면에서는 현재 게시글 상태에 따라 위 API를 토글 호출합니다.

```text
apps/app/src/pages/board/index.tsx
```

- `post.isLikedByMe`가 `false`이면 `likePost`, `true`이면 `unlikePost`
- `post.isCheckedByMe`가 `false`이면 `checkPost`, `true`이면 `uncheckPost`

## 현재 의심 지점

서버 응답 코드와 메시지상, 현재 백엔드는 관리자 계정 토큰으로 일반 `/wards/{wardId}` 계열 게시판 액션 API를 호출하는 것을 막고 있습니다.

즉 아래 둘 중 하나로 API 계약 정리가 필요합니다.

### 1. 기존 게시판 액션 API를 관리자 계정에도 허용

관리자 계정이 해당 병동의 ACTIVE 관리자 membership을 가지고 있다면, 아래 API 호출을 허용해야 합니다.

```http
PUT /wards/{wardId}/board/posts/{postId}/likes
DELETE /wards/{wardId}/board/posts/{postId}/likes
PUT /wards/{wardId}/board/posts/{postId}/checks
DELETE /wards/{wardId}/board/posts/{postId}/checks
```

권한 판단 예시:

```text
principalType = WARD_ADMIN
AND ward_admin_memberships.account_id = current admin account
AND ward_admin_memberships.ward_id = requested wardId
AND ward_admin_memberships.status = ACTIVE
```

이 방향이면 프론트 변경 없이 현재 게시판 UX를 복구할 수 있습니다.

### 2. 관리자 전용 게시판 액션 API 제공

백엔드 정책상 관리자 계정은 반드시 관리자 전용 API만 사용해야 한다면, 프론트가 호출할 아래 API 계약이 필요합니다.

```http
PUT /admin/wards/{wardId}/board/posts/{postId}/likes
DELETE /admin/wards/{wardId}/board/posts/{postId}/likes
PUT /admin/wards/{wardId}/board/posts/{postId}/checks
DELETE /admin/wards/{wardId}/board/posts/{postId}/checks
```

이 경우 응답 상태와 의미는 기존 API와 동일하게 맞춰주시면 됩니다.

- 좋아요 성공: `204 No Content` 또는 기존 `/likes` API와 동일 응답
- 좋아요 취소 성공: `204 No Content` 또는 기존 `/likes` API와 동일 응답
- 체크 성공: `204 No Content` 또는 기존 `/checks` API와 동일 응답
- 체크 취소 성공: `204 No Content` 또는 기존 `/checks` API와 동일 응답

필드 의미도 게시글 조회 응답과 연결되어야 합니다.

- 좋아요 후 게시글 목록/상세 재조회 시 `isLikedByMe=true`
- 좋아요 취소 후 `isLikedByMe=false`
- 체크 후 `isCheckedByMe=true`
- 체크 취소 후 `isCheckedByMe=false`
- 카운트 필드가 있다면 좋아요/체크 수가 함께 반영

## 백엔드 확인 요청

아래 항목 확인 부탁드립니다.

1. 관리자 계정이 병동 게시판 글에 좋아요/체크를 할 수 있는 제품 정책이 맞는지 확인
2. 맞다면 관리자 ACTIVE membership이 있는 병동에 대해 아래 기존 API를 허용해도 되는지 확인

```http
PUT /wards/{wardId}/board/posts/{postId}/likes
DELETE /wards/{wardId}/board/posts/{postId}/likes
PUT /wards/{wardId}/board/posts/{postId}/checks
DELETE /wards/{wardId}/board/posts/{postId}/checks
```

3. 기존 API를 허용하지 않는 정책이라면 관리자 전용 API 경로와 응답 스키마 공유
4. 좋아요/체크의 actor 저장 모델 확인
   - 일반 간호사 계정과 관리자 계정이 서로 다른 테이블이라면, 좋아요/체크 작성자도 관리자 계정을 식별할 수 있어야 합니다.
   - `account_id`만 FK로 저장하는 구조라면 관리자 계정에서 FK 오류나 권한 차단이 발생하지 않도록 별도 처리 필요합니다.
5. 게시글 목록/상세 조회의 `isLikedByMe`, `isCheckedByMe` 계산이 관리자 계정에서도 현재 로그인한 관리자 기준으로 동작하는지 확인

## 기대 동작

관리자 계정이 해당 병동의 ACTIVE 관리자라면:

1. 게시판 글 좋아요 클릭 시 403 없이 성공합니다.
2. 좋아요 취소 클릭 시 403 없이 성공합니다.
3. 게시판 글 체크 클릭 시 403 없이 성공합니다.
4. 체크 취소 클릭 시 403 없이 성공합니다.
5. 액션 후 게시글 목록/상세 재조회 시 `isLikedByMe`, `isCheckedByMe` 값이 현재 관리자 계정 기준으로 정확히 내려옵니다.

권한이 없는 병동 또는 삭제/비활성 게시글에 대해서만 명확한 403/404가 발생해야 합니다.

## 프론트 반영 필요 여부

백엔드가 기존 `/wards/{wardId}/board/posts/{postId}/likes|checks` API를 관리자 계정에도 허용하면 프론트 추가 수정은 필요 없습니다.

관리자 전용 `/admin/wards/{wardId}/...` API를 제공하는 방향이면, 프론트에서 관리자 계정 여부에 따라 게시판 좋아요/체크 API 경로를 분기하도록 수정하겠습니다.
