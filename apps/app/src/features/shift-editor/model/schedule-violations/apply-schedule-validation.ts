import type {TValidationRes} from '@dutying/api/ward';
import {refreshScheduleViolations, type TRefreshScheduleViolationsParams} from './refresh-schedule-violations';
import {useShiftEditorStore} from '../store';

/**
 * validate-snapshot을 호출하고, 요청 시점·응답 시점 draftRevision이 모두 최신이면 콜백으로 반영한다.
 */
export async function fetchAndApplyScheduleValidation(
    params: TRefreshScheduleViolationsParams,
    apply: (validation: TValidationRes) => void,
    onUnavailable?: () => void,
): Promise<boolean> {
    const requestedRevision = params.draftRevision;
    const result = await refreshScheduleViolations(params);
    const currentRevision = useShiftEditorStore.getState().draftRevision;

    if (!result) {
        if (currentRevision === requestedRevision) onUnavailable?.();
        return false;
    }

    if (result.draftRevision !== requestedRevision || result.draftRevision !== currentRevision) {
        return false;
    }

    apply(result);

    return true;
}
