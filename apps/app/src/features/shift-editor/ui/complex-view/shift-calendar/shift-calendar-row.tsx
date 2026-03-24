import {Draggable} from '@hello-pangea/dnd';
import {type ComponentProps, type RefObject} from 'react';
import {type TWardShiftType, type TShift} from '@/entities';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TDutyDoc, type TSelection} from '@/features/shift-editor/model';
import {DragIcon, MinusIcon, PlusIcon2} from '@/shared/assets/svg';
import RequestLayer from '../request-layer';
import {type TLayerFlags, type TShiftCalendarFocus} from '../types';
import ViolationLayer from '../violation-layer';
import {getWeekendCellBg} from './shift-calendar-utils';

type TViolationItem = ComponentProps<typeof ViolationLayer>['violation'];

type TShiftCalendarRowProps = {
    row: TShift['divisionShiftNurses'][number][number];
    rowIndex: number;
    rowsLength: number;
    level: number;
    shift: TShift;
    readonly: boolean;
    enableDragAndDrop: boolean;
    enableDivisionManagement: boolean;
    onEditDivision?: (opts: {shiftNurseId: number; level: number; direction: 1 | -1}) => void;
    onSelectNurse?: (nurseId: number | null) => void;
    onUpdateCarry?: (shiftNurseId: number, nextCarry: number) => void;
    docRowIndex: number;
    docRow?: TDutyDoc['rows'][number];
    getCellShiftType: (rowIndex: number, colIndex: number) => TWardShiftType | null;
    idToType: Map<number, TWardShiftType>;
    selection: TSelection | null;
    selectionRect: {top: number; left: number; bottom: number; right: number} | null;
    effectiveFocus: TShiftCalendarFocus | null;
    layerFlags: TLayerFlags;
    violations?: Map<string, TViolationItem>;
    separateWeekendColor: boolean;
    focusedCellRef: RefObject<HTMLParagraphElement | null>;
    onCellClick: (rowIndex: number, colIndex: number) => void;
};

