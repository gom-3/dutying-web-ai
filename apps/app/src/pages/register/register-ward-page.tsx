import {Navigate} from 'react-router';
import ROUTE from '@/shared/constant/path';

export default function RegisterWardRedirectPage() {
    return <Navigate to={ROUTE.ONBOARDING_CREATE_WARD} replace />;
}
