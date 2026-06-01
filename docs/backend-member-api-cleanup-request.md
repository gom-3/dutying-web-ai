# 근무자 관리 간호사 생성/수정 API 정리 요청

## 목적

근무자 관리 화면에서 현재 프론트가 백엔드 validation을 통과시키기 위해 임시 더미값을 보내고 있습니다.

앞으로는 실제 근무자 관리 기획에 남아있는 값만 보내도록 API 계약을 정리하려고 합니다.

## 현재 프론트 임시 처리

현재 프론트에서는 아래 값들을 백엔드 필수 validation 때문에 강제로 채워 보내고 있습니다.

```json
{
  "phoneNum": "01000000000",
  "gender": "여",
  "isDutyManager": false,
  "employmentDate": ""
}
```

이 중 `gender`, `isDutyManager`, `employmentDate`는 근무자 관리 기획에서 기능 자체를 제거할 예정입니다.

`phoneNum`만 선택 입력값으로 유지합니다.

## 변경하려는 API 계약

### 1. `phoneNum`

전화번호는 필수가 아니라 선택값입니다.

요청사항:

- `phoneNum`은 선택 필드로 처리해주세요.
- 프론트는 전화번호가 입력된 경우에만 보냅니다.
- 값이 없으면 프론트에서 더미값 `01000000000`을 보내지 않습니다.

권장 계약:

```ts
phoneNum?: string | null;
```

### 2. `gender`

성별은 근무자 관리 기능에서 제거합니다.

요청사항:

- 생성/수정 request body에서 `gender`를 받지 않도록 정리해주세요.
- 프론트도 더 이상 `gender`를 보내지 않습니다.
- 기존 데이터 호환이 필요하다면 서버 내부에서만 유지하고, 근무자 관리 request 계약에서는 제거해주세요.

### 3. `isDutyManager`

`isDutyManager`는 근무자 관리에서 더 이상 사용하지 않습니다.

요청사항:

- 생성/수정 request body에서 `isDutyManager`를 받지 않도록 정리해주세요.
- 프론트도 더 이상 `isDutyManager: false`를 보내지 않습니다.
- 백엔드 내부에서 해당 값이 필요하다면 서버 기본값을 `false`로 처리해주세요.

### 4. `employmentDate`

`employmentDate`는 근무자 관리 생성/수정 request에서 보내지 않습니다.

요청사항:

- 생성/수정 request body에서 `employmentDate`를 받지 않도록 정리해주세요.
- 프론트도 더 이상 `employmentDate: ""`를 보내지 않습니다.
- 기존 데이터 호환이 필요하다면 서버 내부 기본값 또는 nullable 처리를 해주세요.

## 프론트에서 앞으로 보낼 값

신규 간호사 생성 시 최소 payload 예시:

```json
{
  "name": "신규간호사1",
  "isWorker": true,
  "isWardManager": false,
  "memo": ""
}
```

전화번호가 입력된 경우에만 포함합니다.

```json
{
  "name": "신규간호사1",
  "isWorker": true,
  "isWardManager": false,
  "memo": "",
  "phoneNum": "01012345678"
}
```

간호사 수정 시에도 실제 변경 가능한 근무자 관리 필드만 보냅니다.

```json
{
  "name": "김간호사",
  "isWorker": true,
  "isWardManager": false,
  "memo": "메모",
  "phoneNum": "01012345678"
}
```

## 권장 DTO

```ts
type CreateShiftTeamNurseRequest = {
  name: string;
  isWorker?: boolean;
  isWardManager?: boolean;
  memo?: string | null;
  phoneNum?: string | null;
};
```

```ts
type UpdateNurseRequest = {
  name?: string;
  isWorker?: boolean;
  isWardManager?: boolean;
  memo?: string | null;
  phoneNum?: string | null;
};
```

제외할 필드:

```ts
gender
isDutyManager
employmentDate
```

## 백엔드 처리 요청 요약

- `phoneNum`은 optional 처리
- `gender`는 request에서 제거
- `isDutyManager`는 request에서 제거
- `employmentDate`는 request에서 제거
- 누락된 optional 필드 때문에 validation error가 발생하지 않도록 처리
- 프론트가 더미값을 보내지 않아도 간호사 생성/수정이 가능하도록 처리

## 기대 효과

- 실제 사용자가 입력하지 않은 더미 전화번호가 저장되지 않습니다.
- 근무자 관리 기획에서 제거된 성별 값이 임의로 저장되지 않습니다.
- 더 이상 사용하지 않는 `isDutyManager`를 프론트가 보내지 않아도 됩니다.
- 더 이상 사용하지 않는 `employmentDate`를 프론트가 보내지 않아도 됩니다.
- 근무자 관리 화면의 UX와 API request 계약이 일치합니다.
