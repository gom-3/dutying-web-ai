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

/**
 * AI 자동 채우기 toolbar와 동일한 톤의 반응형 사이즈로 통일.
 * StatusBadge는 className override로 size 조정.
 */
const STATUS_BADGE_RESPONSIVE_CLASS =
    'make-shift-requests__status-badge px-[clamp(8px,0.85vw,14px)] py-[clamp(2px,0.3vw,6px)] text-[clamp(10px,0.85vw,14px)] gap-[clamp(4px,0.5vw,8px)]';

const REQUESTS_NAV_BUTTON_CLASS =
    'h-[clamp(30px,2.5vw,42px)] rounded-[clamp(8px,0.7vw,10px)] px-[clamp(12px,1.0vw,20px)] text-[clamp(11px,0.95vw,16px)] font-semibold';

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
        <div className="make-shift-requests-header flex flex-wrap items-start justify-between gap-[clamp(14px,1.5vw,24px)]">
            <div className="make-shift-requests-header__intro flex items-baseline gap-[clamp(12px,1.3vw,20px)]">
                <div>
                    <p className="make-shift-requests-header__title font-apple text-[clamp(20px,1.7vw,30px)] font-semibold text-sub-1">
                        {t('page.makeShift.requests.title')}
                    </p>
                    <p className="make-shift-requests-header__description mt-[clamp(2px,0.2vw,4px)] font-apple text-[clamp(13px,1.1vw,20px)] font-medium text-gray-3">
                        {t('page.makeShift.requests.descriptionPrefix')}{' '}
                        <span className="text-main-1">{t('page.makeShift.requests.descriptionHighlight')}</span>
                        {t('page.makeShift.requests.descriptionSuffix')}
                    </p>
                    <div className="make-shift-requests-header__badges mt-[clamp(8px,0.95vw,16px)] flex flex-wrap items-center gap-[clamp(4px,0.5vw,8px)]">
                        <StatusBadge
                            label={t('page.makeShift.requests.badge.accepted')}
                            tone="success"
                            count={acceptedCount}
                            className={STATUS_BADGE_RESPONSIVE_CLASS}
                        />
                        <StatusBadge
                            label={t('page.makeShift.requests.badge.pending')}
                            tone="brand"
                            count={pendingCount}
                            className={STATUS_BADGE_RESPONSIVE_CLASS}
                        />
                        <StatusBadge
                            label={t('page.makeShift.requests.badge.rejected')}
                            tone="neutral"
                            count={rejectedCount}
                            className={STATUS_BADGE_RESPONSIVE_CLASS}
                        />
                    </div>
                </div>
            </div>

            <div className="make-shift-requests-header__actions flex items-center gap-[clamp(6px,0.55vw,12px)]">
                <Button
                    variant="secondary"
                    size="md"
                    className={`make-shift-requests-header__nav-button ${REQUESTS_NAV_BUTTON_CLASS}`}
                    onClick={onPrev}
                    disabled={!canPrev}
                    type="button"
                >
                    {t('page.makeShift.navigation.previous')}
                </Button>
                <Button
                    size="md"
                    className={`make-shift-requests-header__nav-button ${REQUESTS_NAV_BUTTON_CLASS}`}
                    onClick={onNext}
                    disabled={!canNext}
                    type="button"
                >
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
        <div id="make_requests_board" className="make-shift-requests-board flex h-full min-h-0 flex-col">
            <div className="make-shift-requests-board__scroll scrollbar-default min-h-0 scroll-m-2 overflow-auto rounded-[clamp(10px,1.0vw,15px)] shadow-banner">
                <div className="make-shift-requests-board__head flex items-center px-[clamp(10px,1.0vw,20px)]">
                    <div className="make-shift-requests-board__head-name w-[clamp(64px,7.0vw,96px)] shrink-0 text-center font-apple text-[clamp(11px,0.95vw,16px)] font-medium text-sub-3">
                        {t('page.makeShift.requests.table.name')}
                    </div>
                    <div className="make-shift-requests-board__head-days min-w-0 flex-1">
                        <div className="inline-flex rounded-[clamp(20px,2.0vw,40px)] px-[clamp(8px,0.85vw,16px)] py-[clamp(2px,0.2vw,4px)]">
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
                                        className={`make-shift-requests-board__day-number w-[clamp(22px,2.4vw,36px)] flex-1 rounded-full text-center font-poppins text-[clamp(10px,0.85vw,16px)] ${textColor}`}
                                    >
                                        {item.day}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="make-shift-requests-board__rows flex flex-col">
                    {requestShift.divisionShiftNurses.map((division, divisionIndex) => {
                        if (division.length === 0) return null;

                        return (
                            <div key={divisionIndex} className="make-shift-requests-board__division rounded-[clamp(14px,1.4vw,20px)] bg-white">
                                <div className="min-w-0">
                                    <div className="flex flex-col">
                                        {division.map((row) => (
                                            <div
                                                key={row.shiftNurse.shiftNurseId}
                                                className="make-shift-requests-board__row flex h-[clamp(28px,2.5vw,40px)] items-center px-[clamp(10px,1.0vw,20px)]"
                                            >
                                                <div className="make-shift-requests-board__row-name w-[clamp(64px,7.0vw,96px)] shrink-0 truncate text-center font-apple text-[clamp(13px,1.2vw,20px)] text-sub-1">
                                                    {row.shiftNurse.name}
                                                </div>
                                                <div className="make-shift-requests-board__row-cells flex h-full min-w-max px-[clamp(8px,0.95vw,17px)]">
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
                                                                className={`make-shift-requests-board__cell flex h-full w-[clamp(22px,2.4vw,36px)] items-center justify-center px-[clamp(2px,0.2vw,4px)] ${bg}`}
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

/**
 * Decision panel 내 좁은 액션 버튼 공통 사이즈 (반응형).
 */
const REQUESTS_DECISION_ACTION_BUTTON_CLASS =
    'h-[clamp(24px,2.0vw,32px)] rounded-[clamp(8px,0.7vw,10px)] px-[clamp(8px,0.85vw,12px)] text-[clamp(10px,0.85vw,14px)] font-semibold';

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
        <div
            id="make_requests_decision_panel"
            className="make-shift-requests-decision w-[clamp(240px,24vw,360px)] shrink-0 rounded-[clamp(14px,1.4vw,20px)] bg-white shadow-banner"
        >
            <div className="make-shift-requests-decision__header border-b border-sub-4.5 px-[clamp(14px,1.5vw,24px)] py-[clamp(10px,1.0vw,16px)]">
                <p className="make-shift-requests-decision__title font-apple text-[clamp(13px,1.2vw,20px)] font-semibold text-main-1">
                    {t('page.makeShift.requests.panelTitle')}
                </p>
            </div>

            <div className="make-shift-requests-decision__body scrollbar-hide max-h-[calc(100vh-22rem)] overflow-y-auto px-[clamp(14px,1.5vw,24px)] py-[clamp(10px,1.0vw,16px)]">
                <RequestsDecisionSection
                    title={t('page.makeShift.requests.section.accepted')}
                    count={acceptedRequestSummaries.length}
                    emptyLabel={t('page.makeShift.requests.emptyAccepted')}
                    items={acceptedRequestSummaries}
                    renderActions={(item) => (
                        <Button
                            variant="secondary"
                            size="sm"
                            className={REQUESTS_DECISION_ACTION_BUTTON_CLASS}
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
                    className="mt-[clamp(14px,1.5vw,24px)]"
                    title={t('page.makeShift.requests.section.pending')}
                    count={pendingRequests.length}
                    emptyLabel={t('page.makeShift.requests.emptyPending')}
                    items={pendingRequests}
                    renderActions={(item) => (
                        <div className="flex items-center gap-[clamp(2px,0.2vw,4px)]">
                            <Button
                                size="sm"
                                className={REQUESTS_DECISION_ACTION_BUTTON_CLASS}
                                onClick={() => onDecideRequest(item.wardReqShiftId, true)}
                                disabled={updatingRequestId === item.wardReqShiftId}
                                type="button"
                            >
                                {t('page.makeShift.requests.action.accept')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className={REQUESTS_DECISION_ACTION_BUTTON_CLASS}
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
                    className="mt-[clamp(14px,1.5vw,24px)]"
                    title={t('page.makeShift.requests.section.rejected')}
                    count={rejectedRequests.length}
                    emptyLabel={t('page.makeShift.requests.emptyRejected')}
                    items={rejectedRequests}
                    renderActions={(item) => (
                        <div className="flex items-center gap-[clamp(2px,0.2vw,4px)]">
                            <Button
                                size="sm"
                                className={REQUESTS_DECISION_ACTION_BUTTON_CLASS}
                                onClick={() => onDecideRequest(item.wardReqShiftId, true)}
                                disabled={updatingRequestId === item.wardReqShiftId}
                                type="button"
                            >
                                {t('page.makeShift.requests.action.accept')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className={REQUESTS_DECISION_ACTION_BUTTON_CLASS}
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
        <div className={`make-shift-requests-decision__section ${className ?? ''}`}>
            <div className="make-shift-requests-decision__section-header flex items-center justify-between">
                <p className="make-shift-requests-decision__section-title font-apple text-[clamp(11px,0.95vw,16px)] font-semibold text-sub-1">
                    {title}
                </p>
                <p className="make-shift-requests-decision__section-count font-apple text-[clamp(10px,0.85vw,14px)] font-medium text-gray-4">
                    {t('page.makeShift.requests.count', {count})}
                </p>
            </div>

            <div className="make-shift-requests-decision__section-list mt-[clamp(8px,0.85vw,12px)] space-y-[clamp(6px,0.55vw,8px)]">
                {items.length === 0 ? (
                    <p className="make-shift-requests-decision__empty font-apple text-[clamp(10px,0.85vw,14px)] font-medium text-gray-4">
                        {emptyLabel}
                    </p>
                ) : (
                    items.map((item) => (
                        <div
                            key={'wardReqShiftId' in item ? item.wardReqShiftId : item.id}
                            className="make-shift-requests-decision__item flex items-center gap-[clamp(8px,0.85vw,12px)] rounded-[clamp(8px,0.7vw,10px)] border border-gray-6 px-[clamp(8px,0.85vw,12px)] py-[clamp(6px,0.55vw,8px)]"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="make-shift-requests-decision__item-label truncate font-apple text-[clamp(10px,0.85vw,14px)] font-medium text-sub-1">
                                    {t('page.makeShift.requests.itemLabel', {name: item.nurseName, date: item.date})}
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
