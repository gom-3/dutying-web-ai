import {describe, expect, it} from 'vitest';
import {type TNurse} from '@/entities/nurse';
import {getNurseDrawerFeedback, hasNurseChanges} from './nurseEdit';

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
});
