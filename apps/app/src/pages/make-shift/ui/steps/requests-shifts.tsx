import {useEffect, useState} from 'react';
import {BouncingDots} from '@/components/loading-ui/bouncing-dots';
import useRequestShift from '@/features/request-shift';
import {useRequestShiftStore} from '@/features/request-shift/model/store';
import RequestCalendar from '@/pages/request-shift/ui/request-calendar';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import {canGoNext, canGoPrev, isMakeShiftTeamReadyForWard, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {
    MAKE_SHIFT_STEP_HEADING_BLOCK_CLASS,
    MAKE_SHIFT_STEP_NAV_ACTIONS_CLASS,
    MAKE_SHIFT_STEP_SUBTITLE_CLASS,
    MAKE_SHIFT_STEP_TITLE_CLASS,
    MAKE_SHIFT_STEP_TOOLBAR_CLASS,
} from '../make-shift-step-layout';
import {MAKE_SHIFT_STEP_NAV_BUTTON_CLASS} from '../make-shift-step-nav';
import {useFlowTransitionFeedback} from '../use-flow-transition-feedback';

export function RequestsShifts() {
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const {transitioning, runTransition} = useFlowTransitionFeedback();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const makeYear = useMakeShiftStore((s) => s.year);
    const makeMonth = useMakeShiftStore((s) => s.month);
    const makeWardId = useMakeShiftStore((s) => s.wardId);
    const makeShiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const makeShiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const makeShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const setRequestState = useRequestShiftStore((s) => s.setState);
    const setRequestWardContext = useRequestShiftStore((s) => s.setWardContext);
    const [isRequestContextSynced, setIsRequestContextSynced] = useState(false);
    const isMakeShiftTeamReady = isMakeShiftTeamReadyForWard(
        {wardId: makeWardId, shiftTeams: makeShiftTeams, shiftTeamsStatus: makeShiftTeamsStatus},
        makeWardId,
        makeShiftTeamId,
    );

    useEffect(() => {
        setIsRequestContextSynced(false);
        setRequestWardContext(makeWardId);
        setRequestState('year', makeYear);
        setRequestState('month', makeMonth);
        setRequestState('currentShiftTeamId', isMakeShiftTeamReady ? makeShiftTeamId : null);
        setRequestState('focus', null);
        setIsRequestContextSynced(true);
    }, [isMakeShiftTeamReady, makeMonth, makeShiftTeamId, makeWardId, makeYear, setRequestState, setRequestWardContext]);

    const {
        state: {requestShift, shiftStatus, shiftTeams, shiftTeamsStatus, bootstrapStatus},
        actions: {retry, createNextMonthShift},
    } = useRequestShift(true);
    const shiftTeamCount = shiftTeams?.length ?? 0;
    const pageState =
        !isRequestContextSynced || bootstrapStatus === 'pending'
            ? {
                  tone: 'loading' as const,
                  title: t('page.request.overview.bootstrapLoadingTitle'),
                  description: t('page.request.overview.bootstrapLoadingDescription'),
              }
            : bootstrapStatus === 'error'
              ? {
                    tone: 'error' as const,
                    title: t('page.request.overview.bootstrapErrorTitle'),
                    description: t('page.request.overview.bootstrapErrorDescription'),
                    action: {label: t('page.state.retry'), onClick: () => void retry()},
                }
              : shiftTeamsStatus === 'pending'
                ? {
                      tone: 'loading' as const,
                      title: t('page.request.overview.loadingTitle'),
                      description: t('page.request.overview.loadingDescription'),
                  }
                : shiftTeamsStatus === 'error'
                  ? {
                        tone: 'error' as const,
                        title: t('page.request.overview.teamsErrorTitle'),
                        description: t('page.state.errorDescription'),
                        action: {label: t('page.state.retry'), onClick: () => void retry()},
                    }
                  : shiftTeamCount === 0
                    ? {
                          tone: 'empty' as const,
                          title: t('page.request.overview.noTeamsTitle'),
                          description: t('page.request.overview.noTeamsDescription'),
                      }
                    : shiftStatus === 'pending'
                      ? {
                            tone: 'loading' as const,
                            title: t('page.request.overview.shiftLoadingTitle'),
                            description: t('page.request.overview.shiftLoadingDescription'),
                        }
                      : shiftStatus === 'error'
                        ? {
                              tone: 'error' as const,
                              title: t('page.request.overview.shiftErrorTitle'),
                              description: t('page.state.errorDescription'),
                              action: {label: t('page.state.retry'), onClick: () => void retry()},
                          }
                        : !requestShift
                          ? {
                                tone: 'empty' as const,
                                title: t('page.request.overview.emptyTitle'),
                                description: t('page.request.overview.emptyDescription'),
                            }
                          : null;

    return (
        <div id="make_requests_step" className="make-shift-requests flex w-full min-w-0 flex-col">
            <div className="flex w-full min-w-0 flex-col">
                <div className={`${MAKE_SHIFT_STEP_TOOLBAR_CLASS} pb-3`}>
                    <div className={MAKE_SHIFT_STEP_HEADING_BLOCK_CLASS}>
                        <h1 className={MAKE_SHIFT_STEP_TITLE_CLASS}>{t('page.makeShift.requests.title')}</h1>
                        <p className={MAKE_SHIFT_STEP_SUBTITLE_CLASS}>{t('page.makeShift.requests.descriptionLine')}</p>
                    </div>

                    <div className={MAKE_SHIFT_STEP_NAV_ACTIONS_CLASS}>
                        <Button
                            variant="secondary"
                            size="md"
                            className={`make-shift-requests__nav-button cursor-pointer border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                            onClick={() => runTransition('prev', useCase.prev)}
                            disabled={!canPrev || transitioning !== null}
                            type="button"
                        >
                            {transitioning === 'prev' ? <BouncingDots className="w-5 shrink-0 text-main-1" /> : null}
                            {transitioning === 'prev' ? t('page.makeShift.navigation.moving') : t('page.makeShift.navigation.previous')}
                        </Button>
                        <Button
                            size="md"
                            className={`make-shift-requests__nav-button cursor-pointer border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                            onClick={() => runTransition('next', useCase.next)}
                            disabled={!canNext || transitioning !== null}
                            type="button"
                        >
                            {transitioning === 'next' ? <BouncingDots className="w-5 shrink-0 text-white" /> : null}
                            {transitioning === 'next' ? t('page.makeShift.navigation.moving') : t('page.makeShift.navigation.next')}
                        </Button>
                    </div>
                </div>

                {pageState ? (
                    <PageState {...pageState} loadingColor={pageState.tone === 'loading' ? 'purple' : undefined} className="py-0">
                        {pageState.tone === 'empty' && !requestShift && shiftTeamCount > 0 ? (
                            <div className="mt-1 flex justify-center">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    className="h-11 rounded-[14px] px-5 font-semibold"
                                    onClick={createNextMonthShift}
                                >
                                    {t('page.request.overview.createNextMonth')}
                                </Button>
                            </div>
                        ) : null}
                    </PageState>
                ) : (
                    <RequestCalendar defaultReviewMode="pending" />
                )}
            </div>
        </div>
    );
}