export function ShiftCalendarRow({
    row,
    rowIndex,
    rowsLength,
    level,
    shift,
    readonly,
    enableDragAndDrop,
    enableDivisionManagement,
    onEditDivision,
    onSelectNurse,
    onUpdateCarry,
    docRowIndex,
    docRow,
    getCellShiftType,
    idToType,
    selection,
    selectionRect,
    effectiveFocus,
    layerFlags,
    violations,
    separateWeekendColor,
    focusedCellRef,
    onCellClick,
}: TShiftCalendarRowProps) {
    const isRowFocused = effectiveFocus?.shiftNurseId === row.shiftNurse.shiftNurseId;
    const getCountByNurse = (wardShiftTypeId: number) =>
        docRow?.cells.filter((_current, index) => {
            const shiftType = getCellShiftType(docRowIndex, index);

            return shiftType?.wardShiftTypeId === wardShiftTypeId;
        }).length ?? 0;
    const getOffCount = () =>
        docRow?.cells.filter((_current, i) => {
            const shiftType = getCellShiftType(docRowIndex, i);
            const day = shift.days[i];

            return Boolean(shiftType?.isOff) && day?.dayType !== 'workday';
        }).length ?? 0;

    return (
        <Draggable
            draggableId={row.shiftNurse.shiftNurseId.toString()}
            index={rowIndex}
            key={row.shiftNurse.shiftNurseId}
            isDragDisabled={readonly || !enableDragAndDrop}
        >
            {(provided) => (
                <div
                    className={`relative flex h-10 items-center gap-5 ${
                        rowIndex === 0
                            ? rowIndex === rowsLength - 1
                                ? 'rounded-[1.25rem]'
                                : 'rounded-t-[1.25rem]'
                            : rowIndex === rowsLength - 1
                              ? 'rounded-b-[1.25rem]'
                              : ''
                    } ${isRowFocused ? 'bg-main-4' : 'bg-white'}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    {!readonly && enableDragAndDrop ? (
                        <div className="relative w-8.5 shrink-0">
                            <DragIcon className="absolute top-[50%] -right-2.5 h-6 w-6 translate-y-[-50%]" />
                        </div>
                    ) : (
                        <div />
                    )}
                    <div
                        className="w-17.5 shrink-0 truncate text-center font-apple text-[1.25rem] text-sub-1"
                        onClick={() => {
                            onSelectNurse?.(row.shiftNurse.nurseId);
                        }}
                    >
                        {row.shiftNurse.name}
                    </div>
                    <div className="w-7.5 shrink-0 text-center font-apple text-[1.25rem] text-sub-1">
                        {readonly || !onUpdateCarry ? (
                            <div className="h-7.5 w-7.5 cursor-default rounded-[.3125rem] border-[.0313rem] bg-main-bg font-poppins text-[1.25rem] text-sub-2 outline-none focus:bg-main-4">
                                {row.shiftNurse.carried}
                            </div>
                        ) : (
                            <button
                                className="h-7.5 w-7.5 rounded-[.3125rem] border-[.0313rem] bg-main-bg font-poppins text-[1.25rem] text-sub-2 outline-none focus:bg-main-4"
                                onKeyDown={(e) => {
                                    e.preventDefault();

                                    if (e.key === 'ArrowUp') onUpdateCarry(row.shiftNurse.shiftNurseId, row.shiftNurse.carried + 1);

                                    if (e.key === 'ArrowDown') onUpdateCarry(row.shiftNurse.shiftNurseId, row.shiftNurse.carried - 1);
                                }}
                            >
                                {row.shiftNurse.carried}
                            </button>
                        )}
                    </div>
                    <div className="flex w-22.5 gap-[.125rem]">
                        {row.lastWardShiftList.map((current, j) => (
                            <ShiftBadge
                                key={j}
                                shiftType={current != null ? idToType.get(current) : null}
                                className="h-5.25 w-5.25 text-[.9375rem]"
                            />
                        ))}
                    </div>
                    <div className="flex h-full px-4.25">
                        {row.wardShiftList.map((_current, j) => {
                            const request = row.wardReqShiftList[j];
                            const dayType = shift.days[j]?.dayType ?? 'workday';
                            const weekendBg = getWeekendCellBg(dayType, separateWeekendColor);
                            const shiftType = getCellShiftType(docRowIndex, j);
                            const isSelected =
                                selection?.type === 'single' && selection.anchor.row === docRowIndex && selection.anchor.col === j;
                            const isInRange =
                                selectionRect !== null &&
                                docRowIndex >= selectionRect.top &&
                                docRowIndex <= selectionRect.bottom &&
                                j >= selectionRect.left &&
                                j <= selectionRect.right;
                            const isFocused = isRowFocused && effectiveFocus?.day === j;
                            const selectionClass = !readonly && (isSelected || isInRange) ? 'outline-[.125rem] outline-main-1' : undefined;
                            const violation = violations?.get(`${row.shiftNurse.shiftNurseId},${j}`);

                            return (
                                <div
                                    key={j}
                                    className={`group relative flex h-full w-9 flex-1 items-center justify-center px-[.25rem] ${weekendBg} ${
                                        effectiveFocus?.day === j ? 'bg-main-4' : ''
                                    }`}
                                    onClick={() => onCellClick(docRowIndex, j)}
                                >
                                    {!readonly && layerFlags.fault && violation && <ViolationLayer violation={violation} />}
                                    {!readonly && request !== null && shiftType && (
                                        <RequestLayer
                                            isAccept={request === shiftType.wardShiftTypeId}
                                            request={idToType.get(request)!}
                                            showCheck={layerFlags.check}
                                            showSlash={layerFlags.slash}
                                        />
                                    )}
                                    <ShiftBadge
                                        id={rowIndex === 0 && j === 0 ? 'cell_sample' : undefined}
                                        shiftType={shiftType}
                                        isOnlyRequest={shiftType === null && request !== null}
                                        className={`z-10 ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
                                            isFocused ? 'outline-[.125rem] outline-main-1' : ''
                                        } ${selectionClass ?? ''}`}
                                        forwardRef={isFocused ? focusedCellRef : null}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div id="count_by_nurse" className="relative flex shrink-0 items-center gap-2 px-6.25 text-center">
                        {shift.wardShiftTypes
                            .filter((x) => x.isCounted)
                            .map((wardShiftType) => (
                                <div key={wardShiftType.wardShiftTypeId} className="w-6 text-center font-poppins text-[1.25rem] text-sub-2">
                                    {getCountByNurse(wardShiftType.wardShiftTypeId)}
                                </div>
                            ))}
                        <div className="w-6 text-center font-poppins text-[1.25rem] text-sub-2">{getOffCount()}</div>
                    </div>
                    {enableDivisionManagement && onEditDivision && !readonly && (
                        <>
                            {rowIndex !== rowsLength - 1 ? (
                                <>
                                    <div
                                        className="justify-cente group peer absolute bottom-0 z-10 flex h-6 w-6 translate-x-[-80%] translate-y-[50%] items-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditDivision({
                                                shiftNurseId: row.shiftNurse.shiftNurseId,
                                                level,
                                                direction: 1,
                                            });
                                        }}
                                    >
                                        <PlusIcon2 className="invisible h-5 w-5 group-hover:visible" />
                                    </div>
                                    <div className="invisible absolute bottom-0 h-[.0938rem] w-full bg-sub-2.5 peer-hover:visible" />
                                </>
                            ) : (
                                level !== shift.divisionShiftNurses.length - 1 && (
                                    <div
                                        className="absolute bottom-0 z-10 flex h-6 w-6 translate-x-[-65%] translate-y-[calc(50%+.1563rem)] items-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditDivision({
                                                shiftNurseId: row.shiftNurse.shiftNurseId,
                                                level,
                                                direction: -1,
                                            });
                                        }}
                                    >
                                        <MinusIcon className="h-5 w-5 opacity-0 hover:opacity-100" />
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            )}
        </Draggable>
    );
}
