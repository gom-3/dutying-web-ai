import {describe, expect, it} from 'vitest';
import {
    addNurseDraft,
    addShiftTypeDraft,
    addTeamDraft,
    applyScheduleInputDraft,
    applyUploadedScheduleTemplateDraft,
    canComplete,
    canGoNext,
    createInitialDraft,
    DEFAULT_SHIFT_TYPE_COLORS,
    deleteTeamDraft,
    deleteShiftTypeDraft,
    getOnboardingInitialScheduleTarget,
    getOnboardingInitialScheduleTargets,
    getStepValidation,
    MAX_ONBOARDING_SHIFT_TYPES,
    prepareManualEntryDraft,
    reorderNursesWithinTeam,
    saveSkillLevelConfig,
    type TOnboardingDraftLabels,
    updateNurseDraft,
    updateShiftTypeDraft,
} from '../model';

const localizedLabels: TOnboardingDraftLabels = {
    teamName: (index) => `Localized Team ${index}`,
    newNurseName: (index) => `Localized Nurse ${index}`,
    sampleNurseNames: {
        first: 'Sample One',
        second: 'Sample Two',
        skilled: 'Sample Skilled',
        off: 'Sample Rest',
    },
    shiftNames: {
        day: 'Morning',
        evening: 'Swing',
        night: 'Overnight',
        off: 'Rest',
    },
};

