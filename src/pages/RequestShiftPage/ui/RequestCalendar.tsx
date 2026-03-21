import {DragDropContext, type DropResult, Droppable, Draggable} from '@hello-pangea/dnd';
import {type RefObject, useEffect, useRef} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {twMerge} from 'tailwind-merge';
import {events, sendEvent} from '@/analytics';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import useRequestShift from '@/features/shift/useRequestShift';
import useEditShiftTeam from '@/features/ward/useEditShiftTeam';
import {DragIcon, FoldDutyIcon, LinkedIcon, MinusIcon, PlusIcon2, UnlinkedIcon} from '@/shared/assets/svg';
import Card from '@/shared/ui/Card';

export default function ShiftCalendar() {
    const {
        state: {readonly, year, month, requestShift, dutyRequestList, focus, foldedLevels, wardShiftTypeMap, currentShiftTeam},
        actions: {changeFocus, foldLevel, acceptRequest},
    } = useRequestShift();
    const {
        state: {shiftTeams},
        actions: {selectNurse, moveNurseOrder, editDivision},
    } = useEditShiftTeam();
    const separateWeekendColor = useUIConfigStore((state) => state.separateWeekendColor);
    const focusedCellRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const clickAwayRef = useOnclickOutside(() => {
        changeFocus(null);
        selectNurse(null);
    });
    const onDragEnd = ({source, destination, draggableId}: DropResult) => {
        if (!destination || !shiftTeams || !requestShift || !currentShiftTeam) return null;

        if (source.droppableId === destination.droppableId && destination.index === source.index) return;

        const sourceDivision = parseInt(source.droppableId);
        const destinationDivision = parseInt(destination.droppableId);
        const dragedNurse = requestShift.divisionShiftNurses[sourceDivision].find(
            (x) => x.shiftNurse.shiftNurseId === parseInt(draggableId),
        )!.shiftNurse;
        const destinationNurses = requestShift.divisionShiftNurses[destinationDivision];

        if (
            destination.droppableId === source.droppableId &&
            destinationNurses.findIndex((x) => x.shiftNurse.shiftNurseId === dragedNurse.shiftNurseId) < destination.index
        ) {
            moveNurseOrder(
                dragedNurse.nurseId,
                currentShiftTeam.shiftTeamId,
                currentShiftTeam.shiftTeamId,
                destinationNurses[0].shiftNurse.divisionNum,
                destination.index === 0 ? 0 : destinationNurses[destination.index].shiftNurse.priority,
                destination.index === destinationNurses.length - 1
                    ? destinationNurses[destination.index].shiftNurse.priority + 2024
                    : destinationNurses[destination.index + 1].shiftNurse.priority,
                year.toString() + '-' + month.toString().padStart(2, '0'),
            );
        } else {
            moveNurseOrder(
                dragedNurse.nurseId,
                currentShiftTeam.shiftTeamId,
                currentShiftTeam.shiftTeamId,
                destinationNurses[0].shiftNurse.divisionNum,
                destination.index === 0 ? 0 : destinationNurses[destination.index - 1].shiftNurse.priority,
                destination.index === destinationNurses.length
                    ? destinationNurses[destination.index - 1].shiftNurse.priority + 2024
                    : destinationNurses[destination.index].shiftNurse.priority,
                year.toString() + '-' + month.toString().padStart(2, '0'),
            );
        }

        sendEvent(events.requestPage.calendar.moveNurse);
    };

    useEffect(() => {
        if (focus) {
            const focusRect = focusedCellRef.current?.getBoundingClientRect();
            const container = containerRef.current;

            if (!focusRect || !container) return;

            // 셀이 화면 오른쪽에 있을 때 오른쪽으로 충분히 화면을 이동한다.
            if (focusRect.x + focusRect.width - container.offsetLeft > container.clientWidth)
                container.scroll({
                    left: focusRect.left + container.scrollLeft,
                });

            // 셀이 화면 왼쪽에 있을 때 왼쪽 끝으로 화면을 이동한다.
            if (focusRect.x - container.offsetLeft < 0) container.scroll({left: 0});

            // 셀이 화면 아래에 있을 때 아래로 충분히 화면을 이동한다.
            if (focusRect.y + focusRect.height - container.offsetTop > container.clientHeight)
                container.scroll({
                    top: focusRect.top + container.scrollTop,
                });

            // 셀이 화면 위에 있을 때 한칸씩 위로 화면을 이동한다.
            if (focusRect.y - container.offsetTop < 0) container.scroll({top: focusRect.top + window.scrollY - 132});
        }
    }, [focus]);

    const unresolvedRequestCount = dutyRequestList?.filter((x) => x.isAccepted === null).length ?? 0;

    return requestShift && foldedLevels && wardShiftTypeMap && currentShiftTeam ? (
        <div id="calendar" className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
            <Card variant="elevated" padding="none" className="min-w-0 flex-1 overflow-hidden border-gray-6">
                <div ref={clickAwayRef} className="flex h-full min-h-0 flex-col px-4 pb-4">
                    <div className="z-20 my-[.75rem] flex h-7.5 min-w-max items-center gap-5 bg-white pr-4">
                        <div className="flex gap-5">
                            <div className="w-13.5 text-center font-apple text-[1rem] font-medium text-sub-3">{/* 구분 */}</div>
                            <div className="w-17.5 text-center font-apple text-[1rem] font-medium text-sub-3">이름</div>
                            <div className="w-7.5 text-center font-apple text-[1rem] font-medium text-sub-3">연동</div>
                            <div className="flex rounded-[2.5rem] border-[.0625rem] border-sub-4 px-4 py-[.1875rem]">
                                {requestShift.days.map((item, j) => (
                                    <p
                                        key={j}
                                        className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${
                                            item.dayType === 'saturday'
                                                ? j === focus?.day
                                                    ? separateWeekendColor
                                                        ? 'bg-blue text-white'
                                                        : 'bg-red text-white'
                                                    : separateWeekendColor
                                                      ? 'text-blue'
                                                      : 'text-red'
                                                : item.dayType === 'sunday' || item.dayType === 'holiday'
                                                  ? j === focus?.day
                                                      ? 'bg-red text-white'
                                                      : 'text-red'
                                                  : item.dayType === 'workday'
                                                    ? j === focus?.day
                                                        ? 'bg-main-1 text-white'
                                                        : 'text-sub-2.5'
                                                    : ''
                                        } `}
                                    >
                                        {item.day}
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DragDropContext onDragEnd={(d) => !readonly && onDragEnd(d)}>
                        <div
                            className="-mt-5 scrollbar-hide flex min-h-0 flex-col gap-[.3125rem] overflow-x-auto overflow-y-scroll pt-5 pr-4 pb-8"
                            ref={containerRef}
                        >
                            {requestShift.divisionShiftNurses
                                .map((x) => x.filter((y) => y.shiftNurse.isWorker)) // 근무자만 필터링
                                .map((rows, level) => {
                                    return rows.length ? (
                                        requestShift && foldedLevels[level] ? (
                                            <div
                                                key={level}
                                                className="ml-5 flex h-7.5 w-[calc(100%-1.25rem)] cursor-pointer items-center gap-[.125rem] rounded-[.625rem] bg-sub-4.5 px-[.625rem]"
                                                onClick={() => {
                                                    sendEvent(events.requestPage.calendar.foldDivision);
                                                    foldLevel(level);
                                                }}
                                            >
                                                <FoldDutyIcon className="h-5.5 w-5.5 rotate-180" />
                                            </div>
                                        ) : (
                                            <Droppable droppableId={level.toString()} key={level.toString()}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        key={level}
                                                        className="flex gap-5"
                                                        {...provided.droppableProps}
                                                    >
                                                        <div className="relative ml-5 rounded-[1.25rem] shadow-banner">
                                                            {!readonly && (
                                                                <div className="absolute left-[-.9375rem] flex h-full w-7.5 items-center justify-center font-poppins font-light text-sub-2.5">
                                                                    <FoldDutyIcon
                                                                        className="absolute top-[50%] left-[50%] z-10 h-5.5 w-5.5 translate-x-[-50%] translate-y-[-50%] cursor-pointer"
                                                                        onClick={() => {
                                                                            sendEvent(events.requestPage.calendar.spreadDivision);
                                                                            foldLevel(level);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {rows.map((row, rowIndex) => (
                                                                <Draggable
                                                                    draggableId={row.shiftNurse.shiftNurseId.toString()}
                                                                    index={rowIndex}
                                                                    key={row.shiftNurse.shiftNurseId}
                                                                    isDragDisabled={readonly}
                                                                >
                                                                    {(provided) => (
                                                                        <div
                                                                            className={`relative flex h-10 items-center gap-5 ${
                                                                                rowIndex === 0
                                                                                    ? rowIndex === rows.length - 1
                                                                                        ? 'rounded-[1.25rem]'
                                                                                        : 'rounded-t-[1.25rem]'
                                                                                    : rowIndex === rows.length - 1
                                                                                      ? 'rounded-b-[1.25rem]'
                                                                                      : ''
                                                                            } ${
                                                                                focus?.shiftNurseId === row.shiftNurse.shiftNurseId
                                                                                    ? 'bg-main-4'
                                                                                    : 'bg-white'
                                                                            }`}
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                        >
                                                                            <div className="relative w-8.5 shrink-0">
                                                                                {!readonly && (
                                                                                    <DragIcon className="absolute top-[50%] -right-2.5 h-6 w-6 translate-y-[-50%]" />
                                                                                )}
                                                                            </div>
                                                                            <div className="w-17.5 shrink-0 truncate text-center font-apple text-[1.25rem] text-sub-1">
                                                                                {row.shiftNurse.name}
                                                                            </div>
                                                                            <div className="flex w-7.5 shrink-0 items-center justify-center text-center font-apple text-[1.25rem] text-sub-1">
                                                                                {currentShiftTeam.nurses.find(
                                                                                    (x) => x.nurseId === row.shiftNurse.nurseId,
                                                                                )?.isConnected ? (
                                                                                    <LinkedIcon className="h-6 w-6" />
                                                                                ) : (
                                                                                    <UnlinkedIcon className="h-6 w-6" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex h-full px-4.25">
                                                                                {row.wardReqShiftList.map((current, date) => {
                                                                                    const requestDutyRequest =
                                                                                        dutyRequestList?.find(
                                                                                            (x) =>
                                                                                                x.nurseId === row.shiftNurse.nurseId &&
                                                                                                x.date - 1 === date,
                                                                                        ) ?? null;
                                                                                    const isSaturday =
                                                                                        requestShift.days[date].dayType === 'saturday';
                                                                                    const isSunday =
                                                                                        requestShift.days[date].dayType === 'sunday' ||
                                                                                        requestShift.days[date].dayType === 'holiday';
                                                                                    const isFocused =
                                                                                        focus?.shiftNurseId ===
                                                                                            row.shiftNurse.shiftNurseId &&
                                                                                        focus.day === date;

                                                                                    return (
                                                                                        <div
                                                                                            key={date}
                                                                                            className={`group relative flex h-full w-9 flex-1 items-center justify-center px-[.25rem] ${
                                                                                                isSunday
                                                                                                    ? 'bg-[#FFE1E680]'
                                                                                                    : isSaturday
                                                                                                      ? separateWeekendColor
                                                                                                          ? 'bg-[#E1E5FF80]'
                                                                                                          : 'bg-[#FFE1E680]'
                                                                                                      : ''
                                                                                            } ${date === focus?.day && 'bg-main-4'}`}
                                                                                        >
                                                                                            <ShiftBadge
                                                                                                id={
                                                                                                    rowIndex === 0 && date === 0
                                                                                                        ? 'cell_sample'
                                                                                                        : undefined
                                                                                                }
                                                                                                onClick={() => {
                                                                                                    if (readonly) return;

                                                                                                    changeFocus?.({
                                                                                                        shiftNurseName: row.shiftNurse.name,
                                                                                                        shiftNurseId:
                                                                                                            row.shiftNurse.shiftNurseId,
                                                                                                        day: date,
                                                                                                    });
                                                                                                    sendEvent(
                                                                                                        events.requestPage.calendar
                                                                                                            .focusCell,
                                                                                                    );
                                                                                                }}
                                                                                                shiftType={
                                                                                                    current === null
                                                                                                        ? requestDutyRequest === null
                                                                                                            ? null
                                                                                                            : wardShiftTypeMap.get(
                                                                                                                  requestDutyRequest.wardShiftTypeId,
                                                                                                              )
                                                                                                        : wardShiftTypeMap.get(current)
                                                                                                }
                                                                                                isOnlyRequest={
                                                                                                    current === null &&
                                                                                                    requestDutyRequest !== null
                                                                                                }
                                                                                                className={`z-10 ${
                                                                                                    readonly
                                                                                                        ? 'cursor-default'
                                                                                                        : 'cursor-pointer'
                                                                                                } ${
                                                                                                    isFocused &&
                                                                                                    'outline-[.125rem] outline-main-1'
                                                                                                }`}
                                                                                                forwardRef={
                                                                                                    isFocused
                                                                                                        ? (focusedCellRef as unknown as RefObject<HTMLParagraphElement>)
                                                                                                        : null
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            {rowIndex !== rows.length - 1
                                                                                ? !readonly && (
                                                                                      <>
                                                                                          <div
                                                                                              className="justify-cente group peer absolute bottom-0 z-10 flex h-6 w-6 translate-x-[-80%] translate-y-[50%] items-center"
                                                                                              onClick={(e) => {
                                                                                                  e.stopPropagation();
                                                                                                  editDivision(
                                                                                                      currentShiftTeam.shiftTeamId,
                                                                                                      row.shiftNurse.priority,
                                                                                                      1,
                                                                                                      year.toString() +
                                                                                                          '-' +
                                                                                                          month.toString().padStart(2, '0'),
                                                                                                  );
                                                                                                  sendEvent(
                                                                                                      events.makePage.calendar
                                                                                                          .createDivision,
                                                                                                  );
                                                                                              }}
                                                                                          >
                                                                                              <PlusIcon2 className="invisible h-5 w-5 group-hover:visible" />
                                                                                          </div>
                                                                                          <div className="invisible absolute bottom-0 h-[.0938rem] w-full bg-sub-2.5 peer-hover:visible" />
                                                                                      </>
                                                                                  )
                                                                                : level !== requestShift.divisionShiftNurses.length - 1 &&
                                                                                  !readonly && (
                                                                                      <div
                                                                                          className="absolute bottom-0 z-10 flex h-6 w-6 translate-x-[-65%] translate-y-[calc(50%+.1563rem)] items-center"
                                                                                          onClick={(e) => {
                                                                                              e.stopPropagation();
                                                                                              editDivision(
                                                                                                  currentShiftTeam.shiftTeamId,
                                                                                                  row.shiftNurse.priority,
                                                                                                  -1,
                                                                                                  year.toString() +
                                                                                                      '-' +
                                                                                                      month.toString().padStart(2, '0'),
                                                                                              );
                                                                                              sendEvent(
                                                                                                  events.makePage.calendar.deleteDivision,
                                                                                              );
                                                                                          }}
                                                                                      >
                                                                                          <MinusIcon className="h-5 w-5 opacity-0 hover:opacity-100" />
                                                                                      </div>
                                                                                  )}
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {provided.placeholder}
                                                        </div>
                                                    </div>
                                                )}
                                            </Droppable>
                                        )
                                    ) : null;
                                })}
                        </div>
                    </DragDropContext>
                </div>
            </Card>

            <Card
                id="nurse_request_list"
                variant="elevated"
                padding="none"
                className="flex w-full shrink-0 flex-col overflow-hidden border-gray-6 xl:w-[360px]"
            >
                <div className="border-b border-sub-4.5 px-6 py-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-apple text-[1.25rem] font-semibold text-main-1">신청 내역</p>
                            <p className="mt-1 font-apple text-sm font-medium text-gray-4">미처리 신청 {unresolvedRequestCount}건</p>
                        </div>
                    </div>
                </div>

                <div className="scrollbar-hide max-h-[calc(100vh-18rem)] overflow-y-auto px-5 py-4">
                    {dutyRequestList && dutyRequestList.length > 0 ? (
                        <div className="space-y-3">
                            {dutyRequestList.map((dutyRequest) => {
                                const matchedShiftNurseId =
                                    requestShift.divisionShiftNurses
                                        .flatMap((x) => x)
                                        .find((x) => x.shiftNurse.nurseId === dutyRequest.nurseId)?.shiftNurse.shiftNurseId ?? null;
                                const requestFocus =
                                    matchedShiftNurseId !== null
                                        ? {
                                              shiftNurseName: dutyRequest.nurseName,
                                              shiftNurseId: matchedShiftNurseId,
                                              day: dutyRequest.date - 1,
                                          }
                                        : null;

                                return (
                                    <div key={dutyRequest.wardReqShiftId} className="rounded-[16px] border border-gray-6 px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <button
                                                    type="button"
                                                    className={twMerge(
                                                        'truncate text-left font-apple text-base font-semibold text-sub-1',
                                                        (!requestFocus || readonly) && 'cursor-default',
                                                        requestFocus && !readonly && 'cursor-pointer hover:text-main-1',
                                                    )}
                                                    onClick={() => {
                                                        if (readonly || !requestFocus) return;

                                                        changeFocus(requestFocus);
                                                    }}
                                                >
                                                    {dutyRequest.nurseName} / {dutyRequest.date}일
                                                </button>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <ShiftBadge shiftType={wardShiftTypeMap.get(dutyRequest.wardShiftTypeId)} />
                                                    <p className="font-apple text-sm font-medium text-gray-4">
                                                        {dutyRequest.isAccepted === true
                                                            ? '수락됨'
                                                            : dutyRequest.isAccepted === false
                                                              ? '거절됨'
                                                              : '확인 필요'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex rounded-[12px] bg-gray-7 p-1">
                                            <button
                                                type="button"
                                                className={twMerge(
                                                    'flex h-9 flex-1 items-center justify-center rounded-[10px] font-apple text-sm font-semibold text-gray-3 transition-colors',
                                                    dutyRequest.isAccepted === true && 'bg-main-1 text-white',
                                                )}
                                                onClick={() => {
                                                    acceptRequest(dutyRequest.wardReqShiftId, true);
                                                    sendEvent(events.requestPage.acceptRequest, 'true');
                                                }}
                                            >
                                                수락
                                            </button>
                                            <button
                                                type="button"
                                                className={twMerge(
                                                    'flex h-9 flex-1 items-center justify-center rounded-[10px] font-apple text-sm font-semibold text-gray-3 transition-colors',
                                                    dutyRequest.isAccepted === false && 'bg-sub-2 text-white',
                                                )}
                                                onClick={() => {
                                                    acceptRequest(dutyRequest.wardReqShiftId, false);
                                                    sendEvent(events.requestPage.acceptRequest, 'false');
                                                }}
                                            >
                                                거절
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex min-h-[220px] items-center justify-center rounded-[16px] bg-gray-7 px-6 text-center">
                            <p className="font-apple text-sm leading-6 font-medium text-gray-4">
                                아직 제출된 신청 근무가 없어요.
                                <br />
                                신청이 들어오면 이 패널에서 바로 확인할 수 있어요.
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    ) : null;
}
