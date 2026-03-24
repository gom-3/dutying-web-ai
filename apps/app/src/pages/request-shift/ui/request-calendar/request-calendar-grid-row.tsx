import {type DraggableProvided} from '@hello-pangea/dnd';
import {type RefObject} from 'react';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/request-shift/model/types';
import {DragIcon, LinkedIcon, MinusIcon, PlusIcon2, UnlinkedIcon} from '@/shared/assets/svg';
import RequestCalendarGridCell from './request-calendar-grid-cell';
import {getDutyRequestLookupKey, getRequestCalendarDivisionAction, getRequestCalendarRowClassName} from './utils';

type TRequestShiftRow = TRequestShift['divisionShiftNurses'][number][number];

type TRequestCalendarGridRowProps = {
    row: TRequestShiftRow;
    rowIndex: number;
    rowCount: number;
    level: number;
    divisionCount: number;
    focus: TFocus | null;
    readonly: boolean;
    separateWeekendColor: boolean;
    requestShift: TRequestShift;
    wardShiftTypeMap: Map<number, TWardShiftType>;
    dutyRequestLookup: Map<string, TDutyRequest>;
    connectedNurseIds: Set<number>;
    focusedCellRef: RefObject<HTMLDivElement | null>;
    draggableProvided: DraggableProvided;
    onSelectCell: (focus: TFocus) => void;
    onCreateDivision: (priority: number) => void;
    onDeleteDivision: (priority: number) => void;
};

export default function RequestCalendarGridRow({
    row,
    rowIndex,
    rowCount,
    level,
    divisionCount,
    focus,
    readonly,
    separateWeekendColor,
    requestShift,
    wardShiftTypeMap,
    dutyRequestLookup,
    connectedNurseIds,
    focusedCellRef,
    draggableProvided,
    onSelectCell,
    onCreateDivision,
    onDeleteDivision,
}: TRequestCalendarGridRowProps) {
    const isFocusedRow = focus?.shiftNurseId === row.shiftNurse.shiftNurseId;
    const divisionAction = getRequestCalendarDivisionAction({
        readonly,
        rowIndex,
        rowCount,
        level,
        divisionCount,
    });

    return (
        <div
            className={getRequestCalendarRowClassName({rowIndex, rowCount, isFocusedRow})}
            ref={draggableProvided.innerRef}
            {...draggableProvided.draggableProps}
            {...draggableProvided.dragHandleProps}
        >
            <div className="relative w-8.5 shrink-0">
                {!readonly && <DragIcon className="absolute top-[50%] -right-2.5 h-6 w-6 translate-y-[-50%]" />}
            </div>
            <div className="w-17.5 shrink-0 truncate text-center font-apple text-[1rem] font-medium text-sub-1">{row.shiftNurse.name}</div>
            <div className="flex w-7.5 shrink-0 items-center justify-center text-center font-apple text-[1rem] text-sub-1">
                {connectedNurseIds.has(row.shiftNurse.nurseId) ? <LinkedIcon className="h-6 w-6" /> : <UnlinkedIcon className="h-6 w-6" />}
            </div>
            <div className="flex h-full px-4.25">
                {row.wardReqShiftList.map((currentShiftTypeId, day) => {
                    const requestDutyRequest = dutyRequestLookup.get(getDutyRequestLookupKey(row.shiftNurse.nurseId, day)) ?? null;

                    return (
                        <RequestCalendarGridCell
                            key={day}
                            day={day}
                            isSampleCell={rowIndex === 0 && day === 0}
                            dayType={requestShift.days[day].dayType}
                            shiftNurseId={row.shiftNurse.shiftNurseId}
                            shiftNurseName={row.shiftNurse.name}
                            currentShiftTypeId={currentShiftTypeId}
                            requestDutyRequest={requestDutyRequest}
                            focus={focus}
                            readonly={readonly}
                            separateWeekendColor={separateWeekendColor}
                            wardShiftTypeMap={wardShiftTypeMap}
                            focusedCellRef={focusedCellRef}
                            onSelectCell={onSelectCell}
                        />
                    );
                })}
            </div>
            {divisionAction === 'create' ? (
                <>
                    <div
                        className="justify-cente group peer absolute bottom-0 z-10 flex h-6 w-6 translate-x-[-80%] translate-y-[50%] items-center"
                        onClick={(event) => {
                            event.stopPropagation();
                            onCreateDivision(row.shiftNurse.priority);
                        }}
                    >
                        <PlusIcon2 className="invisible h-5 w-5 group-hover:visible" />
                    </div>
                    <div className="invisible absolute bottom-0 h-[.0938rem] w-full bg-sub-2.5 peer-hover:visible" />
                </>
            ) : null}
            {divisionAction === 'delete' ? (
                <div
                    className="absolute bottom-0 z-10 flex h-6 w-6 translate-x-[-65%] translate-y-[calc(50%+.1563rem)] items-center"
                    onClick={(event) => {
                        event.stopPropagation();
                        onDeleteDivision(row.shiftNurse.priority);
                    }}
                >
                    <MinusIcon className="h-5 w-5 opacity-0 hover:opacity-100" />
                </div>
            ) : null}
        </div>
    );
}
