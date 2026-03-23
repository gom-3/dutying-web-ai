import {type ReactNode} from 'react';
import {type TDutyRequest, type TRequestShift, type TWardShiftType} from '@/entities';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import StatusBadge from '@/shared/ui/StatusBadge';

type TAcceptedRequestSummary = {
    id: TDutyRequest['wardReqShiftId'];
    nurseName: TDutyRequest['nurseName'];
    date: TDutyRequest['date'];
    wardShiftTypeId: TDutyRequest['wardShiftTypeId'];
};

type TDecisionAction = (wardReqShiftId: number, isAccepted: boolean | null) => void;

type TRequestsShiftsHeaderProps = {
    acceptedCount: number;
    pendingCount: number;
    rejectedCount: number;
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
};

export function RequestsShiftsHeader({
    acceptedCount,
    pendingCount,
    rejectedCount,
    canPrev,
    canNext,
    onPrev,
    onNext,
}: TRequestsShiftsHeaderProps) {
    const {t} = useTypedTranslation();

    return (
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
                        <StatusBadge label={t('page.makeShift.requests.badge.accepted')} tone="success" count={acceptedCount} />
                        <StatusBadge label={t('page.makeShift.requests.badge.pending')} tone="brand" count={pendingCount} />
                        <StatusBadge label={t('page.makeShift.requests.badge.rejected')} tone="neutral" count={rejectedCount} />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="secondary"
                    size="md"
                    className="h-[42px] rounded-[10px] px-5 font-semibold"
                    onClick={onPrev}
                    disabled={!canPrev}
                    type="button"
                >
                    {t('page.makeShift.navigation.previous')}
                </Button>
                <Button size="md" className="h-[42px] rounded-[10px] px-5 font-semibold" onClick={onNext} disabled={!canNext} type="button">
                    {t('page.makeShift.navigation.next')}
                </Button>
            </div>
        </div>
    );
}

type TRequestsShiftBoardProps = {
    loading: boolean;
    error: boolean;
    requestShift: TRequestShift | null;
    wardShiftTypeMap: Map<number, TWardShiftType>;
    separateWeekendColor: boolean;
    onRetry: () => Promise<unknown>;
};

