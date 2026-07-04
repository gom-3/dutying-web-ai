import {useEffect} from 'react';
import {useSearchParams} from 'react-router';
import {useMakeShiftStore} from './make-shift-store';

const ROUTE_SYNC_ONETIME_PARAMS = ['onboardingWardCreated', 'onboardingSchedule'];

function setNumericParam(params: URLSearchParams, key: string, value: number | null) {
    if (value === null) {
        params.delete(key);

        return;
    }

    params.set(key, String(value));
}

export function useMakeShiftRouteSync() {
    const [searchParams, setSearchParams] = useSearchParams();
    const isHydrated = useMakeShiftStore((s) => s.isHydrated);
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);

    useEffect(() => {
        if (!isHydrated) return;

        const nextSearchParams = new URLSearchParams(searchParams);

        nextSearchParams.set('year', String(year));
        nextSearchParams.set('month', String(month));
        setNumericParam(nextSearchParams, 'shiftTeamId', currentShiftTeamId);

        if (phase === 'stepping') {
            nextSearchParams.set('step', String(currentStep));
        } else {
            nextSearchParams.delete('step');
        }

        ROUTE_SYNC_ONETIME_PARAMS.forEach((key) => nextSearchParams.delete(key));

        if (nextSearchParams.toString() !== searchParams.toString()) {
            setSearchParams(nextSearchParams, {replace: true});
        }
    }, [currentShiftTeamId, currentStep, isHydrated, month, phase, searchParams, setSearchParams, year]);
}
