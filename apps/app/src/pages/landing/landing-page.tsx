import useAuth from '@/features/auth';
import LandingPageView from './landing-page-view';

export default function LandingPage() {
    const {
        state: {accountMe, isAuth},
        actions: {handleLogout},
    } = useAuth();

    return <LandingPageView accountMe={accountMe} isAuth={isAuth} onLogout={handleLogout} />;
}
