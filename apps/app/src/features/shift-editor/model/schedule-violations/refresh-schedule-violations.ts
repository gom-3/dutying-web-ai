import {type TAiValidation, type TValidateSnapshotDTO} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import WardAPI from '@/shared/api/ward';
import {docToSnapshotCellsDTO, docToSnapshotRowOrderDTO} from '../shift-adapter';
import type {TDutyDoc} from '../types';

export type TRefreshScheduleViolationsParams = {
    wardId: number;
    doc: TDutyDoc;
    originalShift: TShift;
    shiftTeamId: number;
    year: number;
    month: number;
    draftRevision: number;
    rulesHash: string;
};

/**
 * 재진입·수동 편집 후 서버에서 제약 위반을 다시 계산한다.
 *
 * @returns 갱신된 validation.
 */
export async function refreshScheduleViolations(params: TRefreshScheduleViolationsParams): Promise<TAiValidation | null> {
    const {wardId, doc, originalShift, shiftTeamId, year, month, draftRevision, rulesHash} = params;

    const dto: TValidateSnapshotDTO = {
        yearMonth: `${year}-${String(month).padStart(2, '0')}`,
        draftRevision,
        rulesHash,
        cells: docToSnapshotCellsDTO(doc, originalShift),
        rowOrder: docToSnapshotRowOrderDTO(doc),
    };

    try {
        return await WardAPI.validateSnapshot(wardId, shiftTeamId, dto);
    } catch {
        return null;
    }
}
