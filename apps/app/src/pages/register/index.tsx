import {useEffect, useState} from 'react';
import {Navigate} from 'react-router';
import {useLocation} from 'react-router';
import {match} from 'ts-pattern';
import useAuth from '@/features/auth';
import {getIsSocialSignupPath, readSocialSignupProfile} from '@/features/auth/model/social-signup';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
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
    const {t} = useTypedTranslation();
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
                        title={t('page.register.state.accountErrorTitle')}
                        description={t('page.register.state.accountErrorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void handleGetAccountMe().catch(() => undefined)}}
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
                    .with('LINKED', () => <Navigate to={ROUTE.HOME} />)
                    .with('DEMO', () => <Navigate to={ROUTE.HOME} />)
                    .otherwise(() => (
                        <div className="flex min-h-[420px] items-center justify-center">
                            <PageState
                                tone="error"
                                title={t('page.register.state.statusErrorTitle')}
                                description={t('page.register.state.statusErrorDescription')}
                                action={{label: t('page.state.retry'), onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                                className="py-0"
                            />
                        </div>
                    ))
            )}
        </RegisterShell>
    );
}

export default RegisterPage;
