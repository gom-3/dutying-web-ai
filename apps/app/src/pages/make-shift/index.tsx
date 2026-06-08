import {useQuery} from '@tanstack/react-query';
import {useEffect, useState} from 'react';
import {useLocation, useSearchParams} from 'react-router';
import {getWardDisplayCode, getWardDisplayTitle, wardQueryOptions} from '@/entities/ward';
import useAuth from '@/features/auth';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';
import {useMakeShiftBootstrap} from './model/use-bootstrap';
import {MakeShiftPageView} from './ui';
import MakeTutorial from './ui/make-tutorial';

const ONBOARDING_WARD_CREATED_SEARCH_PARAM = 'onboardingWardCreated';
const ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM = 'onboardingSchedule';

type TMakeShiftLocationState = {
    onboardingWardCreated?: unknown;
    onboardingInitialSchedule?: unknown;
} | null;

const MakeShiftPage = () => {
    const {
        state: {wardId},
    } = useAuth();
    const location = useLocation();
    const locationState = location.state as TMakeShiftLocationState;
    const [searchParams, setSearchParams] = useSearchParams();
    const [showOnboardingWardCodeGuide, setShowOnboardingWardCodeGuide] = useState(false);
    const [enteredFromOnboardingWardCreated] = useState(
        () => searchParams.get(ONBOARDING_WARD_CREATED_SEARCH_PARAM) === '1' || Boolean(locationState?.onboardingWardCreated),
    );
    const [enteredFromOnboardingInitialSchedule] = useState(
        () => searchParams.get(ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM) === '1' || Boolean(locationState?.onboardingInitialSchedule),
    );
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });

    useMakeShiftBootstrap(wardId, {
        preferNextMonth: enteredFromOnboardingWardCreated && !enteredFromOnboardingInitialSchedule,
        confirmExistingShift: enteredFromOnboardingInitialSchedule,
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
                wardCode={getWardDisplayCode(wardQuery.data, '확인 중')}
                wardTitle={getWardDisplayTitle(wardQuery.data)}
                onClose={() => setShowOnboardingWardCodeGuide(false)}
            />
            <MakeShiftPageView />
            <MakeTutorial />
        </>
    );
};

export default MakeShiftPage;
