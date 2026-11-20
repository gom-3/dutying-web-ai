import {describe, expect, it} from 'vitest';
import {buildCreateWardPayload, applyParsedWardData, type TOnboardingParsedWardData} from '../adapter';
import {normalizeOnboardingDivisions} from '../divisions';
import {
    addDivisionAfterNurseDraft,
    addScheduleDivisionAfterRowDraft,
    applyUploadedScheduleTemplateDraft,
    addNurseDraft,
    createInitialDraft,
    deleteDivisionDraft,
    deleteScheduleDivisionDraft,
    deleteNurseDraft,
    updateNurseDraft,
    type TOnboardingWardDraft,
} from '../draft';

const createGroupedDraft = (): TOnboardingWardDraft => {
    const draft = createInitialDraft();
    const team = draft.teams[0]!;
    const nurses = [1, 1, 2, 2, 3].map((divisionNum, index) => ({
        ...draft.nurses[0]!,
        id: `nurse-${index}`,
        teamId: team.id,
        name: `Nurse ${index}`,
        divisionNum,
    }));
    const rows = nurses.map((nurse, index) => ({
        id: `row-${index}`,
        nurseId: nurse.id,
        name: nurse.name,
        divisionNum: nurse.divisionNum,
        shifts: {'1': 'D'},
    }));

    return {
        ...draft,
        teams: [
            {
                ...team,
                divisions: [
                    {divisionNum: 1, name: '그룹1'},
                    {divisionNum: 2, name: '夜勤チーム'},
                    {divisionNum: 3, name: '그룹3'},
                ],
            },
        ],
        nurses,
        scheduleInputs: {
            [team.id]: {
                '2026-11': {year: 2026, month: 11, rows},
                '2026-12': {year: 2026, month: 12, rows: rows.map((row) => ({...row, shifts: {'2': 'N'}}))},
            },
        },
    };
};
const expectMatchingScheduleGroups = (draft: TOnboardingWardDraft) => {
    const numbers = new Map(draft.nurses.map((nurse) => [nurse.id, nurse.divisionNum]));

    for (const schedules of Object.values(draft.scheduleInputs)) {
        for (const schedule of Object.values(schedules ?? {})) {
            for (const row of schedule?.rows ?? []) expect(row.divisionNum).toBe(numbers.get(row.nurseId!));
        }
    }
};

