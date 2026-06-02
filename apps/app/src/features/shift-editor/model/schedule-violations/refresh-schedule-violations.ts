import type {TValidationRes} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import WardAPI from '@/shared/api/ward';
import {buildValidateSnapshotDTO} from '../schedule-authoring';
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
export async function refreshScheduleViolations(params: TRefreshScheduleViolationsParams): Promise<TValidationRes | null> {
    const {wardId, doc, originalShift, shiftTeamId, year, month, draftRevision, rulesHash} = params;

    const dto = buildValidateSnapshotDTO({year, month, draftRevision, rulesHash, doc, originalShift});

    try {
        return await WardAPI.validateSnapshot(wardId, shiftTeamId, dto);
    } catch {
        return null;
    }
}
