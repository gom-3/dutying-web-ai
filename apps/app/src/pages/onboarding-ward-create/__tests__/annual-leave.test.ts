import {describe, expect, it} from 'vitest';
import {
    applyParsedWardData,
    applyScheduleInputDraft,
    createInitialDraft,
    deleteShiftTypeDraft,
    ensureOnboardingAnnualLeave,
    getStepValidation,
    updateRotationModeDraft,
    updateShiftTypeDraft,
} from '../model';

describe('onboarding annual leave', () => {
    it('reserves the engine core codes even when display codes differ', () => {
        const initial = createInitialDraft();
        const draft = {
            ...initial,
            shiftTypes: ['A', 'L', 'V', 'B', 'C'].map((shortName, index) => ({
                ...initial.shiftTypes[0]!,
                id: `custom-${index}`,
                shortName,
                classification: 'OTHER_WORK' as const,
                rotationSystem: 'NONE' as const,
            })),
        };

        expect(ensureOnboardingAnnualLeave(draft).shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')?.shortName).toBe('F');
    });
    it.each(['THREE', 'TWO', 'MIXED'] as const)('seeds and requires annual leave for %s', (mode) => {
        const draft = updateRotationModeDraft(createInitialDraft(), mode);
        const annual = draft.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')!;

        expect(annual).toMatchObject({
            shortName: 'A',
            rotationSystem: 'NONE',
            isOff: true,
            isCounted: false,
            startTime: '',
            endTime: '',
            paidMinutes: null,
        });
        expect(getStepValidation(draft, 4).isValid).toBe(true);
        expect(
            getStepValidation({...draft, shiftTypes: draft.shiftTypes.filter((shift) => shift.id !== annual.id)}, 4).issues,
        ).toContainEqual({code: 'missing-required-shift-types', step: 4});
    });

    it('repairs a legacy draft without changing existing codes, eligibility or history', () => {
        const draft = createInitialDraft();
        const legacy = {...draft, shiftTypes: draft.shiftTypes.filter((shift) => shift.classification !== 'ANNUAL_LEAVE')};

        legacy.shiftTypes.push({
            ...legacy.shiftTypes[0]!,
            id: 'custom-A',
            shortName: 'A1',
            classification: 'OTHER_WORK',
            rotationSystem: 'NONE',
            autoSeeded: false,
        });

        const repaired = ensureOnboardingAnnualLeave(legacy);

        expect(repaired.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')?.shortName).toBe('L');
        expect(repaired.shiftTypes).toEqual(expect.arrayContaining(legacy.shiftTypes));
        expect(repaired.scheduleInputs).toBe(legacy.scheduleInputs);
        expect(repaired.nurses[0]?.possibleShiftTypeIds).toEqual(expect.arrayContaining(legacy.nurses[0]!.possibleShiftTypeIds));
        expect(ensureOnboardingAnnualLeave(repaired)).toBe(repaired);
    });

    it('protects the last annual leave but allows names and codes to be edited', () => {
        const draft = createInitialDraft();
        const annual = draft.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')!;

        expect(deleteShiftTypeDraft(draft, annual.id)).toBe(draft);
        expect(updateShiftTypeDraft(draft, annual.id, {isActive: false})).toBe(draft);
        expect(updateShiftTypeDraft(draft, annual.id, {classification: 'OTHER_LEAVE'})).toBe(draft);
        expect(updateShiftTypeDraft(draft, annual.id, {mappingStatus: 'UNASSIGNED'})).toBe(draft);
        expect(
            updateShiftTypeDraft(draft, annual.id, {name: '휴가', shortName: 'L'}).shiftTypes.find((shift) => shift.id === annual.id),
        ).toMatchObject({name: '휴가', shortName: 'L', classification: 'ANNUAL_LEAVE'});
    });

    it('allows multiple leave units and removal of an extra annual type', () => {
        const draft = createInitialDraft();
        const annual = draft.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')!;
        const withHalfDay = {
            ...draft,
            shiftTypes: [...draft.shiftTypes, {...annual, id: 'half-day', name: '반차', shortName: 'H', autoSeeded: false}],
        };

        expect(getStepValidation(withHalfDay, 4).isValid).toBe(true);
        expect(
            deleteShiftTypeDraft(withHalfDay, annual.id).shiftTypes.filter((shift) => shift.classification === 'ANNUAL_LEAVE'),
        ).toHaveLength(1);
        expect(
            updateShiftTypeDraft(withHalfDay, annual.id, {classification: 'OTHER_LEAVE'}).shiftTypes.find((shift) => shift.id === annual.id)
                ?.classification,
        ).toBe('OTHER_LEAVE');
    });

    it('reuses an uploaded annual leave type and preserves ambiguous A as a separate duty', () => {
        const draft = createInitialDraft();
        const uploaded = applyParsedWardData(draft, {
            shiftTypes: [{name: '유급휴가', shortName: 'L', classification: 'ANNUAL_LEAVE', source: 'schedule-input'}],
        });

        expect(uploaded.shiftTypes.filter((shift) => shift.classification === 'ANNUAL_LEAVE')).toHaveLength(1);
        expect(uploaded.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')).toMatchObject({shortName: 'L'});

        const manual = applyScheduleInputDraft(draft, draft.teams[0]!.id, {
            year: 2026,
            month: 10,
            rows: [{id: 'row-1', nurseId: null, name: '홍길동', shifts: {'1': 'A'}}],
        });

        expect(manual.shiftTypes.find((shift) => shift.shortName === 'A')?.classification).toBe('OTHER_WORK');
        expect(manual.shiftTypes.find((shift) => shift.classification === 'ANNUAL_LEAVE')?.shortName).toBe('L');
    });
});
