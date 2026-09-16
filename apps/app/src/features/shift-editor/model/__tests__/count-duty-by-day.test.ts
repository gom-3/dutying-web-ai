import {describe, expect, it} from 'vitest';
import type {TWardShiftType} from '@/entities';
import {countDutyByDay} from '../count-duty-by-day';
import type {TDutyRow} from '../types';

const shiftType = (wardShiftTypeId: number, shortName: string, isCounted = true): TWardShiftType => ({
    wardShiftTypeId,
    shortName,
    name: shortName,
    isCounted,
    isOff: !isCounted,
    isDefault: false,
    color: '#000000',
    startTime: '',
    endTime: '',
    classification: isCounted ? 'DAY' : 'OFF',
});

describe('countDutyByDay', () => {
    it('counts each day without including empty, unknown, or uncounted cells', () => {
        const rows: TDutyRow[] = [
            {workerId: '1', cells: ['D', 'N', null, 'O', 'D']},
            {workerId: '2', cells: ['D', 'D', '', 'unknown']},
            {workerId: '3', cells: ['N']},
        ];
        const types = [shiftType(1, 'D'), shiftType(2, 'N'), shiftType(3, 'O', false)];

        expect(countDutyByDay(rows, 4, types)).toEqual(
            new Map([
                [1, [2, 1, 0, 0]],
                [2, [1, 1, 0, 0]],
            ]),
        );
        expect(countDutyByDay([], 2, types)).toEqual(
            new Map([
                [1, [0, 0]],
                [2, [0, 0]],
            ]),
        );
    });

    it('matches the original per-type filter, including duplicate short names and edited cells', () => {
        const types = [shiftType(1, 'D'), shiftType(2, 'N'), shiftType(3, 'O', false), shiftType(4, 'D')];
        const cellValues = ['D', 'N', 'O', '', null, 'unknown'];
        const rows = Array.from({length: 80}, (_, row) => ({
            workerId: String(row),
            cells: Array.from({length: 31}, (_, day) => cellValues[(row * 7 + day) % cellValues.length]),
        }));
        const typeByShortName = new Map(types.map((type) => [type.shortName, type]));

        for (const currentRows of [rows, rows.map((row, index) => (index === 0 ? {...row, cells: ['N', ...row.cells.slice(1)]} : row))]) {
            const counts = countDutyByDay(currentRows, 31, types);

            for (const type of types.filter((item) => item.isCounted)) {
                for (let day = 0; day < 31; day += 1) {
                    const expected = currentRows.filter((row) => {
                        const cell = row.cells[day];

                        return Boolean(cell) && typeByShortName.get(cell!)?.wardShiftTypeId === type.wardShiftTypeId;
                    }).length;

                    expect(counts.get(type.wardShiftTypeId)?.[day]).toBe(expected);
                }
            }
        }
    });
});
