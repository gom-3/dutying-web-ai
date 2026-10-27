import type {TScheduleViolationDto} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import {scheduleWarningRows} from '../schedule-warning-presentation';
import raw from './fixtures/actual-http-staffing-warnings.json';

const actual = (index = 0) => structuredClone(raw.cases[index]!.violations) as unknown as TScheduleViolationDto[];
const pair = () => [actual()[0]!, actual()[3]!];

function freeze(value: unknown) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
}

describe('staffing warning display projection', () => {
    it.each([0, 1])('projects real HTTP case %s into three concise rows without modifying or dropping server objects', (index) => {
        const source = actual(index);
        const before = JSON.stringify(source);

        freeze(source);

        const rows = scheduleWarningRows(source);

        expect(rows).toHaveLength(3);
        expect(rows.map((row) => row.staffing)).toMatchObject([
            {date: '2026-10-03', shift: 'D', actual: 0, required: 1},
            {date: '2026-10-03', shift: 'E', actual: 0, required: 1},
            {date: '2026-10-03', shift: 'N', actual: 0, required: 1},
        ]);
        expect(rows.map((row) => row.violations.length)).toEqual([2, 2, 2]);
        expect(rows.flatMap((row) => row.violations)).toHaveLength(6);

        for (const issue of source) expect(rows.flatMap((row) => row.violations)).toContain(issue);

        expect(JSON.stringify(source)).toBe(before);
    });
    it.each(['date', 'shift', 'shift-id', 'required', 'actual', 'target-group', 'division', 'severity', 'magnitude'] as const)(
        'does not merge a different %s',
        (field) => {
            const [configured, builtin] = pair();

            if (field === 'date') {
                builtin!.period = {startDate: '2026-10-04', endDate: '2026-10-04', dates: ['2026-10-04']};
                builtin!.comparisonKey![3] = ['2026-10-04', '2026-10-04'];
            }

            if (field === 'shift') {
                builtin!.messageArgs!.shift = 'N12';
                builtin!.comparisonKey![4] = [30];
            }

            if (field === 'shift-id') builtin!.comparisonKey![4] = [99];

            if (field === 'required') builtin!.messageArgs!.expected = 2;

            if (field === 'actual') {
                builtin!.messageArgs!.actual = 1;
                builtin!.messageArgs!.expected = 2;
            }

            if (field === 'target-group') builtin!.comparisonKey![2] = {group: {target: {nurseIds: [1, 2]}, division: null}};

            if (field === 'division') builtin!.comparisonKey![2] = {group: {target: {}, division: 2}};

            if (field === 'severity') builtin!.severity = 'SOFT';

            if (field === 'magnitude') builtin!.magnitude = 2;

            expect(scheduleWarningRows([configured!, builtin!])).toHaveLength(2);
        },
    );
    it.each(['missing-key', 'missing-scope', 'unknown-comparison', 'inconsistent-period'] as const)(
        'keeps separate rows when equivalence cannot be established: %s',
        (scenario) => {
            const source = pair();

            if (scenario === 'missing-key') delete source[1]!.comparisonKey;

            if (scenario === 'missing-scope') source[1]!.comparisonKey![2] = {group: {}};

            if (scenario === 'unknown-comparison') source[1]!.comparisonAvailable = false;

            if (scenario === 'inconsistent-period') source[1]!.period!.startDate = '2026-10-04';

            expect(scheduleWarningRows(source as TScheduleViolationDto[])).toHaveLength(2);
        },
    );
    it('matches explicit group objects regardless of JSON property order', () => {
        const source = pair() as TScheduleViolationDto[];

        source[1]!.comparisonKey![2] = {group: {division: null, target: {}}};
        expect(scheduleWarningRows(source)).toHaveLength(1);
    });
    it('does not collapse two distinct configured rules', () => {
        const source = pair() as TScheduleViolationDto[];

        source[1]!.templateCode = 'MIN_STAFF_BY_SHIFT';
        expect(scheduleWarningRows(source)).toHaveLength(2);
    });
    it('leaves non-staffing warnings and their coordinates intact', () => {
        const other = {...actual()[0]!, templateCode: 'MIN_OFF_AFTER_NIGHT', message: '야간 뒤 휴무가 부족해요.'};
        const rows = scheduleWarningRows([other]);

        expect(rows[0]!.staffing).toBeUndefined();
        expect(rows[0]!.violations[0]).toBe(other);
    });
});
