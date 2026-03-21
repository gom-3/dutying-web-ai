import {type DropResult, DragDropContext, Draggable, Droppable} from '@hello-pangea/dnd';
import {type RefObject} from 'react';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TShiftTeam, type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/shift/useRequestShift/type';
import {DragIcon, FoldDutyIcon, LinkedIcon, MinusIcon, PlusIcon2, UnlinkedIcon} from '@/shared/assets/svg';
import {getDayCellClass, getDutyRequestLookupKey} from './utils';

interface IRequestCalendarGridProps {
    requestShift: TRequestShift;
    foldedLevels: boolean[];
    focus: TFocus | null;
    readonly: boolean;
    separateWeekendColor: boolean;
    wardShiftTypeMap: Map<number, TWardShiftType>;
    currentShiftTeam: TShiftTeam;
    dutyRequestLookup: Map<string, TDutyRequest>;
    connectedNurseIds: Set<number>;
    focusedCellRef: RefObject<HTMLParagraphElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    onDragEnd: (result: DropResult) => void;
    changeFocus: (focus: TFocus | null) => void;
    foldLevel: (level: number) => void;
    editDivision: (shiftTeamId: number, priority: number, updateNum: number, workDate: string) => void;
    onFoldAnalytics: (expanded: boolean) => void;
    onFocusAnalytics: () => void;
    onCreateDivisionAnalytics: () => void;
    onDeleteDivisionAnalytics: () => void;
    yearMonthLabel: string;
}

