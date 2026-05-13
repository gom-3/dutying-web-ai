import {cn} from '@dutying/utils/style';
import {Check, Clock, X} from 'lucide-react';
import {type TDutyRequest, type TWardShiftType} from '@/entities';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {MAKE_SHIFT_STEP_NAV_BUTTON_CLASS} from '../make-shift-step-nav';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';

type TDecisionAction = (wardReqShiftId: number, isAccepted: boolean | null) => void;

type TRequestsShiftsHeaderProps = {
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
};

export function RequestsShiftsHeader({canPrev, canNext, onPrev, onNext}: TRequestsShiftsHeaderProps) {
    const {t} = useTypedTranslation();

    return (
        <div className="make-shift-requests-header flex flex-wrap items-center justify-between gap-[clamp(14px,1.5vw,24px)]">
            <div className="make-shift-requests-header__intro flex min-w-0 flex-1 flex-wrap items-baseline gap-x-[clamp(12px,1.2vw,24px)] gap-y-[clamp(6px,0.55vw,10px)]">
                <p className="make-shift-requests-header__title shrink-0 font-apple text-[clamp(20px,1.7vw,30px)] font-semibold text-sub-1">
                    {t('page.makeShift.requests.title')}
                </p>
                <p className="make-shift-requests-header__description max-w-full min-w-0 font-apple text-[clamp(13px,1.1vw,20px)] leading-snug font-medium text-gray-3">
                    {t('page.makeShift.requests.descriptionLine')}
                </p>
            </div>

            <div className="make-shift-requests-header__actions flex shrink-0 items-center gap-[clamp(12px,1.1vw,24px)]">
                <Button
                    variant="secondary"
                    size="md"
                    className={`make-shift-requests-header__nav-button cursor-pointer disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                    onClick={onPrev}
                    disabled={!canPrev}
                    type="button"
                >
                    {t('page.makeShift.navigation.previous')}
                </Button>
                <Button
                    size="md"
                    className={`make-shift-requests-header__nav-button cursor-pointer border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
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

type TRequestsPendingPanelProps = {
    acceptedCount: number;
    pendingCount: number;
    rejectedCount: number;
    pendingRequests: TDutyRequest[];
    wardShiftTypeMap: Map<number, TWardShiftType>;
    updatingRequestId: number | null;
    onDecideRequest: TDecisionAction;
};

const PENDING_ACTION_BTN =
    'h-[clamp(22px,1.75vw,28px)] min-w-0 shrink-0 rounded-[clamp(5px,0.45cqw,8px)] px-[clamp(6px,0.55vw,10px)] text-[clamp(9px,0.72cqw,12px)] font-semibold leading-none';
const REQUEST_SUMMARY_ICON_CLASS = 'size-[clamp(10px,0.9cqw,14px)] shrink-0 stroke-[1.25]';
const REQUEST_SUMMARY_BADGE_CLASS =
    'inline-flex items-center gap-[clamp(2px,0.2cqw,4px)] rounded-full border border-gray-6 bg-main-bg px-[clamp(5px,0.45cqw,8px)] py-[clamp(1px,0.12cqw,3px)]';

/**
 * 대기(미결정) 신청만 표시. 수락 / 거절만 제공하는 좁은 패널.
 */
export function RequestsPendingPanel({
    acceptedCount,
    pendingCount,
    rejectedCount,
    pendingRequests,
    wardShiftTypeMap,
    updatingRequestId,
    onDecideRequest,
}: TRequestsPendingPanelProps) {
    const {t} = useTypedTranslation();

    return (
        <div
            id="make_requests_decision_panel"
            className="make-shift-requests-pending flex w-[clamp(200px,17vw,280px)] shrink-0 flex-col overflow-hidden rounded-[clamp(10px,0.9cqw,16px)] bg-white shadow-banner"
        >
            <div className="make-shift-requests-pending__header flex min-h-0 items-center justify-between gap-[clamp(8px,0.65cqw,12px)] border-b border-sub-4.5 px-[clamp(12px,1.0cqw,16px)] py-[clamp(10px,0.8cqw,14px)]">
                <p className="make-shift-requests-pending__title min-w-0 truncate font-apple text-[clamp(13px,1.05cqw,16px)] leading-tight font-semibold text-main-1">
                    {t('page.makeShift.requests.panelTitle')}
                </p>
                <div
                    className="make-shift-requests-pending__summary flex shrink-0 flex-nowrap items-center justify-end gap-[clamp(4px,0.35cqw,6px)]"
                    aria-label={t('page.makeShift.requests.summaryCountsAria')}
                >
                    <span className={REQUEST_SUMMARY_BADGE_CLASS} title={t('page.makeShift.requests.badge.accepted')}>
                        <Check className={cn(REQUEST_SUMMARY_ICON_CLASS, 'text-green-600')} aria-hidden />
                        <span className="font-apple text-[clamp(9px,0.72cqw,12px)] leading-none font-semibold text-sub-1 tabular-nums">
                            {acceptedCount}
                        </span>
                    </span>
                    <span className={REQUEST_SUMMARY_BADGE_CLASS} title={t('page.makeShift.requests.badge.pending')}>
                        <Clock className={cn(REQUEST_SUMMARY_ICON_CLASS, 'text-main-1')} aria-hidden />
                        <span className="font-apple text-[clamp(9px,0.72cqw,12px)] leading-none font-semibold text-sub-1 tabular-nums">
                            {pendingCount}
                        </span>
                    </span>
                    <span className={REQUEST_SUMMARY_BADGE_CLASS} title={t('page.makeShift.requests.badge.rejected')}>
                        <X className={cn(REQUEST_SUMMARY_ICON_CLASS, 'text-gray-4')} aria-hidden />
                        <span className="font-apple text-[clamp(9px,0.72cqw,12px)] leading-none font-semibold text-sub-1 tabular-nums">
                            {rejectedCount}
                        </span>
                    </span>
                </div>
            </div>

            <div className="make-shift-requests-pending__body flex min-h-0 flex-1 flex-col gap-[clamp(5px,0.45cqw,8px)] overflow-y-auto px-[clamp(12px,1.0cqw,16px)] py-[clamp(6px,0.55cqw,10px)]">
                {pendingRequests.length === 0 ? (
                    <p className="make-shift-requests-pending__empty font-apple text-[clamp(10px,0.78cqw,13px)] leading-snug font-medium text-gray-4">
                        {t('page.makeShift.requests.emptyPending')}
                    </p>
                ) : (
                    pendingRequests.map((item) => (
                        <div
                            key={item.wardReqShiftId}
                            className="make-shift-requests-pending__row flex items-center gap-[clamp(4px,0.35cqw,6px)] rounded-[clamp(6px,0.5cqw,10px)] border border-gray-6 bg-main-bg px-[clamp(5px,0.45cqw,8px)] py-[clamp(4px,0.35cqw,6px)]"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-apple text-[clamp(10px,0.78cqw,13px)] leading-tight font-medium text-sub-1">
                                    {t('page.makeShift.requests.itemLabel', {name: item.nurseName, date: item.date})}
                                </p>
                            </div>
                            <ShiftBadge
                                shiftType={wardShiftTypeMap.get(item.wardShiftTypeId ?? -1)}
                                isOnlyRequest
                                className="!size-[clamp(16px,1.35cqw,22px)] shrink-0 !rounded-[clamp(3px,0.28cqw,5px)] !text-[clamp(8px,0.65cqw,11px)] leading-none"
                            />
                            <div className="flex shrink-0 items-center gap-[clamp(2px,0.2cqw,4px)]">
                                <Button
                                    size="sm"
                                    className={PENDING_ACTION_BTN}
                                    onClick={() => onDecideRequest(item.wardReqShiftId, true)}
                                    disabled={updatingRequestId === item.wardReqShiftId}
                                    type="button"
                                >
                                    {t('page.makeShift.requests.action.accept')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className={PENDING_ACTION_BTN}
                                    onClick={() => onDecideRequest(item.wardReqShiftId, false)}
                                    disabled={updatingRequestId === item.wardReqShiftId}
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
    );
}
