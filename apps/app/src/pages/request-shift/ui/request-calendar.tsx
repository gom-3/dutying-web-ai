import {cn} from '@dutying/utils/style';
import {type DropResult} from '@hello-pangea/dnd';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowRight, UserPlus} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {useNavigate} from 'react-router-dom';
import {events, sendEvent} from '@/analytics';
import type {TNurse} from '@/entities/nurse';
import type {TRequestShift} from '@/entities/shift';
import type {TShiftTeam} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import useRequestShift from '@/features/request-shift';
import {buildMakeShiftWorkerMovePayload} from '@/pages/make-shift/model/make-shift-worker-order';
import {
    applyNursePriorityMoveToSchedule,
    applyNursePriorityMoveToShiftTeams,
    getDisplayWorkersFromSchedule,
    sortScheduleByTeamNurseOrder,
} from '@/pages/make-shift/model/nurse-order-sync';
import {MakeShiftCalendar} from '@/pages/make-shift/ui/steps/shared/make-shift-calendar';
import {NurseAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import RequestDutyRequestPanel from './request-calendar/request-duty-request-panel';
import {createRequestCalendarCellFocus, createShiftNurseIdByNurseId, requestShiftToCalendarData} from './request-calendar/utils';

type TRequestCalendarProps = {
    defaultReviewMode?: 'date' | 'request' | 'pending' | 'nurse';
    canReorderRows?: boolean;
    rowReorderDisabled?: boolean;
    orderSourceNurses?: TNurse[];
    onRowDragEnd?: (result: DropResult) => void;
};

function formatPatchYearMonth(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

const EMPTY_VIOLATION_MAP = new Map();

function findRequestRowByShiftNurseId(requestShift: TRequestShift, shiftNurseId: number) {
    for (const division of requestShift.divisionShiftNurses) {
        for (const row of division) {
            if (row.shiftNurse.shiftNurseId === shiftNurseId) return row;
        }
    }

    return null;
}

export default function ShiftCalendar({
    defaultReviewMode,
    canReorderRows = false,
    rowReorderDisabled = false,
    orderSourceNurses,
    onRowDragEnd,
}: TRequestCalendarProps = {}) {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {
        state: {
            year,
            month,
            requestShift,
            dutyRequestList,
            dutyRequestStatus,
            updatingRequestId,
            focus,
            currentShiftTeam,
            editAvailability,
            wardShiftTypeMap,
        },
        actions: {changeFocus, acceptRequest, acceptRequests, retry},
    } = useRequestShift();
    const {
        state: {wardId},
    } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const reorderInFlightRef = useRef(false);
    const [optimisticRequestShift, setOptimisticRequestShift] = useState<TRequestShift | null>(null);
    const clickAwayRef = useOnclickOutside(() => {
        changeFocus(null);
    });
    const handleSelectCell = useCallback(
        (nextFocus: Parameters<typeof changeFocus>[0]) => {
            changeFocus(nextFocus);
            sendEvent(events.requestPage.calendar.focusCell);
        },
        [changeFocus],
    );
    const hasCurrentTeamNurses = (currentShiftTeam?.nurses.length ?? 0) > 0;
    const requestContextKey = `${wardId ?? 'none'}:${currentShiftTeam?.shiftTeamId ?? 'none'}:${year}:${month}`;

    useEffect(() => {
        reorderInFlightRef.current = false;
        setOptimisticRequestShift(null);
    }, [requestContextKey]);

    const orderedRequestShift = useMemo(
        () => optimisticRequestShift ?? sortScheduleByTeamNurseOrder(requestShift, orderSourceNurses ?? currentShiftTeam?.nurses ?? []),
        [currentShiftTeam?.nurses, optimisticRequestShift, orderSourceNurses, requestShift],
    );
    const handleStandaloneRowDragEnd = useCallback(
        async (result: DropResult) => {
            if (onRowDragEnd) {
                onRowDragEnd(result);

                return;
            }

            if (
                !result.destination ||
                !wardId ||
                !currentShiftTeam ||
                !orderedRequestShift ||
                reorderInFlightRef.current ||
                rowReorderDisabled
            ) {
                return;
            }

            const shiftNurseId = Number.parseInt(result.draggableId, 10);
            const sourceDivisionNum = Number.parseInt(result.source.droppableId, 10);
            const destinationDivisionNum = Number.parseInt(result.destination.droppableId, 10);

            if ([shiftNurseId, sourceDivisionNum, destinationDivisionNum].some(Number.isNaN)) return;

            const row = findRequestRowByShiftNurseId(orderedRequestShift, shiftNurseId);

            if (!row) return;

            const teamNurses = orderSourceNurses ?? currentShiftTeam.nurses;
            const displayWorkers = getDisplayWorkersFromSchedule(orderedRequestShift, teamNurses);

            if (!displayWorkers) return;

            const sourceWorkers = displayWorkers.filter((nurse) => nurse.divisionNum === sourceDivisionNum && nurse.isWorker);
            const destinationWorkers = displayWorkers.filter((nurse) => nurse.divisionNum === destinationDivisionNum && nurse.isWorker);
            const sourceWorkerIndex = sourceWorkers.findIndex((nurse) => nurse.nurseId === row.shiftNurse.nurseId);
            const destinationWorkerIndex = Math.min(result.destination.index, destinationWorkers.length);

            if (sourceWorkerIndex === -1) return;

            const payload = buildMakeShiftWorkerMovePayload(
                teamNurses,
                displayWorkers,
                currentShiftTeam.shiftTeamId,
                row.shiftNurse.nurseId,
                sourceDivisionNum,
                destinationDivisionNum,
                sourceWorkerIndex,
                destinationWorkerIndex,
            );

            if (!payload) return;

            const requestQueryKey = wardQueryOptions.request(wardId, currentShiftTeam.shiftTeamId, year, month).queryKey;
            const dutyQueryKey = wardQueryOptions.duty(wardId, currentShiftTeam.shiftTeamId, year, month).queryKey;
            const shiftTeamsQueryKey = wardQueryKeys.shiftTeams(wardId);
            const shiftTeamNursesQueryKey = wardQueryKeys.shiftTeamNurses(wardId, currentShiftTeam.shiftTeamId);
            const previousRequestShift = queryClient.getQueryData<TRequestShift>(requestQueryKey);
            const previousShiftTeams = queryClient.getQueryData<TShiftTeam[]>(shiftTeamsQueryKey);
            const nextRequestShift = applyNursePriorityMoveToSchedule(orderedRequestShift, payload);

            reorderInFlightRef.current = true;
            setOptimisticRequestShift(nextRequestShift);

            try {
                await Promise.all([
                    queryClient.cancelQueries({queryKey: requestQueryKey}),
                    queryClient.cancelQueries({queryKey: shiftTeamsQueryKey}),
                    queryClient.cancelQueries({queryKey: shiftTeamNursesQueryKey}),
                ]);

                queryClient.setQueryData<TRequestShift>(requestQueryKey, nextRequestShift);
                queryClient.setQueryData<TShiftTeam[]>(shiftTeamsQueryKey, (current) =>
                    current ? applyNursePriorityMoveToShiftTeams(current, payload) : current,
                );

                await NurseAPI.updateNurseOrder(
                    payload.nurseId,
                    payload.sourceShiftTeamId,
                    payload.destinationShiftTeamId,
                    payload.divisionNum,
                    payload.prevPriority,
                    payload.nextPriority,
                    formatPatchYearMonth(year, month),
                );

                await Promise.all([
                    queryClient.invalidateQueries({queryKey: wardQueryKeys.id(wardId)}),
                    queryClient.invalidateQueries({queryKey: shiftTeamsQueryKey}),
                    queryClient.invalidateQueries({queryKey: shiftTeamNursesQueryKey}),
                    queryClient.invalidateQueries({queryKey: requestQueryKey}),
                    queryClient.invalidateQueries({queryKey: dutyQueryKey}),
                    queryClient.invalidateQueries({
                        queryKey: ['ward', wardId, 'shift-team', currentShiftTeam.shiftTeamId, 'schedule-workspace', year, month],
                    }),
                ]);

                setOptimisticRequestShift(null);
            } catch (error) {
                if (previousRequestShift !== undefined) queryClient.setQueryData(requestQueryKey, previousRequestShift);

                if (previousShiftTeams !== undefined) queryClient.setQueryData(shiftTeamsQueryKey, previousShiftTeams);

                setOptimisticRequestShift(null);
                showActionErrorFeedback(error, t('feature.editShiftTeam.moveNurseFailed'));
            } finally {
                reorderInFlightRef.current = false;
            }
        },
        [currentShiftTeam, month, onRowDragEnd, orderSourceNurses, orderedRequestShift, queryClient, rowReorderDisabled, t, wardId, year],
    );
    const goToMemberSettings = useCallback(() => {
        if (!currentShiftTeam) return;

        navigate(`${ROUTE.MEMBER}?shiftTeamId=${currentShiftTeam.shiftTeamId}`);
    }, [currentShiftTeam, navigate]);
    const requestCalendarData = useMemo(
        () => (orderedRequestShift ? requestShiftToCalendarData(orderedRequestShift, year, month, dutyRequestList) : null),
        [dutyRequestList, month, orderedRequestShift, year],
    );
    const focusedCell = useMemo(() => {
        if (focus === null || requestCalendarData === null) return null;

        const row = requestCalendarData.rowIndexByShiftNurseId.get(focus.shiftNurseId);

        return row === undefined ? null : {row, col: focus.day};
    }, [focus, requestCalendarData]);
    const shiftNurseIdByNurseId = useMemo(
        () => (orderedRequestShift ? createShiftNurseIdByNurseId(orderedRequestShift) : new Map<number, number>()),
        [orderedRequestShift],
    );
    const canEditRequests = editAvailability.canEdit;
    const shouldShowRowReorder = canReorderRows || onRowDragEnd === undefined;
    const isRowReorderDisabled = rowReorderDisabled;
    const handleCalendarCellClick = useCallback(
        (rowIndex: number, colIndex: number) => {
            if (colIndex < 0 || requestCalendarData === null) return;

            const row = requestCalendarData.rowsByDocIndex[rowIndex];

            if (!row) return;

            handleSelectCell(
                createRequestCalendarCellFocus({
                    shiftNurseName: row.nurseName,
                    shiftNurseId: row.shiftNurseId,
                    day: colIndex,
                }),
            );
        },
        [handleSelectCell, requestCalendarData],
    );

    useEffect(() => {
        if (!focus || requestCalendarData === null) return;

        const container = containerRef.current;
        const target = container?.querySelector<HTMLElement>(
            `[data-shift-nurse-id="${focus.shiftNurseId}"] [data-day-index="${focus.day}"]`,
        );

        if (!container || !target) return;

        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const overflowRight = targetRect.right - containerRect.right;
        const overflowLeft = targetRect.left - containerRect.left;
        const overflowBottom = targetRect.bottom - containerRect.bottom;
        const overflowTop = targetRect.top - containerRect.top;

        if (overflowRight > 0) container.scrollLeft += overflowRight + 8;

        if (overflowLeft < 0) container.scrollLeft += overflowLeft - 8;

        if (overflowBottom > 0) container.scrollTop += overflowBottom + 8;

        if (overflowTop < 0) container.scrollTop += overflowTop - 8;
    }, [focus, requestCalendarData]);

    if (!orderedRequestShift || !requestCalendarData || !wardShiftTypeMap || !currentShiftTeam) return null;

    return (
        <div
            id="calendar"
            className={cn(
                'mx-auto mt-2 grid min-h-0 w-full max-w-none min-w-[1124px] flex-1 grid-cols-[minmax(840px,1fr)_minmax(271px,clamp(271px,18vw,344px))] items-start gap-3',
                !hasCurrentTeamNurses && 'items-stretch',
            )}
        >
            <section
                className={cn('min-h-0 min-w-0 overflow-hidden rounded-[18px] bg-white p-2', !hasCurrentTeamNurses && 'h-full')}
                aria-label={t('page.request.calendar.ariaLabel')}
            >
                <div ref={clickAwayRef} className="flex h-full min-h-0 flex-col rounded-[18px] bg-white">
                    {hasCurrentTeamNurses ? (
                        <div ref={containerRef} className="min-h-[420px] w-full overflow-x-auto overflow-y-visible rounded-[18px] bg-white">
                            <div className="request-calendar__calendar-frame min-w-[840px]">
                                <MakeShiftCalendar
                                    shift={requestCalendarData.shift}
                                    doc={requestCalendarData.doc}
                                    violationMap={EMPTY_VIOLATION_MAP}
                                    showFaults={false}
                                    variant="simplified"
                                    readonly
                                    disableInitialSelection
                                    showCellStatusPins
                                    focusedCell={focusedCell}
                                    rowNameClassName="text-[clamp(12px,1.05vw,16px)]"
                                    rowGapClassName="gap-y-3"
                                    canReorderRows={shouldShowRowReorder}
                                    rowReorderDisabled={isRowReorderDisabled}
                                    onRowDragEnd={handleStandaloneRowDragEnd}
                                    onCellClick={handleCalendarCellClick}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-4 py-8 text-center">
                            <div className="grid size-12 place-items-center rounded-full bg-main-light text-main-1 shadow-[inset_0_0_0_1px_rgba(112,82,255,0.10)]">
                                <UserPlus aria-hidden className="size-6" strokeWidth={2.2} />
                            </div>
                            <p className="mt-5 max-w-[520px] font-apple text-[22px] leading-[1.35] font-semibold break-keep text-sub-1">
                                <span className="text-main-1">{currentShiftTeam.name}</span>
                                {t('page.request.calendar.noNurseTitleSuffix')}
                            </p>
                            <p className="mt-2 max-w-[560px] font-apple text-[15px] leading-6 font-medium break-keep text-gray-3">
                                {t('page.request.calendar.noNurseDescription')}
                            </p>
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <ManagementActionButton
                                    size="sm"
                                    variant="primary"
                                    className="h-11 cursor-pointer rounded-[12px] px-5 text-[15px]"
                                    onClick={goToMemberSettings}
                                >
                                    {t('page.request.calendar.noNurseAction')}
                                    <ArrowRight aria-hidden className="size-4" />
                                </ManagementActionButton>
                            </div>
                        </div>
                    )}
                </div>
            </section>
            <RequestDutyRequestPanel
                year={year}
                month={month}
                days={orderedRequestShift.days}
                dutyRequestList={dutyRequestList}
                dutyRequestStatus={dutyRequestStatus}
                wardShiftTypeMap={wardShiftTypeMap}
                canEdit={canEditRequests}
                updatingRequestId={updatingRequestId}
                shiftNurseIdByNurseId={shiftNurseIdByNurseId}
                changeFocus={changeFocus}
                acceptRequest={acceptRequest}
                acceptRequests={acceptRequests}
                retry={retry}
                onAcceptAnalytics={(accepted) => sendEvent(events.requestPage.acceptRequest, String(accepted))}
                defaultReviewMode={defaultReviewMode}
                className={!hasCurrentTeamNurses ? 'h-full' : undefined}
            />
        </div>
    );
}
