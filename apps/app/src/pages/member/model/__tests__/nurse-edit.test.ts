import {describe, expect, it} from 'vitest';
import {type TNurse} from '@/entities/nurse';
import {getNurseDrawerFeedback, hasNurseChanges} from '../nurse-edit';

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
});

describe('getNurseDrawerFeedback', () => {
    it('returns create guidance before the first save', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'create',
                saveStatus: 'idle',
                isDirty: false,
            }).title,
        ).toBe('새 간호사를 추가했어요');
    });

    it('prioritizes error feedback over draft state', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'error',
                isDirty: true,
            }).title,
        ).toBe('저장하지 못했어요');
    });

    it('describes that the draft is preserved on save failure', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'error',
                isDirty: false,
            }).description,
        ).toContain('입력한 내용은 그대로 남아 있어요');
    });

    it('returns success feedback after a clean save in edit mode', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'success',
                isDirty: false,
            }).title,
        ).toBe('저장을 마쳤어요');
    });

    it('warns about losing edits when the drawer is closed with unsaved changes', () => {
        expect(
            getNurseDrawerFeedback({
                mode: 'edit',
                saveStatus: 'idle',
                isDirty: true,
            }).description,
        ).toContain('저장하지 않고 닫으면');
    });
});
