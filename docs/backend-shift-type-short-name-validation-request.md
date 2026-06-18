# 근무유형 약자(shortName) 3글자 저장 불가 이슈

## 요약

근무유형 설정에서 `shortName`을 3글자로 입력해 저장하면 백엔드에서 `shortName` 크기 제한을 `1~2`로 검증해 저장이 실패합니다.

현재 웹 프론트는 근무유형 약자를 최대 3글자까지 허용하도록 구현되어 있어 프론트와 백엔드 검증 기준이 맞지 않습니다.

## 재현 정보

- 환경: dev
- 요청 URL: `https://dev.api.dutying.net/wards/421/shift-types/2349`
- 웹 클라이언트 호출: `PUT /wards/{wardId}/shift-types/{shiftTypeId}`
- 재현 조건: 근무유형 약자 `shortName`에 3글자 입력 후 저장

## 현재 백엔드 응답

```json
{
  "code": "INVALID_TYPE_VALUE",
  "message": "파라미터 타입이 올바르지 않습니다.",
  "messageKey": "error.invalidTypeValue",
  "displayPolicy": "CLIENT_TRANSLATE",
  "locale": "ko-KR",
  "requestId": "0fa3847c",
  "errors": [
    {
      "field": "shortName",
      "message": "크기가 1에서 2 사이여야 합니다",
      "messageKey": "Size"
    }
  ]
}
```

## 프론트 기준

현재 프론트는 `shortName`을 최대 3글자까지 허용합니다.

- `apps/app/src/shared/lib/shift-short-name.ts`
  - `SHIFT_SHORT_NAME_MAX_LENGTH = 3`
  - 공백 제거 후 최대 3글자까지 정규화
- `apps/app/src/pages/ward-settings/ui/index.tsx`
  - 근무유형 설정 화면의 약자 입력값에 `maxLength={SHIFT_SHORT_NAME_MAX_LENGTH}` 적용
- i18n 문구
  - `공백 없이 3글자까지 입력해 주세요.`
  - `Use up to 3 characters without spaces.`

## 요청 사항

제품 스펙이 `shortName` 최대 3글자라면 백엔드 검증 조건을 `1~3`으로 변경해 주세요.

예상 기준:

- `shortName` 최소 길이: 1
- `shortName` 최대 길이: 3
- 3글자 약자 저장 가능
- 생성/수정 API 모두 동일한 기준 적용

관련 API:

- `POST /wards/{wardId}/shift-types`
- `PUT /wards/{wardId}/shift-types/{shiftTypeId}`

## 확인 필요

만약 백엔드 기준인 `최대 2글자`가 최종 제품 스펙이라면 프론트의 입력 제한과 안내 문구를 `2글자` 기준으로 낮춰야 합니다. 현재 UX와 프론트 구현은 `3글자 허용` 기준이므로, 우선 백엔드 검증을 `max=3`으로 맞추는 방향이 자연스러워 보입니다.

