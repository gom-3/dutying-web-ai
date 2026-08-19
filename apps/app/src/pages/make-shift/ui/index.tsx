import {cn} from '@dutying/utils/style';
import {useIsMutating} from '@tanstack/react-query';
import {ArrowRight, CalendarPlus} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {Trans} from 'react-i18next';
import {useNavigate} from 'react-router';
import useEditNurseStore from '@/features/edit-shift-team/model/store';
import pageEmptyStateIcon from '@/shared/assets/images/page-empty-state-visual.webp';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isMakeShiftMonthAllowed} from '@/shared/lib/shift-calendar-month-policy';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import PageState from '@/shared/ui/PageState';
import {DutyManagementStatusCard, ManagementActionButton} from '@/widgets/duty-management/ui';
import {getAiAutofillExitGuardReason, type TAiAutofillExitGuardReason, useAiAutofillExitGuardStore} from '../model/ai-autofill-exit-guard';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../model/make-shift-store';
import {useMakeShiftUseCase} from '../model/make-shift-use-case';
import {shiftConstraintRuleQueryKeys} from '../model/shift-constraint-rules';
import {MakeShiftHeader} from './make-shift-header';
import {MakeShiftStepContent} from './make-shift-step-content';
import {MakeShiftStepper} from './make-shift-stepper';

type TPendingAiAutofillExit = {
    action: () => void;
    reason: TAiAutofillExitGuardReason;
};

