import {CheckCircle2, ChevronDown} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {twMerge} from 'tailwind-merge';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/request-shift/model/types';
import i18n from '@/i18n';
import pageEmptyStateIcon from '@/shared/assets/images/page-empty-state-visual.webp';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import PageState from '@/shared/ui/PageState';
import {getRequestFocus} from './utils';

interface IRequestDutyRequestPanelProps {
    year: number;
    month: number;
    days: TRequestShift['days'];
    dutyRequestList: TDutyRequest[] | undefined;
    dutyRequestStatus: 'pending' | 'error' | 'success';
    wardShiftTypeMap: Map<number, TWardShiftType>;
    canEdit: boolean;
    updatingRequestId: number | null;
    shiftNurseIdByNurseId: Map<number, number>;
    changeFocus: (focus: TFocus | null) => void;
    acceptRequest: (reqShiftId: number, isAccepted: boolean) => Promise<boolean>;
    acceptRequests: (reqShiftIds: number[], isAccepted: boolean) => Promise<boolean>;
    retry: () => Promise<unknown>;
    onAcceptAnalytics: (accepted: boolean) => void;
    defaultReviewMode?: TReviewMode;
    className?: string;
}

type TReviewMode = 'pending' | 'processed';
type TRequestSort = 'date' | 'nurse' | 'request';
type TRequestRowLabelMode = 'nurse' | 'nurse-date' | 'nurse-requested-at' | 'date';

type TRequestDateGroup = {
    key: string;
    date: number;
    requests: TDutyRequest[];
};
type TRequestNurseGroup = {
    key: string;
    nurseId: number;
    nurseName: string;
    requests: TDutyRequest[];
};

const REQUEST_DATE_GROUP_PAGE_SIZE = 7;
const REQUEST_NURSE_GROUP_PAGE_SIZE = 4;
const REQUEST_FLAT_LIST_PAGE_SIZE = 9;
const PENDING_REQUEST_DISMISS_DELAY_MS = 500;
const REVIEW_PANEL_SURFACE_CLASS_NAME = 'bg-gray-7';
const REVIEW_ROW_SURFACE_CLASS_NAME = 'bg-white';
const REQUEST_EMPTY_VISUAL = (
    <img
        src={pageEmptyStateIcon}
        alt=""
        aria-hidden="true"
        className="h-[198px] w-[229px] object-contain"
        draggable={false}
        loading="lazy"
        decoding="async"
    />
);
const WEEKDAY_LABEL_KEYS = [
    'page.request.panel.weekday.sunday',
    'page.request.panel.weekday.monday',
    'page.request.panel.weekday.tuesday',
    'page.request.panel.weekday.wednesday',
    'page.request.panel.weekday.thursday',
    'page.request.panel.weekday.friday',
    'page.request.panel.weekday.saturday',
] as const;
const getRequestTimestamp = (request: TDutyRequest) => {
    const timestamp = new Date(request.requestDate).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
};
const sortByRequestDate = (current: TDutyRequest, next: TDutyRequest) => {
    const requestDateDiff = getRequestTimestamp(current) - getRequestTimestamp(next);

    if (requestDateDiff !== 0) return requestDateDiff;

    return current.wardReqShiftId - next.wardReqShiftId;
};
const sortByDateThenRequest = (current: TDutyRequest, next: TDutyRequest) => {
    const dateDiff = current.date - next.date;

    if (dateDiff !== 0) return dateDiff;

    return sortByRequestDate(current, next);
};
const sortByNurseName = (current: TDutyRequest, next: TDutyRequest) => {
    const nurseNameDiff = current.nurseName.localeCompare(next.nurseName);

    if (nurseNameDiff !== 0) return nurseNameDiff;

    return sortByDateThenRequest(current, next);
};
const getRequestShiftType = (request: TDutyRequest, wardShiftTypeMap: Map<number, TWardShiftType>) => {
    const shiftType = wardShiftTypeMap.get(request.wardShiftTypeId);

    if (shiftType) return shiftType;

    return {
        wardShiftTypeId: request.wardShiftTypeId,
        name: request.wardShiftTypeShortName,
        shortName: request.wardShiftTypeShortName,
        color: request.wardShiftTypeColor,
        startTime: '',
        endTime: '',
        isDefault: false,
        isOff: request.wardShiftTypeShortName === 'O',
        isCounted: request.wardShiftTypeShortName !== 'O',
        classification: request.wardShiftTypeShortName === 'N' ? 'NIGHT' : request.wardShiftTypeShortName === 'O' ? 'OFF' : 'DAY',
    } as TWardShiftType;
};
const getActionButtonClassName = ({active, tone}: {active: boolean; tone: 'accept' | 'reject'}) =>
    twMerge(
        'h-8 min-w-0 cursor-pointer rounded-[10px] px-1.5 font-apple text-[11px] font-semibold transition-colors min-[1440px]:px-2 min-[1440px]:text-[12px] disabled:cursor-wait disabled:opacity-60',
        active && tone === 'accept' && 'bg-main-1 text-white hover:bg-main-1-hover',
        active && tone === 'reject' && 'bg-gray-3 text-white hover:bg-sub-2',
        !active && 'bg-[#EDF2F7] text-gray-3 hover:bg-[#E4ECF5] hover:text-sub-1',
    );
