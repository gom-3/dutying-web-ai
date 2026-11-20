import {describe, expect, it} from 'vitest';
import {buildOnboardingParseDraftInjection, buildUploadedMonthlySchedulesFromParsedWardData} from '../adapter';
import {applyUploadedScheduleTemplateDraft, createInitialDraft, getScheduleMonthKey} from '../draft';

// 월별 탭(7월·8월·9월)을 한 파일에 쌓아 올리면 달마다 근무표 칸이 따로 채워져야 한다.
// 예전에는 최신 달 한 장만 들어가고 나머지 달이 조용히 사라졌다.
describe('여러 달 시트를 담은 근무표 파일', () => {
    const parsed = {
        teams: [{name: '', divisions: [{divisionNum: 1, name: 'RN'}]}],
        nurses: [
            {
                name: '김은주',
                divisionNum: 1,
                initialShifts: [
                    {date: '2026-07-01', shiftShortName: 'D'},
                    {date: '2026-08-01', shiftShortName: 'E'},
                    {date: '2026-09-01', shiftShortName: 'N'},
                ],
            },
            {
                name: '이승미',
                divisionNum: 1,
                initialShifts: [
                    {date: '2026-07-02', shiftShortName: 'E'},
                    {date: '2026-09-02', shiftShortName: 'D'},
                ],
            },
        ],
    };

    it('달마다 근무표 칸을 갈라 내고 최신 달을 마지막에 둔다', () => {
        const monthlySchedules = buildUploadedMonthlySchedulesFromParsedWardData(parsed);

        expect(monthlySchedules.map(({year, month}) => `${year}-${month}`)).toEqual(['2026-7', '2026-8', '2026-9']);
        expect(monthlySchedules[0]?.teamSchedules[0]?.rows.map((row) => row.shifts)).toEqual([{'1': 'D'}, {'2': 'E'}]);
        expect(monthlySchedules[2]?.teamSchedules[0]?.rows.map((row) => row.shifts)).toEqual([{'1': 'N'}, {'2': 'D'}]);
        // 그 달에 근무가 없는 사람도 행은 남는다. 빼면 간호사로 등록되지 않는다.
        expect(monthlySchedules[1]?.teamSchedules[0]?.rows.map((row) => [row.name, row.shifts])).toEqual([
            ['김은주', {'1': 'E'}],
            ['이승미', {}],
        ]);
    });

    it('팀과 명단은 한 벌만 만들고 나머지 달은 근무표 칸만 채운다', () => {
        const monthlySchedules = buildUploadedMonthlySchedulesFromParsedWardData(parsed);
        const primary = monthlySchedules[monthlySchedules.length - 1]!;
        const {draft} = applyUploadedScheduleTemplateDraft(createInitialDraft(), {
            fileName: '근무표.xlsx',
            year: primary.year,
            month: primary.month,
            teamSchedules: primary.teamSchedules,
            monthlySchedules,
        });
        const teamId = draft.teams[0]!.id;
        const scheduleInput = draft.scheduleInputs[teamId] ?? {};

        expect(draft.teams).toHaveLength(1);
        expect(draft.nurses.map((nurse) => nurse.name)).toEqual(['김은주', '이승미']);
        expect(Object.keys(scheduleInput).sort()).toEqual(['2026-07', '2026-08', '2026-09']);

        const july = scheduleInput[getScheduleMonthKey(2026, 7)]!;

        expect(july.rows.map((row) => row.shifts)).toEqual([{'1': 'D'}, {'2': 'E'}]);
        // 지난 달 행도 같은 간호사에 매달려야 저장할 때 사람이 복제되지 않는다.
        expect(july.rows.map((row) => row.nurseId)).toEqual(draft.nurses.map((nurse) => nurse.id));
        expect(
            draft.nurses.map((nurse) =>
                draft.shiftTypes
                    .filter((type) => !type.isOff && nurse.possibleShiftTypeIds.includes(type.id))
                    .map((type) => type.shortName),
            ),
        ).toEqual([
            ['D', 'E', 'N'],
            ['D', 'E'],
        ]);
    });
    it('carries the parsed ward team, group and nurse settings with each imported row', () => {
        const {parsedWardData} = buildOnboardingParseDraftInjection(
            {
                teams: [{name: 'A', divisions: [{divisionNum: 1, name: 'RN'}]}, {name: 'B'}],
                nurses: [
                    {
                        name: 'Sam',
                        teamName: 'A',
                        divisionNum: 1,
                        memo: '멘토',
                        isPreceptor: true,
                        employmentDate: '2025-03-01',
                        possibleShiftShortNames: ['D'],
                        assignments: {'2026-11-01': 'D', '2026-12-01': 'D', '2026-12-02': '/'},
                    },
                    {
                        name: 'Sam',
                        teamName: 'B',
                        divisionNum: 2,
                        groupName: 'RN2',
                        isWorker: false,
                        possibleShiftShortNames: ['N'],
                        assignments: {'2026-11-02': 'N', '2026-12-02': 'N'},
                    },
                ],
            },
            'photo.jpg',
        );
        const monthlySchedules = buildUploadedMonthlySchedulesFromParsedWardData(parsedWardData);
        const primary = monthlySchedules[1]!;
        const {draft} = applyUploadedScheduleTemplateDraft(createInitialDraft(), {
            fileName: 'photo.jpg',
            ...primary,
            monthlySchedules: [{...monthlySchedules[0]!, teamSchedules: [...monthlySchedules[0]!.teamSchedules].reverse()}],
        });
        const [teamA, teamB] = draft.teams;
        const [nurseA, nurseB] = draft.nurses;
        const codeById = new Map(draft.shiftTypes.map((shiftType) => [shiftType.id, shiftType.shortName]));

        expect(draft.teams.map((team) => [team.name, team.divisions])).toEqual([
            ['A', [{divisionNum: 1, name: 'RN'}]],
            ['B', [{divisionNum: 1, name: 'RN2'}]],
        ]);
        expect(nurseA).toMatchObject({teamId: teamA!.id, isPreceptor: true, employmentDate: '2025-03-01', memo: '멘토'});
        expect(nurseB).toMatchObject({teamId: teamB!.id, isWorker: false, isPreceptor: false});
        expect(nurseA!.possibleShiftTypeIds.map((id) => codeById.get(id))).toEqual(['D', '/', 'A']);
        expect(nurseB!.possibleShiftTypeIds.map((id) => codeById.get(id))).toEqual(['N', '/', 'A']);
        expect(draft.scheduleInputs[teamA!.id]?.['2026-12']?.rows[0]?.shifts).toEqual({'1': 'D', '2': '/'});
        expect(draft.scheduleInputs[teamB!.id]?.['2026-12']?.rows[0]?.shifts).toEqual({'2': 'N'});
        expect(draft.scheduleInputs[teamB!.id]?.['2026-11']?.rows[0]).toMatchObject({nurseId: nurseB!.id, shifts: {'2': 'N'}});
    });
});
