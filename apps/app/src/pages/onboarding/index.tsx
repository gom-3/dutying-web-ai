import {Navigate} from 'react-router';
import useAuth from '@/features/auth';
import RegisterShell from '@/pages/register/ui/register-shell';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

function OnboardingPage() {
    const {t} = useTypedTranslation();
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe},
    } = useAuth();
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';
    const redirectTarget = accountMe?.status === 'LINKED' || accountMe?.status === 'DEMO' ? ROUTE.MAKE : ROUTE.REGISTER;

    return (
        <RegisterShell>
            {isAccountBootstrapPending ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center">
                    <LoadingSpinner size={56} />
                </div>
            ) : isAccountBootstrapError ? (
                <div className="flex min-h-[420px] items-center justify-center">
                    <PageState
                        tone="error"
                        title={t('page.register.state.accountErrorTitle')}
                        description={t('page.register.state.accountErrorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                        className="py-0"
                    />
                </div>
            ) : (
                <Navigate to={redirectTarget} replace />
            )}
        </RegisterShell>
    );
}

export default OnboardingPage;
