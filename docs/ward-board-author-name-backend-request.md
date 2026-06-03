# 병동 게시판 작성자 이름 오표시 백엔드 요청

## 요약

병동 게시판에서 글을 작성하면, 게시글 작성자 이름이 실제 글쓴 사람 이름이 아니라 `"김찬규"`로 표시되는 현상이 있습니다.

프론트는 게시글 작성 요청 시 작성자 이름을 보내지 않고, 백엔드 응답의 `writerName` 또는 `authorName` 값을 그대로 화면에 표시하고 있습니다. 따라서 백엔드에서 게시글 작성자 저장/조회/DTO 매핑 로직 점검이 필요합니다.

## 현재 현상

1. 로그인한 사용자가 병동 게시판에서 새 글을 작성합니다.
2. 글 작성 성공 후 목록 또는 상세 화면에서 작성자 이름을 확인합니다.
3. 실제 글쓴 사람 이름이 아니라 `"김찬규"`로 표시됩니다.

## 기대 동작

게시글 작성자 이름은 항상 실제 글쓴 사람의 이름으로 내려와야 합니다.

- `POST /wards/{wardId}/board/posts` 작성 성공 응답의 `writerName` 또는 `authorName`
- `GET /wards/{wardId}/board/posts` 목록 응답의 각 게시글 `writerName` 또는 `authorName`
- `GET /wards/{wardId}/board/posts/{postId}` 상세 응답의 `writerName` 또는 `authorName`

위 응답 모두에서 작성자 이름은 게시글을 실제로 작성한 로그인 사용자 이름이어야 합니다.

## 프론트 요청 형식

프론트의 게시글 작성 요청에는 작성자 이름 필드가 없습니다.

```http
POST /wards/{wardId}/board/posts
Content-Type: application/json
```

```json
{
  "title": "게시글 제목",
  "content": "게시글 내용",
  "deadlineDate": "2026-06-10",
  "imageUrls": ["https://example.com/post.png"]
}
```

`deadlineDate`, `imageUrls`는 선택 값입니다.

프론트 관련 파일:

```text
apps/app/src/shared/api/board/index.ts
apps/app/src/pages/board/index.tsx
```

## 프론트 표시 로직

프론트는 백엔드 응답에서 내려온 값을 아래 순서로 표시합니다.

```ts
post.writerName ?? post.authorName ?? '작성자'
```

즉, `"김찬규"`가 화면에 보인다면 백엔드 응답의 `writerName` 또는 `authorName` 값이 `"김찬규"`로 내려오고 있을 가능성이 높습니다.

## 백엔드 확인 요청

아래 항목 확인을 요청드립니다.

1. 게시글 생성 시 현재 로그인한 principal/account/admin/nurse가 실제 게시글 작성자로 저장되는지 확인
2. 게시글 목록/상세 조회 DTO 변환 시 `writerName` 또는 `authorName`이 실제 작성자 이름으로 매핑되는지 확인
3. 특정 계정 이름, 테스트 계정 이름, 병동 관리자 이름 등이 기본값처럼 잘못 들어가고 있지 않은지 확인
4. 관리자 계정과 일반 간호사 계정의 작성자 모델이 분리되어 있다면, 두 케이스 모두 실제 작성자 이름과 `isMine` 값이 올바르게 계산되는지 확인
5. 작성 직후 응답과 재조회 응답의 작성자 이름이 동일한지 확인

## 확인 기준

예를 들어 로그인 사용자 이름이 `홍길동`인 상태에서 글을 작성했다면:

```json
{
  "postId": 1,
  "title": "게시글 제목",
  "content": "게시글 내용",
  "writerName": "홍길동",
  "authorName": "홍길동",
  "isMine": true
}
```

처럼 실제 글쓴 사람 이름이 내려와야 합니다.

`writerName`과 `authorName` 중 하나만 사용하는 API 계약이라면, 프론트와 필드명을 맞춘 뒤 해당 필드에 실제 글쓴 사람 이름을 내려주면 됩니다.
