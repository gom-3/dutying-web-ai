import {describe, expect, it} from 'vitest';
import {buildCreateWardPayload} from '../adapter';
import {createInitialDraft, updateNurseDraft, updateShiftTypeDraft} from '../draft';
import {normalizeOnboardingSignals, withOnboardingEdit, withOnboardingImport} from '../onboarding-measurement';

describe('onboarding measurement coverage', () => {
    it('keeps old draft coverage unknown and does not infer imports from a filename', () => {
        const old = {...createInitialDraft(), onboardingSignals: undefined, uploadedFileName: 'private.xlsx'};

        expect(normalizeOnboardingSignals(old.onboardingSignals)).toBeUndefined();
        expect(buildCreateWardPayload(old).onboardingSignals).toBeUndefined();

        const imported = withOnboardingImport(old, 'EXCEL');

        expect(imported.onboardingSignals).toMatchObject({coverageComplete: false, excelImported: true});
        expect(JSON.stringify(imported.onboardingSignals)).not.toContain('private.xlsx');
    });
    it('counts actual manual edits, including edits later reverted, but excludes no-op selections', () => {
        const draft = createInitialDraft();
        const nurse = draft.nurses[0];
        const renamed = withOnboardingEdit(draft, updateNurseDraft(draft, nurse.id, {name: '변경한 이름'}), 'possibleShiftsEdited');

        expect(renamed.onboardingSignals?.possibleShiftsEdited).toBe(false);

        const edited = withOnboardingEdit(draft, updateNurseDraft(draft, nurse.id, {possibleShiftTypeIds: []}), 'possibleShiftsEdited');

        expect(edited.onboardingSignals?.possibleShiftsEdited).toBe(true);

        const reverted = withOnboardingEdit(
            edited,
            updateNurseDraft(edited, nurse.id, {possibleShiftTypeIds: nurse.possibleShiftTypeIds}),
            'possibleShiftsEdited',
        );

        expect(buildCreateWardPayload(reverted).onboardingSignals?.possibleShiftsEdited).toBe(true);

        const same = withOnboardingEdit(
            draft,
            updateShiftTypeDraft(draft, draft.shiftTypes[0].id, {name: draft.shiftTypes[0].name}),
            'shiftTypesEdited',
        );

        expect(same.onboardingSignals?.shiftTypesEdited).toBe(false);
    });
    it('accumulates successful Excel and photo imports without marking automatic prefill as a manual edit', () => {
        const draft = withOnboardingImport(withOnboardingImport(createInitialDraft(), 'EXCEL'), 'PHOTO');

        expect(draft.onboardingSignals).toMatchObject({
            coverageComplete: true,
            excelImported: true,
            photoImported: true,
            shiftTypesEdited: false,
        });
        expect(buildCreateWardPayload(draft).onboardingSignals).toEqual(draft.onboardingSignals);
    });
});
