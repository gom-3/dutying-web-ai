import {useMemo} from 'react';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import StatusBadge from '@/shared/ui/StatusBadge';
import {canGoNext, canGoPrev, useMakeShiftStore} from '../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../model/make-shift-use-case';
import {useRequestsShiftsHook} from '../../model/requestsShiftsHook';

export function RequestsShifts() {
    const useCase = useMakeShiftUseCase();
    const {t} = useTypedTranslation();
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
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-baseline gap-[20px]">
                    <div>
                        <p className="font-apple text-[32px] font-semibold text-sub-1">{t('page.makeShift.requests.title')}</p>
                        <p className="font-apple text-xl font-medium text-gray-3">
                            {t('page.makeShift.requests.descriptionPrefix')}{' '}
                            <span className="text-main-1">{t('page.makeShift.requests.descriptionHighlight')}</span>
                            {t('page.makeShift.requests.descriptionSuffix')}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <StatusBadge
                                label={t('page.makeShift.requests.badge.accepted')}
                                tone="success"
                                count={acceptedRequestSummaries.length}
                            />
                            <StatusBadge label={t('page.makeShift.requests.badge.pending')} tone="brand" count={pendingRequests.length} />
                            <StatusBadge
                                label={t('page.makeShift.requests.badge.rejected')}
                                tone="neutral"
                                count={rejectedRequests.length}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        size="md"
                        className="h-[42px] rounded-[10px] px-5 font-semibold"
                        onClick={() => useCase.prev()}
                        disabled={!canPrev}
                        type="button"
                    >
                        {t('page.makeShift.navigation.previous')}
                    </Button>
                    <Button
                        size="md"
                        className="h-[42px] rounded-[10px] px-5 font-semibold"
                        onClick={() => useCase.next()}
                        disabled={!canNext}
                        type="button"
                    >
                        {t('page.makeShift.navigation.next')}
                    </Button>
                </div>
            </div>

            <div className="mt-6 flex min-h-0 flex-1 gap-6">
                <div className="min-w-0 flex-1">
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
                            action={{label: t('page.state.retry'), onClick: () => void retry()}}
                        />
                    )}
                    {!loading && !error && !requestShift && (
                        <PageState tone="empty" title={t('page.makeShift.requests.empty')} description={t('page.state.emptyDescription')} />
                    )}

                    {!loading && !error && requestShift && (
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="scrollbar-default min-h-0 scroll-m-2 overflow-auto rounded-[15px] shadow-banner">
                                <div className="flex items-center px-5">
                                    <div className="w-24 shrink-0 text-center font-apple text-[1rem] font-medium text-sub-3">
                                        {t('page.makeShift.requests.table.name')}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="inline-flex rounded-[2.5rem] px-4 py-[.1875rem]">
                                            {requestShift.days.map((item, idx) => {
                                                const isSat = item.dayType === 'saturday';
                                                const isSun = item.dayType === 'sunday' || item.dayType === 'holiday';
                                                const textColor = isSun
                                                    ? 'text-red'
                                                    : isSat
                                                      ? separateWeekendColor
                                                          ? 'text-blue'
                                                          : 'text-red'
                                                      : 'text-sub-2.5';

                                                return (
                                                    <p
                                                        key={idx}
                                                        className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${textColor}`}
                                                    >
                                                        {item.day}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    {requestShift.divisionShiftNurses.map((division, divisionIndex) => {
                                        if (division.length === 0) return null;

                                        return (
                                            <div key={divisionIndex} className="rounded-[20px] bg-white">
                                                <div className="min-w-0">
                                                    <div className="flex flex-col">
                                                        {division.map((row) => (
                                                            <div key={row.shiftNurse.shiftNurseId} className="flex h-10 items-center px-5">
                                                                <div className="w-24 shrink-0 truncate text-center font-apple text-[1.25rem] text-sub-1">
                                                                    {row.shiftNurse.name}
                                                                </div>
                                                                <div className="flex h-full min-w-max px-4.25">
                                                                    {row.wardReqShiftList.map((wardShiftTypeId, dateIdx) => {
                                                                        const dayType = requestShift.days[dateIdx]?.dayType;
                                                                        const isSat = dayType === 'saturday';
                                                                        const isSun = dayType === 'sunday' || dayType === 'holiday';
                                                                        const bg = isSun
                                                                            ? 'bg-[#FFE1E680]'
                                                                            : isSat
                                                                              ? separateWeekendColor
                                                                                  ? 'bg-[#E1E5FF80]'
                                                                                  : 'bg-[#FFE1E680]'
                                                                              : '';

                                                                        return (
                                                                            <div
                                                                                key={dateIdx}
                                                                                className={`flex h-full w-9 items-center justify-center px-[.25rem] ${bg}`}
                                                                            >
                                                                                <ShiftBadge
                                                                                    shiftType={wardShiftTypeMap.get(wardShiftTypeId ?? -1)}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-[360px] shrink-0 rounded-[20px] bg-white shadow-banner">
                    <div className="border-b border-sub-4.5 px-6 py-4">
                        <p className="font-apple text-[1.25rem] font-semibold text-main-1">{t('page.makeShift.requests.panelTitle')}</p>
                    </div>

                    <div className="scrollbar-hide max-h-[calc(100vh-22rem)] overflow-y-auto px-6 py-4">
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="font-apple text-base font-semibold text-sub-1">
                                    {t('page.makeShift.requests.section.accepted')}
                                </p>
                                <p className="font-apple text-sm font-medium text-gray-4">
                                    {t('page.makeShift.requests.count', {count: acceptedRequestSummaries.length})}
                                </p>
                            </div>

                            <div className="mt-3 space-y-2">
                                {acceptedRequestSummaries.length === 0 ? (
                                    <p className="font-apple text-sm font-medium text-gray-4">
                                        {t('page.makeShift.requests.emptyAccepted')}
                                    </p>
                                ) : (
                                    acceptedRequestSummaries.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 rounded-[10px] border border-gray-6 px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-apple text-sm font-medium text-sub-1">
                                                    {item.nurseName} / {item.date}일
                                                </p>
                                            </div>
                                            <ShiftBadge shiftType={wardShiftTypeMap.get(item.wardShiftTypeId)} />
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                                onClick={() => decideRequest(item.id, null)}
                                                disabled={updatingRequestId === item.id}
                                                type="button"
                                            >
                                                {t('page.makeShift.requests.action.hold')}
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <p className="font-apple text-base font-semibold text-sub-1">
                                    {t('page.makeShift.requests.section.pending')}
                                </p>
                                <p className="font-apple text-sm font-medium text-gray-4">
                                    {t('page.makeShift.requests.count', {count: pendingRequests.length})}
                                </p>
                            </div>

                            <div className="mt-3 space-y-2">
                                {pendingRequests.length === 0 ? (
                                    <p className="font-apple text-sm font-medium text-gray-4">
                                        {t('page.makeShift.requests.emptyPending')}
                                    </p>
                                ) : (
                                    pendingRequests.map((dutyRequest) => (
                                        <div
                                            key={dutyRequest.wardReqShiftId}
                                            className="flex items-center gap-3 rounded-[10px] border border-gray-6 px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-apple text-sm font-medium text-sub-1">
                                                    {dutyRequest.nurseName} / {dutyRequest.date}일
                                                </p>
                                            </div>
                                            <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} isOnlyRequest />
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                                    onClick={() => decideRequest(dutyRequest.wardReqShiftId, true)}
                                                    disabled={updatingRequestId === dutyRequest.wardReqShiftId}
                                                    type="button"
                                                >
                                                    {t('page.makeShift.requests.action.accept')}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                                    onClick={() => decideRequest(dutyRequest.wardReqShiftId, false)}
                                                    disabled={updatingRequestId === dutyRequest.wardReqShiftId}
                                                    type="button"
                                                >
                                                    {t('page.makeShift.requests.action.reject')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <p className="font-apple text-base font-semibold text-sub-1">
                                    {t('page.makeShift.requests.section.rejected')}
                                </p>
                                <p className="font-apple text-sm font-medium text-gray-4">
                                    {t('page.makeShift.requests.count', {count: rejectedRequests.length})}
                                </p>
                            </div>

                            <div className="mt-3 space-y-2">
                                {rejectedRequests.length === 0 ? (
                                    <p className="font-apple text-sm font-medium text-gray-4">
                                        {t('page.makeShift.requests.emptyRejected')}
                                    </p>
                                ) : (
                                    rejectedRequests.map((dutyRequest) => (
                                        <div
                                            key={dutyRequest.wardReqShiftId}
                                            className="flex items-center gap-3 rounded-[10px] border border-gray-6 px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-apple text-sm font-medium text-sub-1">
                                                    {dutyRequest.nurseName} / {dutyRequest.date}일
                                                </p>
                                            </div>
                                            <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} isOnlyRequest />
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                                    onClick={() => decideRequest(dutyRequest.wardReqShiftId, true)}
                                                    disabled={updatingRequestId === dutyRequest.wardReqShiftId}
                                                    type="button"
                                                >
                                                    {t('page.makeShift.requests.action.accept')}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                                    onClick={() => decideRequest(dutyRequest.wardReqShiftId, null)}
                                                    disabled={updatingRequestId === dutyRequest.wardReqShiftId}
                                                    type="button"
                                                >
                                                    {t('page.makeShift.requests.action.hold')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
