import {cn} from '@dutying/utils/style';
import {type DropResult} from '@hello-pangea/dnd';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowRight, UserPlus} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {useNavigate} from 'react-router-dom';
import {events, sendEvent} from '@/analytics';
import type {TRequestShift} from '@/entities/shift';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import type {TNurse} from '@/entities/nurse';
import type {TShiftTeam} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import useRequestShift from '@/features/request-shift';
import {getWardSkillSettings, resolveWardSkillLevels} from '@/features/ward-skill/model/skill-level';
import {
    applyNursePriorityMoveToSchedule,
    applyNursePriorityMoveToShiftTeams,
    getDisplayWorkersFromSchedule,
    sortScheduleByTeamNurseOrder,
} from '@/pages/make-shift/model/nurse-order-sync';
import {buildMakeShiftWorkerMovePayload} from '@/pages/make-shift/model/make-shift-worker-order';
import {NurseAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import RequestCalendarGrid from './request-calendar/request-calendar-grid';
import RequestCalendarHeader from './request-calendar/request-calendar-header';
import RequestDutyRequestPanel from './request-calendar/request-duty-request-panel';
import {useRequestCalendarFocusScroll} from './request-calendar/use-request-calendar-focus-scroll';
import {createConnectedNurseIdSet, createDutyRequestLookup, createShiftNurseIdByNurseId} from './request-calendar/utils';

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
            wardShiftTypeMap,
            currentShiftTeam,
            shiftTeams,
            editAvailability,
        },
        actions: {changeFocus, acceptRequest, acceptRequests, retry},
    } = useRequestShift();
    const {
        state: {wardId},
    } = useAuth();
    const separateWeekendColor = useUIConfigStore((state) => state.separateWeekendColor);
    const focusedCellRef = useRef<HTMLDivElement>(null);
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
    const skillSettings = useMemo(() => getWardSkillSettings(wardId), [wardId]);
    const allWardNurses = useMemo(
        () => shiftTeams?.flatMap((shiftTeam) => shiftTeam.nurses) ?? currentShiftTeam?.nurses ?? [],
        [currentShiftTeam?.nurses, shiftTeams],
    );
    const {config: skillConfig, levelsByNurseId} = useMemo(
        () => resolveWardSkillLevels(allWardNurses, skillSettings),
        [allWardNurses, skillSettings],
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

    useRequestCalendarFocusScroll({focus, focusedCellRef, containerRef});

    if (!orderedRequestShift || !wardShiftTypeMap || !currentShiftTeam) return null;

    const canEditRequests = editAvailability.canEdit;
    const dutyRequestLookup = createDutyRequestLookup(dutyRequestList);
    const connectedNurseIds = createConnectedNurseIdSet(currentShiftTeam);
    const shiftNurseIdByNurseId = createShiftNurseIdByNurseId(orderedRequestShift);
    const showSkillColumn = skillConfig.enabled;
    const shouldShowRowReorder = canReorderRows || onRowDragEnd === undefined;
    const isRowReorderDisabled = rowReorderDisabled;

    return (
        <div
            id="calendar"
            className={cn(
                'mx-auto mt-2 grid min-h-0 w-full max-w-none min-w-[1160px] flex-1 grid-cols-[minmax(876px,1fr)_minmax(271px,clamp(271px,18vw,344px))] items-start gap-3',
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
                            <div className="min-w-[900px]">
                                <RequestCalendarHeader
                                    days={orderedRequestShift.days}
                                    focusDay={focus?.day}
                                    canReorder={shouldShowRowReorder}
                                    separateWeekendColor={separateWeekendColor}
                                    showSkillColumn={showSkillColumn}
                                />
                                <RequestCalendarGrid
                                    requestShift={orderedRequestShift}
                                    focus={focus}
                                    readonly
                                    canReorder={shouldShowRowReorder}
                                    rowReorderDisabled={isRowReorderDisabled}
                                    separateWeekendColor={separateWeekendColor}
                                    wardShiftTypeMap={wardShiftTypeMap}
                                    dutyRequestLookup={dutyRequestLookup}
                                    connectedNurseIds={connectedNurseIds}
                                    skillConfig={skillConfig}
                                    levelsByNurseId={levelsByNurseId}
                                    showSkillColumn={showSkillColumn}
                                    focusedCellRef={focusedCellRef}
                                    onDragEnd={handleStandaloneRowDragEnd}
                                    onSelectCell={handleSelectCell}
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
