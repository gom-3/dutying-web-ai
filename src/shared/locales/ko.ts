export const ko = {
    page: {
        landing: {
            title: '근무표\n이제 더 간편하게!',
        },
        makeShift: {
            overview: {
                loading: '근무표를 불러오는 중입니다...',
                shiftExists: '{{teamName}}의 {{month}}월 근무표가 존재합니다.',
                shiftEmpty: '{{teamName}}의 {{month}}월 근무표가 비어있어요',
                checking: '근무표 상태를 확인 중입니다.',
                viewShift: '{{month}}월 근무표 보러가기',
                createShift: '{{month}}월 근무표 생성하기',
            },
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
            workers: {
                totalCount: '총 {{count}}명',
                sortByLevel: '숙련도 순',
                column: {
                    name: '이름',
                    level: '숙련도',
                    shiftTypes: '가능 근무',
                    memo: '비고',
                },
                dragHandleAria: '드래그하여 순서 변경',
            },
            aiRefill: {
                action: 'AI 다시 채우기',
                retry: 'AI 다시 시도',
                generating: 'AI 채우는 중...',
                intro: '실패해도 현재 편집본은 유지돼요.\n이전 단계로 돌아가 조건을 다시 보고 오거나, 여기서 바로 재시도하고 확정할 수 있어요.',
                saveFailed: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
                title: {
                    idle: 'AI 자동 채우기를 시작할 준비가 됐어요',
                    loading: 'AI가 근무표를 다시 계산하고 있어요',
                    success: 'AI 결과를 반영했어요',
                    error: 'AI 요청이 실패했어요',
                },
                description: {
                    idle: '이전 단계에서 정리한 조건으로 AI 자동 채우기를 시작할 수 있어요.',
                    loading: '응답을 기다리는 동안에는 확정과 재요청을 잠시 막아둘게요.',
                    success: 'AI가 새 근무표를 반영했어요. 검토 후 직접 수정하거나 바로 확정할 수 있어요.',
                    error: 'AI 요청이 실패했어요. 현재 화면의 근무표는 그대로 유지되며 바로 다시 시도할 수 있어요.',
                },
                draft: {
                    saved: '현재 편집본은 유지되고 자동 저장돼요.',
                    none: '아직 저장된 편집본 없이 기본 근무표를 보고 있어요.',
                },
                previous: '이전 단계',
                confirm: '확정하기',
            },
        },
        duty: {
            prevMonth: '이전 달',
            nextMonth: '다음 달',
            monthHeader: '{{year}}년 {{month}}월',
            confirmedShift: '확정 근무표',
            createNextMonth: '다음달 근무표 만들기',
            publish: '게시하기',
            exportExcel: '엑셀 내보내기',
            editShift: '근무표 수정하기',
            save: '저장하기',
            cancel: '취소하기',
            loading: '근무표를 불러오는 중입니다...',
            error: '근무표를 불러오지 못했어요.',
        },
        refresh: {
            loading: '로그인중입니다.',
        },
    },
    feature: {
        auth: {
            sessionExpired: '로그인이 만료되었습니다. 다시 로그인해주세요.',
        },
        shiftEditor: {
            panel: {
                histories: '기록',
                faults: '문제점',
                history: {
                    reordered: '근무자 순서를 변경했습니다',
                    editedCells: '{{source}} 입력으로 {{count}}개 셀을 수정했습니다',
                    defaultLabel: '편집 내역',
                    empty: '편집 기록이 없습니다.',
                    sourceAi: 'AI',
                    sourceSystem: '시스템',
                    sourceUser: '수동',
                },
                faultsEmpty: '문제점이 없습니다.',
                fold: '닫기',
                expand: '펼치기',
            },
        },
    },
};

export type TLocale = typeof ko;
