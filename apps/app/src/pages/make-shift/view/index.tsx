import {useNavigate} from 'react-router';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../model/make-shift-store';
import {useMakeShiftUseCase} from '../model/make-shift-use-case';
import {MakeShiftHeader} from './make-shift-header';
import {MakeShiftStepContent} from './make-shift-step-content';
import {MakeShiftStepper} from './make-shift-stepper';

export const MakeShiftPageView = () => {
    const navigate = useNavigate();
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const year = useMakeShiftStore((s) => s.year);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const shiftExists = useMakeShiftStore((s) => s.shiftExists);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const shiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const setYearMonth = useMakeShiftStore((s) => s.setYearMonth);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const isOverview = phase === 'overview';
    const showNoTeamsState = shiftTeamsStatus === 'success' && shiftTeams.length === 0;
    const currentShiftTeamName = shiftTeams.find((t) => t.shiftTeamId === currentShiftTeamId)?.name ?? '선택한 팀';
    const hasCurrentMonthShift = shiftStatus === 'success' && shiftExists;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const handleGoDuty = () => {
        const params = new URLSearchParams({
            year: String(year),
            month: String(month),
            shiftTeamId: String(currentShiftTeamId ?? ''),
        });

        navigate(`${ROUTE.DUTY}?${params.toString()}`);
    };
    const handleCreateCurrentMonth = () => {
        useCase.start();
    };
    const handleCreateNextMonth = () => {
        setYearMonth({year: nextYear, month: nextMonth});
        useCase.start();
    };

    return (
        <div className="flex min-h-screen w-full flex-col px-10 py-10">
            <MakeShiftHeader />

            <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-white">
                {isOverview ? (
                    <div className="flex flex-1 items-center justify-center px-10 py-16">
                        {showNoTeamsState ? (
                            <PageState
                                tone="empty"
                                title={t('page.makeShift.overview.noTeamsTitle')}
                                description={t('page.makeShift.overview.noTeamsDescription')}
                                className="py-0"
                            />
                        ) : shiftStatus === 'pending' || shiftStatus === 'idle' ? (
                            <PageState
                                tone="loading"
                                title={
                                    shiftStatus === 'pending' ? t('page.makeShift.overview.loading') : t('page.makeShift.overview.checking')
                                }
                                description={t('page.state.loadingDescription')}
                                className="py-0"
                            />
                        ) : shiftStatus === 'error' ? (
                            <PageState
                                tone="error"
                                title={t('page.makeShift.overview.error')}
                                description={t('page.state.errorDescription')}
                                action={{label: t('page.state.retry'), onClick: useCase.retryOverview}}
                                className="py-0"
                            />
                        ) : hasCurrentMonthShift ? (
                            <PageState
                                tone="empty"
                                title={t('page.makeShift.overview.shiftExists', {teamName: currentShiftTeamName, month})}
                                description={t('page.state.emptyDescription')}
                                className="py-0"
                            >
                                <div className="mt-1 flex flex-wrap justify-center gap-4">
                                    <ManagementActionButton variant="secondary" size="lg" onClick={handleGoDuty}>
                                        {t('page.makeShift.overview.viewShift', {month})}
                                    </ManagementActionButton>
                                    <ManagementActionButton size="lg" onClick={handleCreateNextMonth}>
                                        {t('page.makeShift.overview.createShift', {month: nextMonth})}
                                    </ManagementActionButton>
                                </div>
                            </PageState>
                        ) : (
                            <PageState
                                tone="empty"
                                title={t('page.makeShift.overview.shiftEmpty', {teamName: currentShiftTeamName, month})}
                                description={t('page.state.emptyDescription')}
                                className="py-0"
                            >
                                <div className="mt-1 flex justify-center">
                                    <ManagementActionButton
                                        variant="secondary"
                                        size="lg"
                                        onClick={handleCreateCurrentMonth}
                                        disabled={currentShiftTeamId === null}
                                    >
                                        {t('page.makeShift.overview.createShift', {month})}
                                    </ManagementActionButton>
                                </div>
                            </PageState>
                        )}
                    </div>
                ) : (
                    <>
                        <MakeShiftStepper currentStep={currentStep} onClickStep={useCase.goToStep} />
                        <MakeShiftStepContent
                            currentStep={currentStep}
                            canPrev={canPrev}
                            canNext={canNext}
                            onPrev={useCase.prev}
                            onNext={useCase.next}
                        />
                    </>
                )}
            </div>
        </div>
    );
};
