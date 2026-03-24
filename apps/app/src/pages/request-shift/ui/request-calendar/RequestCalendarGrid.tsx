import {type DropResult, DragDropContext, Draggable, Droppable} from '@hello-pangea/dnd';
import {type RefObject} from 'react';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/shift/useRequestShift/type';
import {FoldDutyIcon} from '@/shared/assets/svg';
import RequestCalendarGridRow from './RequestCalendarGridRow';

interface IRequestCalendarGridProps {
    requestShift: TRequestShift;
    foldedLevels: boolean[];
    focus: TFocus | null;
    readonly: boolean;
    separateWeekendColor: boolean;
    wardShiftTypeMap: Map<number, TWardShiftType>;
    dutyRequestLookup: Map<string, TDutyRequest>;
    connectedNurseIds: Set<number>;
    focusedCellRef: RefObject<HTMLDivElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    onDragEnd: (result: DropResult) => void;
    onSelectCell: (focus: TFocus) => void;
    onToggleFoldLevel: (level: number, expanded: boolean) => void;
    onCreateDivision: (priority: number) => void;
    onDeleteDivision: (priority: number) => void;
}

export default function RequestCalendarGrid({
    requestShift,
    foldedLevels,
    focus,
    readonly,
    separateWeekendColor,
    wardShiftTypeMap,
    dutyRequestLookup,
    connectedNurseIds,
    focusedCellRef,
    containerRef,
    onDragEnd,
    onSelectCell,
    onToggleFoldLevel,
    onCreateDivision,
    onDeleteDivision,
}: IRequestCalendarGridProps) {
    return (
        <DragDropContext onDragEnd={(result) => !readonly && onDragEnd(result)}>
            <div
                className="scrollbar-hide flex min-h-0 flex-col gap-[.3125rem] overflow-x-auto overflow-y-scroll pr-4 pb-3"
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
                                    className={`ml-5 flex h-7.5 w-[calc(100%-1.25rem)] items-center gap-[.125rem] rounded-[.625rem] bg-sub-4.5 px-[.625rem] ${
                                        readonly ? '' : 'cursor-pointer'
                                    }`}
                                    onClick={() => {
                                        if (readonly) return;

                                        onToggleFoldLevel(level, true);
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
                                                        onClick={() => onToggleFoldLevel(level, false)}
                                                    />
                                                </div>
                                            )}
                                            {rows.map((row, rowIndex) => {
                                                return (
                                                    <Draggable
                                                        draggableId={row.shiftNurse.shiftNurseId.toString()}
                                                        index={rowIndex}
                                                        key={row.shiftNurse.shiftNurseId}
                                                        isDragDisabled={readonly}
                                                    >
                                                        {(draggableProvided) => (
                                                            <RequestCalendarGridRow
                                                                row={row}
                                                                rowIndex={rowIndex}
                                                                rowCount={rows.length}
                                                                level={level}
                                                                divisionCount={requestShift.divisionShiftNurses.length}
                                                                focus={focus}
                                                                readonly={readonly}
                                                                separateWeekendColor={separateWeekendColor}
                                                                requestShift={requestShift}
                                                                wardShiftTypeMap={wardShiftTypeMap}
                                                                dutyRequestLookup={dutyRequestLookup}
                                                                connectedNurseIds={connectedNurseIds}
                                                                focusedCellRef={focusedCellRef}
                                                                draggableProvided={draggableProvided}
                                                                onSelectCell={onSelectCell}
                                                                onCreateDivision={onCreateDivision}
                                                                onDeleteDivision={onDeleteDivision}
                                                            />
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
