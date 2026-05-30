import {Navigate} from 'react-router';
import ROUTE from '@/shared/constant/path';

export default function EnterWardRedirectPage() {
    return <Navigate to={ROUTE.ONBOARDING_JOIN_WARD} replace />;
}
