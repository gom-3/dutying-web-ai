export const ko = {
    page: {
        landing: {
            title: '근무표\n이제 더 간편하게!',
        },
        makeShift: {
            constraints: {
                section: {
                    strong: '강 제약 조건',
                    weak: '약 제약 조건',
                    excluded: '제외',
                },
                info: '위치를 옮겨서 원하는 우선순위대로 정렬할 수 있어요',
                count: '{{count}}개',
                empty: '표시할 제약조건이 없습니다.',
                dragHandleAria: '드래그하여 위치를 변경',
                violationCount: '{{count}}개',
                phrase: {
                    max: '최대',
                    min: '최소',
                    day: '일',
                    lte: '이하',
                    gte: '이상',
                },
                rule: {
                    maxContinuousWork: {label: '연속 근무 수'},
                    minNightInterval: {label: '나이트 간격'},
                    maxContinuousNight: {label: '연속 나이트'},
                    minContinuousNight: {label: '연속 나이트'},
                    minOffAssignAfterNight: {label: '나이트 근무 후 오프 배정'},
                    excludeCertainWorkTypes: {label: 'ND / ED / NE / NOD 근무 패턴 불가능'},
                    excludeNightBeforeReqOff: {label: '신청 오프 전날에는 나이트 근무 불가능'},
                },
            },
        },
        refresh: {
            loading: '로그인중입니다.',
        },
    },
    feature: {
        auth: {
            sessionExpired: '로그인이 만료되었습니다. 다시 로그인해주세요.',
        },
    },
};

export type TLocale = typeof ko;
