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

type TMakeShiftLocationState = {
    onboardingWardCreated?: unknown;
} | null;

const MakeShiftPage = () => {
    const {
        state: {wardId},
    } = useAuth();
    const location = useLocation();
    const locationState = location.state as TMakeShiftLocationState;
    const [searchParams, setSearchParams] = useSearchParams();
    const [showOnboardingWardCodeGuide, setShowOnboardingWardCodeGuide] = useState(false);
    const enteredFromOnboardingWardCreated =
        searchParams.get(ONBOARDING_WARD_CREATED_SEARCH_PARAM) === '1' || Boolean(locationState?.onboardingWardCreated);
    const wardQuery = useQuery({
        ...wardQueryOptions.id(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });

    useMakeShiftBootstrap(wardId, {preferNextMonth: enteredFromOnboardingWardCreated});

    useEffect(() => {
        if (searchParams.get(ONBOARDING_WARD_CREATED_SEARCH_PARAM) !== '1') {
            return;
        }

        setShowOnboardingWardCodeGuide(true);

        const nextSearchParams = new URLSearchParams(searchParams);

        nextSearchParams.delete(ONBOARDING_WARD_CREATED_SEARCH_PARAM);
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