export function RequestsShiftBoard({
    loading,
    error,
    requestShift,
    wardShiftTypeMap,
    separateWeekendColor,
    onRetry,
}: TRequestsShiftBoardProps) {
    const {t} = useTypedTranslation();

    if (loading) {
        return <PageState tone="loading" title={t('page.makeShift.requests.loading')} description={t('page.state.loadingDescription')} />;
    }

    if (error) {
        return (
            <PageState
                tone="error"
                title={t('page.makeShift.requests.error')}
                description={t('page.state.errorDescription')}
                action={{label: t('page.state.retry'), onClick: () => void onRetry()}}
            />
        );
    }

    if (!requestShift) {
        return <PageState tone="empty" title={t('page.makeShift.requests.empty')} description={t('page.state.emptyDescription')} />;
    }

    return (
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
                                    <p key={idx} className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${textColor}`}>
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
                                                                <ShiftBadge shiftType={wardShiftTypeMap.get(wardShiftTypeId ?? -1)} />
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
    );
}

type TRequestsDecisionPanelProps = {
    acceptedRequestSummaries: TAcceptedRequestSummary[];
    pendingRequests: TDutyRequest[];
    rejectedRequests: TDutyRequest[];
    wardShiftTypeMap: Map<number, TWardShiftType>;
    updatingRequestId: number | null;
    onDecideRequest: TDecisionAction;
};

export function RequestsDecisionPanel({
    acceptedRequestSummaries,
    pendingRequests,
    rejectedRequests,
    wardShiftTypeMap,
    updatingRequestId,
    onDecideRequest,
}: TRequestsDecisionPanelProps) {
    const {t} = useTypedTranslation();

    return (
        <div className="w-[360px] shrink-0 rounded-[20px] bg-white shadow-banner">
            <div className="border-b border-sub-4.5 px-6 py-4">
                <p className="font-apple text-[1.25rem] font-semibold text-main-1">{t('page.makeShift.requests.panelTitle')}</p>
            </div>

            <div className="scrollbar-hide max-h-[calc(100vh-22rem)] overflow-y-auto px-6 py-4">
                <RequestsDecisionSection
                    title={t('page.makeShift.requests.section.accepted')}
                    count={acceptedRequestSummaries.length}
                    emptyLabel={t('page.makeShift.requests.emptyAccepted')}
                    items={acceptedRequestSummaries}
                    renderActions={(item) => (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                            onClick={() => onDecideRequest(item.id, null)}
                            disabled={updatingRequestId === item.id}
                            type="button"
                        >
                            {t('page.makeShift.requests.action.hold')}
                        </Button>
                    )}
                    renderBadge={(item) => <ShiftBadge shiftType={wardShiftTypeMap.get(item.wardShiftTypeId ?? -1)} />}
                />

                <RequestsDecisionSection
                    className="mt-6"
                    title={t('page.makeShift.requests.section.pending')}
                    count={pendingRequests.length}
                    emptyLabel={t('page.makeShift.requests.emptyPending')}
                    items={pendingRequests}
                    renderActions={(item) => (
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                onClick={() => onDecideRequest(item.wardReqShiftId, true)}
                                disabled={updatingRequestId === item.wardReqShiftId}
                                type="button"
                            >
                                {t('page.makeShift.requests.action.accept')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                onClick={() => onDecideRequest(item.wardReqShiftId, false)}
                                disabled={updatingRequestId === item.wardReqShiftId}
                                type="button"
                            >
                                {t('page.makeShift.requests.action.reject')}
                            </Button>
                        </div>
                    )}
                    renderBadge={(item) => <ShiftBadge shiftType={wardShiftTypeMap.get(item.wardShiftTypeId ?? -1)} isOnlyRequest />}
                />

                <RequestsDecisionSection
                    className="mt-6"
                    title={t('page.makeShift.requests.section.rejected')}
                    count={rejectedRequests.length}
                    emptyLabel={t('page.makeShift.requests.emptyRejected')}
                    items={rejectedRequests}
                    renderActions={(item) => (
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                onClick={() => onDecideRequest(item.wardReqShiftId, true)}
                                disabled={updatingRequestId === item.wardReqShiftId}
                                type="button"
                            >
                                {t('page.makeShift.requests.action.accept')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 rounded-[10px] px-3 text-sm font-semibold"
                                onClick={() => onDecideRequest(item.wardReqShiftId, null)}
                                disabled={updatingRequestId === item.wardReqShiftId}
                                type="button"
                            >
                                {t('page.makeShift.requests.action.hold')}
                            </Button>
                        </div>
                    )}
                    renderBadge={(item) => <ShiftBadge shiftType={wardShiftTypeMap.get(item.wardShiftTypeId ?? -1)} isOnlyRequest />}
                />
            </div>
        </div>
    );
}

type TRequestsDecisionSectionItem = TAcceptedRequestSummary | TDutyRequest;

type TRequestsDecisionSectionProps<TItem extends TRequestsDecisionSectionItem> = {
    className?: string;
    title: string;
    count: number;
    emptyLabel: string;
    items: TItem[];
    renderBadge: (item: TItem) => ReactNode;
    renderActions: (item: TItem) => ReactNode;
};

function RequestsDecisionSection<TItem extends TRequestsDecisionSectionItem>({
    className,
    title,
    count,
    emptyLabel,
    items,
    renderBadge,
    renderActions,
}: TRequestsDecisionSectionProps<TItem>) {
    const {t} = useTypedTranslation();

    return (
        <div className={className}>
            <div className="flex items-center justify-between">
                <p className="font-apple text-base font-semibold text-sub-1">{title}</p>
                <p className="font-apple text-sm font-medium text-gray-4">{t('page.makeShift.requests.count', {count})}</p>
            </div>

            <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                    <p className="font-apple text-sm font-medium text-gray-4">{emptyLabel}</p>
                ) : (
                    items.map((item) => (
                        <div
                            key={'wardReqShiftId' in item ? item.wardReqShiftId : item.id}
                            className="flex items-center gap-3 rounded-[10px] border border-gray-6 px-3 py-2"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-apple text-sm font-medium text-sub-1">
                                    {item.nurseName} / {item.date}일
                                </p>
                            </div>
                            {renderBadge(item)}
                            {renderActions(item)}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
