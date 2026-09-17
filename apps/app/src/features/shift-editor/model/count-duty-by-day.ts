import type {TWardShiftType} from '@/entities';
import type {TDutyRow} from './types';

export function countDutyByDay(rows: TDutyRow[], dayCount: number, shiftTypes: TWardShiftType[]) {
    const shortNameToId = new Map(shiftTypes.map((type) => [type.shortName, type.wardShiftTypeId]));
    const counts = new Map<number, number[]>();

    for (const type of shiftTypes) {
        if (type.isCounted) counts.set(type.wardShiftTypeId, Array<number>(dayCount).fill(0));
    }

    for (const row of rows) {
        for (let day = 0; day < Math.min(dayCount, row.cells.length); day += 1) {
            const cell = row.cells[day];

            if (!cell) continue;

            const shiftTypeId = shortNameToId.get(cell);
            const dailyCounts = shiftTypeId === undefined ? undefined : counts.get(shiftTypeId);

            if (dailyCounts) dailyCounts[day] += 1;
        }
    }

    return counts;
}
