import type {TDay, TShift} from '@/entities/shift';
import type {TDutyDoc} from '@/features/shift-editor/model/types';

/** Older drafts may not include the roster; reconstruct only from their captured data. */
export function localScheduleSnapshot(doc: TDutyDoc, shift?: TShift) {
    if (shift) return {doc, shift};

    const day = (date: string): TDay => {
        const value = new Date(`${date}T00:00:00Z`);

        return {day: value.getUTCDate(), dayType: value.getUTCDay() === 0 ? 'sunday' : value.getUTCDay() === 6 ? 'saturday' : 'workday'};
    };
    const codes = [...new Set(doc.rows.flatMap((row) => [...row.cells, ...(row.lastCells ?? [])]).filter((code) => code !== null))];
    const lastCount = Math.max(0, ...doc.rows.map((row) => row.lastCells?.length ?? 0));
    const first = new Date(`${doc.columns[0]}T00:00:00Z`);
    const fallback: TShift = {
        days: doc.columns.map(day),
        lastDays: Array.from({length: lastCount}, (_, index) =>
            day(new Date(first.getTime() - (lastCount - index) * 86400000).toISOString().slice(0, 10)),
        ),
        wardShiftTypes: codes.map((code, index) => ({
            wardShiftTypeId: doc.shiftTypeRefs?.find((type) => type.shortName === code)?.wardShiftTypeId ?? -(index + 1),
            name: code,
            shortName: code,
            startTime: '',
            endTime: '',
            color: '#626D7A',
            isDefault: true,
            isOff: code === 'O' || code === '/',
            isCounted: true,
            classification: doc.shiftTypeRefs?.find((type) => type.shortName === code)?.classification ?? 'DAY',
        })),
        divisionShiftNurses: [
            doc.rows.map((row, index) => ({
                shiftNurse: {
                    shiftNurseId: Number(row.workerId),
                    nurseId: doc.workerMeta[row.workerId]?.nurseId ?? Number(row.workerId),
                    name: doc.workerMeta[row.workerId]?.name ?? row.workerId,
                    carried: 0,
                    isWorker: true,
                    priority: doc.workerMeta[row.workerId]?.priority ?? index,
                    divisionNum: doc.workerMeta[row.workerId]?.divisionNum ?? 0,
                    divisionName: doc.workerMeta[row.workerId]?.divisionName,
                },
                wardShiftList: doc.columns.map(() => null),
                wardReqShiftList: doc.columns.map(() => null),
                lastWardShiftList: Array.from({length: lastCount}, () => null),
                lastWardReqShiftList: Array.from({length: lastCount}, () => null),
            })),
        ],
    };

    return {doc, shift: fallback};
}
