# 백엔드 요청: 온보딩 병동 생성 시 간호사까지 함께 생성

## 배경

웹 관리자 온보딩(`/onboarding/ward-create`)에서는 마지막 `완료` 버튼을 눌렀을 때 병동, 근무유형, 팀, 간호사 목록이 함께 확정됩니다.

현재 프론트는 `/accounts/me/admin-workspace` 요청 body에 온보딩에서 입력한 `wardShiftTypes`, `shiftTeams`, `nurses`를 함께 보내고 있습니다. 하지만 현재 Swagger의 request schema에는 아래 필드만 정의되어 있습니다.

```json
{
    "hospitalName": "string",
    "wardName": "string",
    "adminName": "string",
    "phoneNum": "string",
    "profileImgUrl": "string"
}
```

이 상태에서는 백엔드가 프론트에서 보낸 간호사/팀/근무유형 데이터를 무시할 가능성이 높고, 실제로 병동 생성 후 근무자 관리(`/member`)에서 온보딩 간호사가 보이지 않는 문제가 발생합니다.

## 요청 사항

`POST /accounts/me/admin-workspace`를 온보딩 완료용 생성 API로 확장해 주세요.

이 API는 마지막 `완료` 시점에 아래 데이터를 한 번에 받아서, 같은 트랜잭션 안에서 생성해야 합니다.

- 병동
- 병동 관리자 OWNER membership
- 근무유형
- 근무팀
- 팀별 간호사
- 간호사별 가능 근무유형

중간 단계에서는 병동이 생성되면 안 되고, 마지막 `완료` 요청이 성공할 때만 병동과 구성원이 생성되어야 합니다.

## 요청 Body 제안

```json
{
    "hospitalName": "듀팅병원",
    "wardName": "7A",
    "adminName": "김관리",
    "phoneNum": "01012341234",
    "profileImgUrl": "",
    "wardShiftTypes": [
        {
            "name": "데이",
            "shortName": "D",
            "startTime": "07:00",
            "endTime": "15:00",
            "color": "#4DC2AD",
            "isDefault": true,
            "isOff": false,
            "isCounted": true,
            "classification": "DAY"
        },
        {
            "name": "오프",
            "shortName": "O",
            "startTime": "",
            "endTime": "",
            "color": "#465B7A",
            "isDefault": true,
            "isOff": true,
            "isCounted": false,
            "classification": "OFF"
        }
    ],
    "shiftTeams": [
        {
            "name": "A팀",
            "nurseNames": ["홍길동", "김하늘"],
            "nurses": [
                {
                    "name": "홍길동",
                    "memo": "프리셉터",
                    "isWorker": true,
                    "employmentDate": "2026-06-05",
                    "level": 2,
                    "isPreceptor": true,
                    "isPreceptee": false,
                    "possibleShiftShortNames": ["D"]
                },
                {
                    "name": "김하늘",
                    "memo": "",
                    "isWorker": true,
                    "employmentDate": "2026-06-05",
                    "level": null,
                    "isPreceptor": false,
                    "isPreceptee": false,
                    "possibleShiftShortNames": ["D", "O"]
                }
            ]
        }
    ]
}
```

## 필드 매핑

### `wardShiftTypes`

- `name`: 근무유형명
- `shortName`: 근무 약어
- `startTime`, `endTime`: 근무 시간. 오프(`isOff=true`)는 빈 문자열 가능
- `color`: 표시 색상
- `isDefault`: 기본 근무유형 여부
- `isOff`: 오프 근무 여부
- `isCounted`: 근무 인원 카운트 포함 여부
- `classification`: `DAY`, `EVENING`, `NIGHT`, `OTHER_WORK`, `OFF`, `OTHER_LEAVE`

### `shiftTeams`

- `name`: 팀 이름
- `nurseNames`: 호환용 이름 배열
- `nurses`: 신규 온보딩 간호사 상세 정보

`nurses`가 있으면 `nurses`를 우선 사용하고, 없으면 `nurseNames`로 간호사를 생성해 주세요.

### `shiftTeams[].nurses[]`

