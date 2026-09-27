import type {TAutofillResponse} from '@dutying/api/ward';
import type {TDutyDoc} from '@/features/shift-editor/model/types';

export type CommercialBatchResult = {
    requestKey: string;
    targets: {shiftTeamId: number; year: number; month: number}[];
    jobs: {id: string; shiftTeamId: number; status: string; result?: string}[];
};

/** A persisted result is a preview, never permission to overwrite a different roster or protected cells. */
export function batchCellsForReview(batch: CommercialBatchResult, teamId: number, year: number, month: number, doc: TDutyDoc) {
    if (!batch.targets.some((t) => t.shiftTeamId === teamId && t.year === year && t.month === month)) throw Error('BATCH_SCOPE_CHANGED');
    const job = batch.jobs.find((j) => j.shiftTeamId === teamId);
    if (job?.status !== 'SUCCEEDED' || !job.result) throw Error('BATCH_RESULT_UNAVAILABLE');
    const response = JSON.parse(job.result) as TAutofillResponse;
    const rows = new Set(doc.rows.map((r) => r.workerId));
    const dates = new Set(doc.columns);
    if (!Array.isArray(response.changedCells) || response.changedCells.some((c) => !rows.has(String(c.shiftNurseId)) || !dates.has(c.date)))
        throw Error('BATCH_ROSTER_CHANGED');
    return response.changedCells.filter(
        (c) => !doc.fixedCells[`${c.shiftNurseId}|${c.date}`] && !doc.requestCells[`${c.shiftNurseId}|${c.date}`],
    );
}
