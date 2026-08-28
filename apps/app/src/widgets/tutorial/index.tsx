import {Suspense, lazy} from 'react';
import {useLocation} from 'react-router';
import ROUTE from '@/shared/constant/path';

const MemberTutorial = lazy(() => import('./MemberTutorial'));
const RequestTutorial = lazy(() => import('./RequestTutorial'));

const TUTORIAL_BY_ROUTE = {
    [ROUTE.REQUEST]: RequestTutorial,
    [ROUTE.MEMBER]: MemberTutorial,
} as const;
const Tutorial = () => {
    const {pathname} = useLocation();
    const TutorialComponent = TUTORIAL_BY_ROUTE[pathname as keyof typeof TUTORIAL_BY_ROUTE];

    return TutorialComponent ? (
        <Suspense fallback={null}>
            <TutorialComponent />
        </Suspense>
    ) : null;
};

export default Tutorial;