describe('OnboardingWardCreatePage model', () => {
    it('requires hospital name and keeps ward name optional on the first step', () => {
        const initialDraft = createInitialDraft();

        expect(getStepValidation(initialDraft, 1).issues).toEqual([{code: 'missing-hospital-name', step: 1}]);

        const withHospitalName = {
            ...initialDraft,
            hospitalName: '듀팅병원',
        };

        expect(getStepValidation(withHospitalName, 1).isValid).toBe(true);

        const withInvalidWardName = {
            ...withHospitalName,
            wardName: '중환자실!',
        };

        expect(getStepValidation(withInvalidWardName, 1).issues).toEqual([{code: 'invalid-ward-name', step: 1}]);
    });

    it('uses injected labels for default teams, nurses, and shifts', () => {
        const initialDraft = createInitialDraft(localizedLabels);

        expect(initialDraft.teams.map((team) => team.name)).toEqual(['Localized Team 1', 'Localized Team 2', 'Localized Team 3']);
        expect(initialDraft.shiftTypes.map((shiftType) => shiftType.name)).toEqual(['Morning', 'Swing', 'Overnight', 'Rest']);
        expect(initialDraft.nurses.map((nurse) => nurse.name)).toEqual(['Sample One', 'Sample Two', 'Sample Skilled', 'Sample Rest']);

        const {draft: teamDraft} = addTeamDraft(initialDraft, localizedLabels);
        const nurseDraft = addNurseDraft(initialDraft, initialDraft.teams[0]!.id, localizedLabels);
        const {draft: uploadedDraft} = applyUploadedScheduleTemplateDraft(
            prepareManualEntryDraft(initialDraft, localizedLabels),
            {
                fileName: 'template.xlsx',
                year: 2026,
                month: 6,
                teamSchedules: [{teamName: '', rows: [{name: 'Uploaded Nurse', shifts: {'1': 'O'}}]}],
            },
            localizedLabels,
        );

        expect(teamDraft.teams[teamDraft.teams.length - 1]?.name).toBe('Localized Team 4');
        expect(nurseDraft.nurses[nurseDraft.nurses.length - 1]?.name).toBe('Localized Nurse 5');
        expect(uploadedDraft.teams.map((team) => team.name)).toEqual(['Localized Team 1']);
    });

    it('returns validation issues for invalid shift types', () => {
        const initialDraft = createInitialDraft();
        const extraShiftDraft = addShiftTypeDraft({
            ...initialDraft,
            currentStep: 3,
        });
        const validation = getStepValidation(extraShiftDraft, 3);

        expect(validation.isValid).toBe(false);
        expect(validation.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-shift-short-name']));
        expect(canGoNext(extraShiftDraft)).toBe(false);
    });

    it('blocks duplicate shift short names', () => {
        const initialDraft = createInitialDraft();
        const firstShift = initialDraft.shiftTypes[0];
        const secondShift = initialDraft.shiftTypes[1];

        if (!firstShift || !secondShift) {
            throw new Error('base shift types are required for this test');
        }

        const duplicateDraft = updateShiftTypeDraft(
            {
                ...initialDraft,
                currentStep: 3,
            },
            secondShift.id,
            {
                name: firstShift.name,
                shortName: firstShift.shortName,
            },
        );
        const validation = getStepValidation(duplicateDraft, 3);

        expect(validation.issues).toEqual(
            expect.arrayContaining([
                {code: 'duplicate-shift-short-name', step: 3, targetId: firstShift.id},
                {code: 'duplicate-shift-short-name', step: 3, targetId: secondShift.id},
            ]),
        );
        expect(canGoNext(duplicateDraft)).toBe(false);
    });

    it('blocks shift short names that start with the same character', () => {
        const initialDraft = createInitialDraft();
        const firstShift = initialDraft.shiftTypes[0];
        const secondShift = initialDraft.shiftTypes[1];

        if (!firstShift || !secondShift) {
            throw new Error('base shift types are required for this test');
        }

        const duplicateDraft = updateShiftTypeDraft(
            {
                ...initialDraft,
                currentStep: 3,
            },
            secondShift.id,
            {
                name: 'Unique shift',
                shortName: `${firstShift.shortName}X`,
            },
        );
        const validation = getStepValidation(duplicateDraft, 3);

        expect(validation.issues).toEqual(
            expect.arrayContaining([
                {code: 'duplicate-shift-short-name', step: 3, targetId: firstShift.id},
                {code: 'duplicate-shift-short-name', step: 3, targetId: secondShift.id},
            ]),
        );
        expect(canGoNext(duplicateDraft)).toBe(false);
    });

    it('allows three-character keyboard abbreviations and blocks invalid first keys', () => {
        const initialDraft = createInitialDraft();
        const firstShift = initialDraft.shiftTypes[0];

        if (!firstShift) {
            throw new Error('base shift type is required for this test');
        }

        const symbolDraft = updateShiftTypeDraft(
            {
                ...initialDraft,
                currentStep: 3,
            },
            firstShift.id,
            {shortName: '_11'},
        );

        expect(getStepValidation(symbolDraft, 3).issues).not.toEqual(
            expect.arrayContaining([{code: 'invalid-shift-short-name', step: 3, targetId: firstShift.id}]),
        );

        const invalidFirstKeyDraft = updateShiftTypeDraft(symbolDraft, firstShift.id, {shortName: '교육'});

        expect(getStepValidation(invalidFirstKeyDraft, 3).issues).toEqual(
            expect.arrayContaining([{code: 'invalid-shift-short-name', step: 3, targetId: firstShift.id}]),
        );

        const tooLongDraft = updateShiftTypeDraft(symbolDraft, firstShift.id, {shortName: 'ABCD'});

        expect(getStepValidation(tooLongDraft, 3).issues).toEqual(
            expect.arrayContaining([{code: 'invalid-shift-short-name', step: 3, targetId: firstShift.id}]),
        );
    });

    it('limits shift types to the maximum count', () => {
        const draft = createInitialDraft();

        let maxShiftDraft = draft;

        for (let index = draft.shiftTypes.length; index < MAX_ONBOARDING_SHIFT_TYPES; index += 1) {
            maxShiftDraft = addShiftTypeDraft(maxShiftDraft);
        }

        expect(maxShiftDraft.shiftTypes).toHaveLength(MAX_ONBOARDING_SHIFT_TYPES);

        const afterExceeded = addShiftTypeDraft(maxShiftDraft);

        expect(afterExceeded.shiftTypes).toHaveLength(MAX_ONBOARDING_SHIFT_TYPES);
    });

    it('uses dedicated default colors for core and newly added shift types', () => {
        const draft = createInitialDraft();
        const withAdditionalShift = addShiftTypeDraft(draft);

        expect(draft.shiftTypes.map((shiftType) => shiftType.color)).toEqual(DEFAULT_SHIFT_TYPE_COLORS.slice(0, 4));
        expect(withAdditionalShift.shiftTypes[4]?.color).toBe(DEFAULT_SHIFT_TYPE_COLORS[4]);
        expect(
            withAdditionalShift.nurses.every((nurse) => nurse.possibleShiftTypeIds.includes(withAdditionalShift.shiftTypes[4]?.id ?? '')),
        ).toBe(true);
    });

    it('deletes a team and all nurses in that team', () => {
        const draft = createInitialDraft();
        const targetTeamId = draft.teams[0]?.id ?? '';
        const teamNurseIds = draft.nurses.filter((nurse) => nurse.teamId === targetTeamId).map((nurse) => nurse.id);
        const nextDraft = deleteTeamDraft(draft, targetTeamId);

        expect(nextDraft.teams.some((team) => team.id === targetTeamId)).toBe(false);
        expect(nextDraft.nurses.some((nurse) => teamNurseIds.includes(nurse.id))).toBe(false);
    });

    it('adds a nurse with all shift types selected by default', () => {
        const draft = createInitialDraft();
        const teamId = draft.teams[0]?.id ?? '';
        const nextDraft = addNurseDraft(draft, teamId);
        const addedNurse = nextDraft.nurses[nextDraft.nurses.length - 1];

        expect(addedNurse).toBeDefined();
        expect(addedNurse?.possibleShiftTypeIds).toEqual(nextDraft.shiftTypes.map((shiftType) => shiftType.id));
    });

    it('preserves existing team month schedules when another month is edited', () => {
        const draft = createInitialDraft();
        const teamId = draft.teams[0]?.id ?? '';
        const mayDraft = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [{id: 'may-row', nurseId: null, name: '김하늘', shifts: {'1': 'D'}}],
        });
        const juneDraft = applyScheduleInputDraft(mayDraft, teamId, {
            year: 2026,
            month: 6,
            rows: [{id: 'june-row', nurseId: null, name: '김하늘', shifts: {'1': 'E'}}],
        });

        expect(juneDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.shifts).toEqual({'1': 'D'});
        expect(juneDraft.scheduleInputs[teamId]?.['2026-06']?.rows[0]?.shifts).toEqual({'1': 'E'});
        expect(juneDraft.nurses.find((nurse) => nurse.name === '김하늘')?.possibleShiftTypeIds).toEqual(
            juneDraft.shiftTypes.map((shiftType) => shiftType.id),
        );
    });

    it('removes a schedule-derived nurse when their name cell is cleared', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]?.id ?? '';
        const withNurses = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {id: 'row-a', nurseId: null, name: 'Nurse A', shifts: {'1': 'D'}},
                {id: 'row-b', nurseId: null, name: 'Nurse B', shifts: {'1': 'E'}},
            ],
        });
        const [nurseARow, nurseBRow] = withNurses.scheduleInputs[teamId]?.['2026-05']?.rows ?? [];
        const clearedDraft = applyScheduleInputDraft(withNurses, teamId, {
            year: 2026,
            month: 5,
            rows: [{...nurseARow!, name: ''}, nurseBRow!],
        });

        expect(clearedDraft.nurses.map((nurse) => nurse.name)).toEqual(['Nurse B']);
        expect(clearedDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.nurseId).toBeNull();
    });

    it('blocks schedule input rows that have shifts without a nurse name', () => {
        const draft = {
            ...prepareManualEntryDraft(createInitialDraft()),
            currentStep: 2 as const,
        };
        const teamId = draft.teams[0]?.id ?? '';
        const invalidDraft = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [{id: 'row-a', nurseId: null, name: '', shifts: {'1': 'D'}}],
        });
        const validation = getStepValidation(invalidDraft, 2);

        expect(validation.isValid).toBe(false);
        expect(validation.issues).toEqual([{code: 'schedule-row-missing-nurse-name', step: 2, targetId: 'row-a'}]);
        expect(canGoNext(invalidDraft)).toBe(false);
    });

    it('keeps nurses that still appear in another schedule month', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]?.id ?? '';
        const mayDraft = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [{id: 'may-row', nurseId: null, name: 'Nurse A', shifts: {'1': 'D'}}],
        });
        const juneDraft = applyScheduleInputDraft(mayDraft, teamId, {
            year: 2026,
            month: 6,
            rows: [{id: 'june-row', nurseId: null, name: 'Nurse B', shifts: {'1': 'E'}}],
        });
        const clearedMayDraft = applyScheduleInputDraft(juneDraft, teamId, {
            year: 2026,
            month: 5,
            rows: [],
        });

        expect(clearedMayDraft.nurses.map((nurse) => nurse.name)).toEqual(['Nurse B']);
        expect(clearedMayDraft.scheduleInputs[teamId]?.['2026-06']?.rows[0]?.name).toBe('Nurse B');
    });

    it('clears sample nurses when starting manual entry without an upload', () => {
        const draft = createInitialDraft();
        const manualDraft = prepareManualEntryDraft(draft);

        expect(manualDraft.teams).toHaveLength(1);
        expect(manualDraft.nurses).toEqual([]);
        expect(manualDraft.constraintCandidates).toEqual([]);
    });

    it('removes deleted shift ids from nurse possible shifts', () => {
        const draft = createInitialDraft();
        const deletedShiftId = draft.shiftTypes[0]?.id ?? '';
        const nextDraft = deleteShiftTypeDraft(draft, deletedShiftId);

        expect(nextDraft.shiftTypes.some((shiftType) => shiftType.id === deletedShiftId)).toBe(false);
        expect(nextDraft.nurses.every((nurse) => !nurse.possibleShiftTypeIds.includes(deletedShiftId))).toBe(true);
    });

    it('flags empty teams and missing nurse names in nurse steps', () => {
        const draft = createInitialDraft();
        const {draft: draftWithTeam} = addTeamDraft({
            ...draft,
            currentStep: 4,
        });
        const nurseId = draftWithTeam.nurses[0]?.id ?? '';
        const invalidDraft = updateNurseDraft(draftWithTeam, nurseId, {name: ''});
        const validation = getStepValidation(invalidDraft, 4);

        expect(validation.isValid).toBe(false);
        expect(validation.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['empty-team-nurses', 'missing-nurse-name']));
        expect(canGoNext(invalidDraft)).toBe(false);
    });

    it('flags invalid nurse names when korean input has incomplete jamo or too short syllables', () => {
        const draft = createInitialDraft();
        const nurseId = draft.nurses[0]?.id ?? '';
        const jamoNameDraft = updateNurseDraft(
            {
                ...draft,
                currentStep: 4,
            },
            nurseId,
            {name: 'ㄱㅣㅁ'},
        );
        const shortKoreanNameDraft = updateNurseDraft(jamoNameDraft, nurseId, {name: '홍'});

        expect(getStepValidation(jamoNameDraft, 4).issues).toEqual(
            expect.arrayContaining([{code: 'invalid-nurse-name', step: 4, targetId: nurseId}]),
        );
        expect(getStepValidation(shortKoreanNameDraft, 4).issues).toEqual(
            expect.arrayContaining([{code: 'invalid-nurse-name', step: 4, targetId: nurseId}]),
        );
        expect(canGoNext(shortKoreanNameDraft)).toBe(false);
    });

    it('allows ordinary internal spaces in nurse names', () => {
        const draft = {
            ...createInitialDraft(),
            currentStep: 4 as const,
        };
        const nurseId = draft.nurses[0]?.id ?? '';
        const koreanNameDraft = updateNurseDraft(draft, nurseId, {name: '신규 간호사 1'});
        const englishNameDraft = updateNurseDraft(draft, nurseId, {name: 'Nurse 1'});

        expect(getStepValidation(koreanNameDraft, 4).issues).not.toEqual(
            expect.arrayContaining([{code: 'invalid-nurse-name', step: 4, targetId: nurseId}]),
        );
        expect(getStepValidation(englishNameDraft, 4).issues).not.toEqual(
            expect.arrayContaining([{code: 'invalid-nurse-name', step: 4, targetId: nurseId}]),
        );
    });

    it('rejects unsupported nurse name separators and special characters', () => {
        const draft = {
            ...createInitialDraft(),
            currentStep: 4 as const,
        };
        const nurseId = draft.nurses[0]?.id ?? '';
        const invalidNames = ['Nurse_1', '김\t길동', '김\n길동', '김　길동'];

        invalidNames.forEach((name) => {
            const invalidDraft = updateNurseDraft(draft, nurseId, {name});

            expect(getStepValidation(invalidDraft, 4).issues).toEqual(
                expect.arrayContaining([{code: 'invalid-nurse-name', step: 4, targetId: nurseId}]),
            );
        });
    });

    it('allows off shifts without times but blocks working shifts without times', () => {
        const draft = createInitialDraft();
        const offShiftId = draft.shiftTypes.find((shiftType) => shiftType.isOff)?.id ?? '';
        const workingShiftId = draft.shiftTypes.find((shiftType) => !shiftType.isOff)?.id ?? '';
        const withoutOffTimes = updateShiftTypeDraft(draft, offShiftId, {startTime: '', endTime: ''});
        const withoutWorkingStartTime = updateShiftTypeDraft(withoutOffTimes, workingShiftId, {startTime: ''});
        const validation = getStepValidation(withoutWorkingStartTime, 3);

        expect(validation.issues).toEqual(expect.arrayContaining([{code: 'missing-shift-time', step: 3, targetId: workingShiftId}]));
        expect(validation.issues).not.toEqual(expect.arrayContaining([{code: 'missing-shift-time', step: 3, targetId: offShiftId}]));
    });

    it('flags invalid shift time format', () => {
        const draft = createInitialDraft();
        const workingShiftId = draft.shiftTypes.find((shiftType) => shiftType.classification === 'DAY')?.id ?? '';
        const invalidFormatDraft = updateShiftTypeDraft(
            {
                ...draft,
                currentStep: 3,
            },
            workingShiftId,
            {startTime: '24:00'},
        );
        const validation = getStepValidation(invalidFormatDraft, 3);

        expect(validation.issues).toEqual(expect.arrayContaining([{code: 'invalid-shift-time-format', step: 3, targetId: workingShiftId}]));
        expect(canGoNext(invalidFormatDraft)).toBe(false);
    });

    it('allows overnight shift times for any working shift type', () => {
        const draft = createInitialDraft();
        const dayShiftId = draft.shiftTypes.find((shiftType) => shiftType.classification === 'DAY')?.id ?? '';
        const overnightDraft = updateShiftTypeDraft(
            {
                ...draft,
                currentStep: 3,
            },
            dayShiftId,
            {
                startTime: '16:30',
                endTime: '00:30',
            },
        );
        const validation = getStepValidation(overnightDraft, 3);

        expect(validation.issues).not.toEqual(expect.arrayContaining([{code: 'invalid-shift-time-order', step: 3, targetId: dayShiftId}]));
        expect(canGoNext(overnightDraft)).toBe(true);
    });

    it('flags invalid shift time order when start and end times are the same', () => {
        const draft = createInitialDraft();
        const dayShiftId = draft.shiftTypes.find((shiftType) => shiftType.classification === 'DAY')?.id ?? '';
        const invalidOrderDraft = updateShiftTypeDraft(
            {
                ...draft,
                currentStep: 3,
            },
            dayShiftId,
            {
                startTime: '12:00',
                endTime: '12:00',
            },
        );
        const validation = getStepValidation(invalidOrderDraft, 3);

        expect(validation.issues).toEqual(expect.arrayContaining([{code: 'invalid-shift-time-order', step: 3, targetId: dayShiftId}]));
        expect(canGoNext(invalidOrderDraft)).toBe(false);
    });

    it('allows overnight order for night shifts', () => {
        const draft = createInitialDraft();
        const nightShiftId = draft.shiftTypes.find((shiftType) => shiftType.classification === 'NIGHT')?.id;
        const validation = getStepValidation(
            {
                ...draft,
                currentStep: 3,
            },
            3,
        );
        const nightOrderIssue = validation.issues.find(
            (issue) => issue.code === 'invalid-shift-time-order' && issue.targetId === nightShiftId,
        );

        expect(nightOrderIssue).toBeUndefined();
    });

    it('reports empty-team when all onboarding teams are removed', () => {
        const draft = createInitialDraft();
        const withoutTeams = {
            ...draft,
            currentStep: 4 as const,
            teams: [],
            nurses: [],
        };
        const validation = getStepValidation(withoutTeams, 4);

        expect(validation.isValid).toBe(false);
        expect(validation.issues).toEqual([{code: 'empty-team', step: 4}]);
        expect(canGoNext(withoutTeams)).toBe(false);
    });

    it('keeps nurse order changes scoped to the active team', () => {
        const draft = createInitialDraft();
        const activeTeamId = draft.teams[0]?.id ?? '';
        const otherTeamId = draft.teams[1]?.id ?? '';
        const otherTeamNurse = {
            ...draft.nurses[0]!,
            id: 'other-team-nurse',
            teamId: otherTeamId,
            name: '다른 팀 간호사',
        };
        const draftWithOtherTeamNurse = {
            ...draft,
            nurses: [...draft.nurses, otherTeamNurse],
        };
        const teamNursesBefore = draftWithOtherTeamNurse.nurses.filter((nurse) => nurse.teamId === activeTeamId);
        const reordered = reorderNursesWithinTeam(draftWithOtherTeamNurse, activeTeamId, {
            source: {droppableId: activeTeamId, index: 0},
            destination: {droppableId: activeTeamId, index: 1},
        });
        const teamNursesAfter = reordered.nurses.filter((nurse) => nurse.teamId === activeTeamId);

        expect(teamNursesAfter[0]?.id).toBe(teamNursesBefore[1]?.id);
        expect(reordered.nurses.find((nurse) => nurse.id === otherTeamNurse.id)?.teamId).toBe(otherTeamId);
    });

    it('allows completion only when step 4 validation passes', () => {
        const draft = createInitialDraft();
        const withSecondTeamNurse = addNurseDraft(draft, draft.teams[1]!.id);
        const withAllTeamNurses = addNurseDraft(withSecondTeamNurse, draft.teams[2]!.id);
        const step4Draft = {
            ...withAllTeamNurses,
            currentStep: 4 as const,
            hospitalName: '듀팅병원',
            wardName: '중환자실',
        };
        const validNurseDraft = updateNurseDraft(step4Draft, step4Draft.nurses[0]!.id, {name: '홍길동'});

        expect(canComplete(validNurseDraft)).toBe(true);

        const invalidDraft = updateNurseDraft(validNurseDraft, validNurseDraft.nurses[0]!.id, {name: ''});

        expect(canComplete(invalidDraft)).toBe(false);
    });

    it('converts manual schedule input rows into initial shifts for save payload', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const nextDraft = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '김하늘',
                    shifts: {
                        '1': 'D',
                        '2': '/',
                        '3': '-',
                        '4': 'OFF',
                        '5': '휴무',
                        '6': '교육',
                    },
                },
            ],
        });
        const nurse = nextDraft.nurses.find((candidate) => candidate.name === '김하늘');
        const customShiftType = nextDraft.shiftTypes.find((shiftType) => shiftType.shortName === '교육');

        expect(nurse?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'D'},
            {date: '2026-05-02', shiftShortName: 'O'},
            {date: '2026-05-03', shiftShortName: 'O'},
            {date: '2026-05-04', shiftShortName: 'O'},
            {date: '2026-05-05', shiftShortName: 'O'},
            {date: '2026-05-06', shiftShortName: '교육'},
        ]);
        expect(customShiftType).toEqual(
            expect.objectContaining({
                name: '교육',
                shortName: '교육',
                color: expect.stringMatching(/^#[0-9A-F]{6}$/),
                isOff: false,
                classification: 'OTHER_WORK',
            }),
        );
        expect(customShiftType?.color).not.toBe('#BFC7D4');
        expect(nextDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.nurseId).toBe(nurse?.id);
    });

    it('syncs custom shift types discovered only from an uploaded schedule template', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const {draft: nextDraft} = applyUploadedScheduleTemplateDraft(draft, {
            fileName: 'schedule-template.xlsx',
            year: 2026,
            month: 5,
            teamSchedules: [
                {
                    teamName: 'Team A',
                    rows: [
                        {
                            name: 'Nurse A',
                            shifts: {'1': 'CCC', '2': 'AAA'},
                        },
                    ],
                },
            ],
        });
        const customShiftTypes = nextDraft.shiftTypes.filter((shiftType) => ['AAA', 'CCC'].includes(shiftType.shortName));
        const nurse = nextDraft.nurses.find((candidate) => candidate.name === 'Nurse A');
        const teamId = nextDraft.teams[0]?.id ?? '';

        expect(customShiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['AAA', 'CCC']);
        expect(customShiftTypes.map((shiftType) => shiftType.color)).toEqual([DEFAULT_SHIFT_TYPE_COLORS[4], DEFAULT_SHIFT_TYPE_COLORS[5]]);
        expect(nurse?.possibleShiftTypeIds).toEqual(nextDraft.shiftTypes.map((shiftType) => shiftType.id));
        expect(nextDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.shifts).toEqual({'1': 'CCC', '2': 'AAA'});
    });

    it('removes schedule-generated shift types when the entered code is cleared', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const withCustomShift = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: 'Nurse A',
                    shifts: {'1': 'X'},
                },
            ],
        });
        const customShiftTypeId = withCustomShift.shiftTypes.find((shiftType) => shiftType.shortName === 'X')?.id;
        const storedRow = withCustomShift.scheduleInputs[teamId]?.['2026-05']?.rows[0];
        const clearedDraft = applyScheduleInputDraft(withCustomShift, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: storedRow?.id ?? 'row-1',
                    nurseId: storedRow?.nurseId ?? null,
                    name: 'Nurse A',
                    shifts: {},
                },
            ],
        });

        expect(customShiftTypeId).toBeTruthy();
        expect(clearedDraft.shiftTypes.some((shiftType) => shiftType.shortName === 'X')).toBe(false);
        expect(clearedDraft.nurses.every((nurse) => !nurse.possibleShiftTypeIds.includes(customShiftTypeId ?? ''))).toBe(true);
    });

    it('archives a deleted shift type when an entered schedule still references it', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const withCustomShift = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: 'Nurse A',
                    shifts: {'1': 'A'},
                },
            ],
        });
        const customShiftTypeId = withCustomShift.shiftTypes.find((shiftType) => shiftType.shortName === 'A')?.id ?? '';
        const archivedDraft = deleteShiftTypeDraft(withCustomShift, customShiftTypeId);
        const archivedShiftType = archivedDraft.shiftTypes.find((shiftType) => shiftType.id === customShiftTypeId);
        const nurse = archivedDraft.nurses.find((candidate) => candidate.name === 'Nurse A');

        expect(archivedShiftType).toEqual(expect.objectContaining({shortName: 'A', isActive: false}));
        expect(nurse?.possibleShiftTypeIds).not.toContain(customShiftTypeId);
        expect(nurse?.initialShifts).toEqual([{date: '2026-05-01', shiftShortName: 'A'}]);
        expect(getStepValidation({...archivedDraft, currentStep: 3}, 3).isValid).toBe(true);
    });

    it('restores an archived shift type instead of creating a second one with the same short name', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const withCustomShift = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: 'Nurse A',
                    shifts: {'1': 'A'},
                },
            ],
        });
        const archivedShiftTypeId = withCustomShift.shiftTypes.find((shiftType) => shiftType.shortName === 'A')?.id ?? '';
        const archivedDraft = deleteShiftTypeDraft(withCustomShift, archivedShiftTypeId);
        const withNewShiftRow = addShiftTypeDraft(archivedDraft);
        const newShiftTypeId = withNewShiftRow.shiftTypes.find((shiftType) => shiftType.shortName === '')?.id ?? '';
        const restoredDraft = updateShiftTypeDraft(withNewShiftRow, newShiftTypeId, {shortName: 'A'});

        expect(restoredDraft.shiftTypes.filter((shiftType) => shiftType.shortName === 'A')).toHaveLength(1);
        expect(restoredDraft.shiftTypes.find((shiftType) => shiftType.id === archivedShiftTypeId)).toEqual(
            expect.objectContaining({shortName: 'A', isActive: true}),
        );
        expect(restoredDraft.shiftTypes.some((shiftType) => shiftType.id === newShiftTypeId)).toBe(false);
        expect(restoredDraft.nurses.every((nurse) => nurse.possibleShiftTypeIds.includes(archivedShiftTypeId))).toBe(true);
    });

    it('keeps user-configured shift types even if their schedule code is cleared', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const withCustomShift = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: 'Nurse A',
                    shifts: {'1': 'X'},
                },
            ],
        });
        const customShiftTypeId = withCustomShift.shiftTypes.find((shiftType) => shiftType.shortName === 'X')?.id ?? '';
        const userConfiguredDraft = updateShiftTypeDraft(withCustomShift, customShiftTypeId, {
            startTime: '09:00',
            endTime: '18:00',
        });
        const storedRow = userConfiguredDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0];
        const clearedDraft = applyScheduleInputDraft(userConfiguredDraft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: storedRow?.id ?? 'row-1',
                    nurseId: storedRow?.nurseId ?? null,
                    name: 'Nurse A',
                    shifts: {},
                },
            ],
        });

        expect(clearedDraft.shiftTypes.find((shiftType) => shiftType.id === customShiftTypeId)).toEqual(
            expect.objectContaining({
                name: 'X',
                shortName: 'X',
                startTime: '09:00',
                endTime: '18:00',
            }),
        );
    });

    it('renames matching schedule cells and initial shifts when a schedule-discovered shift code changes', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const withCustomShift = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: 'Nurse A',
                    shifts: {'1': 'R', '2': 'D'},
                },
            ],
        });
        const customShiftTypeId = withCustomShift.shiftTypes.find((shiftType) => shiftType.shortName === 'R')?.id ?? '';
        const renamedDraft = updateShiftTypeDraft(withCustomShift, customShiftTypeId, {
            shortName: 'A',
            startTime: '09:00',
            endTime: '18:00',
        });
        const nurse = renamedDraft.nurses.find((candidate) => candidate.name === 'Nurse A');

        expect(renamedDraft.shiftTypes.find((shiftType) => shiftType.id === customShiftTypeId)).toEqual(
            expect.objectContaining({
                name: 'R',
                shortName: 'A',
                startTime: '09:00',
                endTime: '18:00',
            }),
        );
        expect(renamedDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.shifts).toEqual({'1': 'A', '2': 'D'});
        expect(nurse?.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'A'},
            {date: '2026-05-02', shiftShortName: 'D'},
        ]);
    });

    it('keeps the original schedule code available for remapping while a short name is temporarily empty', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const withCustomShift = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 5,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: 'Nurse A',
                    shifts: {'1': 'R'},
                },
            ],
        });
        const customShiftTypeId = withCustomShift.shiftTypes.find((shiftType) => shiftType.shortName === 'R')?.id ?? '';
        const temporarilyEmptyDraft = updateShiftTypeDraft(withCustomShift, customShiftTypeId, {shortName: ''});
        const renamedDraft = updateShiftTypeDraft(temporarilyEmptyDraft, customShiftTypeId, {
            shortName: 'A',
            startTime: '09:00',
            endTime: '18:00',
        });
        const nurse = renamedDraft.nurses.find((candidate) => candidate.name === 'Nurse A');

        expect(temporarilyEmptyDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.shifts).toEqual({'1': 'R'});
        expect(renamedDraft.scheduleInputs[teamId]?.['2026-05']?.rows[0]?.shifts).toEqual({'1': 'A'});
        expect(nurse?.initialShifts).toEqual([{date: '2026-05-01', shiftShortName: 'A'}]);
    });

    it('resolves the onboarding initial schedule target from the entered schedule month and created ward team', () => {
        const draft = prepareManualEntryDraft(createInitialDraft());
        const teamId = draft.teams[0]!.id;
        const nextDraft = applyScheduleInputDraft(draft, teamId, {
            year: 2026,
            month: 6,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '김하늘',
                    shifts: {'1': 'D'},
                },
            ],
        });

        expect(
            getOnboardingInitialScheduleTarget(nextDraft, {
                preferredTeamId: teamId,
                createdWard: {shiftTeams: [{shiftTeamId: 77, name: nextDraft.teams[0]?.name}]},
            }),
        ).toEqual({
            teamId,
            year: 2026,
            month: 6,
            shiftTeamId: 77,
        });
    });

    it('resolves onboarding initial schedule targets for every team with an entered schedule', () => {
        const baseDraft = {
            ...createInitialDraft(),
            teams: [
                {id: 'team-a', name: 'A Team'},
                {id: 'team-b', name: 'B Team'},
                {id: 'team-c', name: 'C Team'},
            ],
            nurses: [],
            scheduleInputs: {},
        };
        const withATeam = applyScheduleInputDraft(baseDraft, 'team-a', {
            year: 2026,
            month: 6,
            rows: [{id: 'row-a', nurseId: null, name: 'A Nurse', shifts: {'1': 'D'}}],
        });
        const withBTeam = applyScheduleInputDraft(withATeam, 'team-b', {
            year: 2026,
            month: 6,
            rows: [{id: 'row-b', nurseId: null, name: 'B Nurse', shifts: {'1': 'E'}}],
        });
        const withCTeam = applyScheduleInputDraft(withBTeam, 'team-c', {
            year: 2026,
            month: 6,
            rows: [{id: 'row-c', nurseId: null, name: 'C Nurse', shifts: {'1': 'N'}}],
        });

        expect(
            getOnboardingInitialScheduleTargets(withCTeam, {
                preferredTeamId: 'team-c',
                createdWard: {
                    shiftTeams: [
                        {shiftTeamId: 101, name: 'A Team'},
                        {shiftTeamId: 102, name: 'B Team'},
                        {shiftTeamId: 103, name: 'C Team'},
                    ],
                },
            }),
        ).toEqual([
            {teamId: 'team-c', year: 2026, month: 6, shiftTeamId: 103},
            {teamId: 'team-a', year: 2026, month: 6, shiftTeamId: 101},
            {teamId: 'team-b', year: 2026, month: 6, shiftTeamId: 102},
        ]);
    });

    it('blocks completion when an earlier required step is invalid', () => {
        const draft = createInitialDraft();
        const withSecondTeamNurse = addNurseDraft(draft, draft.teams[1]!.id);
        const withAllTeamNurses = addNurseDraft(withSecondTeamNurse, draft.teams[2]!.id);
        const invalidShiftDraft = addShiftTypeDraft({
            ...withAllTeamNurses,
            currentStep: 4,
            hospitalName: '듀팅병원',
            wardName: '중환자실',
        });

        expect(getStepValidation(invalidShiftDraft, 3).isValid).toBe(false);
        expect(getStepValidation(invalidShiftDraft, 4).isValid).toBe(true);
        expect(canComplete(invalidShiftDraft)).toBe(false);
    });

    it('clamps nurse levels to the configured range when auto assignment is disabled', () => {
        const draft = createInitialDraft();
        const withCustomLevels = {
            ...draft,
            nurses: draft.nurses.map((nurse, index) => ({
                ...nurse,
                level: index === 0 ? null : 5,
            })),
        };
        const nextDraft = saveSkillLevelConfig(withCustomLevels, {
            enabled: true,
            levelCount: 3,
            paletteId: 'cool',
            autoAssign: false,
        });

        expect(nextDraft.skillLevelConfig).toEqual({
            enabled: true,
            levelCount: 3,
            paletteId: 'cool',
            autoAssign: false,
        });
        expect(nextDraft.nurses.map((nurse) => nurse.level)).toEqual([null, 3, 3, 3]);
    });
});