const getDateMeta = ({year, month, date, days}: {year: number; month: number; date: number; days: TRequestShift['days']}) => {
    const dayType = days.find((day) => day.day === date)?.dayType ?? 'workday';

    if (dayType === 'holiday') {
        return {
            labelKey: 'page.request.panel.dayType.holiday' as const,
            className: 'text-red',
        };
    }

    if (dayType === 'saturday') {
        return {
            labelKey: 'page.request.panel.dayType.saturday' as const,
            className: 'text-blue',
        };
    }

    if (dayType === 'sunday') {
        return {
            labelKey: 'page.request.panel.dayType.sunday' as const,
            className: 'text-red',
        };
    }

    return {
        labelKey: WEEKDAY_LABEL_KEYS[new Date(year, month - 1, date).getDay()] ?? 'page.request.panel.weekday.sunday',
        className: 'text-gray-4',
    };
};

export default function RequestDutyRequestPanel({
    year,
    month,
    days,
    dutyRequestList,
    dutyRequestStatus,
    wardShiftTypeMap,
    canEdit,
    updatingRequestId,
    shiftNurseIdByNurseId,
    changeFocus,
    acceptRequest,
    acceptRequests,
    retry,
    onAcceptAnalytics,
    defaultReviewMode = 'pending',
    className,
}: IRequestDutyRequestPanelProps) {
    const {t} = useTypedTranslation();
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const requestDateTimeFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }),
        [locale],
    );
    const [reviewMode, setReviewMode] = useState<TReviewMode>(canEdit ? defaultReviewMode : 'processed');
    const [requestSort, setRequestSort] = useState<TRequestSort>('date');
    const [requestPageIndex, setRequestPageIndex] = useState(0);
    const [exitingPendingRequestById, setExitingPendingRequestById] = useState<Record<number, TDutyRequest>>({});
    const exitingPendingRequestTimerByIdRef = useRef(new Map<number, number>());
    const isRequestActionLocked = updatingRequestId !== null;
    const isBulkUpdating = updatingRequestId === -1;
    const displayedRequestList = canEdit ? dutyRequestList : dutyRequestList?.filter((request) => request.isAccepted === true);
    const panelTitle = canEdit ? t('page.request.panel.editTitle') : t('page.request.panel.readonlyTitle');
    const emptyTitle = canEdit ? t('page.request.panel.emptyTitleEdit') : t('page.request.panel.emptyTitleReadonly');
    const emptyDescription = canEdit ? undefined : t('page.request.panel.emptyDescriptionReadonly');
    const sortedRequestList = useMemo(() => {
        const requestById = new Map((displayedRequestList ?? []).map((request) => [request.wardReqShiftId, request]));

        for (const request of Object.values(exitingPendingRequestById)) {
            requestById.set(request.wardReqShiftId, {...requestById.get(request.wardReqShiftId), ...request});
        }

        return [...requestById.values()].sort(sortByDateThenRequest);
    }, [displayedRequestList, exitingPendingRequestById]);
    const pendingRequestList = useMemo(
        () =>
            sortedRequestList
                .filter((request) => request.isAccepted === null || exitingPendingRequestById[request.wardReqShiftId] !== undefined)
                .sort(sortByRequestDate),
        [exitingPendingRequestById, sortedRequestList],
    );
    const actionablePendingRequestList = useMemo(
        () =>
            (displayedRequestList ?? []).filter(
                (request) => request.isAccepted === null && exitingPendingRequestById[request.wardReqShiftId] === undefined,
            ),
        [displayedRequestList, exitingPendingRequestById],
    );
    const processedRequestList = useMemo(() => sortedRequestList.filter((request) => request.isAccepted !== null), [sortedRequestList]);
    const panelDisplayTitle = canEdit ? `${panelTitle} (${pendingRequestList.length})` : panelTitle;
    const visibleRequestList = reviewMode === 'pending' ? pendingRequestList : processedRequestList;
    const sortedVisibleRequestList = useMemo(() => {
        const requests = [...visibleRequestList];

        if (requestSort === 'nurse') return requests.sort(sortByNurseName);

        if (requestSort === 'request') return requests.sort(sortByRequestDate);

        return requests.sort(sortByDateThenRequest);
    }, [requestSort, visibleRequestList]);
    const requestNurseGroups = useMemo(() => {
        if (requestSort !== 'nurse') return [];

        const groupMap = new Map<number, TRequestNurseGroup>();

        for (const request of sortedVisibleRequestList) {
            const currentGroup = groupMap.get(request.nurseId);

            if (currentGroup) {
                currentGroup.requests.push(request);
                continue;
            }

            groupMap.set(request.nurseId, {
                key: String(request.nurseId),
                nurseId: request.nurseId,
                nurseName: request.nurseName,
                requests: [request],
            });
        }

        return [...groupMap.values()]
            .map((group) => ({
                ...group,
                requests: [...group.requests].sort(sortByDateThenRequest),
            }))
            .sort((current, next) => {
                const nurseNameDiff = current.nurseName.localeCompare(next.nurseName);

                return nurseNameDiff !== 0 ? nurseNameDiff : current.nurseId - next.nurseId;
            });
    }, [requestSort, sortedVisibleRequestList]);
    const requestDateGroups = useMemo(() => {
        if (requestSort !== 'date') return [];

        const groupMap = new Map<number, TDutyRequest[]>();

        for (const request of sortedVisibleRequestList) {
            const currentRequests = groupMap.get(request.date);

            if (currentRequests) {
                currentRequests.push(request);
                continue;
            }

            groupMap.set(request.date, [request]);
        }

        return [...groupMap.entries()]
            .map(
                ([date, requests]): TRequestDateGroup => ({
                    key: String(date),
                    date,
                    requests: [...requests].sort(sortByRequestDate),
                }),
            )
            .sort((current, next) => current.date - next.date);
    }, [requestSort, sortedVisibleRequestList]);
    const flatRequestList = requestSort === 'request' ? sortedVisibleRequestList : [];
    const totalDisplayCount =
        requestSort === 'date' ? requestDateGroups.length : requestSort === 'nurse' ? requestNurseGroups.length : flatRequestList.length;
    const pageSize =
        requestSort === 'date'
            ? REQUEST_DATE_GROUP_PAGE_SIZE
            : requestSort === 'nurse'
              ? REQUEST_NURSE_GROUP_PAGE_SIZE
              : REQUEST_FLAT_LIST_PAGE_SIZE;
    const lastPageIndex = Math.max(Math.ceil(totalDisplayCount / pageSize) - 1, 0);
    const currentPageIndex = Math.min(requestPageIndex, lastPageIndex);
    const visibleStartIndex = currentPageIndex * pageSize;
    const visibleDateGroups = requestDateGroups.slice(visibleStartIndex, visibleStartIndex + pageSize);
    const visibleNurseGroups = requestNurseGroups.slice(visibleStartIndex, visibleStartIndex + pageSize);
    const visibleFlatRequests = flatRequestList.slice(visibleStartIndex, visibleStartIndex + pageSize);
    const visibleItemCount =
        requestSort === 'date'
            ? visibleDateGroups.length
            : requestSort === 'nurse'
              ? visibleNurseGroups.length
              : visibleFlatRequests.length;
    const visibleEndIndex = visibleStartIndex + visibleItemCount;
    const hasRequestPagination = totalDisplayCount > pageSize;
    const hasAnyRequest = sortedRequestList.length > 0;
    const hasVisibleRequest = totalDisplayCount > 0;
    const shouldShowRequestEmptyVisual = !(reviewMode === 'pending' && hasAnyRequest);
    const reviewModeOptions: Array<{value: TReviewMode; label: string; count?: number}> = [
        {value: 'pending', label: t('page.request.panel.pendingLabel'), count: pendingRequestList.length},
        {value: 'processed', label: t('page.request.panel.processedLabel')},
    ];
    const requestSortOptions: Array<{value: TRequestSort; label: string}> = [
        {value: 'date', label: t('page.request.panel.sortByDate')},
        {value: 'nurse', label: t('page.request.panel.sortByNurse')},
        {value: 'request', label: t('page.request.panel.sortByRequestOrder')},
    ];
    const pendingEmptyTitle = t('page.request.panel.pendingEmptyTitle');
    const processedEmptyTitle = t('page.request.panel.processedEmptyTitle');
    const markPendingRequestExiting = (dutyRequest: TDutyRequest, nextAccepted: boolean) => {
        if (dutyRequest.isAccepted !== null) return;

        const previousTimer = exitingPendingRequestTimerByIdRef.current.get(dutyRequest.wardReqShiftId);

        if (previousTimer !== undefined) {
            window.clearTimeout(previousTimer);
            exitingPendingRequestTimerByIdRef.current.delete(dutyRequest.wardReqShiftId);
        }

        setExitingPendingRequestById((current) => ({
            ...current,
            [dutyRequest.wardReqShiftId]: {...dutyRequest, isAccepted: nextAccepted},
        }));
    };
    const clearPendingRequestExit = (reqShiftId: number) => {
        const previousTimer = exitingPendingRequestTimerByIdRef.current.get(reqShiftId);

        if (previousTimer !== undefined) {
            window.clearTimeout(previousTimer);
            exitingPendingRequestTimerByIdRef.current.delete(reqShiftId);
        }

        setExitingPendingRequestById((current) => {
            if (current[reqShiftId] === undefined) return current;

            const next = {...current};

            delete next[reqShiftId];

            return next;
        });
    };
    const schedulePendingRequestDismissal = (dutyRequest: TDutyRequest) => {
        if (dutyRequest.isAccepted !== null) return;

        const previousTimer = exitingPendingRequestTimerByIdRef.current.get(dutyRequest.wardReqShiftId);

        if (previousTimer !== undefined) {
            window.clearTimeout(previousTimer);
        }

        const nextTimer = window.setTimeout(() => {
            exitingPendingRequestTimerByIdRef.current.delete(dutyRequest.wardReqShiftId);
            setExitingPendingRequestById((current) => {
                const next = {...current};

                delete next[dutyRequest.wardReqShiftId];

                return next;
            });
        }, PENDING_REQUEST_DISMISS_DELAY_MS);

        exitingPendingRequestTimerByIdRef.current.set(dutyRequest.wardReqShiftId, nextTimer);
    };
    const decideRequest = async (dutyRequest: TDutyRequest, nextAccepted: boolean) => {
        if (isRequestActionLocked) return;

        if (dutyRequest.isAccepted === nextAccepted) return;

        markPendingRequestExiting(dutyRequest, nextAccepted);

        let accepted = false;

        try {
            accepted = await acceptRequest(dutyRequest.wardReqShiftId, nextAccepted);
        } catch (error) {
            clearPendingRequestExit(dutyRequest.wardReqShiftId);
            throw error;
        }

        if (!accepted) {
            clearPendingRequestExit(dutyRequest.wardReqShiftId);

            return;
        }

        onAcceptAnalytics(nextAccepted);
        schedulePendingRequestDismissal(dutyRequest);
        toast.success(
            nextAccepted
                ? t('page.request.panel.acceptedToast', {
                      nurseName: dutyRequest.nurseName,
                      shiftType: getRequestShiftType(dutyRequest, wardShiftTypeMap).shortName,
                  })
                : t('page.request.panel.rejectedToast', {
                      nurseName: dutyRequest.nurseName,
                      shiftType: getRequestShiftType(dutyRequest, wardShiftTypeMap).shortName,
                  }),
        );
    };
    const acceptAllPendingRequests = async () => {
        if (isRequestActionLocked || actionablePendingRequestList.length === 0) return;

        const pendingRequestIds = actionablePendingRequestList.map((request) => request.wardReqShiftId);

        for (const dutyRequest of actionablePendingRequestList) {
            markPendingRequestExiting(dutyRequest, true);
        }

        let accepted = false;

        try {
            accepted = await acceptRequests(pendingRequestIds, true);
        } catch (error) {
            for (const dutyRequest of actionablePendingRequestList) {
                clearPendingRequestExit(dutyRequest.wardReqShiftId);
            }

            throw error;
        }

        if (!accepted) {
            for (const dutyRequest of actionablePendingRequestList) {
                clearPendingRequestExit(dutyRequest.wardReqShiftId);
            }

            return;
        }

        onAcceptAnalytics(true);

        for (const dutyRequest of actionablePendingRequestList) {
            schedulePendingRequestDismissal(dutyRequest);
        }

        toast.success(t('page.request.panel.acceptAll', {count: pendingRequestIds.length}));
    };

    useEffect(
        () => () => {
            for (const timerId of exitingPendingRequestTimerByIdRef.current.values()) {
                window.clearTimeout(timerId);
            }
        },
        [],
    );

    const renderRequestRow = (dutyRequest: TDutyRequest, labelMode: TRequestRowLabelMode = 'nurse') => {
        const requestFocus = getRequestFocus(dutyRequest, shiftNurseIdByNurseId);
        const isExitingPendingRequest = exitingPendingRequestById[dutyRequest.wardReqShiftId] !== undefined;
        const isUpdating = updatingRequestId === dutyRequest.wardReqShiftId || isBulkUpdating;
        const isAccepted = dutyRequest.isAccepted === true;
        const isRejected = dutyRequest.isAccepted === false;
        const dateLabel = t('page.request.panel.dateLabel', {month, date: dutyRequest.date});
        const requestDateTime = new Date(dutyRequest.requestDate);
        const requestedAtLabel = t('page.request.panel.requestDateTimeLabel', {
            date: Number.isNaN(requestDateTime.getTime()) ? dutyRequest.requestDate : requestDateTimeFormatter.format(requestDateTime),
        });
        const primaryLabel = labelMode === 'date' ? dateLabel : dutyRequest.nurseName;
        const focusRequest = () => {
            if (!requestFocus) return;

            changeFocus(requestFocus);
        };

        return (
            <div
                key={dutyRequest.wardReqShiftId}
                className={twMerge(
                    'flex min-w-0 items-center gap-1.5 rounded-[12px] px-2 py-1.5 transition-colors min-[1440px]:gap-2 min-[1440px]:px-2.5',
                    REVIEW_ROW_SURFACE_CLASS_NAME,
                    requestFocus && 'hover:bg-[#FBFDFF]',
                    (isUpdating || isExitingPendingRequest) && 'opacity-70',
                )}
            >
                <button
                    type="button"
                    className={twMerge(
                        'flex min-w-0 flex-1 items-center gap-2 text-left',
                        requestFocus ? 'cursor-pointer' : 'cursor-default',
                    )}
                    onClick={focusRequest}
                >
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-apple text-[13px] font-semibold text-sub-1">{primaryLabel}</span>
                        {labelMode === 'nurse-date' || labelMode === 'nurse-requested-at' ? (
                            <span className="mt-0.5 block truncate font-apple text-[11px] font-medium text-gray-4">
                                {labelMode === 'nurse-requested-at' ? requestedAtLabel : dateLabel}
                            </span>
                        ) : null}
                    </span>
                </button>
                <button
                    type="button"
                    className={twMerge(
                        'grid size-[22px] shrink-0 place-items-center rounded-[7px] transition-transform disabled:opacity-100',
                        requestFocus ? 'cursor-pointer hover:scale-[1.04] active:scale-95' : 'cursor-default',
                    )}
                    disabled={!requestFocus}
                    aria-label={`${dutyRequest.nurseName} ${dateLabel} ${t('page.request.panel.viewOnCalendar')}`}
                    onClick={focusRequest}
                >
                    <ShiftBadge
                        shiftType={getRequestShiftType(dutyRequest, wardShiftTypeMap)}
                        className={twMerge('pointer-events-none shrink-0 rounded-[7px] text-[12px]', 'size-[22px]')}
                    />
                </button>
                {canEdit ? (
                    <div className="ml-auto grid w-[94px] shrink-0 grid-cols-2 gap-1 min-[1440px]:w-[106px]">
                        <button
                            type="button"
                            className={getActionButtonClassName({active: isAccepted, tone: 'accept'})}
                            disabled={isRequestActionLocked || isExitingPendingRequest}
                            aria-pressed={isAccepted}
                            onClick={() => void decideRequest(dutyRequest, true)}
                        >
                            {t('page.request.panel.accept')}
                        </button>
                        <button
                            type="button"
                            className={getActionButtonClassName({active: isRejected, tone: 'reject'})}
                            disabled={isRequestActionLocked || isExitingPendingRequest}
                            aria-pressed={isRejected}
                            onClick={() => void decideRequest(dutyRequest, false)}
                        >
                            {t('page.request.panel.reject')}
                        </button>
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <aside
            id="nurse_request_list"
            className={twMerge('h-fit w-full min-w-0 rounded-[18px] bg-white', className)}
            aria-label={panelDisplayTitle}
        >
            <div className="px-2 pt-2 min-[1440px]:px-2.5 min-[1440px]:pt-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    <p className="pl-1 font-apple text-[15px] font-semibold text-sub-1 min-[1440px]:text-[17px]">{panelDisplayTitle}</p>
                </div>
                {canEdit && hasAnyRequest ? (
                    <>
                        <div
                            className="mt-3 grid w-full grid-cols-2 rounded-[12px] bg-[#F2F4F6] p-0.5"
                            aria-label={t('page.request.panel.summaryLabel')}
                        >
                            {reviewModeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    id={option.value === 'pending' ? 'nurse_request_pending_toggle' : undefined}
                                    className={twMerge(
                                        'relative h-8 min-w-0 cursor-pointer overflow-visible rounded-[9px] px-1.5 font-apple text-[11px] font-semibold whitespace-nowrap transition-colors min-[1440px]:px-2 min-[1440px]:text-[12px]',
                                        reviewMode === option.value ? 'bg-white text-sub-1' : 'text-gray-4 hover:text-sub-1',
                                    )}
                                    aria-pressed={reviewMode === option.value}
                                    onClick={() => {
                                        setReviewMode(option.value);
                                        setRequestPageIndex(0);
                                    }}
                                >
                                    <span className="block min-w-0 truncate">{option.label}</span>
                                    {option.count !== undefined && option.count > 0 ? (
                                        <span className="absolute -top-1.5 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F07C84] px-1 font-poppins text-[10px] leading-none font-semibold text-white">
                                            {option.count}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 flex justify-end">
                            <label htmlFor="nurse_request_sort" className="sr-only">
                                {t('page.request.panel.viewModeLabel')}
                            </label>
                            <div className="relative w-[116px] min-[1440px]:w-[128px]">
                                <select
                                    id="nurse_request_sort"
                                    value={requestSort}
                                    className="h-8 w-full cursor-pointer appearance-none rounded-[10px] bg-gray-7 px-3 pr-8 font-apple text-[12px] font-semibold text-sub-1 transition-colors outline-none hover:bg-gray-6/70 focus:ring-0 focus-visible:ring-0"
                                    onChange={(event) => {
                                        setRequestSort(event.target.value as TRequestSort);
                                        setRequestPageIndex(0);
                                    }}
                                >
                                    {requestSortOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-gray-4"
                                />
                            </div>
                        </div>
                        {reviewMode === 'pending' && actionablePendingRequestList.length > 0 ? (
                            <div className="mt-1 flex min-h-8 items-center justify-between gap-3 px-1">
                                <span className="min-w-0 truncate font-apple text-[12px] font-medium text-gray-3">
                                    {t('page.request.panel.pendingRequestCount', {count: actionablePendingRequestList.length})}
                                </span>
                                <button
                                    type="button"
                                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 bg-transparent font-apple text-[12px] font-semibold whitespace-nowrap text-main-1 transition-colors hover:text-main-1-hover active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                                    disabled={isRequestActionLocked}
                                    onClick={() => void acceptAllPendingRequests()}
                                >
                                    <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.4} />
                                    {t('page.request.panel.acceptAllAction')}
                                </button>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>

            <div className="px-1.5 pt-2.5 pb-2 min-[1440px]:px-2 min-[1440px]:pt-3">
                {dutyRequestStatus === 'pending' ? (
                    <PageState
                        tone="loading"
                        title={canEdit ? t('page.request.panel.loadingTitleEdit') : t('page.request.panel.loadingTitleReadonly')}
                        description={
                            canEdit ? t('page.request.panel.loadingDescriptionEdit') : t('page.request.panel.loadingDescriptionReadonly')
                        }
                        className="min-h-[132px] px-5 py-6"
                    />
                ) : dutyRequestStatus === 'error' ? (
                    <PageState
                        tone="error"
                        title={canEdit ? t('page.request.panel.errorTitleEdit') : t('page.request.panel.errorTitleReadonly')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void retry()}}
                        className="min-h-[132px] px-5 py-6"
                    />
                ) : hasVisibleRequest ? (
                    <>
                        {requestSort === 'date' ? (
                            <div className="flex flex-col gap-1.5">
                                {visibleDateGroups.map((requestGroup) => {
                                    const dateMeta = getDateMeta({year, month, date: requestGroup.date, days});

                                    return (
                                        <section
                                            key={requestGroup.key}
                                            className={twMerge('flex gap-1.5 rounded-[16px] p-1.5', REVIEW_PANEL_SURFACE_CLASS_NAME)}
                                        >
                                            <div className="flex w-[56px] shrink-0 flex-col items-center justify-center text-center min-[1440px]:w-[62px]">
                                                <span className="font-apple text-[11px] leading-none font-semibold text-gray-4">
                                                    {t('page.request.panel.monthShortLabel', {month})}
                                                </span>
                                                <span className="mt-1 font-apple text-[17px] leading-none font-semibold tracking-[-0.03em] text-sub-1">
                                                    {t('page.request.panel.dayShortLabel', {date: requestGroup.date})}
                                                </span>
                                                <span
                                                    className={twMerge(
                                                        'mt-1.5 font-apple text-[11px] leading-none font-medium',
                                                        dateMeta.className,
                                                    )}
                                                >
                                                    {t(dateMeta.labelKey)}
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                                {requestGroup.requests.map((dutyRequest) => renderRequestRow(dutyRequest))}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        ) : requestSort === 'nurse' ? (
                            <div className="flex flex-col gap-1.5">
                                {visibleNurseGroups.map((requestGroup) => (
                                    <section
                                        key={requestGroup.key}
                                        className={twMerge('flex gap-1.5 rounded-[16px] p-1.5', REVIEW_PANEL_SURFACE_CLASS_NAME)}
                                    >
                                        <div className="flex w-[56px] shrink-0 flex-col items-center justify-center text-center min-[1440px]:w-[62px]">
                                            <span className="max-w-full truncate font-apple text-[15px] leading-none font-semibold tracking-[-0.02em] text-sub-1">
                                                {requestGroup.nurseName}
                                            </span>
                                            <span className="mt-1.5 font-apple text-[11px] leading-none font-medium text-gray-4">
                                                {t('page.request.panel.groupRequestCaseCount', {count: requestGroup.requests.length})}
                                            </span>
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            {requestGroup.requests.map((dutyRequest) => renderRequestRow(dutyRequest, 'date'))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {visibleFlatRequests.map((dutyRequest) => renderRequestRow(dutyRequest, 'nurse-requested-at'))}
                            </div>
                        )}
                        {hasRequestPagination ? (
                            <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    className="h-9 cursor-pointer rounded-full bg-gray-7 px-4 font-apple text-[13px] font-semibold text-sub-2 transition-colors hover:bg-gray-6/60 disabled:cursor-not-allowed disabled:text-gray-4 disabled:opacity-50"
                                    disabled={currentPageIndex === 0}
                                    onClick={() => setRequestPageIndex((current) => Math.max(current - 1, 0))}
                                >
                                    {t('page.request.panel.showPrevious')}
                                </button>
                                <span className="font-poppins text-[12px] font-medium text-gray-4">
                                    {visibleStartIndex + 1}-{visibleEndIndex} / {totalDisplayCount}
                                </span>
                                <button
                                    type="button"
                                    className="h-9 cursor-pointer rounded-full bg-gray-7 px-4 font-apple text-[13px] font-semibold text-sub-2 transition-colors hover:bg-gray-6/60 disabled:cursor-not-allowed disabled:text-gray-4 disabled:opacity-50"
                                    disabled={currentPageIndex === lastPageIndex}
                                    onClick={() => setRequestPageIndex((current) => Math.min(current + 1, lastPageIndex))}
                                >
                                    {t('page.request.panel.showNext')}
                                </button>
                            </div>
                        ) : null}
                    </>
                ) : (
                    <PageState
                        tone="empty"
                        title={
                            reviewMode === 'pending' && hasAnyRequest
                                ? pendingEmptyTitle
                                : reviewMode === 'processed' && hasAnyRequest
                                  ? processedEmptyTitle
                                  : emptyTitle
                        }
                        description={hasAnyRequest ? undefined : emptyDescription}
                        titleClassName="max-w-full !break-normal [overflow-wrap:anywhere]"
                        visual={shouldShowRequestEmptyVisual ? REQUEST_EMPTY_VISUAL : undefined}
                        className="min-h-[132px] px-5 py-6"
                    />
                )}
            </div>
        </aside>
    );
}
