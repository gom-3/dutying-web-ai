import {Navigate} from 'react-router';
import useAuth from '@/features/auth';
import RegisterShell from '@/pages/register/ui/register-shell';
import ROUTE from '@/shared/constant/path';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

function OnboardingPage() {
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
                        title="계정 정보를 불러오지 못했어요"
                        description="잠시 후 다시 시도해 주세요. 문제가 계속되면 다시 로그인해 주세요."
                        action={{label: '다시 시도', onClick: () => void handleGetAccountMe().catch(() => undefined)}}
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