export default function RequestCalendarGrid({
    requestShift,
    foldedLevels,
    focus,
    readonly,
    separateWeekendColor,
    wardShiftTypeMap,
    currentShiftTeam,
    dutyRequestLookup,
    connectedNurseIds,
    focusedCellRef,
    containerRef,
    onDragEnd,
    changeFocus,
    foldLevel,
    editDivision,
    onFoldAnalytics,
    onFocusAnalytics,
    onCreateDivisionAnalytics,
    onDeleteDivisionAnalytics,
    yearMonthLabel,
}: IRequestCalendarGridProps) {
    return (
        <DragDropContext onDragEnd={(result) => !readonly && onDragEnd(result)}>
            <div
                className="-mt-5 scrollbar-hide flex min-h-0 flex-col gap-[.3125rem] overflow-x-auto overflow-y-scroll pt-5 pr-4 pb-8"
                ref={containerRef}
            >
                {requestShift.divisionShiftNurses
                    .map((division) => division.filter((row) => row.shiftNurse.isWorker))
                    .map((rows, level) => {
                        if (rows.length === 0) return null;

                        if (foldedLevels[level]) {
                            return (
                                <div
                                    key={level}
                                    className="ml-5 flex h-7.5 w-[calc(100%-1.25rem)] cursor-pointer items-center gap-[.125rem] rounded-[.625rem] bg-sub-4.5 px-[.625rem]"
                                    onClick={() => {
                                        onFoldAnalytics(true);
                                        foldLevel(level);
                                    }}
                                >
                                    <FoldDutyIcon className="h-5.5 w-5.5 rotate-180" />
                                </div>
                            );
                        }

                        return (
                            <Droppable droppableId={level.toString()} key={level}>
                                {(provided) => (
                                    <div ref={provided.innerRef} className="flex gap-5" {...provided.droppableProps}>
                                        <div className="relative ml-5 rounded-[1.25rem] shadow-banner">
                                            {!readonly && (
                                                <div className="absolute left-[-.9375rem] flex h-full w-7.5 items-center justify-center font-poppins font-light text-sub-2.5">
                                                    <FoldDutyIcon
                                                        className="absolute top-[50%] left-[50%] z-10 h-5.5 w-5.5 translate-x-[-50%] translate-y-[-50%] cursor-pointer"
                                                        onClick={() => {
                                                            onFoldAnalytics(false);
                                                            foldLevel(level);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            {rows.map((row, rowIndex) => {
                                                const isFocusedRow = focus?.shiftNurseId === row.shiftNurse.shiftNurseId;
                                                const isLastRow = rowIndex === rows.length - 1;
                                                const isSingleRow = rowIndex === 0 && isLastRow;

                                                return (
                                                    <Draggable
                                                        draggableId={row.shiftNurse.shiftNurseId.toString()}
                                                        index={rowIndex}
                                                        key={row.shiftNurse.shiftNurseId}
                                                        isDragDisabled={readonly}
                                                    >
                                                        {(draggableProvided) => (
                                                            <div
                                                                className={`relative flex h-10 items-center gap-5 ${
                                                                    isSingleRow
                                                                        ? 'rounded-[1.25rem]'
                                                                        : rowIndex === 0
                                                                          ? 'rounded-t-[1.25rem]'
                                                                          : isLastRow
                                                                            ? 'rounded-b-[1.25rem]'
                                                                            : ''
                                                                } ${isFocusedRow ? 'bg-main-4' : 'bg-white'}`}
                                                                ref={draggableProvided.innerRef}
                                                                {...draggableProvided.draggableProps}
                                                                {...draggableProvided.dragHandleProps}
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
                                                                    {connectedNurseIds.has(row.shiftNurse.nurseId) ? (
                                                                        <LinkedIcon className="h-6 w-6" />
                                                                    ) : (
                                                                        <UnlinkedIcon className="h-6 w-6" />
                                                                    )}
                                                                </div>
                                                                <div className="flex h-full px-4.25">
                                                                    {row.wardReqShiftList.map((currentShiftTypeId, date) => {
                                                                        const requestDutyRequest =
                                                                            dutyRequestLookup.get(
                                                                                getDutyRequestLookupKey(row.shiftNurse.nurseId, date),
                                                                            ) ?? null;
                                                                        const isFocusedCell = isFocusedRow && focus?.day === date;

                                                                        return (
                                                                            <div
                                                                                key={date}
                                                                                className={`group relative flex h-full w-9 flex-1 items-center justify-center px-[.25rem] ${getDayCellClass(
                                                                                    requestShift.days[date].dayType,
                                                                                    date === focus?.day,
                                                                                    separateWeekendColor,
                                                                                )}`}
                                                                            >
                                                                                <ShiftBadge
                                                                                    id={
                                                                                        rowIndex === 0 && date === 0
                                                                                            ? 'cell_sample'
                                                                                            : undefined
                                                                                    }
                                                                                    onClick={() => {
                                                                                        if (readonly) return;

                                                                                        changeFocus({
                                                                                            shiftNurseName: row.shiftNurse.name,
                                                                                            shiftNurseId: row.shiftNurse.shiftNurseId,
                                                                                            day: date,
                                                                                        });
                                                                                        onFocusAnalytics();
                                                                                    }}
                                                                                    shiftType={
                                                                                        currentShiftTypeId === null
                                                                                            ? requestDutyRequest === null
                                                                                                ? null
                                                                                                : wardShiftTypeMap.get(
                                                                                                      requestDutyRequest.wardShiftTypeId,
                                                                                                  )
                                                                                            : wardShiftTypeMap.get(currentShiftTypeId)
                                                                                    }
                                                                                    isOnlyRequest={
                                                                                        currentShiftTypeId === null &&
                                                                                        requestDutyRequest !== null
                                                                                    }
                                                                                    className={`z-10 ${
                                                                                        readonly ? 'cursor-default' : 'cursor-pointer'
                                                                                    } ${
                                                                                        isFocusedCell && 'outline-[.125rem] outline-main-1'
                                                                                    }`}
                                                                                    forwardRef={isFocusedCell ? focusedCellRef : null}
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
                                                                                  onClick={(event) => {
                                                                                      event.stopPropagation();
                                                                                      editDivision(
                                                                                          currentShiftTeam.shiftTeamId,
                                                                                          row.shiftNurse.priority,
                                                                                          1,
                                                                                          yearMonthLabel,
                                                                                      );
                                                                                      onCreateDivisionAnalytics();
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
                                                                              onClick={(event) => {
                                                                                  event.stopPropagation();
                                                                                  editDivision(
                                                                                      currentShiftTeam.shiftTeamId,
                                                                                      row.shiftNurse.priority,
                                                                                      -1,
                                                                                      yearMonthLabel,
                                                                                  );
                                                                                  onDeleteDivisionAnalytics();
                                                                              }}
                                                                          >
                                                                              <MinusIcon className="h-5 w-5 opacity-0 hover:opacity-100" />
                                                                          </div>
                                                                      )}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        );
                    })}
            </div>
        </DragDropContext>
    );
}
