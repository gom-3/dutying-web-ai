import {describe, expect, it} from 'vitest';
import {type TOnboardingWardParseApiResponse} from '@/shared/api/file/type';
import {
    applyParsedWardData,
    buildCreateWardPayload,
    buildOnboardingParseDraftInjection,
    buildUploadedMonthlySchedulesFromParsedWardData,
} from '../adapter';
import {
    applyScheduleInputDraft,
    applyUploadedScheduleTemplateDraft,
    createEmptyShiftType,
    createInitialDraft,
    getStepValidation,
    mergeImportedShiftTypeDraft,
    updateShiftTypeDraft,
} from '../draft';

const importPhoto = (response: TOnboardingWardParseApiResponse, previous = createInitialDraft()) => {
    const {parsedWardData} = buildOnboardingParseDraftInjection(response, 'schedule.jpg', {targetYear: 2026, targetMonth: 12});
    const months = buildUploadedMonthlySchedulesFromParsedWardData(parsedWardData);
    const primary = months[months.length - 1]!;

    return applyUploadedScheduleTemplateDraft(applyParsedWardData(previous, parsedWardData), {
        fileName: 'schedule.jpg',
        ...primary,
        monthlySchedules: months,
    }).draft;
};
const response: TOnboardingWardParseApiResponse = {
    nurses: [],
    nurse_candidates: [
        {
            raw_name: 'Staff A',
            assignments: {'1': 'D', '2': 'O', '3': 'O', '4': 'K'},
            unmapped_assignments: {'3': '/', '4': '응급지원팀', '5': 'q', '6': 'Q', '7': 'Ⓓ', '8': '★', '2026-11-25': '/', '32': 'invalid'},
        },
        {raw_name: 'Staff B', unmapped_assignments: {'4': '응급지원팀', '5': 'q', '6': '  ', '7': null}},
    ],
    shift_type_candidates: [
        {code: 'K', classification: 'OTHER_WORK'},
        {code: 'O', classification: 'OFF'},
    ],
};