export const MakeShiftPageView = () => {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const useCase = useMakeShiftUseCase();
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const maxReachedStep = useMakeShiftStore((s) => s.maxReachedStep);
    const year = useMakeShiftStore((s) => s.year);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const shiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const wardId = useMakeShiftStore((s) => s.wardId);
    const stepNavigationBusy = useMakeShiftStore((s) => s.stepNavigationBusy);
    const hasAiAutofillUnsavedChanges = useAiAutofillExitGuardStore((s) => s.hasUnsavedChanges);
    const isAiAutofillGenerating = useAiAutofillExitGuardStore((s) => s.isAiGenerating);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const nurseSaveStatus = useEditNurseStore((s) => s.nurseSaveStatus);
    const isOverview = phase === 'overview';
    const makeMonthAllowed = isMakeShiftMonthAllowed(year, month);
    const pendingConstraintRuleSaves = useIsMutating({
        mutationKey: shiftConstraintRuleQueryKeys.save(wardId, currentShiftTeamId),
    });
    const isSavingConstraintRules = currentStep === 2 && pendingConstraintRuleSaves > 0;
    const isSavingWorkers = currentStep === 1 && nurseSaveStatus === 'saving';
    const isCurrentStepNavigationBusy = Boolean(stepNavigationBusy[currentStep]) || isSavingConstraintRules || isSavingWorkers;
    const showNoTeamsState = shiftTeamsStatus === 'success' && shiftTeams.length === 0;
    const [pendingAiAutofillExit, setPendingAiAutofillExit] = useState<TPendingAiAutofillExit | null>(null);
    const currentShiftTeamName =
        shiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId)?.name ?? t('page.makeShift.overview.selectedTeamFallback');
    const visibleMaxReachedStep = currentStep === 1 && !canNext ? 1 : maxReachedStep;
    const isStepping = phase === 'stepping';
    const handleCreateCurrentMonth = () => {
        useCase.start();
    };
    const aiAutofillExitGuardReason = getAiAutofillExitGuardReason({
        hasUnsavedChanges: hasAiAutofillUnsavedChanges,
        isAiGenerating: isAiAutofillGenerating,
    });
    const runWithAiAutofillExitGuard = useCallback(
        (action: () => void) => {
            if (!aiAutofillExitGuardReason) {
                action();

                return;
            }

            setPendingAiAutofillExit({action, reason: aiAutofillExitGuardReason});
        },
        [aiAutofillExitGuardReason],
    );
    const closeAiAutofillExitDialog = useCallback(() => {
        setPendingAiAutofillExit(null);
    }, []);
    const confirmAiAutofillExitDialog = useCallback(() => {
        const pendingAction = pendingAiAutofillExit?.action;

        setPendingAiAutofillExit(null);
        pendingAction?.();
    }, [pendingAiAutofillExit]);

    useEffect(() => {
        if (!aiAutofillExitGuardReason) return;

        const handleNavigationClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-navigation-path]') : null;
            const navigationPath = target?.dataset.navigationPath;

            if (!navigationPath || navigationPath === window.location.pathname) return;

            event.preventDefault();
            event.stopPropagation();
            runWithAiAutofillExitGuard(() => navigate(navigationPath));
        };

        document.addEventListener('click', handleNavigationClick, true);

        return () => document.removeEventListener('click', handleNavigationClick, true);
    }, [aiAutofillExitGuardReason, navigate, runWithAiAutofillExitGuard]);

    const aiAutofillExitDialogReason = pendingAiAutofillExit?.reason ?? aiAutofillExitGuardReason;
    const aiAutofillExitDialogOpen = pendingAiAutofillExit !== null;
    const aiAutofillExitDialogTitle =
        aiAutofillExitDialogReason === 'aiGenerating'
            ? t('page.makeShift.aiRefill.exitGuard.aiGeneratingTitle')
            : t('page.makeShift.aiRefill.exitGuard.unsavedTitle');
    const aiAutofillExitDialogDescription =
        aiAutofillExitDialogReason === 'aiGenerating'
            ? t('page.makeShift.aiRefill.exitGuard.aiGeneratingDescription')
            : t('page.makeShift.aiRefill.exitGuard.unsavedDescription');

    return (
        <div className={cn('min-h-full w-full', isStepping ? 'overflow-visible' : 'overflow-x-hidden')}>
            <div className="mx-auto flex min-h-full w-full max-w-[1680px] min-w-0 flex-col pt-4 pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+0.75rem)] pb-3 pl-3 transition-[padding-right] duration-300 ease-out min-[1600px]:pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+2.5rem)] min-[1600px]:pl-10 lg:pr-[calc(var(--make-ai-snapshot-sidebar-offset,0px)+1rem)] lg:pl-4">
                <MakeShiftHeader onBeforeContextChange={runWithAiAutofillExitGuard} />

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
                                >
                                    <div className="mt-1 flex justify-center">
                                        <ManagementActionButton
                                            variant="primary"
                                            size="sm"
                                            className="h-11 cursor-pointer rounded-[12px] px-5 text-[15px]"
                                            onClick={() => navigate(ROUTE.MEMBER)}
                                        >
                                            {t('page.makeShift.workers.goMemberManagement')}
                                            <ArrowRight aria-hidden className="size-4" />
                                        </ManagementActionButton>
                                    </div>
                                </PageState>
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
                                    className="min-h-[360px] py-0"
                                />
                            ) : shiftStatus === 'error' ? (
                                <PageState
                                    tone="error"
                                    title={t('page.makeShift.overview.error')}
                                    description={t('page.state.errorDescription')}
                                    action={{label: t('page.state.retry'), onClick: useCase.retryOverview}}
                                    className="min-h-0 py-0"
                                />
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
                                    contentClassName="max-w-[34rem]"
                                    titleClassName="mx-auto max-w-full break-normal whitespace-normal [overflow-wrap:anywhere] [text-wrap:balance]"
                                    visual={
                                        <img
                                            src={pageEmptyStateIcon}
                                            alt=""
                                            aria-hidden="true"
                                            decoding="async"
                                            className="h-[clamp(132px,23.1vh,185px)] w-auto object-contain select-none sm:h-[clamp(145px,27.5vh,231px)]"
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
                                navigationDisabled={isCurrentStepNavigationBusy}
                                onClickStep={(step) => runWithAiAutofillExitGuard(() => useCase.goToStep(step))}
                            />

                            <div className="flex w-full min-w-0 px-3 pb-3 2xl:px-4">
                                <MakeShiftStepContent
                                    currentStep={currentStep}
                                    canPrev={canPrev}
                                    canNext={canNext}
                                    nextBusy={isCurrentStepNavigationBusy}
                                    onPrev={() => runWithAiAutofillExitGuard(useCase.prev)}
                                    onNext={() => runWithAiAutofillExitGuard(useCase.next)}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
            <ConfirmActionDialog
                open={aiAutofillExitDialogOpen}
                title={aiAutofillExitDialogTitle}
                description={aiAutofillExitDialogDescription}
                confirmLabel={t('page.makeShift.aiRefill.exitGuard.leaveConfirm')}
                cancelLabel={t('page.makeShift.aiRefill.exitGuard.stayCancel')}
                tone="danger"
                onClose={closeAiAutofillExitDialog}
                onConfirm={confirmAiAutofillExitDialog}
            />
        </div>
    );
};
