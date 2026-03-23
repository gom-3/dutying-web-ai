import {type DropResult} from '@hello-pangea/dnd';
import {useRef} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {events, sendEvent} from '@/analytics';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import useRequestShift from '@/features/shift/useRequestShift';
import useEditShiftTeam from '@/features/ward/useEditShiftTeam';
import Card from '@/shared/ui/Card';
import RequestCalendarGrid from './request-calendar/RequestCalendarGrid';
import RequestCalendarHeader from './request-calendar/RequestCalendarHeader';
import RequestDutyRequestPanel from './request-calendar/RequestDutyRequestPanel';
import {useRequestCalendarFocusScroll} from './request-calendar/useRequestCalendarFocusScroll';
import {
    createConnectedNurseIdSet,
    createDutyRequestLookup,
    createShiftNurseIdByNurseId,
    getMoveNurseOrderPayload,
    getUnresolvedRequestCount,
    getYearMonthLabel,
} from './request-calendar/utils';

export default function ShiftCalendar() {
    const {
        state: {
            readonly,
            year,
            month,
            requestShift,
            dutyRequestList,
            dutyRequestStatus,
            updatingRequestId,
            focus,
            foldedLevels,
            wardShiftTypeMap,
            currentShiftTeam,
        },
        actions: {changeFocus, foldLevel, acceptRequest, acceptRequests, retry},
    } = useRequestShift();
    const {
        state: {shiftTeams},
        actions: {selectNurse, moveNurseOrder, editDivision},
    } = useEditShiftTeam();
    const separateWeekendColor = useUIConfigStore((state) => state.separateWeekendColor);
    const focusedCellRef = useRef<HTMLParagraphElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const clickAwayRef = useOnclickOutside(() => {
        changeFocus(null);
        selectNurse(null);
    });
    const onDragEnd = ({source, destination, draggableId}: DropResult) => {
        if (!destination || !shiftTeams || !requestShift || !currentShiftTeam) return null;

        if (source.droppableId === destination.droppableId && destination.index === source.index) return;

        const movePayload = getMoveNurseOrderPayload({
            source,
            destination,
            draggableId,
            requestShift,
        });

        if (!movePayload) return;

        moveNurseOrder(
            movePayload.nurseId,
            currentShiftTeam.shiftTeamId,
            currentShiftTeam.shiftTeamId,
            movePayload.destinationDivisionNum,
            movePayload.prevPriority,
            movePayload.nextPriority,
            getYearMonthLabel(year, month),
        );

        sendEvent(events.requestPage.calendar.moveNurse);
    };

    useRequestCalendarFocusScroll({focus, focusedCellRef, containerRef});

    if (!requestShift || !foldedLevels || !wardShiftTypeMap || !currentShiftTeam) return null;

    const unresolvedRequestCount = getUnresolvedRequestCount(dutyRequestStatus, dutyRequestList);
    const yearMonthLabel = getYearMonthLabel(year, month);
    const dutyRequestLookup = createDutyRequestLookup(dutyRequestList);
    const connectedNurseIds = createConnectedNurseIdSet(currentShiftTeam);
    const shiftNurseIdByNurseId = createShiftNurseIdByNurseId(requestShift);

    return (
        <div id="calendar" className="mt-6 flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
            <Card
                variant="elevated"
                padding="none"
                className="min-w-0 flex-1 overflow-hidden border-transparent shadow-[0_4px_34px_0_rgba(237,233,245,1)]"
            >
                <div ref={clickAwayRef} className="flex h-full min-h-0 flex-col px-5 pb-4">
                    <RequestCalendarHeader days={requestShift.days} focusDay={focus?.day} separateWeekendColor={separateWeekendColor} />
                    <RequestCalendarGrid
                        requestShift={requestShift}
                        foldedLevels={foldedLevels}
                        focus={focus}
                        readonly={readonly}
                        separateWeekendColor={separateWeekendColor}
                        wardShiftTypeMap={wardShiftTypeMap}
                        currentShiftTeam={currentShiftTeam}
                        dutyRequestLookup={dutyRequestLookup}
                        connectedNurseIds={connectedNurseIds}
                        focusedCellRef={focusedCellRef}
                        containerRef={containerRef}
                        onDragEnd={onDragEnd}
                        changeFocus={changeFocus}
                        foldLevel={foldLevel}
                        editDivision={editDivision}
                        onFoldAnalytics={(expanded) =>
                            sendEvent(expanded ? events.requestPage.calendar.foldDivision : events.requestPage.calendar.spreadDivision)
                        }
                        onFocusAnalytics={() => sendEvent(events.requestPage.calendar.focusCell)}
                        onCreateDivisionAnalytics={() => sendEvent(events.makePage.calendar.createDivision)}
                        onDeleteDivisionAnalytics={() => sendEvent(events.makePage.calendar.deleteDivision)}
                        yearMonthLabel={yearMonthLabel}
                    />
                </div>
            </Card>
            <RequestDutyRequestPanel
                month={month}
                dutyRequestList={dutyRequestList}
                dutyRequestStatus={dutyRequestStatus}
                wardShiftTypeMap={wardShiftTypeMap}
                unresolvedRequestCount={unresolvedRequestCount}
                readonly={readonly}
                updatingRequestId={updatingRequestId}
                shiftNurseIdByNurseId={shiftNurseIdByNurseId}
                changeFocus={changeFocus}
                acceptRequest={acceptRequest}
                acceptRequests={acceptRequests}
                retry={retry}
                onAcceptAnalytics={(accepted) => sendEvent(events.requestPage.acceptRequest, String(accepted))}
            />
        </div>
    );
}