describe('unmapped photo readings', () => {
    it('retains exact dated readings across months, separate from known shifts, including when editing the table', () => {
        const draft = importPhoto(response);
        const team = draft.teams[0]!.id;
        const schedule = draft.scheduleInputs[team]!['2026-12']!;
        const edited = applyScheduleInputDraft(draft, team, schedule);

        for (const state of [draft, edited]) {
            const types = state.shiftTypes.filter((type) => type.importedCode);

            expect(types.map((type) => type.importedCode).sort()).toEqual(['/', '응급지원팀', 'q', 'Q', 'Ⓓ', '★'].sort());
            expect(types.every((type) => type.mappingStatus === 'UNASSIGNED')).toBe(true);
            expect(state.shiftTypes.filter((type) => type.shortName === 'O')).toHaveLength(1);
            expect(state.shiftTypes.some((type) => type.shortName === 'K')).toBe(false);
            expect(state.scheduleInputs[team]!['2026-11']!.rows[0]!.shifts).toEqual({'25': '/'});
            expect(state.scheduleInputs[team]!['2026-12']!.rows[0]!.shifts).toEqual({
                '1': 'D',
                '2': 'O',
                '3': '/',
                '4': '응급지원팀',
                '5': 'q',
                '6': 'Q',
                '7': 'Ⓓ',
                '8': '★',
            });
            expect(state.nurses[0]!.initialShifts).toContainEqual({date: '2026-12-07', shiftShortName: 'Ⓓ'});
        }
    });

    it('updates only matching cells on merge or abbreviation edit, and submits resolved values', () => {
        const draft = importPhoto(response);
        const source = draft.shiftTypes.find((type) => type.importedCode === '/')!;
        const off = draft.shiftTypes.find((type) => type.shortName === 'O')!;
        const long = draft.shiftTypes.find((type) => type.importedCode === '응급지원팀')!;
        const lower = draft.shiftTypes.find((type) => type.importedCode === 'q')!;
        const upper = draft.shiftTypes.find((type) => type.importedCode === 'Q')!;

        expect(mergeImportedShiftTypeDraft(draft, source.id, upper.id)).toBe(draft);

        const merged = mergeImportedShiftTypeDraft(draft, source.id, off.id);

        expect(merged.shiftTypes.some((type) => type.id === source.id)).toBe(false);

        const renamed = updateShiftTypeDraft(merged, long.id, {shortName: 'T', classification: 'OTHER_WORK'});
        const resolved = mergeImportedShiftTypeDraft(renamed, lower.id, long.id);
        const team = draft.teams[0]!.id;

        expect(resolved.scheduleInputs[team]!['2026-12']!.rows.map((r) => r.shifts)).toEqual([
            {'1': 'D', '2': 'O', '3': 'O', '4': 'T', '5': 'T', '6': 'Q', '7': 'Ⓓ', '8': '★'},
            {'4': 'T', '5': 'T'},
        ]);
        expect(resolved.scheduleInputs[team]!['2026-11']!.rows[0]!.shifts).toEqual({'25': 'O'});
        expect(resolved.shiftTypes.find((type) => type.id === long.id)).toMatchObject({
            importedCode: '응급지원팀',
            shortName: 'T',
            mappingStatus: 'CONFIRMED',
        });

        for (const nurse of resolved.nurses) {
            expect(nurse.possibleShiftTypeIds).not.toContain(lower.id);
            expect(nurse.possibleShiftTypeIds).not.toContain(source.id);
        }

        const payload = buildCreateWardPayload(resolved);

        expect(payload.wardShiftTypes.find((type) => type.shortName === 'T')).not.toHaveProperty('importedCode');

        const history = payload.shiftTeams[0]!.nurses![0]!.initialShifts!;

        expect(history).toContainEqual({date: '2026-11-25', shiftShortName: 'O'});
        expect(history).toContainEqual({date: '2026-12-05', shiftShortName: 'T'});
        expect(history.some((shift) => shift.date === '2026-12-06')).toBe(false);
    });

    it('keeps alternative spellings of standard codes independent until the user links each one', () => {
        const draft = importPhoto({
            nurses: [
                {
                    name: 'A',
                    assignments: {'1': 'D', '2': 'O'},
                    unmapped_assignments: {'3': 'd', '4': 'Day', '5': 'OFF', '6': 'Ｄ', '7': 'off'},
                },
            ],
        });
        const team = draft.teams[0]!.id;
        const getCells = (state: typeof draft) => state.scheduleInputs[team]!['2026-12']!.rows[0]!.shifts;
        const working = applyScheduleInputDraft(draft, team, draft.scheduleInputs[team]!['2026-12']!);

        expect(getCells(working)).toEqual({'1': 'D', '2': 'O', '3': 'd', '4': 'Day', '5': 'OFF', '6': 'Ｄ', '7': 'off'});

        const off = working.shiftTypes.find((type) => type.shortName === 'O')!;
        const day = working.shiftTypes.find((type) => type.shortName === 'D')!;
        const source = (code: string) => working.shiftTypes.find((type) => type.importedCode === code)!;
        const withDay = mergeImportedShiftTypeDraft(working, source('d').id, day.id);
        const withOff = mergeImportedShiftTypeDraft(withDay, source('OFF').id, off.id);

        expect(getCells(withOff)).toEqual({'1': 'D', '2': 'O', '3': 'D', '4': 'Day', '5': 'O', '6': 'Ｄ', '7': 'off'});
        expect(withOff.nurses[0]!.initialShifts).toContainEqual({date: '2026-12-07', shiftShortName: 'off'});
    });

    it('saves the meaning chosen for a literal slash even when it resembles the legacy off abbreviation', () => {
        const draft = importPhoto({nurses: [{name: 'A', unmapped_assignments: {'1': '/'}}]});
        const slash = draft.shiftTypes.find((type) => type.importedCode === '/')!;
        const resolved = updateShiftTypeDraft(draft, slash.id, {classification: 'OTHER_LEAVE', isOff: true});
        const payload = buildCreateWardPayload(resolved);

        expect(payload.wardShiftTypes.find((type) => type.shortName === '/')).toMatchObject({classification: 'OTHER_LEAVE', isOff: true});
        expect(payload.shiftTeams[0]!.nurses![0]!.initialShifts).toEqual([{date: '2026-12-01', shiftShortName: '/'}]);
    });

    it('reuses an existing user-defined shift when the photo contains the exact same abbreviation', () => {
        const custom = {...createEmptyShiftType(), name: '응급지원', shortName: 'X1', startTime: '09:30', endTime: '15:45'};
        const base = createInitialDraft();
        const first = importPhoto(
            {nurses: [{name: 'A', unmapped_assignments: {'1': 'X1', '2': 'x1'}}]},
            {...base, shiftTypes: [...base.shiftTypes, custom]},
        );
        const second = importPhoto({nurses: [{name: 'A', unmapped_assignments: {'1': 'X1', '2': 'x1'}}]}, first);

        for (const state of [first, second]) {
            expect(state.shiftTypes.filter((entry) => entry.shortName === 'X1')).toMatchObject([
                {id: custom.id, name: '응급지원', startTime: '09:30', endTime: '15:45', mappingStatus: 'CONFIRMED'},
            ]);
            expect(state.shiftTypes.find((entry) => entry.shortName === 'x1')).toMatchObject({name: 'x1', mappingStatus: 'UNASSIGNED'});
        }
    });

    it('keeps a long source label visible while enforcing the database name limit at configuration', () => {
        const original = 'original label exceeding twelve';
        const draft = importPhoto({nurses: [{name: 'A', unmapped_assignments: {'1': original}}]});
        const type = draft.shiftTypes.find((type) => type.importedCode === original)!;
        const renamed = updateShiftTypeDraft(draft, type.id, {shortName: 'T', classification: 'OTHER_LEAVE'});

        expect(getStepValidation(renamed, 4).issues).toContainEqual({step: 4, targetId: type.id, code: 'invalid-shift-name'});

        const configured = updateShiftTypeDraft(renamed, type.id, {name: 'Team leave'});

        expect(getStepValidation(configured, 4).issues.filter((issue) => issue.targetId === type.id)).toEqual([]);
        expect(configured.shiftTypes.find((entry) => entry.id === type.id)?.importedCode).toBe(original);
    });

    it('accepts unknown-only rosters and reads candidate-only cells for the matching detailed worker', () => {
        const draft = importPhoto({
            nurses: [{name: 'A', memo: 'detail'}],
            nurse_candidates: [{raw_name: 'A', unmapped_assignments: {'1': '보조근무', '2': '◇'}}],
        });

        expect(draft.nurses[0]).toMatchObject({
            name: 'A',
            memo: 'detail',
            initialShifts: [
                {date: '2026-12-01', shiftShortName: '보조근무'},
                {date: '2026-12-02', shiftShortName: '◇'},
            ],
        });

        const replaced = importPhoto({nurses: [{name: 'B', unmapped_assignments: {'1': 'Xtra'}}]}, draft);

        expect(replaced.shiftTypes.filter((type) => type.importedCode).map((type) => type.importedCode)).toEqual(['Xtra']);
    });
});
