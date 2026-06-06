import {describe, expect, it} from 'vitest';
import {type TOnboardingWardParseApiResponse} from '@/shared/api/file/type';
import {
    applyParsedWardData,
    buildCreateWardPayload,
    buildOnboardingParseDraftInjection,
    createInitialDraft,
    getOnboardingUploadFailureMessage,
    isSupportedOnboardingUploadFile,
    type TOnboardingNurseDraft,
} from '../model';

const createNurseDraft = (teamId: string, overrides: Partial<TOnboardingNurseDraft> = {}): TOnboardingNurseDraft => ({
    id: overrides.id ?? `nurse-${overrides.name ?? 'seed'}`,
    teamId,
    name: overrides.name ?? '홍길동',
    memo: overrides.memo ?? '',
    isWorker: overrides.isWorker ?? true,
    employmentDate: overrides.employmentDate ?? '2024-01-01',
    possibleShiftTypeIds: overrides.possibleShiftTypeIds ?? [],
    level: overrides.level ?? null,
});

describe('OnboardingWardCreatePage adapter', () => {
    it('builds create ward payload outside the UI draft layer', () => {
        const initialDraft = createInitialDraft();
        const firstTeamId = initialDraft.teams[0]?.id ?? '';
        const defaultPossibleShiftTypeIds = initialDraft.shiftTypes
            .filter((shiftType) => !shiftType.isOff)
            .map((shiftType) => shiftType.id);
        const draft = {
            ...initialDraft,
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            nurses: ['홍길동', '김하늘', '이서윤', '박연우'].map((name) =>
                createNurseDraft(firstTeamId, {
                    id: `nurse-${name}`,
                    name,
                    possibleShiftTypeIds: defaultPossibleShiftTypeIds,
                }),
            ),
        };
        const payload = buildCreateWardPayload(draft);

        expect(payload).toHaveProperty('name', draft.wardName);
        expect(payload).toHaveProperty('hospitalName', draft.hospitalName);
        expect(payload.wardShiftTypes).toHaveLength(draft.shiftTypes.length);
        expect(payload.wardShiftTypes[0]).not.toHaveProperty('id');
        expect(payload.shiftTeams).toHaveLength(draft.teams.length);
        expect(payload.shiftTeams[0]).toEqual(
            expect.objectContaining({
                nurseNames: ['홍길동', '김하늘', '이서윤', '박연우'],
                nurses: expect.arrayContaining([
                    expect.objectContaining({
                        name: '홍길동',
                        isWorker: true,
                        possibleShiftShortNames: expect.arrayContaining(['D']),
                    }),
                ]),
            }),
        );
    });

    it('preserves ordinary spaces in nurse names when building the create ward payload', () => {
        const initialDraft = createInitialDraft();
        const firstTeamId = initialDraft.teams[0]?.id ?? '';
        const draft = {
            ...initialDraft,
            nurses: [
                createNurseDraft(firstTeamId, {
                    id: 'nurse-spaced-ko',
                    name: ' 신규 간호사 1 ',
                }),
                createNurseDraft(firstTeamId, {
                    id: 'nurse-spaced-en',
                    name: 'Nurse 1',
                }),
            ],
        };

        const payload = buildCreateWardPayload(draft);

        expect(payload.shiftTeams[0]?.nurseNames).toEqual(['신규 간호사 1', 'Nurse 1']);
        expect(payload.shiftTeams[0]?.nurses?.map((nurse) => nurse.name)).toEqual(['신규 간호사 1', 'Nurse 1']);
    });

    it('uses a safe fallback name when both ward and hospital names are blank', () => {
        const payload = buildCreateWardPayload(createInitialDraft());

        expect(payload.name).toBe('듀팅 병동');
        expect(payload.hospitalName).toBe('듀팅 병동');
    });

    it('applies parsed response data as draft bootstrap values', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            fileName: 'ward.xlsx',
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            shiftTypes: [
                {name: '데이', shortName: 'D', color: '#111111', classification: 'DAY'},
                {name: '오프', shortName: 'O', color: '#222222', isOff: true, classification: 'OFF'},
            ],
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: 'A팀',
                    possibleShiftShortNames: ['D'],
                    employmentDate: '2025-01-01',
                    level: 2,
                },
            ],
        });

        expect(nextDraft.uploadedFileName).toBe('ward.xlsx');
        expect(nextDraft.wardName).toBe('중환자실');
        expect(nextDraft.hospitalName).toBe('듀팅병원');
        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O']);
        expect(nextDraft.teams).toHaveLength(1);
        expect(nextDraft.teams[0]?.name).toBe('A팀');
        expect(nextDraft.nurses[0]?.teamId).toBe(nextDraft.teams[0]?.id);
        expect(nextDraft.nurses[0]?.possibleShiftTypeIds).toEqual([nextDraft.shiftTypes[0]?.id]);
    });

    it('infers standard shift classifications from parsed short names', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            shiftTypes: [
                {name: '데이', shortName: 'D'},
                {name: '이브닝', shortName: 'E'},
                {name: '나이트', shortName: 'N'},
                {name: '오프', shortName: 'O', isOff: true},
            ],
        });

        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.classification)).toEqual(['DAY', 'EVENING', 'NIGHT', 'OFF']);
    });

    it('falls back to default possible shifts when parsed shift mappings are empty', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: draft.teams[0]?.name,
                    possibleShiftShortNames: [],
                },
                {
                    name: '다른 간호사',
                    teamName: draft.teams[0]?.name,
                    possibleShiftShortNames: ['UNKNOWN'],
                },
            ],
        });
        const defaultShiftTypeIds = nextDraft.shiftTypes.filter((shiftType) => !shiftType.isOff).map((shiftType) => shiftType.id);

        expect(nextDraft.nurses[0]?.possibleShiftTypeIds).toEqual(defaultShiftTypeIds);
        expect(nextDraft.nurses[1]?.possibleShiftTypeIds).toEqual(defaultShiftTypeIds);
    });

    it('fills missing parsed employmentDate with today', () => {
        const draft = createInitialDraft();
        const today = new Date().toISOString().slice(0, 10);
        const nextDraft = applyParsedWardData(draft, {
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: draft.teams[0]?.name,
                },
            ],
        });

        expect(nextDraft.nurses[0]?.employmentDate).toBe(today);
    });

    it('remaps existing nurse possible shifts by short name after uploaded shift types replace ids', () => {
        const initialDraft = createInitialDraft();
        const dayShift = initialDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'D');
        const eveningShift = initialDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'E');
        const nurseId = 'nurse-remap-target';
        const draft = {
            ...initialDraft,
            nurses: [
                createNurseDraft(initialDraft.teams[0]?.id ?? '', {
                    id: nurseId,
                    possibleShiftTypeIds: [dayShift?.id ?? '', eveningShift?.id ?? ''],
                }),
            ],
        };
        const nurseScopedDraft = {
            ...draft,
            nurses: draft.nurses.map((nurse) =>
                nurse.id === nurseId
                    ? {
                          ...nurse,
                          possibleShiftTypeIds: [dayShift?.id ?? '', eveningShift?.id ?? ''],
                      }
                    : nurse,
            ),
        };
        const nextDraft = applyParsedWardData(nurseScopedDraft, {
            shiftTypes: [
                {name: '데이', shortName: 'D'},
                {name: '미드', shortName: 'M'},
                {name: '오프', shortName: 'O', isOff: true},
            ],
        });
        const remappedNurse = nextDraft.nurses.find((nurse) => nurse.id === nurseId);
        const defaultShiftTypeIds = nextDraft.shiftTypes.filter((shiftType) => !shiftType.isOff).map((shiftType) => shiftType.id);

        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O', 'M']);
        expect(remappedNurse?.possibleShiftTypeIds).toEqual([nextDraft.shiftTypes[0]?.id, nextDraft.shiftTypes[1]?.id]);
        expect(remappedNurse?.possibleShiftTypeIds).not.toEqual(defaultShiftTypeIds);
    });

    it('falls back nurse team ids to the first uploaded team when previous team names disappear', () => {
        const draft = createInitialDraft();
        const fallbackTeamName = 'A팀';
        const renamedTeamsDraft = {
            ...draft,
            teams: draft.teams.map((team, index) => ({
                ...team,
                name: index === 0 ? fallbackTeamName : `${team.name}-기존`,
            })),
            nurses: draft.nurses.map((nurse, index) => ({
                ...nurse,
                teamId: draft.teams[index === 0 ? 0 : 1]?.id ?? nurse.teamId,
            })),
        };
        const nextDraft = applyParsedWardData(renamedTeamsDraft, {
            teams: [{name: fallbackTeamName}, {name: 'B팀'}],
        });

        expect(nextDraft.teams.map((team) => team.name)).toEqual([fallbackTeamName, 'B팀']);
        expect(nextDraft.nurses.every((nurse) => nurse.teamId === nextDraft.teams[0]?.id)).toBe(true);
    });

    it('merges uploaded skill level config into the existing draft config', () => {
        const draft = createInitialDraft();
        const nextDraft = applyParsedWardData(draft, {
            skillLevelConfig: {
                levelCount: 4,
            },
        });

        expect(nextDraft.skillLevelConfig).toEqual({
            ...draft.skillLevelConfig,
            levelCount: 4,
        });
    });

    it('normalizes parse api responses into draft injection data', () => {
        const response: TOnboardingWardParseApiResponse = {
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            wardShiftTypes: [
                {name: '데이', shortName: 'd'},
                {name: '오프', shortName: 'o', isOff: true},
            ],
            shiftTeams: [{name: 'A팀'}],
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: 'A팀',
                    possibleShiftShortNames: ['d', null],
                },
            ],
            warnings: ['근속 연수가 없는 간호사는 오늘 날짜로 반영되었어요.'],
        };
        const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');

        expect(parsedWardData).toMatchObject({
            fileName: 'ward.xlsx',
            wardName: '중환자실',
            hospitalName: '듀팅병원',
        });
        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['D', 'O']);
        expect(parsedWardData.teams).toEqual([{name: 'A팀'}]);
        expect(parsedWardData.nurses?.[0]?.possibleShiftShortNames).toEqual(['D']);
        expect(warnings).toEqual(['근속 연수가 없는 간호사는 오늘 날짜로 반영되었어요.']);
    });

    it('normalizes llm onboarding analyze responses into draft data and constraint candidates', () => {
        const response: TOnboardingWardParseApiResponse = {
            shift_type_candidates: [
                {code: 'D', classification: 'DAY'},
                {code: 'N', classification: 'NIGHT'},
                {code: 'O', classification: 'OFF'},
            ],
            nurse_candidates: [
                {
                    raw_name: '신규 간호사',
                    assignments: {'2025-03-01': 'D', '2025-03-02': 'N', '2025-03-03': 'O'},
                    monthly_counts: {D: 1, N: 1, O: 1},
                },
            ],
            constraint_candidates: [
                {
                    key: 'required_staff',
                    template_code: 'MIN_STAFF_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    params: {staffing: [{shift: 'D', count: 2}]},
                    severity_recommendation: 'HARD_AFTER_CONFIRM',
                    confidence: 0.86,
                    evidence_summary: '날짜별 근무코드 배치 수의 최빈값을 기준으로 계산',
                    risk_note: '확인이 필요합니다.',
                },
                {
                    key: 'unsupported',
                    params: {count: 6},
                    severity_recommendation: 'SOFT',
                    confidence: 0.5,
                    evidence_summary: '지원되지 않는 후보',
                },
            ],
            quality_report: {
                warnings: ['확정표가 없어 신뢰도를 낮췄어요.'],
            },
        };

        const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');
        const nextDraft = applyParsedWardData(createInitialDraft(), parsedWardData);
        const payload = buildCreateWardPayload(nextDraft);

        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['D', 'N', 'O']);
        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O']);
        expect(payload.wardShiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O']);
        expect(parsedWardData.nurses?.[0]?.possibleShiftShortNames).toEqual(['D', 'N']);
        expect(nextDraft.constraintCandidates).toHaveLength(1);
        expect(nextDraft.constraintCandidates[0]).toMatchObject({
            templateCode: 'MIN_STAFF_BY_SHIFT',
            severity: 'HARD',
            selected: true,
            confidence: 0.86,
        });
        expect(payload.shiftTeams[0]?.constraintRules).toEqual([
            {
                templateCode: 'MIN_STAFF_BY_SHIFT',
                severity: 'HARD',
                selected: true,
                params: {staffing: [{shift: 'D', count: 2}]},
            },
        ]);
        expect(warnings).toEqual(['확정표가 없어 신뢰도를 낮췄어요.']);
    });

    it('collects warnings from failed sheets and rows while trimming parsed upload fields', () => {
        const response: TOnboardingWardParseApiResponse = {
            fileName: ' parsed.xlsx ',
            wardName: ' 중환자실 ',
            hospitalName: ' 듀팅병원 ',
            wardShiftTypes: [
                {name: ' 데이 ', shortName: ' d '},
                {name: ' ', shortName: ' '},
            ],
            shiftTeams: [{name: ' A팀 '}],
            nurses: [
                {
                    name: ' 신규 간호사 ',
                    teamName: ' A팀 ',
                    possibleShiftShortNames: [' d ', null, ' '],
                },
                {
                    name: ' ',
                    teamName: ' ',
                },
            ],
            warnings: ['기본 경고'],
            failedSheets: ['3월'],
            failedRows: ['12행'],
        };
        const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, 'fallback.xlsx');

        expect(parsedWardData).toMatchObject({
            fileName: 'parsed.xlsx',
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            shiftTypes: [{name: '데이', shortName: 'D'}],
            teams: [{name: 'A팀'}],
        });
        expect(parsedWardData.nurses).toEqual([
            {
                name: '신규 간호사',
                teamName: 'A팀',
                possibleShiftShortNames: ['D'],
            },
        ]);
        expect(warnings).toEqual(['기본 경고', '시트 "3월" 데이터를 불러오지 못했어요.', '일부 행(12행)을 해석하지 못해 제외했어요.']);
    });

    it('detects supported upload file extensions', () => {
        expect(isSupportedOnboardingUploadFile('march-duty.xlsx')).toBe(true);
        expect(isSupportedOnboardingUploadFile('march-duty.csv')).toBe(false);
        expect(isSupportedOnboardingUploadFile('march-duty.pdf')).toBe(false);
    });

    it('maps network upload failures to a user guidance message', () => {
        expect(getOnboardingUploadFailureMessage(new Error('Network Error'))).toBe(
            '파싱 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
    });
});
