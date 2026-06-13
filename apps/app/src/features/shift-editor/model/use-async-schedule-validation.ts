import {useEffect, useRef} from 'react';
import {useShiftEditorCommands} from './use-shift-editor-commands';
import {fetchAndApplyScheduleValidation} from './schedule-violations';
import {useShiftEditorStore} from './store';
import {type TShift} from '@/entities';

export type TUseAsyncScheduleValidationParams = {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
    originalShift?: TShift;
    enabled?: boolean;
    debounceMs?: number;
};

/**
 * doc 변경 시 서버에 비동기로 제약조건 검증을 요청한다.
 */
export function useAsyncScheduleValidation(params: TUseAsyncScheduleValidationParams) {
    const {
        wardId,
        shiftTeamId,
        year,
        month,
        originalShift,
        enabled = true,
        debounceMs = 1500,
    } = params;

    const doc = useShiftEditorStore((s) => s.doc);
    const draftRevision = useShiftEditorStore((s) => s.draftRevision);
    const rulesHash = useShiftEditorStore((s) => s.rulesHash);
    const commands = useShiftEditorCommands();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!enabled || !wardId || !shiftTeamId || !originalShift || !rulesHash || draftRevision === 0) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
            await fetchAndApplyScheduleValidation(
                {
                    wardId,
                    doc,
                    originalShift,
                    shiftTeamId,
                    year,
                    month,
                    draftRevision,
                    rulesHash,
                },
                commands.setScheduleValidationFromApi,
                commands.clearScheduleValidationFromApi,
            );
        }, debounceMs);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [doc, draftRevision, rulesHash, enabled, wardId, shiftTeamId, year, month, originalShift, debounceMs, commands]);
}
