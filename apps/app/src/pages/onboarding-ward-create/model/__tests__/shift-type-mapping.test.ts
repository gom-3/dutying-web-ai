import {describe, expect, it} from 'vitest';
import {
    applyScheduleInputDraft,
    buildCreateWardPayload,
    createInitialDraft,
    getAutomaticPreviousScheduleShiftMapping,
    getPreviousScheduleShiftMappingRecommendation,
    getPreviousScheduleRotationModeCorrection,
    getStepValidation,
    isUniqueAutomaticPreviousScheduleShiftMapping,
    updateRotationModeDraft,
} from '..';

describe('previous schedule shift-type mapping', () => {
    it('automatically maps only explicit codes for each ward rotation mode', () => {
        expect(getAutomaticPreviousScheduleShiftMapping('D', 'THREE')).toEqual({
            classification: 'DAY',
            rotationSystem: 'THREE',
        });
        expect(getAutomaticPreviousScheduleShiftMapping('E', 'TWO')).toBeNull();
        expect(getAutomaticPreviousScheduleShiftMapping('D', 'TWO')).toEqual({
            classification: 'DAY',
            rotationSystem: 'TWO',
        });
        expect(getAutomaticPreviousScheduleShiftMapping('ⓓ', 'MIXED')).toBeNull();
        expect(getAutomaticPreviousScheduleShiftMapping('Ⓓ', 'TWO')).toBeNull();
        expect(getAutomaticPreviousScheduleShiftMapping('ⓝ', 'MIXED')).toBeNull();
        expect(getAutomaticPreviousScheduleShiftMapping('Ⓝ', 'TWO')).toBeNull();
        expect(getAutomaticPreviousScheduleShiftMapping('D', 'MIXED')).toEqual({
            classification: 'DAY',
            rotationSystem: 'THREE',
        });
        expect(getAutomaticPreviousScheduleShiftMapping('1', 'MIXED')).toEqual({
            classification: 'DAY',
            rotationSystem: 'TWO',
        });
        expect(getAutomaticPreviousScheduleShiftMapping('2', 'MIXED')).toEqual({
            classification: 'NIGHT',
            rotationSystem: 'TWO',
        });
        expect(getAutomaticPreviousScheduleShiftMapping('/', 'MIXED')).toEqual({
            classification: 'OFF',
            rotationSystem: 'NONE',
        });
    });

    it('keeps time and AI semantics as recommendations instead of confirmed mappings', () => {
        expect(
            getPreviousScheduleShiftMappingRecommendation({
                shortName: 'W',
                name: '2교대 데이',
                startTime: '07:00',
                endTime: '19:00',
                classification: 'DAY',
                rotationSystem: 'TWO',
                rotationMode: 'MIXED',
            }),
        ).toEqual({classification: 'DAY', rotationSystem: 'TWO', reason: 'TIME'});
    });

    it('uses the selected single rotation and moves explicit opposite-rotation codes to other work', () => {
        expect(
            getPreviousScheduleRotationModeCorrection({
                shortName: '1',
                classification: 'DAY',
                rotationSystem: 'TWO',
                rotationMode: 'THREE',
            }),
        ).toEqual({classification: 'OTHER_WORK', rotationSystem: 'NONE'});
        expect(
            getPreviousScheduleRotationModeCorrection({
                shortName: 'D',
                classification: 'DAY',
                rotationSystem: 'TWO',
                rotationMode: 'THREE',
            }),
        ).toEqual({classification: 'DAY', rotationSystem: 'THREE'});
        expect(
            getPreviousScheduleRotationModeCorrection({
                shortName: 'E',
                classification: 'EVENING',
                rotationSystem: 'THREE',
                rotationMode: 'TWO',
            }),
        ).toEqual({classification: 'OTHER_WORK', rotationSystem: 'NONE'});
        expect(
            getPreviousScheduleRotationModeCorrection({
                shortName: '1',
                classification: 'OTHER_WORK',
                rotationSystem: 'NONE',
                rotationMode: 'THREE',
            }),
        ).toBeNull();
    });

    it('keeps an automatic mapping only when its observed rotation and classification pair is unique', () => {
        const automaticTwoDay = {
            classification: 'DAY' as const,
            rotationSystem: 'TWO' as const,
            mappingStatus: 'AUTO_MATCHED' as const,
            protectedByPreviousSchedule: true,
        };

        expect(isUniqueAutomaticPreviousScheduleShiftMapping(automaticTwoDay, [automaticTwoDay])).toBe(true);
        expect(
            isUniqueAutomaticPreviousScheduleShiftMapping(automaticTwoDay, [
                automaticTwoDay,
                {
                    classification: 'DAY',
                    rotationSystem: 'TWO',
                    mappingStatus: 'CONFIRMED',
                    protectedByPreviousSchedule: true,
                },
            ]),
        ).toBe(false);
        expect(
            isUniqueAutomaticPreviousScheduleShiftMapping(automaticTwoDay, [
                automaticTwoDay,
                {
                    classification: 'DAY',
                    rotationSystem: 'THREE',
                    mappingStatus: 'CONFIRMED',
                    protectedByPreviousSchedule: true,
                },
            ]),
        ).toBe(true);
    });

    it('uses imported mixed-mode numeric codes as two-shift rows without leaving duplicate seeds', () => {
        const initialDraft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const teamId = initialDraft.teams[0]!.id;
        const importedDraft = applyScheduleInputDraft(initialDraft, teamId, {
            year: 2026,
            month: 7,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '간호사 A',
                    shifts: {'1': 'D', '2': 'E', '3': 'N', '4': '1', '5': '2', '6': '/'},
                },
            ],
        });
        const importedDay = importedDraft.shiftTypes.find((shiftType) => shiftType.shortName === '1')!;
        const importedNight = importedDraft.shiftTypes.find((shiftType) => shiftType.shortName === '2')!;

        expect(importedDraft.shiftTypes.some((shiftType) => shiftType.shortName === 'ⓓ' || shiftType.shortName === 'ⓝ')).toBe(false);
        expect(importedDay.mappingStatus).toBe('AUTO_MATCHED');
        expect(importedNight.mappingStatus).toBe('AUTO_MATCHED');
        const payload = buildCreateWardPayload(importedDraft);

        expect(payload.wardShiftTypes.filter((shiftType) => shiftType.rotationSystem === 'TWO')).toEqual([
            expect.objectContaining({shortName: '1', classification: 'DAY'}),
            expect.objectContaining({shortName: '2', classification: 'NIGHT'}),
        ]);
        expect(getStepValidation({...importedDraft, currentStep: 4}, 4).isValid).toBe(true);
    });

    it('uses imported D and N as the two-shift rows without leaving duplicate seeds', () => {
        const initialDraft = updateRotationModeDraft(createInitialDraft(), 'TWO');
        const teamId = initialDraft.teams[0]!.id;
        const importedDraft = applyScheduleInputDraft(initialDraft, teamId, {
            year: 2026,
            month: 7,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '간호사 A',
                    shifts: {'1': 'D', '2': 'N', '3': 'O'},
                },
            ],
        });

        expect(importedDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'N', 'O']);
        expect(importedDraft.shiftTypes.map((shiftType) => shiftType.rotationSystem)).toEqual(['TWO', 'TWO', 'NONE']);
        expect(getStepValidation({...importedDraft, currentStep: 4}, 4).isValid).toBe(true);
    });

    it('keeps only shift codes observed in a mixed-mode previous schedule', () => {
        const initialDraft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const teamId = initialDraft.teams[0]!.id;
        const importedDraft = applyScheduleInputDraft(initialDraft, teamId, {
            year: 2026,
            month: 7,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '간호사 A',
                    shifts: {'1': 'D', '2': 'E', '3': 'N', '4': 'O'},
                },
            ],
        });

        expect(importedDraft.shiftTypes.map((shiftType) => shiftType.shortName)).toEqual(['D', 'E', 'N', 'O']);
    });

    it('keeps circled previous-schedule codes as other work instead of inferring two-shift types', () => {
        const initialDraft = updateRotationModeDraft(createInitialDraft(), 'TWO');
        const teamId = initialDraft.teams[0]!.id;
        const importedDraft = applyScheduleInputDraft(initialDraft, teamId, {
            year: 2026,
            month: 7,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '간호사 A',
                    shifts: {'1': 'D', '2': 'ⓓ', '3': 'N'},
                },
            ],
        });
        const inferredDay = importedDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'D');
        const exactDay = importedDraft.shiftTypes.find((shiftType) => shiftType.shortName === 'ⓓ');

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
        expect(getStepValidation({...importedDraft, currentStep: 4}, 4).issues).toEqual(
            expect.arrayContaining([expect.objectContaining({code: 'missing-shift-time', targetId: exactDay?.id})]),
        );
    });

    it('normalizes uppercase circled aliases and keeps both as other work', () => {
        const initialDraft = updateRotationModeDraft(createInitialDraft(), 'MIXED');
        const teamId = initialDraft.teams[0]!.id;
        const importedDraft = applyScheduleInputDraft(initialDraft, teamId, {
            year: 2026,
            month: 7,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '간호사 A',
                    shifts: {'1': 'Ⓓ', '2': 'Ⓝ'},
                },
            ],
        });

        expect(importedDraft.shiftTypes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    shortName: 'ⓓ',
                    classification: 'OTHER_WORK',
                    rotationSystem: 'NONE',
                    mappingStatus: 'CONFIRMED',
                }),
                expect.objectContaining({
                    shortName: 'ⓝ',
                    classification: 'OTHER_WORK',
                    rotationSystem: 'NONE',
                    mappingStatus: 'CONFIRMED',
                }),
            ]),
        );
    });

    it('keeps one OFF row and remaps all local schedule aliases to the most-used code', () => {
        const initialDraft = createInitialDraft();
        const teamId = initialDraft.teams[0]!.id;
        const importedDraft = applyScheduleInputDraft(initialDraft, teamId, {
            year: 2026,
            month: 7,
            rows: [
                {
                    id: 'row-1',
                    nurseId: null,
                    name: '간호사 A',
                    shifts: {'1': 'O', '2': '/', '3': '/', '4': '-'},
                },
            ],
        });
        const offShiftTypes = importedDraft.shiftTypes.filter((shiftType) => shiftType.classification === 'OFF');
        const storedShifts = importedDraft.scheduleInputs[teamId]?.['2026-07']?.rows[0]?.shifts;

        expect(offShiftTypes).toEqual([expect.objectContaining({shortName: '/', rotationSystem: 'NONE'})]);
        expect(storedShifts).toEqual({'1': '/', '2': '/', '3': '/', '4': '/'});
        expect(importedDraft.nurses.find((nurse) => nurse.name === '간호사 A')?.initialShifts).toEqual([
            {date: '2026-07-01', shiftShortName: '/'},
            {date: '2026-07-02', shiftShortName: '/'},
            {date: '2026-07-03', shiftShortName: '/'},
            {date: '2026-07-04', shiftShortName: '/'},
        ]);
    });
});
