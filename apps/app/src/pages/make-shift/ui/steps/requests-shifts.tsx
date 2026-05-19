import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {useRequestsShiftsHook} from '../../model/requests-shifts-hook';
import {MakeShiftCalendar} from './shared/make-shift-calendar';
import {useDutyEditorStep} from './shared/use-duty-editor-step';
import {RequestsPendingPanel, RequestsShiftsHeader} from './requests-shifts-sections';

export function RequestsShifts() {
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const {dutyQuery, editorDoc, violationMap, teamViolations} = useDutyEditorStep();
    const {
        state: {acceptedRequests, pendingRequests, rejectedRequests, wardShiftTypeMap},
        status: {loading: requestsLoading, error: requestsError, updatingRequestId},
        actions: {decideRequest, retry},
    } = useRequestsShiftsHook();

    const loading = requestsLoading || dutyQuery.isLoading;
    const error = requestsError || dutyQuery.isError;

    const handleRetry = () => Promise.all([retry(), dutyQuery.refetch()]);

    return (
        <div id="make_requests_step" className="make-shift-requests flex min-h-0 flex-1 flex-col">
            <RequestsShiftsHeader
                canPrev={canPrev}
                canNext={canNext}
                onPrev={useCase.prev}
                onNext={useCase.next}
            />

            <div className="make-shift-requests__body mt-[clamp(14px,1.6vw,24px)] flex min-h-0 flex-1 gap-[clamp(10px,1.0vw,18px)]">
                <div className="make-shift-requests__calendar-area flex min-h-0 min-w-0 flex-1 flex-col">
                    {loading && (
                        <PageState
                            tone="loading"
                            title={t('page.makeShift.requests.loading')}
                            description={t('page.state.loadingDescription')}
                        />
                    )}
                    {!loading && error && (
                        <PageState
                            tone="error"
                            title={t('page.makeShift.requests.error')}
                            description={t('page.state.errorDescription')}
                            action={{label: t('page.state.retry'), onClick: () => void handleRetry()}}
                        />
                    )}
                    {!loading && !error && dutyQuery.data && (
                        <MakeShiftCalendar
                            shift={dutyQuery.data}
                            doc={editorDoc}
                            violationMap={violationMap}
                            showFaults={false}
                            variant="simplified"
                            readonly
                            disableInitialSelection
                        />
                    )}
                    {!loading && !error && !dutyQuery.data && (
                        <PageState
                            tone="empty"
                            title={t('page.makeShift.requests.empty')}
                        />
                    )}
                </div>

                <RequestsPendingPanel
                    acceptedCount={acceptedRequests.length}
                    pendingCount={pendingRequests.length}
                    rejectedCount={rejectedRequests.length}
                    pendingRequests={pendingRequests}
                    wardShiftTypeMap={wardShiftTypeMap}
                    updatingRequestId={updatingRequestId}
                    onDecideRequest={decideRequest}
                />
            </div>
        </div>
    );
}
