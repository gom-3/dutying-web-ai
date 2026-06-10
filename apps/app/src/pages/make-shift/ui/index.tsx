import {cn} from '@dutying/utils/style';
import {CalendarPlus, Play} from 'lucide-react';
import {Trans} from 'react-i18next';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isMakeShiftMonthAllowed} from '@/shared/lib/shift-calendar-month-policy';
import PageState from '@/shared/ui/PageState';
import {DutyManagementStatusCard, ManagementActionButton} from '@/widgets/duty-management/ui';
import {loadDraftStep} from '../model/make-shift-progress-storage';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../model/make-shift-store';
import {useMakeShiftUseCase} from '../model/make-shift-use-case';
import {MakeShiftHeader} from './make-shift-header';
import {MakeShiftStepContent} from './make-shift-step-content';
import {MakeShiftStepper} from './make-shift-stepper';

export const MakeShiftPageView = () => {
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const maxReachedStep = useMakeShiftStore((s) => s.maxReachedStep);
    const year = useMakeShiftStore((s) => s.year);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const shiftExists = useMakeShiftStore((s) => s.shiftExists);
    const shiftFullyAssigned = useMakeShiftStore((s) => s.shiftFullyAssigned);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const shiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const wardId = useMakeShiftStore((s) => s.wardId);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const isOverview = phase === 'overview';
    const makeMonthAllowed = isMakeShiftMonthAllowed(year, month);
    const showNoTeamsState = shiftTeamsStatus === 'success' && shiftTeams.length === 0;
    const currentShiftTeamName = shiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId)?.name ?? t('page.makeShift.overview.selectedTeamFallback');
    const visibleMaxReachedStep = currentStep === 1 && !canNext ? 1 : maxReachedStep;
    const draftStep = wardId && currentShiftTeamId ? loadDraftStep(wardId, currentShiftTeamId, year, month) : null;
    const hasProgress = shiftStatus === 'success' && (draftStep !== null || shiftExists || shiftFullyAssigned);
    const isStepping = phase === 'stepping';
    const handleCreateCurrentMonth = () => {
        useCase.start();
    };

    return (
        <div
            className="min-h-full w-full overflow-x-auto transition-[padding-right] duration-300 ease-out"
            style={{paddingRight: 'var(--make-ai-snapshot-sidebar-offset, 0px)'}}
        >
            {/* /request와 같은 외곽 밀도. 근무표는 31일 폭이 필요해 최소 폭만 유지한다. */}
            <div className="mx-auto flex min-h-full w-full max-w-[1680px] min-w-[1510px] flex-col px-6 pt-4 pb-3 min-[1440px]:px-10">
                <MakeShiftHeader />

                <div
                    className={cn(
                        'mt-2 flex flex-1 flex-col rounded-[18px] bg-white',
                        isStepping ? 'overflow-visible' : 'min-h-0 overflow-hidden',
                    )}
                >
                    {!makeMonthAllowed ? (
                        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-[clamp(16px,5vh,64px)] sm:px-6 md:px-10 [@media(min-height:760px)]:items-center">
                            <DutyManagementStatusCard
                                title={t('page.makeShift.monthRangeTitle')}
                                description={t('page.makeShift.monthRangeDescription')}
                                className="min-h-[360px] flex-1 border-0 bg-transparent"
                            />
                        </div>
                    ) : isOverview ? (
                        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-[clamp(12px,5vh,64px)] sm:px-6 md:px-10 [@media(min-height:760px)]:items-center">
                            {showNoTeamsState ? (
                                <PageState
                                    tone="empty"
                                    title={t('page.makeShift.overview.noTeamsTitle')}
                                    description={t('page.makeShift.overview.noTeamsDescription')}
                                    className="min-h-0 py-0"
                                />
                            ) : shiftStatus === 'pending' || shiftStatus === 'idle' ? (
                                <PageState
                                    tone="loading"
                                    loadingColor="purple"
                                    title={
                                        shiftStatus === 'pending'
                                            ? t('page.makeShift.overview.loading')
                                            : t('page.makeShift.overview.checking')
                                    }
                                    description={t('page.state.loadingDescription')}
                                    className="min-h-0 py-0"
                                />
                            ) : shiftStatus === 'error' ? (
                                <PageState
                                    tone="error"
                                    title={t('page.makeShift.overview.error')}
                                    description={t('page.state.errorDescription')}
                                    action={{label: t('page.state.retry'), onClick: useCase.retryOverview}}
                                    className="min-h-0 py-0"
                                />
                            ) : hasProgress ? (
                                <PageState
                                    tone="empty"
                                    title={
                                        <Trans
                                            i18nKey="page.makeShift.overview.shiftDraft"
                                            values={{teamName: currentShiftTeamName, month}}
                                            components={{
                                                team: <span className="text-main-1" />,
                                                month: <span className="text-main-1" />,
                                            }}
                                        />
                                    }
                                    description={t('page.makeShift.overview.shiftDraftDescription')}
                                    className="min-h-0 py-0"
                                    visual={
                                        <img
                                            src="/img/continue-schedule-nurse.webp"
                                            alt=""
                                            aria-hidden="true"
                                            decoding="async"
                                            className="h-[clamp(120px,20vh,160px)] w-auto object-contain select-none sm:h-[clamp(128px,24vh,192px)]"
                                        />
                                    }
                                >
                                    <div className="mt-1 flex justify-center">
                                        <ManagementActionButton
                                            variant="primary"
                                            size="md"
                                            onClick={handleCreateCurrentMonth}
                                            disabled={currentShiftTeamId === null}
                                            className="h-12 min-w-[168px] cursor-pointer rounded-[14px] px-6 font-apple text-[15px] leading-none font-semibold active:scale-[0.99] disabled:cursor-not-allowed"
                                        >
                                            <Play className="size-[17px] fill-current" stroke="none" aria-hidden="true" />
                                            {t('page.makeShift.overview.continueShift')}
                                        </ManagementActionButton>
                                    </div>
                                </PageState>
                            ) : (
                                <PageState
                                    tone="empty"
                                    title={
                                        <Trans
                                            i18nKey="page.makeShift.overview.shiftEmpty"
                                            values={{teamName: currentShiftTeamName, month}}
                                            components={{
                                                team: <span className="text-main-1" />,
                                                month: <span className="text-main-1" />,
                                            }}
                                        />
                                    }
                                    className="min-h-0 py-0"
                                    visual={
                                        <img
                                            src="/img/empty-schedule-nurse.webp"
                                            alt=""
                                            aria-hidden="true"
                                            decoding="async"
                                            className="h-[clamp(120px,21vh,168px)] w-auto object-contain select-none sm:h-[clamp(132px,25vh,210px)]"
                                        />
                                    }
                                >
                                    <div className="mt-1 flex justify-center">
                                        <ManagementActionButton
                                            variant="primary"
                                            size="md"
                                            onClick={handleCreateCurrentMonth}
                                            disabled={currentShiftTeamId === null}
                                            className="h-12 min-w-[168px] cursor-pointer rounded-[14px] px-6 font-apple text-[15px] leading-none font-semibold active:scale-[0.99] disabled:cursor-not-allowed"
                                        >
                                            <CalendarPlus className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                                            {t('page.makeShift.overview.createShift', {month})}
                                        </ManagementActionButton>
                                    </div>
                                </PageState>
                            )}
                        </div>
                    ) : (
                        <>
                            {/*
                             * Stepper는 흰 카드 폭 전체에 직접 배치한다 (분리선이 카드 좌우 가장자리까지 닿게).
                             * 좌우 콘텐츠 패딩은 stepper 내부의 step list(`px-[clamp(...)]`)와 아래 step content에만 적용한다.
                             */}
                            <MakeShiftStepper
                                currentStep={currentStep}
                                maxReachedStep={visibleMaxReachedStep}
                                onClickStep={useCase.goToStep}
                            />

                            <div className="flex w-full min-w-0 px-3 pb-3 2xl:px-4">
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
