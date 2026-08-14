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
    updateRotationModeDraft,
} from '../model';

const createNurseDraft = (teamId: string, overrides: Partial<TOnboardingNurseDraft> = {}): TOnboardingNurseDraft => ({
    id: overrides.id ?? `nurse-${overrides.name ?? 'seed'}`,
    teamId,
    divisionNum: overrides.divisionNum ?? 1,
    name: overrides.name ?? '홍길동',
    memo: overrides.memo ?? '',
    isPreceptor: overrides.isPreceptor ?? false,
    isPreceptee: overrides.isPreceptee ?? false,
    isWorker: overrides.isWorker ?? true,
    employmentDate: overrides.employmentDate ?? '2024-01-01',
    possibleShiftTypeIds: overrides.possibleShiftTypeIds ?? [],
    initialShifts: overrides.initialShifts ?? [],
});

describe('OnboardingWardCreatePage adapter', () => {
    it('builds create ward payload outside the UI draft layer', () => {
        const initialDraft = createInitialDraft();
        const firstTeamId = initialDraft.teams[0]?.id ?? '';
        const defaultPossibleShiftTypeIds = initialDraft.shiftTypes.map((shiftType) => shiftType.id);
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
                        possibleShiftShortNames: expect.arrayContaining(['D', 'O']),
                    }),
                ]),
            }),
        );
    });

    it('includes two-shift rotation metadata without automatic assignment rules in the create payload', () => {
        const draft = updateRotationModeDraft(createInitialDraft(), 'TWO');
        const payload = buildCreateWardPayload(draft);

        expect(payload.wardShiftTypes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({classification: 'DAY', rotationSystem: 'TWO', paidMinutes: 630}),
                expect.objectContaining({classification: 'NIGHT', rotationSystem: 'TWO', paidMinutes: 630}),
                expect.objectContaining({classification: 'OFF', rotationSystem: 'NONE', paidMinutes: null}),
            ]),
        );
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.rotationSystem === 'THREE')).toBe(false);
        expect(payload.shiftTeams[0]?.constraintRules).toBeUndefined();
    });

    it('uses numeric two-shift aliases in the mixed-mode create payload', () => {
        const draft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const payload = buildCreateWardPayload(draft);

        expect(payload.wardShiftTypes.filter((shiftType) => shiftType.rotationSystem === 'TWO')).toEqual([
            expect.objectContaining({shortName: '1', classification: 'DAY'}),
            expect.objectContaining({shortName: '2', classification: 'NIGHT'}),
        ]);
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.shortName === 'ⓓ' || shiftType.shortName === 'ⓝ')).toBe(false);
    });

    it('normalizes non-standard work types to no rotation system in the create payload', () => {
        const draft = createInitialDraft();
        const customShiftType = {
            ...draft.shiftTypes[0]!,
            id: 'shift-custom',
            name: '교육',
            shortName: '교육',
            isDefault: false,
            classification: 'OTHER_WORK' as const,
            rotationSystem: 'THREE' as const,
            paidMinutes: 480,
        };
        const payload = buildCreateWardPayload({...draft, shiftTypes: [...draft.shiftTypes, customShiftType]});

        expect(payload.wardShiftTypes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({shortName: '교육', classification: 'OTHER_WORK', rotationSystem: 'NONE', paidMinutes: null}),
            ]),
        );
    });

    it('interprets uploaded D and N shifts using the previously selected two-shift mode', () => {
        const twoShiftDraft = updateRotationModeDraft(createInitialDraft(), 'TWO');
        const parsedDraft = applyParsedWardData(twoShiftDraft, {
            shiftTypes: [
                {name: '주간', shortName: 'D', classification: 'DAY', isOff: false},
                {name: '야간', shortName: 'N', classification: 'NIGHT', isOff: false},
                {name: '오프', shortName: 'O', classification: 'OFF', isOff: true},
            ],
        });

        expect(parsedDraft.shiftTypes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({shortName: 'D', rotationSystem: 'TWO', startTime: '07:00', endTime: '19:00'}),
                expect.objectContaining({shortName: 'N', rotationSystem: 'TWO', startTime: '19:00', endTime: '07:00'}),
                expect.objectContaining({shortName: 'O', rotationSystem: 'NONE'}),
            ]),
        );
    });

    it('keeps a parsed circled code as other work instead of inferring a two-shift type', () => {
        const twoShiftDraft = updateRotationModeDraft(createInitialDraft(), 'TWO');
        const parsedDraft = applyParsedWardData(twoShiftDraft, {
            shiftTypes: [
                {name: '주간 D', shortName: 'D', source: 'schedule-input'},
                {name: '주간 ⓓ', shortName: 'ⓓ', source: 'schedule-input'},
                {name: '야간', shortName: 'N', source: 'schedule-input'},
            ],
        });
        const inferredDay = parsedDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'D');
        const exactDay = parsedDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'ⓓ');
        const payload = buildCreateWardPayload(parsedDraft);

        expect(inferredDay).toEqual(
            expect.objectContaining({
                mappingStatus: 'AUTO_MATCHED',
                classification: 'DAY',
                rotationSystem: 'TWO',
            }),
        );
        expect(exactDay).toEqual(
            expect.objectContaining({
                mappingStatus: 'CONFIRMED',
                classification: 'OTHER_WORK',
                rotationSystem: 'NONE',
                startTime: '',
                endTime: '',
            }),
        );
        expect(payload.wardShiftTypes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({shortName: 'D', classification: 'DAY', rotationSystem: 'TWO'}),
                expect.objectContaining({shortName: 'ⓓ', classification: 'OTHER_WORK', rotationSystem: 'NONE'}),
            ]),
        );
    });

    it('does not reintroduce three-shift types when imported data is applied to a two-shift-only ward', () => {
        const twoShiftDraft = updateRotationModeDraft(createInitialDraft(), 'TWO');
        const parsedDraft = applyParsedWardData(twoShiftDraft, {
            shiftTypes: [
                {
                    name: '데이',
                    shortName: 'D',
                    startTime: '07:00',
                    endTime: '15:00',
                    classification: 'DAY',
                    rotationSystem: 'THREE',
                    isDefault: true,
                    isOff: false,
                },
                {
                    name: '이브닝',
                    shortName: 'E',
                    startTime: '15:00',
                    endTime: '22:00',
                    classification: 'EVENING',
                    rotationSystem: 'THREE',
                    isDefault: true,
                    isOff: false,
                },
                {
                    name: '나이트',
                    shortName: 'N',
                    startTime: '22:00',
                    endTime: '07:00',
                    classification: 'NIGHT',
                    rotationSystem: 'THREE',
                    isDefault: true,
                    isOff: false,
                },
                {name: '오프', shortName: 'O', classification: 'OFF', rotationSystem: 'NONE', isDefault: true, isOff: true},
            ],
        });
        const payload = buildCreateWardPayload(parsedDraft);

        expect(parsedDraft.rotationMode).toBe('TWO');
        expect(payload.wardShiftTypes).toEqual([
            expect.objectContaining({
                shortName: 'D',
                classification: 'DAY',
                rotationSystem: 'TWO',
                startTime: '07:00',
                endTime: '19:00',
            }),
            expect.objectContaining({
                shortName: 'N',
                classification: 'NIGHT',
                rotationSystem: 'TWO',
                startTime: '19:00',
                endTime: '07:00',
            }),
            expect.objectContaining({shortName: 'O', classification: 'OFF', rotationSystem: 'NONE'}),
            expect.objectContaining({shortName: 'E', classification: 'OTHER_WORK', rotationSystem: 'NONE'}),
        ]);
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.rotationSystem === 'THREE')).toBe(false);
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.classification === 'EVENING')).toBe(false);
    });

    it('moves imported two-shift-only rows to other work in a three-shift-only ward', () => {
        const parsedDraft = applyParsedWardData(createInitialDraft(), {
            shiftTypes: [
                {
                    name: '2교대 주간',
                    shortName: '1',
                    startTime: '07:00',
                    endTime: '19:00',
                    classification: 'DAY',
                    rotationSystem: 'TWO',
                    isDefault: false,
                    isOff: false,
                },
                {
                    name: '2교대 야간',
                    shortName: '2',
                    startTime: '19:00',
                    endTime: '07:00',
                    classification: 'NIGHT',
                    rotationSystem: 'TWO',
                    isDefault: false,
                    isOff: false,
                },
            ],
        });
        const payload = buildCreateWardPayload(parsedDraft);

        expect(parsedDraft.rotationMode).toBe('THREE');
        expect(parsedDraft.shiftTypes.filter((shiftType) => shiftType.shortName === '1' || shiftType.shortName === '2')).toEqual([
            expect.objectContaining({shortName: '1', classification: 'OTHER_WORK', rotationSystem: 'NONE', mappingStatus: 'CONFIRMED'}),
            expect.objectContaining({shortName: '2', classification: 'OTHER_WORK', rotationSystem: 'NONE', mappingStatus: 'CONFIRMED'}),
        ]);
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.rotationSystem === 'TWO')).toBe(false);
    });

    it('drops stale opposite-rotation seeds unless the previous schedule actually uses them', () => {
        const mixedDraft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const staleThreeShiftDraft = {...mixedDraft, rotationMode: 'THREE' as const};
        const parsedDraft = applyParsedWardData(staleThreeShiftDraft, {
            shiftTypes: [{name: '교육', shortName: '교육', classification: 'OTHER_WORK', rotationSystem: 'NONE', isOff: false}],
        });

        expect(parsedDraft.shiftTypes.some((shiftType) => shiftType.rotationSystem === 'TWO')).toBe(false);
        expect(parsedDraft.shiftTypes.some((shiftType) => ['1', '2', 'ⓓ', 'ⓝ'].includes(shiftType.shortName))).toBe(false);
        expect(parsedDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['교육']);
    });

    it('keeps only parsed previous-schedule shifts after mixed-mode defaults were seeded', () => {
        const mixedDraft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const parsedDraft = applyParsedWardData(mixedDraft, {
            shiftTypes: [
                {name: '데이', shortName: 'D', classification: 'DAY', rotationSystem: 'THREE'},
                {name: '이브닝', shortName: 'E', classification: 'EVENING', rotationSystem: 'THREE'},
                {name: '나이트', shortName: 'N', classification: 'NIGHT', rotationSystem: 'THREE'},
                {name: '오프', shortName: 'O', classification: 'OFF', rotationSystem: 'NONE', isOff: true},
            ],
        });

        expect(parsedDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O']);
        expect(parsedDraft.shiftTypes.some((shiftType) => ['1', '2', 'ⓓ', 'ⓝ'].includes(shiftType.shortName))).toBe(false);
    });

    it('uses imported numeric mixed-mode codes as the two-shift rows', () => {
        const mixedDraft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const parsedDraft = applyParsedWardData(mixedDraft, {
            shiftTypes: [
                {
                    name: '2교대 데이',
                    shortName: '1',
                    startTime: '07:00',
                    endTime: '19:00',
                    isDefault: false,
                    isOff: false,
                    classification: 'OTHER_WORK',
                    rotationSystem: 'NONE',
                    source: 'schedule-input',
                },
                {
                    name: '2교대 나이트',
                    shortName: '2',
                    startTime: '19:00',
                    endTime: '07:00',
                    isDefault: false,
                    isOff: false,
                    classification: 'OTHER_WORK',
                    rotationSystem: 'NONE',
                    source: 'schedule-input',
                },
            ],
        });
        const payload = buildCreateWardPayload(parsedDraft);
        const twoShiftTypes = payload.wardShiftTypes.filter((shiftType) => shiftType.rotationSystem === 'TWO');
        const importedDay = parsedDraft.shiftTypes.find((shiftType) => shiftType.shortName === '1');
        const importedNight = parsedDraft.shiftTypes.find((shiftType) => shiftType.shortName === '2');

        expect(importedDay).toEqual(
            expect.objectContaining({
                mappingStatus: 'AUTO_MATCHED',
                classification: 'DAY',
                rotationSystem: 'TWO',
            }),
        );
        expect(importedNight).toEqual(
            expect.objectContaining({
                mappingStatus: 'AUTO_MATCHED',
                classification: 'NIGHT',
                rotationSystem: 'TWO',
            }),
        );
        expect(twoShiftTypes).toEqual([
            expect.objectContaining({shortName: '1', classification: 'DAY', startTime: '07:00', endTime: '19:00'}),
            expect.objectContaining({shortName: '2', classification: 'NIGHT', startTime: '19:00', endTime: '07:00'}),
        ]);
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.shortName === 'ⓓ' || shiftType.shortName === 'ⓝ')).toBe(false);
    });

    it('auto-matches numeric mixed-mode two-shift codes returned by the parse API', () => {
        const response: TOnboardingWardParseApiResponse = {
            wardShiftTypes: [
                {
                    name: '2교대 데이',
                    shortName: '1',
                    startTime: '07:00',
                    endTime: '19:00',
                    isOff: false,
                    classification: 'DAY',
                    rotationSystem: 'TWO',
                    paidMinutes: 630,
                },
            ],
        };
        const {parsedWardData} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');
        const parsedDraft = applyParsedWardData(updateRotationModeDraft(createInitialDraft(), 'MIXED'), parsedWardData);

        expect(parsedDraft.shiftTypes.find((shiftType) => shiftType.shortName === '1')).toEqual(
            expect.objectContaining({
                classification: 'DAY',
                rotationSystem: 'TWO',
                mappingStatus: 'AUTO_MATCHED',
            }),
        );
    });

    it('does not infer two-shift semantics from time when the user selected three-shift only', () => {
        const parsedDraft = applyParsedWardData(createInitialDraft(), {
            shiftTypes: [
                {
                    name: '12시간 교육',
                    shortName: 'W',
                    startTime: '07:00',
                    endTime: '19:00',
                    isDefault: false,
                    isOff: false,
                    classification: 'OTHER_WORK',
                    rotationSystem: 'NONE',
                },
            ],
        });

        expect(parsedDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'W')).toEqual(
            expect.objectContaining({
                shortName: 'W',
                classification: 'OTHER_WORK',
                rotationSystem: 'NONE',
                mappingStatus: 'UNASSIGNED',
            }),
        );
    });

    it('keeps archived shift types for initial schedules but removes them from future possible shifts', () => {
        const initialDraft = createInitialDraft();
        const firstTeamId = initialDraft.teams[0]?.id ?? '';
        const archivedShiftType = {
            ...initialDraft.shiftTypes[0]!,
            id: 'shift-archived-a',
            name: 'Archived A',
            shortName: 'A',
            startTime: '',
            endTime: '',
            isDefault: false,
            isActive: false,
            classification: 'OTHER_WORK' as const,
        };
        const draft = {
            ...initialDraft,
            shiftTypes: [...initialDraft.shiftTypes, archivedShiftType],
            nurses: [
                createNurseDraft(firstTeamId, {
                    id: 'nurse-a',
                    name: 'Nurse A',
                    possibleShiftTypeIds: [...initialDraft.shiftTypes.map((shiftType) => shiftType.id), archivedShiftType.id],
                    initialShifts: [{date: '2026-05-01', shiftShortName: 'A'}],
                }),
            ],
        };
        const payload = buildCreateWardPayload(draft);

        expect(payload.wardShiftTypes.find((shiftType) => shiftType.shortName === 'A')).toEqual(expect.objectContaining({isActive: false}));
        expect(payload.shiftTeams[0]?.nurses?.[0]?.possibleShiftShortNames).not.toContain('A');
        expect(payload.shiftTeams[0]?.nurses?.[0]?.initialShifts).toEqual([{date: '2026-05-01', shiftShortName: 'A'}]);
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

    it('sends preceptor roles separately from nurse memo in the create payload', () => {
        const initialDraft = createInitialDraft();
        const firstTeamId = initialDraft.teams[0]?.id ?? '';
        const payload = buildCreateWardPayload({
            ...initialDraft,
            nurses: [
                createNurseDraft(firstTeamId, {
                    name: 'Nurse A',
                    memo: '프리셉터',
                    isPreceptor: true,
                }),
            ],
        });

        expect(payload.shiftTeams[0]?.nurses?.[0]).toEqual(
            expect.objectContaining({
                memo: '',
                isPreceptor: true,
                isPreceptee: false,
            }),
        );
    });

    it('uses a safe fallback name when both ward and hospital names are blank', () => {
        const payload = buildCreateWardPayload(createInitialDraft());

        expect(payload.name).toBe('듀팅 병동');
        expect(payload.hospitalName).toBe('듀팅 병동');
    });

    it('preserves the selected classification for overnight working shift types', () => {
        const draft = createInitialDraft();
        const dayShiftId = draft.shiftTypes.find((shiftType) => shiftType.classification === 'DAY')?.id ?? '';
        const payload = buildCreateWardPayload({
            ...draft,
            shiftTypes: draft.shiftTypes.map((shiftType) =>
                shiftType.id === dayShiftId
                    ? {
                          ...shiftType,
                          startTime: '16:30',
                          endTime: '00:30',
                          classification: 'OTHER_WORK',
                      }
                    : shiftType,
            ),
        });

        expect(payload.wardShiftTypes.find((shiftType) => shiftType.shortName === 'D')?.classification).toBe('OTHER_WORK');
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
                },
            ],
        });

        expect(nextDraft.uploadedFileName).toBe('ward.xlsx');
        expect(nextDraft.wardName).toBe('중환자실');
        expect(nextDraft.hospitalName).toBe('듀팅병원');
        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'O']);
        expect(nextDraft.teams).toHaveLength(1);
        expect(nextDraft.teams[0]?.name).toBe('A팀');
        expect(nextDraft.nurses[0]?.teamId).toBe(nextDraft.teams[0]?.id);
        expect(nextDraft.nurses[0]?.possibleShiftTypeIds).toEqual(nextDraft.shiftTypes.map((shiftType) => shiftType.id));
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
        const defaultShiftTypeIds = nextDraft.shiftTypes.map((shiftType) => shiftType.id);

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

    it('checks every shift type as possible after uploaded shift types replace ids', () => {
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
        const defaultShiftTypeIds = nextDraft.shiftTypes.map((shiftType) => shiftType.id);

        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'O', 'M']);
        expect(remappedNurse?.possibleShiftTypeIds).toEqual(defaultShiftTypeIds);
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
                {code: '교육', classification: 'OTHER_WORK'},
            ],
            nurse_candidates: [
                {
                    raw_name: '신규 간호사',
                    assignments: {'2025-03-01': 'D', '2025-03-02': 'N', '2025-03-03': 'O', '2025-03-04': '교육'},
                    monthly_counts: {D: 1, N: 1, O: 1, 교육: 1},
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

        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['D', 'N', 'O', '교육']);
        expect(nextDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'N', 'O', '교육']);
        expect(nextDraft.shiftTypes.find((shiftType) => shiftType.shortName === '교육')).toEqual(
            expect.objectContaining({mappingStatus: 'UNASSIGNED'}),
        );
        expect(payload.wardShiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'N', 'O']);
        expect(parsedWardData.nurses?.[0]?.possibleShiftShortNames).toEqual(['D', 'N', '교육']);
        expect(parsedWardData.nurses?.[0]?.initialShifts).toEqual([
            {date: '2025-03-01', shiftShortName: 'D'},
            {date: '2025-03-02', shiftShortName: 'N'},
            {date: '2025-03-03', shiftShortName: 'O'},
            {date: '2025-03-04', shiftShortName: '교육'},
        ]);
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
        expect(payload.shiftTeams[0]?.nurses?.[0]?.initialShifts).toEqual([
            {date: '2025-03-01', shiftShortName: 'D'},
            {date: '2025-03-02', shiftShortName: 'N'},
            {date: '2025-03-03', shiftShortName: 'O'},
        ]);
        expect(warnings).toEqual(['확정표가 없어 신뢰도를 낮췄어요.']);
    });

    it('prefers observed excel shift symbols over default D/E/N/O fallbacks', () => {
        const response: TOnboardingWardParseApiResponse = {
            wardShiftTypes: [
                {name: '데이', shortName: 'D', isDefault: true, classification: 'DAY'},
                {name: '이브닝', shortName: 'E', isDefault: true, classification: 'EVENING'},
                {name: '나이트', shortName: 'N', isDefault: true, classification: 'NIGHT'},
                {name: '오프', shortName: 'O', isDefault: true, isOff: true, classification: 'OFF'},
                {name: '데이', shortName: 'DA', classification: 'DAY'},
                {name: '이브닝', shortName: 'EV', classification: 'EVENING'},
                {name: '오프', shortName: '-', isOff: true, classification: 'OFF'},
            ],
            nurse_candidates: [
                {
                    raw_name: '김하늘',
                    assignments: {'2026-05-01': 'DA', '2026-05-02': 'EV', '2026-05-03': 'N', '2026-05-04': '-'},
                    monthly_counts: {DA: 1, EV: 1, N: 1, '-': 1},
                },
            ],
        };
        const {parsedWardData} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');
        const nextDraft = applyParsedWardData(createInitialDraft(), parsedWardData);
        const payload = buildCreateWardPayload(nextDraft);

        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['DA', 'EV', 'N', '-']);
        expect(payload.wardShiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['N', '-']);
        expect(payload.wardShiftTypes.find((shiftType) => shiftType.shortName === '-')?.classification).toBe('OFF');
        expect(payload.wardShiftTypes.find((shiftType) => shiftType.shortName === '-')?.isOff).toBe(true);
        expect(payload.wardShiftTypes.find((shiftType) => shiftType.shortName === '-')?.color).toBe('#465B7A');
        expect(nextDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'DA')?.mappingStatus).toBe('UNASSIGNED');
        expect(nextDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'EV')?.mappingStatus).toBe('UNASSIGNED');
        expect(payload.wardShiftTypes.some((shiftType) => shiftType.shortName === 'O')).toBe(false);
        expect(payload.shiftTeams[0]?.nurses?.[0]?.initialShifts).toEqual([
            {date: '2026-05-03', shiftShortName: 'N'},
            {date: '2026-05-04', shiftShortName: '-'},
        ]);
    });

    it('keeps one representative off symbol and remaps off aliases to it', () => {
        const response: TOnboardingWardParseApiResponse = {
            wardShiftTypes: [
                {name: '오프', shortName: 'O', isDefault: true, isOff: true, classification: 'OFF'},
                {name: '오프', shortName: '/', isOff: true, classification: 'OFF'},
            ],
            nurse_candidates: [
                {
                    raw_name: '김하늘',
                    assignments: {'2026-05-01': '/', '2026-05-02': '/', '2026-05-03': 'O'},
                    monthly_counts: {'/': 2, O: 1},
                },
            ],
        };
        const {parsedWardData} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');
        const nextDraft = applyParsedWardData(createInitialDraft(), parsedWardData);
        const payload = buildCreateWardPayload(nextDraft);

        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['/']);
        expect(payload.wardShiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['/']);
        expect(payload.shiftTeams[0]?.nurses?.[0]?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: '/'},
            {date: '2026-05-02', shiftShortName: '/'},
            {date: '2026-05-03', shiftShortName: '/'},
        ]);
    });

    it('treats observed off aliases as the same off type even when classified as other leave', () => {
        const response: TOnboardingWardParseApiResponse = {
            wardShiftTypes: [
                {name: '?ㅽ봽', shortName: 'O', isDefault: true, isOff: true, classification: 'OFF'},
                {name: '?ㅽ봽', shortName: '/', isOff: true, classification: 'OTHER_LEAVE'},
            ],
            nurse_candidates: [
                {
                    raw_name: 'Nurse A',
                    assignments: {'2026-05-01': '/', '2026-05-02': '/'},
                    monthly_counts: {'/': 2},
                },
            ],
        };
        const {parsedWardData} = buildOnboardingParseDraftInjection(response, 'ward.xlsx');
        const nextDraft = applyParsedWardData(createInitialDraft(), parsedWardData);
        const payload = buildCreateWardPayload(nextDraft);

        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['/']);
        expect(payload.wardShiftTypes).toHaveLength(1);
        expect(payload.wardShiftTypes[0]).toEqual(
            expect.objectContaining({shortName: '/', isDefault: true, isOff: true, classification: 'OFF'}),
        );
        expect(payload.shiftTeams[0]?.nurses?.[0]?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: '/'},
            {date: '2026-05-02', shiftShortName: '/'},
        ]);
    });

    it('uses the selected upload month to preserve day-number assignments', () => {
        const response: TOnboardingWardParseApiResponse = {
            nurse_candidates: [
                {
                    raw_name: '신규 간호사',
                    assignments: {'1': 'D', '2': 'E'},
                },
            ],
        };
        const {parsedWardData} = buildOnboardingParseDraftInjection(response, 'ward.xlsx', {targetYear: 2026, targetMonth: 5});
        const nextDraft = applyParsedWardData(createInitialDraft(), parsedWardData);
        const payload = buildCreateWardPayload(nextDraft);

        expect(parsedWardData.shiftTypes?.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E']);
        expect(parsedWardData.nurses?.[0]?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'D'},
            {date: '2026-05-02', shiftShortName: 'E'},
        ]);
        expect(payload.shiftTeams[0]?.nurses?.[0]?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'D'},
            {date: '2026-05-02', shiftShortName: 'E'},
        ]);
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
            blocking_questions: ['근무코드 C의 의미를 확인해 주세요.'],
            failedSheets: ['3월'],
            failedRows: ['12행'],
        };
        const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, 'fallback.xlsx');
        const parsedShiftName = response.wardShiftTypes?.[0]?.name?.trim();

        expect(parsedWardData).toMatchObject({
            fileName: 'parsed.xlsx',
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            shiftTypes: [{name: parsedShiftName, shortName: 'D'}],
            teams: [{name: 'A팀'}],
        });
        expect(parsedWardData.nurses).toEqual([
            {
                name: '신규 간호사',
                teamName: 'A팀',
                possibleShiftShortNames: ['D'],
            },
        ]);
        expect(warnings).toEqual([
            '기본 경고',
            '근무코드 C의 의미를 확인해 주세요.',
            '시트 "3월" 데이터를 불러오지 못했어요.',
            '일부 행(12행)을 해석하지 못해 제외했어요.',
        ]);
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
