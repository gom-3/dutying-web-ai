import {Navigate} from 'react-router';
import {match} from 'ts-pattern';
import useAuth from '@/features/auth';
import RegisterAdminWorkspace from '@/pages/register/ui/register-admin-workspace';
import RegisterShell from '@/pages/register/ui/register-shell';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

function OnboardingCreateWardPage() {
    const {t} = useTypedTranslation();
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe},
    } = useAuth();
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';

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
                match(accountMe?.status)
                    .with('LINKED', () => <Navigate to={ROUTE.MAKE} replace />)
                    .with('DEMO', () => <Navigate to={ROUTE.MAKE} replace />)
                    .otherwise(() => <RegisterAdminWorkspace />)
            )}
        </RegisterShell>
    );
}

export default OnboardingCreateWardPage;
