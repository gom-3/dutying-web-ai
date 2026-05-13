import {useNavigate} from 'react-router';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isDutyViewingThisCalendarMonth, isMakeShiftMonthAllowed} from '@/shared/lib/shift-calendar-month-policy';
import PageState from '@/shared/ui/PageState';
import {DutyManagementStatusCard, ManagementActionButton} from '@/widgets/duty-management/ui';
import {buildDutyPath} from '@/pages/duty/model/duty-navigation';
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
    const maxReachedStep = useMakeShiftStore((s) => s.maxReachedStep);
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
    const makeMonthAllowed = isMakeShiftMonthAllowed(year, month);
    const canOfferCreateFollowingMonth = isDutyViewingThisCalendarMonth(year, month);
    const showNoTeamsState = shiftTeamsStatus === 'success' && shiftTeams.length === 0;
    const currentShiftTeamName = shiftTeams.find((t) => t.shiftTeamId === currentShiftTeamId)?.name ?? '선택한 팀';
    /** `useMakeShiftBootstrap`: 실제 배정 1칸 이상일 때만 true (`isDutyShiftWithoutAssignments`와 동일 기준). */
    const hasCurrentMonthShift = shiftStatus === 'success' && shiftExists;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const handleGoDuty = () => {
        navigate(buildDutyPath({year, month, shiftTeamId: currentShiftTeamId}));
    };
    const handleCreateCurrentMonth = () => {
        useCase.start();
    };
    const handleCreateNextMonth = () => {
        setYearMonth({year: nextYear, month: nextMonth});
        useCase.start();
    };

    return (
        <div className="min-h-screen w-full overflow-x-auto">
            {/* 최소 지원 폭 이하로 내려가면 "페이지 전체" 가로 스크롤 */}
            <div className="flex min-h-screen min-w-[1280px] flex-col px-10 py-4">
                <MakeShiftHeader />

                <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-white">
                    {!makeMonthAllowed ? (
                        <div className="flex flex-1 items-center justify-center px-10 py-16">
                            <DutyManagementStatusCard
                                title={t('page.makeShift.monthRangeTitle')}
                                description={t('page.makeShift.monthRangeDescription')}
                                className="min-h-[360px] flex-1 border-0 bg-transparent"
                            />
                        </div>
                    ) : isOverview ? (
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
                                        shiftStatus === 'pending'
                                            ? t('page.makeShift.overview.loading')
                                            : t('page.makeShift.overview.checking')
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
                                        {canOfferCreateFollowingMonth && (
                                            <ManagementActionButton size="lg" onClick={handleCreateNextMonth}>
                                                {t('page.makeShift.overview.createShift', {month: nextMonth})}
                                            </ManagementActionButton>
                                        )}
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
                            {hasCurrentMonthShift && (
                                <div className="flex flex-wrap items-center justify-end gap-3 border-b border-gray-6 px-6 py-3 2xl:px-10">
                                    <ManagementActionButton variant="secondary" size="md" onClick={handleGoDuty}>
                                        {t('page.makeShift.overview.viewShift', {month})}
                                    </ManagementActionButton>
                                </div>
                            )}
                            {/*
                             * Stepper는 흰 카드 폭 전체에 직접 배치한다 (분리선이 카드 좌우 가장자리까지 닿게).
                             * 좌우 콘텐츠 패딩은 stepper 내부의 step list(`px-[clamp(...)]`)와 아래 step content에만 적용한다.
                             */}
                            <MakeShiftStepper currentStep={currentStep} maxReachedStep={maxReachedStep} onClickStep={useCase.goToStep} />

                            <div className="w-full min-w-0 px-6 2xl:px-10">
                                <MakeShiftStepContent
                                    currentStep={currentStep}
                                    canPrev={canPrev}
                                    canNext={canNext}
                                    onPrev={useCase.prev}
                                    onNext={useCase.next}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
