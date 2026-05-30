import {Navigate} from 'react-router';
import {match} from 'ts-pattern';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';
import RegisterShell from './ui/register-shell';

function RegisterPage() {
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
                        title="계정 정보를 불러오지 못했어요"
                        description="잠시 후 다시 시도해 주세요. 문제가 계속되면 다시 로그인해 주세요."
                        action={{label: '다시 시도', onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                        className="py-0"
                    />
                </div>
            ) : (
                match(accountMe?.status)
                    .with('LINKED', () => <Navigate to={ROUTE.MAKE} />)
                    .with('DEMO', () => <Navigate to={ROUTE.MAKE} />)
                    .with('INITIAL', 'NURSE_INFO_PENDING', 'WARD_SELECT_PENDING', 'WARD_ENTRY_PENDING', 'WORKSPACE_SETUP_PENDING', () => (
                        <Navigate to={ROUTE.ONBOARDING_CREATE_WARD} replace />
                    ))
                    .otherwise(() => (
                        <div className="flex min-h-[420px] items-center justify-center">
                            <PageState
                                tone="error"
                                title="계정 상태를 확인하지 못했어요"
                                description="계정 정보를 다시 불러온 뒤 등록 절차를 이어가세요."
                                action={{label: '다시 시도', onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                                className="py-0"
                            />
                        </div>
                    ))
            )}
        </RegisterShell>
    );
}

export default RegisterPage;
