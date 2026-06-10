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
            {apiShiftTypeId: 101, wardShiftTypeId: 10, name: 'OnCall', shortName: 'O', isPossible: false},
            {apiShiftTypeId: 102, wardShiftTypeId: 20, name: 'Orientation', shortName: 'O', isPossible: true},
        ]);
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
