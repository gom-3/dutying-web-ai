import {describe, expect, it} from 'vitest';
import {type TNurse} from '@/entities/nurse';
import {type TWardShiftType} from '@/entities/ward';
import {getNurseDrawerFeedback, hasNurseChanges} from '../nurse-edit';
import {resolveNurseShiftTypeOptions} from '../nurse-shift-types';

const createNurse = (): TNurse => ({
    nurseId: 1,
    accountId: null,
    shiftTeamId: 10,
    wardId: 20,
    name: '김간호',
    phoneNum: '01012345678',
    isConnected: false,
    nurseShiftTypes: [
        {
            nurseShiftTypeId: 1,
            name: 'Day',
            shortName: 'D',
            isPossible: true,
            isPreferred: false,
        },
        {
            nurseShiftTypeId: 2,
            name: 'Evening',
            shortName: 'E',
            isPossible: false,
            isPreferred: false,
        },
    ],
    isWorker: true,
    isDutyManager: false,
    isWardManager: false,
    gender: '여',
    employmentDate: '2021-08-01',
    memo: '',
    isDeleted: false,
    divisionNum: 0,
    priority: 1,
});

describe('hasNurseChanges', () => {
    it('returns false when editable fields are unchanged', () => {
        const nurse = createNurse();

        expect(hasNurseChanges(nurse, {...nurse})).toBe(false);
    });

    it('detects shift type availability changes', () => {
        const nurse = createNurse();
        const draft = {
            ...nurse,
            nurseShiftTypes: nurse.nurseShiftTypes.map((shiftType, index) => (index === 1 ? {...shiftType, isPossible: true} : shiftType)),
        };

        expect(hasNurseChanges(nurse, draft)).toBe(true);
    });

    it('detects birthDate changes', () => {
        const nurse = createNurse();

        expect(hasNurseChanges(nurse, {...nurse, birthDate: '1996-03-14'})).toBe(true);
        expect(hasNurseChanges({...nurse, birthDate: '1996-03-14'}, {...nurse, birthDate: null})).toBe(true);
    });

    it('detects shift type target ratio changes', () => {
        const nurse = createNurse();
        const draft = {
            ...nurse,
            nurseShiftTypes: nurse.nurseShiftTypes.map((shiftType, index) =>
                index === 0 ? {...shiftType, targetRatioWeight: 14} : shiftType,
            ),
        };

        expect(hasNurseChanges(nurse, draft)).toBe(true);
    });

    it('detects a synthetic ward shift type only when availability changes from the default', () => {
        const nurse = createNurse();
        const syntheticShiftType = {
            nurseShiftTypeId: 100,
            name: 'OnCall',
            shortName: 'O',
            isPossible: true,
            isPreferred: false,
        };

        expect(hasNurseChanges(nurse, {...nurse, nurseShiftTypes: [...nurse.nurseShiftTypes, syntheticShiftType]})).toBe(false);
        expect(
            hasNurseChanges(nurse, {
                ...nurse,
                nurseShiftTypes: [...nurse.nurseShiftTypes, {...syntheticShiftType, isPossible: false}],
            }),
        ).toBe(true);
    });

    it('returns false when the original or draft value is missing', () => {
        const nurse = createNurse();

        expect(hasNurseChanges(nurse, null)).toBe(false);
        expect(hasNurseChanges(undefined, nurse)).toBe(false);
    });

    it('ignores reordered shift types when availability is unchanged', () => {
        const nurse = createNurse();
        const draft = {
            ...nurse,
            nurseShiftTypes: [...nurse.nurseShiftTypes].reverse(),
        };

        expect(hasNurseChanges(nurse, draft)).toBe(false);
    });

    it('compares shift type availability by ward shift type id', () => {
        const nurse = {
            ...createNurse(),
            nurseShiftTypes: [
                {
                    nurseShiftTypeId: 1,
                    wardShiftTypeId: 10,
                    name: 'Old OnCall',
                    shortName: 'O',
                    isPossible: true,
                    isPreferred: false,
                },
                {
                    nurseShiftTypeId: 2,
                    wardShiftTypeId: 20,
                    name: 'Old Orientation',
                    shortName: 'O',
                    isPossible: false,
                    isPreferred: false,
                },
            ],
        };

        expect(
            hasNurseChanges(nurse, {
                ...nurse,
                nurseShiftTypes: nurse.nurseShiftTypes.map((shiftType) =>
                    shiftType.wardShiftTypeId === 20 ? {...shiftType, name: 'Renamed Orientation', shortName: 'A'} : shiftType,
                ),
            }),
        ).toBe(false);
        expect(
            hasNurseChanges(nurse, {
                ...nurse,
                nurseShiftTypes: nurse.nurseShiftTypes.map((shiftType) =>
                    shiftType.wardShiftTypeId === 20 ? {...shiftType, isPossible: true} : shiftType,
                ),
            }),
        ).toBe(true);
    });
});

