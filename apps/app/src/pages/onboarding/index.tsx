import {ArrowLeft, Building2, ChevronRight, DoorOpen} from 'lucide-react';
import {Navigate, useNavigate} from 'react-router';
import {match} from 'ts-pattern';
import useAuth from '@/features/auth';
import RegisterShell from '@/pages/register/ui/register-shell';
import ROUTE from '@/shared/constant/path';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

function OnboardingPage() {
    const navigate = useNavigate();
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
                        title="怨꾩젙 ?뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?댁슂"
                        description="?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭?? 臾몄젣媛 怨꾩냽?섎㈃ ?ㅼ떆 濡쒓렇?명빐 二쇱꽭??"
                        action={{label: '?ㅼ떆 ?쒕룄', onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                        className="py-0"
                    />
                </div>
            ) : (
                match(accountMe?.status)
                    .with('LINKED', () => <Navigate to={ROUTE.MAKE} replace />)
                    .with('DEMO', () => <Navigate to={ROUTE.MAKE} replace />)
                    .otherwise(() => (
                        <div className="flex w-full flex-col">
                            <button
                                type="button"
                                className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                                onClick={() => navigate(-1)}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                怨꾩젙 ?뺣낫濡?                            </button>

                            <div>
                                <h1 className="text-[32px] font-semibold text-sub-1">{`${accountMe?.name ?? '愿由ъ옄'}?? 蹂묐룞???곌껐?댁슂`}</h1>
                                <p className="mt-2 text-sm text-gray-3">처음이면 새 병동을 만들고, 초대 코드를 받았다면 기존 병동에 들어가세요.</p>
                            </div>

                            <div className="mt-6 space-y-3">
                                <button
                                    type="button"
                                    className="group flex min-h-36 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-6 text-left transition-colors hover:bg-gray-7"
                                    onClick={() => navigate(ROUTE.ONBOARDING_WARD_CREATE)}
                                >
                                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-main-light text-main-1">
                                        <Building2 className="h-6 w-6" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[22px] font-semibold text-sub-1">??蹂묐룞 留뚮뱾湲?/span>
</span>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                                </button>

                                <button
                                    type="button"
                                    className="group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-[24px] bg-white p-5 text-left transition-colors hover:bg-gray-7"
                                    onClick={() => navigate(ROUTE.ENTER_WARD)}
                                >
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-main-light text-main-1">
                                        <DoorOpen className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[17px] font-semibold text-sub-1">湲곗〈 蹂묐룞 ?낆옣?섍린</span>
</span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-4 transition-transform group-hover:translate-x-0.5" />
                                </button>
                            </div>
                        </div>
                    ))
            )}
        </RegisterShell>
    );
}

export default OnboardingPage;

