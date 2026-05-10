import {useMemo} from 'react';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {useRequestsShiftsHook} from '../../model/requests-shifts-hook';
import {RequestsDecisionPanel, RequestsShiftBoard, RequestsShiftsHeader} from './requests-shifts-sections';

export function RequestsShifts() {
    const useCase = useMakeShiftUseCase();
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const {
        state: {requestShift, acceptedRequests, pendingRequests, rejectedRequests, wardShiftTypeMap},
        status: {loading, error, updatingRequestId},
        actions: {decideRequest, retry},
    } = useRequestsShiftsHook();
    const {separateWeekendColor} = useUIConfigStore();
    const acceptedRequestSummaries = useMemo(
        () =>
            acceptedRequests.map((item) => ({
                id: item.wardReqShiftId,
                nurseName: item.nurseName,
                date: item.date,
                wardShiftTypeId: item.wardShiftTypeId,
            })),
        [acceptedRequests],
    );

    return (
        <div id="make_requests_step" className="make-shift-requests flex min-h-0 flex-1 flex-col">
            <RequestsShiftsHeader
                acceptedCount={acceptedRequestSummaries.length}
                pendingCount={pendingRequests.length}
                rejectedCount={rejectedRequests.length}
                canPrev={canPrev}
                canNext={canNext}
                onPrev={useCase.prev}
                onNext={useCase.next}
            />

            <div className="make-shift-requests__body mt-[clamp(14px,1.6vw,24px)] flex min-h-0 flex-1 gap-[clamp(14px,1.6vw,24px)]">
                <div className="make-shift-requests__board-area min-w-0 flex-1">
                    <RequestsShiftBoard
                        loading={loading}
                        error={error}
                        requestShift={requestShift}
                        wardShiftTypeMap={wardShiftTypeMap}
                        separateWeekendColor={separateWeekendColor}
                        onRetry={retry}
                    />
                </div>

                <RequestsDecisionPanel
                    acceptedRequestSummaries={acceptedRequestSummaries}
                    pendingRequests={pendingRequests}
                    rejectedRequests={rejectedRequests}
                    wardShiftTypeMap={wardShiftTypeMap}
                    updatingRequestId={updatingRequestId}
                    onDecideRequest={decideRequest}
                />
            </div>
        </div>
    );
}
