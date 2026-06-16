import {useQuery} from '@tanstack/react-query';
import {useEffect, useState} from 'react';
import {useLocation, useSearchParams} from 'react-router';
import {getWardDisplayCode, getWardDisplayTitle, wardQueryOptions} from '@/entities/ward';
import useAuth from '@/features/auth';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';
import {useMakeShiftBootstrap} from './model/use-bootstrap';
import {MakeShiftPageView} from './ui';
import MakeTutorial from './ui/make-tutorial';

const ONBOARDING_WARD_CREATED_SEARCH_PARAM = 'onboardingWardCreated';
const ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM = 'onboardingSchedule';

type TMakeShiftLocationState = {
    onboardingWardCreated?: unknown;
    onboardingInitialSchedule?: unknown;
    onboardingInitialSchedules?: unknown;
} | null;

type TOnboardingInitialScheduleTarget = {
    year: number;
    month: number;
    shiftTeamId?: number;
};

function parsePositiveInt(value: unknown): number | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const n = Number(value);

    return Number.isInteger(n) && n > 0 ? n : null;
}

function readScheduleTargetFromState(value: unknown): TOnboardingInitialScheduleTarget | null {
    if (!value || typeof value !== 'object') return null;

    const source = value as Record<string, unknown>;
    const year = parsePositiveInt(source.year);
    const month = parsePositiveInt(source.month);

    if (year === null || month === null || month > 12) return null;

    const shiftTeamId = parsePositiveInt(source.shiftTeamId);

    return {
        year,
        month,
        ...(shiftTeamId !== null ? {shiftTeamId} : {}),
    };
}

function readScheduleTargetsFromState(value: unknown): TOnboardingInitialScheduleTarget[] {
    if (!Array.isArray(value)) return [];

    return value.map(readScheduleTargetFromState).filter((target): target is TOnboardingInitialScheduleTarget => target !== null);
}

function readOnboardingInitialScheduleTarget(
    searchParams: URLSearchParams,
    locationState: TMakeShiftLocationState,
): TOnboardingInitialScheduleTarget | null {
    if (searchParams.get(ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM) === '1') {
        const year = parsePositiveInt(searchParams.get('year'));
        const month = parsePositiveInt(searchParams.get('month'));

        if (year === null || month === null || month > 12) return null;

        const shiftTeamId = parsePositiveInt(searchParams.get('shiftTeamId'));

        return {
            year,
            month,
            ...(shiftTeamId !== null ? {shiftTeamId} : {}),
        };
    }

    return readScheduleTargetFromState(locationState?.onboardingInitialSchedule);
}

function readOnboardingInitialScheduleTargets(
    searchParams: URLSearchParams,
    locationState: TMakeShiftLocationState,
): TOnboardingInitialScheduleTarget[] {
    const stateTargets = readScheduleTargetsFromState(locationState?.onboardingInitialSchedules);

    if (stateTargets.length > 0) {
        return stateTargets;
    }

    const singleTarget = readOnboardingInitialScheduleTarget(searchParams, locationState);

    return singleTarget ? [singleTarget] : [];
}

const MakeShiftPage = () => {
    const {t} = useTypedTranslation();
    const {
        state: {wardId},
    } = useAuth();
    const location = useLocation();
    const locationState = location.state as TMakeShiftLocationState;
    const [searchParams, setSearchParams] = useSearchParams();
    const [showOnboardingWardCodeGuide, setShowOnboardingWardCodeGuide] = useState(false);
    const [onboardingInitialScheduleTargets] = useState(() => readOnboardingInitialScheduleTargets(searchParams, locationState));
    const onboardingInitialScheduleTarget = onboardingInitialScheduleTargets[0] ?? null;
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });

    useMakeShiftBootstrap(wardId, {
        initialScheduleTarget: onboardingInitialScheduleTarget,
        initialScheduleTargets: onboardingInitialScheduleTargets,
    });

    useEffect(() => {
        const shouldOpenGuide = searchParams.get(ONBOARDING_WARD_CREATED_SEARCH_PARAM) === '1';
        const shouldClearInitialSchedule = searchParams.get(ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM) === '1';

        if (!shouldOpenGuide && !shouldClearInitialSchedule) {
            return;
        }

        if (shouldOpenGuide) {
            setShowOnboardingWardCodeGuide(true);
        }

        const nextSearchParams = new URLSearchParams(searchParams);

        nextSearchParams.delete(ONBOARDING_WARD_CREATED_SEARCH_PARAM);
        nextSearchParams.delete(ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM);
        setSearchParams(nextSearchParams, {replace: true});
    }, [searchParams, setSearchParams]);

    return (
        <>
            <WardCodeGuideModal
                open={showOnboardingWardCodeGuide}
                wardCode={getWardDisplayCode(wardQuery.data, t('page.makeShift.wardCodeLoading'))}
                wardTitle={getWardDisplayTitle(wardQuery.data)}
                onClose={() => setShowOnboardingWardCodeGuide(false)}
            />
            <MakeShiftPageView />
            <MakeTutorial />
        </>
    );
};

export default MakeShiftPage;
