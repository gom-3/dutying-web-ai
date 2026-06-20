import {useLayoutEffect, useState} from 'react';
import useRequestShift from '@/features/request-shift';
import {useRequestShiftStore} from '@/features/request-shift/model/store';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import RequestCalendar from './ui/request-calendar';
import Toolbar from './ui/toolbar';

const RequestShiftPageContent = () => {
    const {t} = useTypedTranslation();
    const {
        state: {requestShift, shiftStatus, shiftTeams, shiftTeamsStatus, bootstrapStatus},
        actions: {retry, createNextMonthShift},
    } = useRequestShift(true);
    const shiftTeamCount = shiftTeams?.length ?? 0;
    const shouldShowToolbar = bootstrapStatus === 'success' && shiftTeamsStatus === 'success' && shiftTeamCount > 0;
    const pageState =
        bootstrapStatus === 'pending'
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
        <div className="mx-auto flex min-h-screen w-full max-w-[1640px] min-w-[1160px] flex-col px-10 pt-4 pb-3">
            <div className="flex min-h-0 flex-1 flex-col">
                {shouldShowToolbar ? <Toolbar /> : null}

                {pageState ? (
                    <PageState {...pageState} className={shouldShowToolbar ? 'py-0 pt-14' : 'py-0'}>
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
                    <RequestCalendar />
                )}
            </div>
        </div>
    );
};
const RequestShiftPage = () => {
    const resetToNextMonth = useRequestShiftStore((state) => state.resetToNextMonth);
    const [isMonthReady, setIsMonthReady] = useState(false);

    useLayoutEffect(() => {
        resetToNextMonth();
        setIsMonthReady(true);
    }, [resetToNextMonth]);

    if (!isMonthReady) return null;

    return <RequestShiftPageContent />;
};

export default RequestShiftPage;
