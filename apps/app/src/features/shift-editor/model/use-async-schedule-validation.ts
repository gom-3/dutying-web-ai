import {useEffect, useRef, useState} from 'react';
import {type TShift} from '@/entities';
import {fetchAndApplyScheduleValidation} from './schedule-violations';
import {isDutyDocInScheduleScope} from './shift-adapter';
import {useShiftEditorStore} from './store';
import {useShiftEditorCommands} from './use-shift-editor-commands';

export type TUseAsyncScheduleValidationParams = {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
    originalShift?: TShift;
    enabled?: boolean;
    debounceMs?: number;
};

export type TAsyncScheduleValidationStatus = 'idle' | 'validating' | 'valid' | 'error';

/**
 * doc 변경 시 서버에 비동기로 제약조건 검증을 요청한다.
 */
export function useAsyncScheduleValidation(params: TUseAsyncScheduleValidationParams) {
    const {wardId, shiftTeamId, year, month, originalShift, enabled = true, debounceMs = 1000} = params;
    const doc = useShiftEditorStore((s) => s.doc);
    const draftRevision = useShiftEditorStore((s) => s.draftRevision);
    const rulesHash = useShiftEditorStore((s) => s.rulesHash);
    const commands = useShiftEditorCommands();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSeqRef = useRef(0);
    const applyValidationRef = useRef(commands.setScheduleValidationFromApi);
    const clearValidationRef = useRef(commands.clearScheduleValidationFromApi);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [status, setStatus] = useState<TAsyncScheduleValidationStatus>('idle');

    applyValidationRef.current = commands.setScheduleValidationFromApi;
    clearValidationRef.current = commands.clearScheduleValidationFromApi;

    useEffect(() => {
        const requestSeq = requestSeqRef.current + 1;

        requestSeqRef.current = requestSeq;

        if (timerRef.current) clearTimeout(timerRef.current);

        abortControllerRef.current?.abort();
        abortControllerRef.current = null;

        if (
            !enabled ||
            !wardId ||
            !shiftTeamId ||
            !originalShift ||
            !rulesHash ||
            draftRevision === 0 ||
            !isDutyDocInScheduleScope(doc, originalShift, year, month)
        ) {
            setStatus('idle');

            return;
        }

        setStatus('validating');

        timerRef.current = setTimeout(async () => {
            const abortController = new AbortController();

            abortControllerRef.current = abortController;

            const applied = await fetchAndApplyScheduleValidation(
                {
                    wardId,
                    doc,
                    originalShift,
                    shiftTeamId,
                    year,
                    month,
                    draftRevision,
                    rulesHash,
                    signal: abortController.signal,
                },
                applyValidationRef.current,
                clearValidationRef.current,
            );

            if (requestSeqRef.current !== requestSeq) return;

            if (useShiftEditorStore.getState().draftRevision !== draftRevision) return;

            setStatus(applied ? 'valid' : 'error');
        }, debounceMs);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);

            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
        };
    }, [doc, draftRevision, rulesHash, enabled, wardId, shiftTeamId, year, month, originalShift, debounceMs]);

    return {status};
}
