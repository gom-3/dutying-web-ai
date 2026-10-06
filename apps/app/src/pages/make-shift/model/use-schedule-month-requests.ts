import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {useCallback, useEffect, useRef, useState} from 'react';
import WardAPI from '@/shared/api/ward';
import {isCarryOverAnswered} from './schedule-month-requests';

type TScope = {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
    enabled: boolean;
    accountId?: number | null;
};

/**
 * 이 달에 걸린 조절 요청 목록. 칩 상태는 이 목록에서 유도한다 —
 * 요청은 서버 상태이므로 새로고침·"다시 생성" 뒤에도 그대로다.
 */
export function useScheduleMonthRequests({wardId, shiftTeamId, year, month, enabled}: TScope) {
    const [requests, setRequests] = useState<TScheduleMonthRequestRes[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const seqRef = useRef(0);
    const scopeKey = `${wardId ?? 'none'}:${shiftTeamId ?? 'none'}:${year}:${month}`;
    const refetch = useCallback(async () => {
        if (!enabled || wardId == null || shiftTeamId == null) return;

        const seq = seqRef.current + 1;

        seqRef.current = seq;
        setIsLoading(true);
        setIsError(false);

        try {
            const result = await WardAPI.getScheduleMonthRequests(wardId, shiftTeamId, year, month);

            if (seqRef.current !== seq) return;

            setRequests(result.requests ?? []);

            return result.requests ?? [];
        } catch {
            if (seqRef.current === seq) setIsError(true);
        } finally {
            if (seqRef.current === seq) setIsLoading(false);
        }
    }, [enabled, month, shiftTeamId, wardId, year]);

    useEffect(() => {
        seqRef.current += 1;
        setRequests([]);

        void refetch();

        return () => {
            seqRef.current += 1;
        };
        // scopeKey 가 바뀔 때만 새로 읽는다. refetch 는 그 값들로 만들어지므로 같은 조건이다.
    }, [scopeKey, enabled]);

    return {requests, isLoading, isError, refetch};
}

/** Load once per account, team and month; preparation waits for this result before continuing. */
export function useScheduleCarryOverCandidates({wardId, shiftTeamId, year, month, enabled, accountId}: TScope) {
    const scopeKey = `${accountId ?? 'guest'}:${wardId ?? 'none'}:${shiftTeamId ?? 'none'}:${year}:${month}`;
    const [state, setState] = useState<{
        scope: string;
        candidates: TScheduleMonthRequestRes[];
        answered: boolean;
        loading: boolean;
        error: boolean;
    }>({scope: '', candidates: [], answered: false, loading: false, error: false});
    const seqRef = useRef(0);
    const available = enabled && wardId != null && shiftTeamId != null;
    const refetch = useCallback(async () => {
        const seq = ++seqRef.current;
        const answered =
            !enabled || wardId == null || shiftTeamId == null || isCarryOverAnswered({accountId, wardId, shiftTeamId, year, month});

        setState({scope: scopeKey, candidates: [], answered, loading: !answered, error: false});

        if (answered || wardId == null || shiftTeamId == null) return;

        try {
            const result = await WardAPI.getScheduleCarryOverCandidates(wardId, shiftTeamId, year, month);

            if (seqRef.current === seq)
                setState({scope: scopeKey, candidates: result.requests ?? [], answered: false, loading: false, error: false});
        } catch {
            if (seqRef.current === seq) setState({scope: scopeKey, candidates: [], answered: false, loading: false, error: true});
        }
    }, [scopeKey, enabled, accountId, wardId, shiftTeamId, year, month]);

    useEffect(() => {
        void refetch();

        return () => {
            seqRef.current += 1;
        };
    }, [refetch]);

    const dismiss = useCallback(() => {
        seqRef.current += 1;
        setState({scope: scopeKey, candidates: [], answered: true, loading: false, error: false});
    }, [scopeKey]);
    const current = state.scope === scopeKey;

    return {
        candidates: current && available ? state.candidates : [],
        needsReview: available && (!current || !state.answered),
        isLoading: available && (!current || state.loading),
        isError: available && current && state.error,
        retry: refetch,
        dismiss,
    };
}
