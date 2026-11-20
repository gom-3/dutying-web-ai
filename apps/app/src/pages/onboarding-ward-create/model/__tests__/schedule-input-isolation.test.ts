import {describe, expect, it} from 'vitest';
import {buildCreateWardPayload} from '../adapter';
import {
    addShiftTypeDraft,
    applyScheduleInputDraft,
    applyUploadedScheduleTemplateDraft,
    createInitialDraft,
    deleteShiftTypeDraft,
    getScheduleInputDraft,
    goNextStep,
    goPreviousStep,
    updateShiftTypeDraft,
    withScheduleInputUpdate,
} from '../draft';

const makeImportedDraft = () => {
    const base = {...createInitialDraft(), currentStep: 3 as const};
    const teamId = base.teams[0]!.id;
    const draft = withScheduleInputUpdate(base, (source) =>
        applyScheduleInputDraft(source, teamId, {
            year: 2026,
            month: 5,
            rows: [{id: 'row-1', nurseId: null, name: 'Nurse A', shifts: {'1': 'R'}}],
        }),
    );

    return {draft, teamId};
};

describe('one-way schedule import', () => {
    it('preserves deletions and order when returning without changing the import page', () => {
        const entered = goNextStep({...createInitialDraft(), currentStep: 3});
        const day = entered.shiftTypes.find((type) => type.classification === 'DAY')!;
        const deleted = deleteShiftTypeDraft(entered, day.id);
        const reordered = {...deleted, shiftTypes: [...deleted.shiftTypes].reverse()};
        const next = goNextStep(goPreviousStep(reordered));

        expect(next.shiftTypes).toBe(reordered.shiftTypes);
        expect(next.shiftTypes.some((type) => type.id === day.id)).toBe(false);
        expect(getScheduleInputDraft(next).shiftTypes.some((type) => type.id === day.id)).toBe(true);
    });

    it('imports only on entry and keeps type edits out of the source cells, colors and names', () => {
        const {draft, teamId} = makeImportedDraft();
        const source = getScheduleInputDraft(draft);
        const sourceType = source.shiftTypes.find((type) => type.shortName === 'R')!;

        expect(draft.shiftTypes.some((type) => type.shortName === 'R')).toBe(false);

        const entered = goNextStep(draft);
        const edited = updateShiftTypeDraft(entered, sourceType.id, {
            name: 'Support',
            shortName: 'F',
            color: '#123456',
            classification: 'OTHER_WORK',
            startTime: '10:00',
            endTime: '19:00',
        });
        const back = goPreviousStep(edited);

        expect(back.currentStep).toBe(3);
        expect(back.scheduleInputs).toBe(source.scheduleInputs);
        expect(back.scheduleInputs[teamId]!['2026-05']!.rows[0]!.shifts).toEqual({'1': 'R'});
        expect(getScheduleInputDraft(back).shiftTypes.find((type) => type.id === sourceType.id)).toEqual(sourceType);
        expect(getScheduleInputDraft(back).shiftTypes.some((type) => type.shortName === 'F')).toBe(false);

        const reentered = goNextStep(back);

        expect(reentered.shiftTypes.find((type) => type.id === sourceType.id)).toMatchObject({
            name: 'Support',
            shortName: 'F',
            color: '#123456',
            startTime: '10:00',
            endTime: '19:00',
        });
        expect(buildCreateWardPayload(reentered).shiftTeams[0]!.nurses![0]!.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'F'},
        ]);
    });

    it('pulls later source edits on the next entry while retaining configured types', () => {
        const {draft, teamId} = makeImportedDraft();
        const entered = goNextStep(draft);
        const type = entered.shiftTypes.find((shift) => shift.shortName === 'R')!;
        const edited = updateShiftTypeDraft(entered, type.id, {
            name: 'Support',
            shortName: 'F',
            color: '#123456',
            classification: 'OTHER_WORK',
            startTime: '09:00',
            endTime: '18:00',
        });
        const back = goPreviousStep(edited);
        const schedule = back.scheduleInputs[teamId]!['2026-05']!;
        const updatedSource = withScheduleInputUpdate(back, (source) =>
            applyScheduleInputDraft(source, teamId, {
                ...schedule,
                rows: [{...schedule.rows[0]!, shifts: {'1': 'R', '2': 'D'}}],
            }),
        );

        expect(updatedSource.shiftTypes).toBe(back.shiftTypes);
        expect(getScheduleInputDraft(updatedSource).shiftTypes.some((shift) => shift.shortName === 'D')).toBe(true);

        const next = goNextStep(updatedSource);

        expect(next.shiftTypes.find((shift) => shift.id === type.id)).toMatchObject({shortName: 'F', name: 'Support', color: '#123456'});
        expect(next.shiftTypes.some((shift) => shift.shortName === 'D')).toBe(true);
        expect(next.scheduleInputs[teamId]!['2026-05']!.rows[0]!.shifts).toEqual({'1': 'R', '2': 'D'});
        expect(buildCreateWardPayload(next).shiftTeams[0]!.nurses![0]!.initialShifts).toEqual([
            {date: '2026-05-01', shiftShortName: 'F'},
            {date: '2026-05-02', shiftShortName: 'D'},
        ]);
    });

    it('keeps original assignments with the renamed type when a new type reuses its old abbreviation', () => {
        const {draft} = makeImportedDraft();
        const entered = goNextStep(draft);
        const original = entered.shiftTypes.find((type) => type.shortName === 'R')!;
        const renamed = updateShiftTypeDraft(entered, original.id, {
            shortName: 'F',
            classification: 'OTHER_WORK',
            startTime: '09:00',
            endTime: '18:00',
        });
        const added = addShiftTypeDraft(renamed);
        const newType = added.shiftTypes[added.shiftTypes.length - 1]!;
        const configured = updateShiftTypeDraft(added, newType.id, {shortName: 'R', name: 'New support'});
        const reentered = goNextStep(goPreviousStep(configured));
        const completed = buildCreateWardPayload(reentered);

        expect(completed.shiftTeams[0]!.nurses![0]!.initialShifts).toEqual([{date: '2026-05-01', shiftShortName: 'F'}]);
        expect(completed.shiftTeams[0]!.nurses![0]!.possibleShiftShortNames).toContain('F');
        expect(completed.shiftTeams[0]!.nurses![0]!.possibleShiftShortNames).not.toContain('R');
    });

    it('replaces the configuration from a newly uploaded file only when entering shift types', () => {
        const {draft} = makeImportedDraft();
        const entered = goNextStep(draft);
        const type = entered.shiftTypes.find((shift) => shift.shortName === 'R')!;
        const edited = updateShiftTypeDraft(entered, type.id, {shortName: 'F', color: '#123456'});
        const sourceUpdated = withScheduleInputUpdate(
            goPreviousStep(edited),
            (source) =>
                applyUploadedScheduleTemplateDraft(source, {
                    fileName: 'replacement.xlsx',
                    year: 2026,
                    month: 6,
                    teamSchedules: [{teamName: 'New team', rows: [{name: 'Nurse B', shifts: {'1': 'R'}}]}],
                }).draft,
            {replace: true},
        );

        expect(sourceUpdated.shiftTypes.find((shift) => shift.id === type.id)?.shortName).toBe('F');
        expect(getScheduleInputDraft(sourceUpdated).shiftTypes.find((shift) => shift.shortName === 'R')?.color).not.toBe('#123456');

        const reentered = goNextStep(sourceUpdated);

        expect(reentered.shiftTypes.some((shift) => shift.shortName === 'F')).toBe(false);
        expect(reentered.shiftTypes.some((shift) => shift.shortName === 'R')).toBe(true);
    });
});
