import {describe, expect, it} from 'vitest';
import {
    addNurseDraft,
    addShiftTypeDraft,
    addTeamDraft,
    canComplete,
    canGoNext,
    createInitialDraft,
    deleteShiftTypeDraft,
    getStepValidation,
    reorderNursesWithinTeam,
    updateNurseDraft,
    updateShiftTypeDraft,
} from './model';

describe('OnboardingWardCreatePage model', () => {
    it('returns validation issues for invalid shift types', () => {
        const initialDraft = createInitialDraft();
        const extraShiftDraft = addShiftTypeDraft({
            ...initialDraft,
            currentStep: 2,
        });
        const validation = getStepValidation(extraShiftDraft, 2);

        expect(validation.isValid).toBe(false);
        expect(validation.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['missing-shift-name', 'missing-shift-short-name']),
        );
        expect(canGoNext(extraShiftDraft)).toBe(false);
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
            currentStep: 3,
        });
        const nurseId = draftWithTeam.nurses[0]?.id ?? '';
        const invalidDraft = updateNurseDraft(draftWithTeam, nurseId, {name: ''});
        const validation = getStepValidation(invalidDraft, 3);

        expect(validation.isValid).toBe(false);
        expect(validation.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['empty-team-nurses', 'missing-nurse-name']));
        expect(canGoNext(invalidDraft)).toBe(false);
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
        };
        const validShiftDraft = updateShiftTypeDraft(step4Draft, step4Draft.shiftTypes[0]!.id, {name: '데이 근무'});
        const validNurseDraft = updateNurseDraft(validShiftDraft, validShiftDraft.nurses[0]!.id, {name: '홍길동'});

        expect(canComplete(validNurseDraft)).toBe(true);

        const invalidDraft = updateNurseDraft(validNurseDraft, validNurseDraft.nurses[0]!.id, {name: ''});

        expect(canComplete(invalidDraft)).toBe(false);
    });
});
