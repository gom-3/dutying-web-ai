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
    assignImportedShiftColors,
    createEmptyShiftType,
    createInitialDraft,
    SCHEDULE_SLASH_COLOR,
    getStepValidation,
    goToStep,
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
    it.each(['AUTO_MATCHED', 'CONFIRMED'] as const)('repairs E/N color collisions even after %s mapping', (mappingStatus) => {
        const types = createInitialDraft().shiftTypes.map((type) => ({
            ...type,
            color: type.shortName === 'E' ? '#3580FF' : type.color,
            source: 'schedule-input' as const,
            mappingStatus,
        }));
        const repaired = assignImportedShiftColors(types);

        expect(repaired.find((type) => type.shortName === 'E')?.color).toBe('#FF8BA5');
        expect(repaired.find((type) => type.shortName === 'N')).toBe(types.find((type) => type.shortName === 'N'));
        expect(new Set(repaired.map((type) => type.color.toUpperCase())).size).toBe(repaired.length);
        expect(assignImportedShiftColors(repaired)).toEqual(repaired);
    });

    it('repairs colors supplied for recognized photo codes before entering shift types', () => {
        const draft = importPhoto(
            {
                shiftTypes: [
                    {shortName: 'E', color: '#3580FF'},
                    {shortName: 'N', color: '#3580FF'},
                ],
                nurse_candidates: [{raw_name: 'Staff A', assignments: {'1': 'E', '2': 'N', '3': 'E'}}],
            },
            {...createInitialDraft(), shiftTypes: []},
        );
        const evening = draft.shiftTypes.find((type) => type.shortName === 'E')!;
        const night = draft.shiftTypes.find((type) => type.shortName === 'N')!;

        expect(evening.color).not.toBe(night.color);
        expect(evening.color).toBe('#FF8BA5');
        expect(night.color).toBe('#3580FF');
    });

    it('preserves an unrelated photo label color when repairing recognized custom codes', () => {
        const custom = ['R', 'S'].map((shortName) => ({...createEmptyShiftType(), shortName, color: '#B8DC8F'}));
        const original = {
            ...createEmptyShiftType(),
            shortName: 'q',
            importedCode: 'q',
            color: '#F7B8A8',
            mappingStatus: 'UNASSIGNED' as const,
        };
        const repaired = assignImportedShiftColors([...custom, original]);

        expect(repaired[2]).toBe(original);
        expect(new Set(repaired.map((type) => type.color)).size).toBe(repaired.length);
    });

    it('replaces a saved yellow slash with gray before reserving colors for other imported labels', () => {
        const slash = {
            ...createEmptyShiftType(),
            shortName: '/',
            importedCode: '/',
            color: '#F8D878',
            mappingStatus: 'UNASSIGNED' as const,
        };
        const other = {
            ...createEmptyShiftType(),
            shortName: 'Ⓝ',
            importedCode: 'Ⓝ',
            color: SCHEDULE_SLASH_COLOR,
            mappingStatus: 'UNASSIGNED' as const,
        };
        const repaired = assignImportedShiftColors([other, slash]);

        expect(repaired[1]).toMatchObject({...slash, color: SCHEDULE_SLASH_COLOR});
        expect(repaired[0]?.color).not.toBe(SCHEDULE_SLASH_COLOR);
        expect(assignImportedShiftColors([slash])[0]?.color).toBe(SCHEDULE_SLASH_COLOR);
        expect(assignImportedShiftColors(repaired)).toEqual(repaired);
    });

    it('repairs colliding imported colors in older drafts even when the preset palette runs out', () => {
        const night = createInitialDraft().shiftTypes.find((type) => type.shortName === 'N')!;
        const codes = ['Ⓝ', 'N1', 'Ｎ', 'Ⓓ', '/', '／', '-', 'Q', 'q', '★', '교육', '지원'];
        const legacy = codes.map((code) => ({
            ...createEmptyShiftType(),
            shortName: code,
            importedCode: code,
            color: night.color,
            mappingStatus: 'UNASSIGNED' as const,
        }));
        const repaired = assignImportedShiftColors([night, ...legacy]);

        expect(repaired[0]).toBe(night);
        expect(repaired.slice(1).map((type) => type.shortName)).toEqual(codes);
        expect(new Set(repaired.map((type) => type.color)).size).toBe(repaired.length);
        expect(assignImportedShiftColors([...repaired].reverse())).toEqual([...repaired].reverse());
    });

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

    it('keeps imported cells unchanged on merge or abbreviation edit and submits resolved values', () => {
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

        expect(resolved.scheduleInputs).toBe(draft.scheduleInputs);
        expect(resolved.scheduleInputs[team]!['2026-12']!.rows.map((r) => r.shifts)).toEqual(
            draft.scheduleInputs[team]!['2026-12']!.rows.map((r) => r.shifts),
        );
        expect(resolved.scheduleInputs[team]!['2026-11']!.rows[0]!.shifts).toEqual({'25': '/'});
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

        expect(getCells(withOff)).toEqual({'1': 'D', '2': 'O', '3': 'd', '4': 'Day', '5': 'OFF', '6': 'Ｄ', '7': 'off'});
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

    it('uses the final classifications for each photo row and includes every active leave code for everyone', () => {
        const photo = importPhoto({
            nurses: [
                {name: 'Kim', assignments: {'1': 'N', '2': 'O'}},
                {name: 'Lee', unmapped_assignments: {'1': 'Ⓝ', '2': '/'}},
                {name: 'Park', unmapped_assignments: {'1': '/'}},
            ],
        });
        const custom = photo.shiftTypes.find((type) => type.importedCode === 'Ⓝ')!;
        const slash = photo.shiftTypes.find((type) => type.importedCode === '/')!;
        const classified = updateShiftTypeDraft(
            updateShiftTypeDraft(photo, custom.id, {classification: 'OTHER_WORK', shortName: 'X', isOff: false}),
            slash.id,
            {classification: 'OTHER_LEAVE', isOff: true},
        );
        const payload = buildCreateWardPayload(goToStep(classified, 5));
        const selections = payload.shiftTeams[0]!.nurses!.map((nurse) => [...nurse.possibleShiftShortNames!].sort());

        expect(selections).toEqual([
            ['/', 'A', 'N', 'O'],
            ['/', 'A', 'O', 'X'],
            ['/', 'A', 'O'],
        ]);
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
