# 이용약관/마케팅 동의 백엔드 구현 요청

## 요약

웹 회원가입 화면에서 아래 동의를 받도록 변경했습니다.

- `[필수] 이용약관 동의`
- `[선택] 마케팅 정보 수신 동의`
- 개인정보처리방침은 동의 기록으로 저장하지 않고, 화면에 안내 문구와 링크만 표시합니다.

백엔드는 회원가입 시 프론트가 보내는 `legalAgreements`를 저장하고, 소셜 신규 가입 흐름에서도 동일한 동의 저장이 가능하도록 처리해야 합니다.

## 프론트 변경 내용

이메일 회원가입 요청에 `legalAgreements` 배열이 추가됩니다.

```http
POST /auth/admin/password/signup
Content-Type: application/json
```

이용약관만 동의한 경우:

```json
{
  "name": "김관리",
  "email": "admin@example.com",
  "emailVerificationToken": "123456",
  "password": "password1234",
  "legalAgreements": [
    {
      "documentType": "TERMS_OF_SERVICE",
      "documentVersion": "2026-06-20",
      "documentUrl": "https://www.notion.so/37698c0fae2580d1a3d2dcbb0c163fc9?source=copy_link",
      "agreed": true,
      "agreedAt": "2026-06-20T05:50:00.000Z",
      "preferredLanguage": "ko",
      "locale": "ko-KR",
      "serviceRegion": "KR"
    }
  ]
}
```

마케팅 정보 수신도 선택한 경우:

```json
{
  "legalAgreements": [
    {
      "documentType": "TERMS_OF_SERVICE",
      "documentVersion": "2026-06-20",
      "documentUrl": "https://www.notion.so/37698c0fae2580d1a3d2dcbb0c163fc9?source=copy_link",
      "agreed": true,
      "agreedAt": "2026-06-20T05:50:00.000Z",
      "preferredLanguage": "ko",
      "locale": "ko-KR",
      "serviceRegion": "KR"
    },
    {
      "documentType": "MARKETING_COMMUNICATIONS",
      "documentVersion": "2026-06-20",
      "agreed": true,
      "agreedAt": "2026-06-20T05:50:00.000Z",
      "preferredLanguage": "ko",
      "locale": "ko-KR",
      "serviceRegion": "KR"
    }
  ]
}
```

## 백엔드 필수 구현

### 1. 회원가입 DTO 확장

아래 요청 DTO에서 `legalAgreements`를 허용해 주세요.

- `POST /auth/admin/password/signup`
- 소셜 신규 가입을 백엔드에서 처리하는 OAuth callback 또는 `POST /auth/admin/social/signup`

권장 타입:

```ts
type LegalAgreementDocumentType = 'TERMS_OF_SERVICE' | 'MARKETING_COMMUNICATIONS';

type LegalAgreementRequest = {
  documentType: LegalAgreementDocumentType;
  documentVersion: string;
  documentUrl?: string;
  agreed: true;
  agreedAt: string;
  preferredLanguage: 'ko' | 'ja' | 'en' | 'zh' | 'th';
  locale: 'ko-KR' | 'ja-JP' | 'en-US' | 'zh-CN' | 'th-TH';
  serviceRegion: 'KR' | 'JP' | 'EN' | 'CN' | 'TH';
};
```

### 2. 필수 이용약관 검증

회원가입 완료 전에 `TERMS_OF_SERVICE` 동의가 반드시 있어야 합니다.

검증 조건:

- `legalAgreements` 안에 `documentType: "TERMS_OF_SERVICE"`가 있어야 함
- `agreed`는 `true`여야 함
- `documentVersion`이 비어 있으면 안 됨
- `agreedAt`은 ISO datetime으로 파싱 가능해야 함

위 조건이 없으면 회원가입을 완료하지 말고 400 응답을 내려주세요.

예시:

```json
{
  "code": "TERMS_AGREEMENT_REQUIRED",
  "messageKey": "error.termsAgreementRequired",
  "displayPolicy": "CLIENT_TRANSLATE"
}
```

### 3. 선택 마케팅 동의 저장

`MARKETING_COMMUNICATIONS`는 선택 동의입니다.

- 요청에 있으면 `agreed: true` 기록 저장
- 요청에 없으면 미동의로 간주
- 미동의 기록을 별도 row로 만들 필요는 없습니다.

마케팅 발송 가능 여부는 최신 `MARKETING_COMMUNICATIONS` 동의 기록이 있는 계정만 `true`로 판단해 주세요.

### 4. 개인정보처리방침 기록은 저장하지 않음

프론트는 개인정보처리방침을 별도 동의로 받지 않습니다.

백엔드도 아래 문서 타입을 요구하거나 저장하지 말아 주세요.

```text
PRIVACY_POLICY
PERSONAL_INFORMATION_COLLECTION
```

개인정보 처리 근거는 서비스 제공 및 계약 이행 기준으로 보고, 화면에서는 개인정보처리방침 링크만 안내합니다.

### 5. DB 저장

권장 테이블 예시:

```sql
create table account_legal_agreements (
  id bigint primary key generated always as identity,
  account_id bigint not null,
  document_type varchar(64) not null,
  document_version varchar(32) not null,
  document_url text null,
  agreed boolean not null,
  agreed_at timestamp with time zone not null,
  preferred_language varchar(8) not null,
  locale varchar(16) not null,
  service_region varchar(8) not null,
  created_at timestamp with time zone not null default now()
);
```

권장 인덱스:

```sql
create index idx_account_legal_agreements_account_type
  on account_legal_agreements (account_id, document_type, agreed_at desc);
```

### 6. 소셜 신규 가입 처리

현재 웹 프론트의 소셜 가입은 백엔드 OAuth 리다이렉트가 토큰을 내려주는 구조입니다.

따라서 소셜 신규 가입에서도 동일한 동의를 저장하려면 백엔드가 아래 중 하나를 지원해야 합니다.

권장안:

- OAuth 시작 URL 또는 callback 처리에서 프론트가 전달한 동의값을 받을 수 있도록 한다.
- 신규 계정 생성 시 `TERMS_OF_SERVICE` 동의가 없으면 가입을 완료하지 않는다.
- `MARKETING_COMMUNICATIONS`는 전달된 경우에만 저장한다.

대안:

- 소셜 callback 후 계정 상태가 `INITIAL` 또는 `NURSE_INFO_PENDING`인 상태에서 `POST /accounts/me/legal-agreements` 같은 인증 API를 제공한다.
- 이 경우 프론트가 첫 등록 화면 진입 시 약관 동의를 저장한 뒤 다음 단계로 진행할 수 있어야 한다.

## 테스트 요청

### 이메일 가입: 이용약관 있음

기대:

- 2xx
- 계정 생성
- `TERMS_OF_SERVICE` row 저장

### 이메일 가입: 이용약관 없음

기대:

- 400
- 계정 생성 안 됨
- `TERMS_AGREEMENT_REQUIRED` 또는 동등한 에러 반환

### 이메일 가입: 마케팅 동의 있음

기대:

- 2xx
- `TERMS_OF_SERVICE` row 저장
- `MARKETING_COMMUNICATIONS` row 저장

### 이메일 가입: 마케팅 동의 없음

기대:

- 2xx
- `TERMS_OF_SERVICE` row만 저장
- 마케팅 발송 가능 여부는 `false`

## 프론트 기준 파일

- `apps/app/src/pages/login/index.tsx`
- `apps/app/src/shared/legal/agreements.ts`
- `apps/app/src/shared/api/auth/type.ts`
