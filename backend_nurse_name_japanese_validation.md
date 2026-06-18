# 간호사 이름 일본어 입력 시 등록/수정 실패 이슈

## 문제 상황

간호사 이름에 일본어가 포함된 경우, 근무표 등록/수정 요청이 백엔드 validation에서 실패합니다.

현재 응답 예시는 아래와 같습니다.

```json
{
  "code": "INVALID_TYPE_VALUE",
  "message": "파라미터 타입이 올바르지 않습니다.",
  "messageKey": "error.invalidTypeValue",
  "displayPolicy": "CLIENT_TRANSLATE",
  "locale": "ja-JP",
  "requestId": "a7e0ca37",
  "errors": [
    {
      "field": "shiftTeams[0].nurses[0].name",
      "message": "이름은 한글, 영문, 숫자, 공백만 입력 가능합니다.",
      "messageKey": "ValidNurseName"
    },
    {
      "field": "shiftTeams[0].nurseNames[0]",
      "message": "이름은 한글, 영문, 숫자, 공백만 입력 가능합니다.",
      "messageKey": "ValidNurseName"
    }
  ]
}
```

## 현재 동작

`ValidNurseName` validation에서 간호사 이름을 다음 문자만 허용하는 것으로 보입니다.

- 한글
- 영문
- 숫자
- 공백

이 때문에 일본어 이름, 예를 들어 아래와 같은 이름이 입력되면 요청이 실패합니다.

- 山田 花子
- 佐藤 美咲
- たなか
- カナ

## 기대 동작

일본어 locale 또는 일본 병원/팀에서 사용하는 간호사 이름은 정상적으로 저장/수정되어야 합니다.

최소한 아래 문자 범위는 허용이 필요합니다.

- 한글
- 영문
- 숫자
- 공백
- 일본어 히라가나
- 일본어 가타카나
- 한자/Kanji
- 일본어 이름에 사용될 수 있는 중점 `・`
- 장음 기호 `ー`

## 영향 필드

현재 에러 기준으로 아래 두 필드에 같은 validation이 적용되고 있습니다.

- `shiftTeams[].nurses[].name`
- `shiftTeams[].nurseNames[]`

두 필드 모두 동일하게 일본어 이름을 허용해야 합니다.

## 제안 수정 방향

`ValidNurseName` validation 규칙을 한국어/영어 전용이 아니라 다국어 이름을 허용하는 방식으로 변경 부탁드립니다.

권장 방향은 특정 국가 문자만 계속 추가하는 방식보다, Unicode 문자 기준으로 이름에 적합한 문자를 허용하는 것입니다.

예시:

```regex
^[\p{L}\p{N}\s・ー]+$
```

의미:

- `\p{L}`: 모든 언어의 문자
- `\p{N}`: 숫자
- `\s`: 공백
- `・`, `ー`: 일본어 이름에서 사용될 수 있는 기호

단, 보안/정책상 모든 Unicode 문자를 허용하기 어렵다면 최소한 일본어 범위를 추가해야 합니다.

```regex
^[가-힣a-zA-Z0-9ぁ-んァ-ヶ一-龯々〆〤\s・ー]+$
```

## Acceptance Criteria

- `山田 花子` 입력 시 validation 에러가 발생하지 않는다.
- `たなか` 입력 시 validation 에러가 발생하지 않는다.
- `カナ` 입력 시 validation 에러가 발생하지 않는다.
- `佐藤・美咲` 입력 시 validation 에러가 발생하지 않는다.
- `shiftTeams[].nurses[].name`와 `shiftTeams[].nurseNames[]` 모두 동일하게 통과한다.
- 기존 한글/영문/숫자/공백 이름은 기존과 동일하게 정상 처리된다.
- 빈 문자열, 특수문자만 있는 값 등 기존에 막아야 하는 값은 계속 막힌다.

## 참고

현재 응답의 `locale`은 `ja-JP`인데 validation 메시지는 한국어로 내려오고 있습니다.

클라이언트에서 `messageKey`로 번역하는 구조라면 큰 문제는 아니지만, 서버 메시지도 locale에 맞춰 내려야 하는 정책이라면 `ValidNurseName`의 일본어 메시지도 함께 확인이 필요합니다.
