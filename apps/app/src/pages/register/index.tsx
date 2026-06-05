import {useEffect, useState} from 'react';
import {Navigate} from 'react-router';
import {useLocation} from 'react-router';
import {match} from 'ts-pattern';
import useAuth from '@/features/auth';
import {getIsSocialSignupPath, readSocialSignupProfile} from '@/features/auth/model/social-signup';
import ROUTE from '@/shared/constant/path';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';
import PendingEnter from './ui/pending-enter';
import RegisterNurse from './ui/register-nurse';
import RegisterShell from './ui/register-shell';
import SelectEnterOrCreate from './ui/select-enter-or-create';

type TRegisterLocationState = {
    fromQuitWard?: boolean;
} | null;

function RegisterPage() {
    const {
        state: {accountMe, accountMeStatus, _loaded},
        actions: {handleGetAccountMe},
    } = useAuth();
    const {state: locationState, search} = useLocation();
    const isFromQuitWard = (locationState as TRegisterLocationState)?.fromQuitWard === true;
    const isAccountBootstrapPending = !_loaded || accountMeStatus === 'idle' || accountMeStatus === 'loading';
    const isAccountBootstrapError = accountMeStatus === 'error';
    const isSocialSignup = getIsSocialSignupPath(search) || Boolean(readSocialSignupProfile());
    const accountStatus = accountMe?.status as string | undefined;
    const shouldCollectContact = accountStatus === 'WORKSPACE_SETUP_PENDING' && !accountMe?.phoneNum;
    const [stepOverride, setStepOverride] = useState<'nurse-info' | null>(null);

    useEffect(() => {
        if (accountStatus !== 'WARD_SELECT_PENDING' && accountStatus !== 'WORKSPACE_SETUP_PENDING') {
            setStepOverride(null);
        }
    }, [accountStatus]);

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
                match(accountStatus)
                    .with('INITIAL', 'NURSE_INFO_PENDING', () => <RegisterNurse mode={isSocialSignup ? 'social' : 'default'} />)
                    .with('WARD_SELECT_PENDING', 'WORKSPACE_SETUP_PENDING', () =>
                        stepOverride === 'nurse-info' || shouldCollectContact ? (
                            <RegisterNurse
                                mode={shouldCollectContact && isSocialSignup ? 'social' : 'default'}
                                onCompleted={() => setStepOverride(null)}
                            />
                        ) : (
                            <SelectEnterOrCreate
                                onBack={isSocialSignup || isFromQuitWard ? undefined : () => setStepOverride('nurse-info')}
                            />
                        ),
                    )
                    .with('WARD_ENTRY_PENDING', () => <PendingEnter />)
                    .with('LINKED', () => <Navigate to={ROUTE.MAKE} />)
                    .with('DEMO', () => <Navigate to={ROUTE.MAKE} />)
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