describe('onboarding group numbering', () => {
    it('starts the remaining roster at 1 after deleting the first group while retaining source rows', () => {
        const original = createGroupedDraft();
        const next = deleteNurseDraft(deleteNurseDraft(original, original.nurses[0]!.id), original.nurses[1]!.id);

        expect(next.nurses.map((nurse) => nurse.divisionNum)).toEqual([1, 1, 2]);
        expect(next.teams[0]!.divisions?.slice(0, 2)).toEqual([
            {divisionNum: 1, name: '夜勤チーム'},
            {divisionNum: 2, name: '그룹2'},
        ]);
        expect(next.scheduleInputs[next.teams[0]!.id]?.['2026-11']?.rows).toHaveLength(5);
        expect(normalizeOnboardingDivisions(next)).toEqual(next);
    });

    it('starts an empty destination team at 1 when adding or moving a nurse', () => {
        const original = createGroupedDraft();
        const emptyTeam = {id: 'empty', name: 'Empty', divisions: [{divisionNum: 8, name: '그룹8'}]};
        const draft = {...original, teams: [...original.teams, emptyTeam]};
        const added = addNurseDraft(draft, emptyTeam.id);

        expect(added.nurses.filter((nurse) => nurse.teamId === emptyTeam.id).map((nurse) => nurse.divisionNum)).toEqual([1]);
        expect(added.teams[1]!.divisions).toEqual([{divisionNum: 1, name: '그룹1'}]);

        const moved = updateNurseDraft(draft, draft.nurses[4]!.id, {teamId: emptyTeam.id});

        expect(moved.nurses.find((nurse) => nurse.teamId === emptyTeam.id)?.divisionNum).toBe(1);
        expect(moved.nurses.map((nurse) => nurse.id)).toEqual(draft.nurses.map((nurse) => nurse.id));
    });

    it('starts sparse imported groups at 1 in each team without changing nurse order, custom names, or shifts', () => {
        const original = createGroupedDraft();
        const first = original.teams[0]!;
        const second = {...first, id: 'other-team', divisions: [{divisionNum: 20, name: 'Group 20'}]};
        const nurses = original.nurses.map((nurse) => ({...nurse, divisionNum: nurse.divisionNum! + 5}));
        const draft = {
            ...original,
            teams: [
                {
                    ...first,
                    divisions: [
                        {divisionNum: 1, name: '그룹1'},
                        {divisionNum: 6, name: '그룹6'},
                        {divisionNum: 7, name: '夜勤チーム'},
                        {divisionNum: 8, name: 'グループ8'},
                    ],
                },
                second,
            ],
            nurses: [...nurses, {...nurses[0]!, id: 'other', teamId: second.id, divisionNum: 20}],
        };
        const untouched = structuredClone(draft);
        const normalized = normalizeOnboardingDivisions(draft);

        expect(normalized.teams.map((team) => team.divisions)).toEqual([
            [
                {divisionNum: 1, name: '그룹1'},
                {divisionNum: 2, name: '夜勤チーム'},
                {divisionNum: 3, name: '그룹3'},
            ],
            [{divisionNum: 1, name: '그룹1'}],
        ]);
        expect(normalized.nurses.map((nurse) => nurse.id)).toEqual(draft.nurses.map((nurse) => nurse.id));
        expect(normalized.nurses.map((nurse) => nurse.divisionNum)).toEqual([1, 1, 2, 2, 3, 1]);
        expectMatchingScheduleGroups(normalized);
        expect(normalized.scheduleInputs[first.id]?.['2026-12']?.rows[0]?.shifts).toEqual({'2': 'N'});
        expect(normalizeOnboardingDivisions(normalized)).toEqual(normalized);
        expect(draft).toEqual(untouched);
    });

    it('keeps every following group when splitting and renumbers default names together with numbers', () => {
        const original = createGroupedDraft();
        const teamId = original.teams[0]!.id;
        const split = addDivisionAfterNurseDraft(original, teamId, original.nurses[0]!.id);

        expect(split.teams[0]!.divisions).toEqual([
            {divisionNum: 1, name: '그룹1'},
            {divisionNum: 2, name: '그룹2'},
            {divisionNum: 3, name: '夜勤チーム'},
            {divisionNum: 4, name: '그룹4'},
        ]);
        expect(split.nurses.map((nurse) => nurse.divisionNum)).toEqual([1, 2, 3, 3, 4]);
        expectMatchingScheduleGroups(split);

        const merged = deleteDivisionDraft(split, teamId, 2);

        expect(merged.teams).toEqual(original.teams);
        expect(merged.nurses).toEqual(original.nurses);
        expectMatchingScheduleGroups(merged);
    });

    it('does not create a gap or erase a custom name when adding at an existing group boundary', () => {
        const draft = createGroupedDraft();
        const next = addDivisionAfterNurseDraft(draft, draft.teams[0]!.id, draft.nurses[1]!.id);

        expect(next.teams).toEqual(draft.teams);
        expect(next.nurses).toEqual(draft.nurses);
        expectMatchingScheduleGroups(next);
    });

    it('keeps schedule splitting and merging consistent with roster groups across months', () => {
        const draft = createGroupedDraft();
        const teamId = draft.teams[0]!.id;
        const schedule = draft.scheduleInputs[teamId]!['2026-11']!;
        const split = addScheduleDivisionAfterRowDraft(draft, teamId, schedule, schedule.rows[0]!.id);

        expect(split.teams[0]!.divisions?.map((division) => division.name)).toEqual(['그룹1', '그룹2', '夜勤チーム', '그룹4']);
        expectMatchingScheduleGroups(split);

        const merged = deleteScheduleDivisionDraft(split, teamId, split.scheduleInputs[teamId]!['2026-11']!, 2);

        expect(merged.teams).toEqual(draft.teams);
        expect(merged.nurses.map((nurse) => [nurse.id, nurse.divisionNum])).toEqual(
            draft.nurses.map((nurse) => [nurse.id, nurse.divisionNum]),
        );
        expectMatchingScheduleGroups(merged);
    });

    it('normalizes uploaded group numbers before the roster and schedule become visible', () => {
        const {draft} = applyUploadedScheduleTemplateDraft(createInitialDraft(), {
            fileName: 'groups.xlsx',
            year: 2026,
            month: 11,
            teamSchedules: [
                {
                    teamName: 'A',
                    rows: [
                        {name: 'Alex', divisionNum: 6, divisionName: '그룹6', shifts: {'1': 'D'}},
                        {name: 'Sam', divisionNum: 8, divisionName: '夜勤チーム', shifts: {'1': 'N'}},
                    ],
                },
            ],
        });

        expect(draft.teams[0]!.divisions).toEqual([
            {divisionNum: 1, name: '그룹1'},
            {divisionNum: 2, name: '夜勤チーム'},
        ]);
        expect(draft.nurses.map((nurse) => nurse.divisionNum)).toEqual([1, 2]);
        expectMatchingScheduleGroups(draft);

        const payload = buildCreateWardPayload(draft);

        expect(payload.shiftTeams[0]!.divisions).toEqual(draft.teams[0]!.divisions);
        expect(payload.shiftTeams[0]!.nurses?.map((nurse) => nurse.divisionNum)).toEqual([1, 2]);
    });

    it('also normalizes the direct parsed-roster path and a legacy draft at submission', () => {
        const parsed: TOnboardingParsedWardData = {
            teams: [
                {
                    name: 'A',
                    divisions: [
                        {divisionNum: 6, name: '그룹6'},
                        {divisionNum: 8, name: 'Custom'},
                    ],
                },
            ],
            nurses: [
                {name: 'Alex', divisionNum: 6, possibleShiftShortNames: []},
                {name: 'Sam', divisionNum: 8, possibleShiftShortNames: []},
            ],
            importedCodes: [],
        };
        const parsedDraft = applyParsedWardData(createInitialDraft(), parsed);

        expect(parsedDraft.teams[0]!.divisions).toEqual([
            {divisionNum: 1, name: '그룹1'},
            {divisionNum: 2, name: 'Custom'},
        ]);
        expect(parsedDraft.nurses.map((nurse) => nurse.divisionNum)).toEqual([1, 2]);

        const legacy = createGroupedDraft();

        legacy.nurses = legacy.nurses.map((nurse) => ({...nurse, divisionNum: nurse.divisionNum! + 5}));
        legacy.teams[0]!.divisions = [
            {divisionNum: 6, name: '그룹6'},
            {divisionNum: 7, name: 'Custom'},
            {divisionNum: 8, name: '그룹8'},
        ];

        const payload = buildCreateWardPayload(legacy);

        expect(payload.shiftTeams[0]!.nurses?.map((nurse) => nurse.divisionNum)).toEqual([1, 1, 2, 2, 3]);
        expect(payload.shiftTeams[0]!.divisions?.map((division) => division.name)).toEqual(['그룹1', 'Custom', '그룹3']);
    });

    it('preserves the group targeted by a rule when teams use different imported numbers', () => {
        const draft = createGroupedDraft();
        const first = draft.teams[0]!;
        const second = {...first, id: 'second', name: 'B', divisions: [{divisionNum: 8, name: '그룹8'}]};

        draft.teams = [
            {
                ...first,
                divisions: [
                    {divisionNum: 6, name: '그룹6'},
                    {divisionNum: 8, name: '그룹8'},
                ],
            },
            second,
        ];
        draft.nurses = [
            {...draft.nurses[0]!, divisionNum: 6},
            {...draft.nurses[1]!, divisionNum: 8},
            {...draft.nurses[2]!, teamId: second.id, divisionNum: 8},
        ];
        draft.scheduleInputs = {};
        draft.constraintCandidates = [
            {
                id: 'rule',
                key: 'rule',
                templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                category: null,
                severity: 'HARD',
                selected: true,
                params: {target: {type: 'DIVISION', divisionNum: 8, name: '그룹8'}, count: 4},
                severityRecommendation: null,
                confidence: 1,
                confidenceBand: null,
                evidenceSummary: '',
                riskNote: null,
            },
        ];

        const normalized = normalizeOnboardingDivisions(draft);
        const payload = buildCreateWardPayload(normalized);

        expect(payload.shiftTeams.map((team) => team.constraintRules?.[0]?.params)).toEqual([
            {target: {type: 'DIVISION', divisionNum: 2, name: '그룹2'}, count: 4},
            {target: {type: 'DIVISION', divisionNum: 1, name: '그룹1'}, count: 4},
        ]);
        expect(normalizeOnboardingDivisions(normalized)).toEqual(normalized);

        const splitSource = createGroupedDraft();

        splitSource.constraintCandidates = [
            {...draft.constraintCandidates[0]!, params: {target: {type: 'DIVISION', divisionNum: 2}, count: 4}},
        ];

        const split = addDivisionAfterNurseDraft(splitSource, first.id, splitSource.nurses[0]!.id);

        expect(buildCreateWardPayload(split).shiftTeams[0]!.constraintRules?.[0]?.params).toEqual({
            target: {type: 'DIVISION', divisionNum: 3},
            count: 4,
        });

        const merged = deleteDivisionDraft(split, first.id, 2);

        expect(buildCreateWardPayload(merged).shiftTeams[0]!.constraintRules?.[0]?.params).toEqual({
            target: {type: 'DIVISION', divisionNum: 2},
            count: 4,
        });
    });
});
