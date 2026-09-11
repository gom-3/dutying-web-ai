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
};

/**
 * 이 달에 걸린 조절 요청 목록. 칩 상태는 이 목록에서 유도한다 —
 * 요청은 서버 상태이므로 새로고침·"다시 생성" 뒤에도 그대로다.
 */
export function useScheduleMonthRequests({wardId, shiftTeamId, year, month, enabled}: TScope) {
    const [requests, setRequests] = useState<TScheduleMonthRequestRes[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const seqRef = useRef(0);
    const scopeKey = `${wardId ?? 'none'}:${shiftTeamId ?? 'none'}:${year}:${month}`;
    const refetch = useCallback(async () => {
        if (!enabled || wardId == null || shiftTeamId == null) return;

        const seq = seqRef.current + 1;

        seqRef.current = seq;
        setIsLoading(true);

        try {
            const result = await WardAPI.getScheduleMonthRequests(wardId, shiftTeamId, year, month);

            if (seqRef.current !== seq) return;

            setRequests(result.requests ?? []);
        } catch {
            // 목록을 못 읽어도 조절 자체는 된다. 칩은 서버 상태를 모르는 채로 남을 뿐이다.
        } finally {
            if (seqRef.current === seq) setIsLoading(false);
        }
    }, [enabled, month, shiftTeamId, wardId, year]);

    useEffect(() => {
        seqRef.current += 1;
        setRequests([]);

        void refetch();
        // scopeKey 가 바뀔 때만 새로 읽는다. refetch 는 그 값들로 만들어지므로 같은 조건이다.
    }, [scopeKey, enabled]);

    return {requests, isLoading, refetch};
}

/**
 * 직전 달의 "이번 달만" 요청. 근무표 만들기 진입 시 한 번 묻고, 답하면 세션 동안 다시 묻지 않는다.
 */
export function useScheduleCarryOverCandidates({wardId, shiftTeamId, year, month, enabled}: TScope) {
    const [candidates, setCandidates] = useState<TScheduleMonthRequestRes[]>([]);
    const [answered, setAnswered] = useState(true);
    const seqRef = useRef(0);
    const scopeKey = `${wardId ?? 'none'}:${shiftTeamId ?? 'none'}:${year}:${month}`;

    useEffect(() => {
        const seq = seqRef.current + 1;

        seqRef.current = seq;
        setCandidates([]);

        if (!enabled || wardId == null || shiftTeamId == null) {
            setAnswered(true);

            return;
        }

        const alreadyAnswered = isCarryOverAnswered({wardId, shiftTeamId, year, month});

        setAnswered(alreadyAnswered);

        if (alreadyAnswered) return;

        WardAPI.getScheduleCarryOverCandidates(wardId, shiftTeamId, year, month)
            .then((result) => {
                if (seqRef.current !== seq) return;

                setCandidates(result.requests ?? []);
            })
            .catch(() => {
                // 되묻기는 부가 기능이다. 못 읽으면 조용히 묻지 않는다.
            });
    }, [scopeKey, enabled]);

    const dismiss = useCallback(() => {
        setAnswered(true);
        setCandidates([]);
    }, []);

    return {candidates, isVisible: !answered && candidates.length > 0, dismiss};
}
