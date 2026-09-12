import {describe, expect, it} from 'vitest';
import {buildUploadedMonthlySchedulesFromParsedWardData} from '../adapter';
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
    });
});