- `name`: 간호사 이름
- `memo`: 메모
- `isWorker`: 근무표 배정 대상 여부
- `employmentDate`: 입사일
- `level`: 숙련도. 백엔드의 `proficiency`로 저장
- `isPreceptor`: 프리셉터 여부
- `isPreceptee`: 프리셉티 여부
- `possibleShiftShortNames`: 가능한 근무유형 약어 목록. 생성된 `wardShiftTypes.shortName`과 매칭해서 nurse shift type 가능 여부를 설정

## 처리 규칙

1. 요청을 받으면 account row를 lock합니다.
2. 관리자 프로필(`adminName`, `phoneNum`, `profileImgUrl`)을 갱신합니다.
3. ward를 생성합니다.
4. 요청의 `wardShiftTypes`를 생성합니다.
5. 요청의 `shiftTeams`를 순서대로 생성합니다.
6. 각 팀의 `nurses`를 생성하고 해당 팀에 배치합니다.
7. `nurses[].possibleShiftShortNames`를 기준으로 간호사별 가능 근무유형을 설정합니다.
8. 현재 계정을 생성된 병동의 `OWNER`로 등록합니다.
9. 현재 계정의 `currentWardId` 또는 `wardId`를 생성된 병동으로 설정하고 상태를 `LINKED`로 변경합니다.
10. 위 작업은 하나의 트랜잭션으로 처리합니다. 중간 실패 시 병동도 생성되지 않아야 합니다.

## 응답 Body 제안

생성된 병동에는 실제 생성된 근무유형, 팀, 간호사가 포함되어야 합니다.

```json
{
    "account": {
        "accountId": 1,
        "wardId": 10,
        "name": "김관리",
        "phoneNum": "01012341234",
        "profileImgUrl": "",
        "isManager": true,
        "status": "LINKED",
        "role": "OWNER",
        "permissions": ["DUTY_MANAGE", "REQUEST_MANAGE", "BOARD_MANAGE", "MEMBER_MANAGE", "WARD_SETTING_MANAGE"]
    },
    "ward": {
        "wardId": 10,
        "hospitalName": "듀팅병원",
        "name": "7A",
        "code": "A7K29Q",
        "nurseCnt": 2,
        "wardShiftTypes": [
            {
                "wardShiftTypeId": 101,
                "name": "데이",
                "shortName": "D",
                "startTime": "07:00",
                "endTime": "15:00",
                "color": "#4DC2AD",
                "isDefault": true,
                "isOff": false,
                "isCounted": true,
                "classification": "DAY"
            }
        ],
        "shiftTeams": [
            {
                "shiftTeamId": 201,
                "name": "A팀",
                "nurseCnt": 2,
                "nurses": [
                    {
                        "nurseId": 301,
                        "wardId": 10,
                        "shiftTeamId": 201,
                        "name": "홍길동",
                        "proficiency": 2,
                        "isPreceptor": true,
                        "isPreceptee": false,
                        "employmentDate": "2026-06-05",
                        "isWorker": true,
                        "isConnected": false,
                        "memo": "프리셉터",
                        "nurseShiftTypes": [
                            {
                                "nurseShiftTypeId": 401,
                                "wardShiftTypeId": 101,
                                "name": "데이",
                                "shortName": "D",
                                "isPossible": true,
                                "isPreferred": false
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

## 검증 기준

아래 기준을 만족하면 프론트의 온보딩 간호사가 근무자 관리에서 정상 표시됩니다.

1. Swagger request schema에 `wardShiftTypes`, `shiftTeams`, `shiftTeams[].nurses`가 표시됩니다.
2. `POST /accounts/me/admin-workspace` 요청 후 응답의 `ward.nurseCnt`가 생성된 간호사 수와 일치합니다.
3. 응답의 `ward.shiftTeams[].nurses`에 온보딩에서 입력한 간호사가 포함됩니다.
4. 이후 `GET /wards/{wardId}/shift-teams` 응답에도 같은 간호사가 포함됩니다.
5. `/member` 화면에서 해당 팀과 간호사가 표시됩니다.

## 현재 프론트 요청 상태

프론트는 이미 아래 형태로 `/accounts/me/admin-workspace`에 값을 보내고 있습니다.

- `wardShiftTypes`
- `shiftTeams`
- `shiftTeams[].nurseNames`
- `shiftTeams[].nurses`

따라서 백엔드에서 위 필드를 request DTO에 추가하고 생성 로직을 구현하면 됩니다.