const createWardShiftType = (overrides: Partial<TWardShiftType>): TWardShiftType => ({
    wardShiftTypeId: 1,
    name: 'Day',
    shortName: 'D',
    startTime: '07:00',
    endTime: '15:00',
    color: '#7C3AED',
    isDefault: false,
    isOff: false,
    isCounted: true,
    classification: 'OTHER_WORK',
    ...overrides,
});
const monthlyShiftTypeMeta = {
    DAY: {name: 'Day', shortName: 'D'},
    EVENING: {name: 'Evening', shortName: 'E'},
    NIGHT: {name: 'Night', shortName: 'N'},
    OFF: {name: 'Off', shortName: '/'},
} as const satisfies Record<'DAY' | 'EVENING' | 'NIGHT' | 'OFF', Pick<TWardShiftType, 'name' | 'shortName'>>;
const createMonthlyWardShiftTypes = (classifications: Array<TWardShiftType['classification']>) =>
    classifications.map((classification, index) =>
        createWardShiftType({
            wardShiftTypeId: index + 1,
            ...monthlyShiftTypeMeta[classification as keyof typeof monthlyShiftTypeMeta],
            classification,
            isOff: classification === 'OFF',
        }),
    );

describe('resolveNurseShiftTypeOptions', () => {
    it('matches nurse shift type rows by wardShiftTypeId instead of duplicated short names', () => {
        const options = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 10,
                    name: 'Old OnCall',
                    shortName: 'O',
                    isPossible: false,
                    isPreferred: false,
                },
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 20,
                    name: 'Old Orientation',
                    shortName: 'O',
                    isPossible: true,
                    isPreferred: false,
                },
            ],
            [
                createWardShiftType({wardShiftTypeId: 20, name: 'Orientation', shortName: 'O'}),
                createWardShiftType({wardShiftTypeId: 10, name: 'OnCall', shortName: 'O'}),
            ],
        );

        expect(options).toMatchObject([
            {apiShiftTypeId: 101, wardShiftTypeId: 10, name: 'OnCall', shortName: 'O', isPossible: false, targetRatioWeight: 7},
            {apiShiftTypeId: 102, wardShiftTypeId: 20, name: 'Orientation', shortName: 'O', isPossible: true, targetRatioWeight: 7},
        ]);
    });

    it('omits inactive ward shift types from selectable options', () => {
        const options = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 10,
                    name: 'Day',
                    shortName: 'D',
                    isPossible: true,
                    isPreferred: false,
                },
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 20,
                    name: 'Archived',
                    shortName: 'A',
                    isPossible: true,
                    isPreferred: false,
                },
            ],
            [
                createWardShiftType({wardShiftTypeId: 10, name: 'Day', shortName: 'D', isActive: true}),
                createWardShiftType({wardShiftTypeId: 20, name: 'Archived', shortName: 'A', isActive: false}),
            ],
        );

        expect(options).toMatchObject([{wardShiftTypeId: 10, shortName: 'D'}]);
    });

    it.each([
        [['DAY', 'EVENING', 'NIGHT', 'OFF'], {D: 9, E: 6, N: 5, '/': 10}],
        [['DAY', 'EVENING', 'NIGHT'], {D: 9, E: 6, N: 5}],
        [['DAY', 'EVENING', 'OFF'], {D: 11, E: 10, '/': 9}],
        [['DAY', 'NIGHT', 'OFF'], {D: 15, N: 5, '/': 10}],
        [['EVENING', 'NIGHT', 'OFF'], {E: 15, N: 5, '/': 10}],
        [['DAY', 'EVENING'], {D: 11, E: 10}],
        [['DAY', 'NIGHT'], {D: 15, N: 5}],
        [['EVENING', 'NIGHT'], {E: 15, N: 5}],
        [['DAY', 'OFF'], {D: 21, '/': 9}],
        [['EVENING', 'OFF'], {E: 21, '/': 9}],
        [['NIGHT', 'OFF'], {N: 15, '/': 15}],
        [['DAY'], {D: 21}],
        [['EVENING'], {E: 21}],
        [['NIGHT'], {N: 14}],
        [['OFF'], {'/': 30}],
    ] as Array<[Array<TWardShiftType['classification']>, Record<string, number>]>)(
        'applies monthly default ratio weights for %s',
        (classifications, expectedWeightsByShortName) => {
            const options = resolveNurseShiftTypeOptions([], createMonthlyWardShiftTypes(classifications));

            expect(Object.fromEntries(options.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual(
                expectedWeightsByShortName,
            );
        },
    );

    it('calculates monthly default ratio weights from possible D/E/N/O classifications only', () => {
        const options = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Evening',
                    shortName: 'E',
                    isPossible: false,
                    isPreferred: false,
                },
            ],
            createMonthlyWardShiftTypes(['DAY', 'EVENING', 'NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(options.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            D: 15,
            E: 7,
            N: 5,
            '/': 10,
        });
    });

    it('preserves explicit monthly target ratio weights over computed defaults', () => {
        const options = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 1,
                    name: 'Day',
                    shortName: 'D',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 12,
                },
            ],
            createMonthlyWardShiftTypes(['DAY', 'EVENING', 'NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(options.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            D: 12,
            E: 6,
            N: 5,
            '/': 10,
        });
    });

    it('preserves stored custom weights that overlap default-like numbers', () => {
        const denoOptions = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Evening',
                    shortName: 'E',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 7,
                },
            ],
            createMonthlyWardShiftTypes(['DAY', 'EVENING', 'NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(denoOptions.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            D: 9,
            E: 7,
            N: 5,
            '/': 10,
        });

        const nightKeepOptions = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 1,
                    name: 'Night',
                    shortName: 'N',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 15,
                },
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Off',
                    shortName: '/',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 16,
                },
            ],
            createMonthlyWardShiftTypes(['NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(nightKeepOptions.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            N: 15,
            '/': 16,
        });
    });

    it('treats stored neutral defaults as unset and applies the monthly combination defaults', () => {
        const options = resolveNurseShiftTypeOptions(
            createMonthlyWardShiftTypes(['DAY', 'EVENING', 'NIGHT', 'OFF']).map((shiftType) => ({
                nurseShiftTypeId: shiftType.wardShiftTypeId,
                wardShiftTypeId: shiftType.wardShiftTypeId,
                name: shiftType.name,
                shortName: shiftType.shortName,
                isPossible: true,
                isPreferred: false,
                targetRatioWeight: 7,
            })),
            createMonthlyWardShiftTypes(['DAY', 'EVENING', 'NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(options.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            D: 9,
            E: 6,
            N: 5,
            '/': 10,
        });
    });

    it('preserves manually edited default-like monthly target ratio weights', () => {
        const denoOptions = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Evening',
                    shortName: 'E',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 7,
                },
            ],
            createMonthlyWardShiftTypes(['DAY', 'EVENING', 'NIGHT', 'OFF']),
            {preserveTargetRatioWeightKeys: new Set(['ward:2'])},
        );

        expect(Object.fromEntries(denoOptions.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            D: 9,
            E: 7,
            N: 5,
            '/': 10,
        });

        const nightKeepOptions = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Off',
                    shortName: '/',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 16,
                },
            ],
            createMonthlyWardShiftTypes(['NIGHT', 'OFF']),
            {preserveTargetRatioWeightKeys: new Set(['ward:2'])},
        );

        expect(Object.fromEntries(nightKeepOptions.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            N: 15,
            '/': 16,
        });
    });

    it('replaces previous default-like night-keep weights with a half night and half off default', () => {
        const options = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 1,
                    name: 'Night',
                    shortName: 'N',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 5,
                },
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Off',
                    shortName: '/',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 16,
                },
            ],
            createMonthlyWardShiftTypes(['NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(options.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            N: 15,
            '/': 15,
        });
    });

    it('preserves non-default custom night-keep weights', () => {
        const options = resolveNurseShiftTypeOptions(
            [
                {
                    nurseShiftTypeId: 101,
                    wardShiftTypeId: 1,
                    name: 'Night',
                    shortName: 'N',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 12,
                },
                {
                    nurseShiftTypeId: 102,
                    wardShiftTypeId: 2,
                    name: 'Off',
                    shortName: '/',
                    isPossible: true,
                    isPreferred: false,
                    targetRatioWeight: 18,
                },
            ],
            createMonthlyWardShiftTypes(['NIGHT', 'OFF']),
        );

        expect(Object.fromEntries(options.map((shiftType) => [shiftType.shortName, shiftType.targetRatioWeight]))).toEqual({
            N: 12,
            '/': 18,
        });
    });
});

describe('getNurseDrawerFeedback', () => {
    it('returns create guidance before the first save', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'create',
                saveStatus: 'idle',
                isDirty: false,
            }).titleKey,
        ).toBe('page.member.nurseDrawerFeedback.create.title');
    });

    it('prioritizes error feedback over draft state', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'error',
                isDirty: true,
            }).titleKey,
        ).toBe('page.member.nurseDrawerFeedback.error.title');
    });

    it('describes that the draft is preserved on save failure', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'error',
                isDirty: false,
            }).descriptionKey,
        ).toBe('page.member.nurseDrawerFeedback.error.description');
    });

    it('returns success feedback after a clean save in edit mode', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'success',
                isDirty: false,
            }).titleKey,
        ).toBe('page.member.nurseDrawerFeedback.success.title');
    });

    it('warns about losing edits when the drawer is closed with unsaved changes', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'idle',
                isDirty: true,
            }).descriptionKey,
        ).toBe('page.member.nurseDrawerFeedback.dirty.description');
    });
});
