import {type ComponentProps, type RefObject, useEffect, useMemo, useRef} from 'react';
import {DragDropContext, type DropResult, Droppable, Draggable} from '@hello-pangea/dnd';
import useOnclickOutside from 'react-cool-onclickoutside';
import {type TDutyDoc, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor/model';
import {normalizeSelection} from '@/features/shift-editor/model/selection';
import ShiftBadge from '@/features/ShiftBadge';
import useUIConfig from '@/entities/ui/useUIConfig';
import {DragIcon, FoldDutyIcon, MinusIcon, PlusIcon2} from '@/shared/assets/svg';
import {type Shift} from '@/shared/types/shift';
import {type TWardShiftType} from '@/shared/types/ward';
import RequestLayer from './request-layer';
import ViolationLayer from './violation-layer';

type TFocus = {shiftNurseId: number; day: number};
type TLayerFlags = {fault: boolean; check: boolean; slash: boolean};
type TViolationItem = ComponentProps<typeof ViolationLayer>['violation'];

function getWeekendCellBg(dayType: Shift['days'][number]['dayType'], separateWeekendColor: boolean): string {
    if (dayType === 'sunday' || dayType === 'holiday') return 'bg-[#FFE1E680]';

    if (dayType === 'saturday') return separateWeekendColor ? 'bg-[#E1E5FF80]' : 'bg-[#FFE1E680]';

    return '';
}

interface IShiftCalendarProps {
    shift: Shift;
    doc: TDutyDoc;
    readonly?: boolean;
    onCellClick?: (rowIndex: number, colIndex: number) => void;
    disableInitialSelection?: boolean;
    focus?: TFocus | null;
    showLayer?: TLayerFlags;
    violations?: Map<string, TViolationItem>;
    foldedLevels?: boolean[];
    onToggleFoldLevel?: (level: number) => void;
    onUpdateCarry?: (shiftNurseId: number, nextCarry: number) => void;
    onSelectNurse?: (nurseId: number | null) => void;
    enableDragAndDrop?: boolean;
    onDragEnd?: (result: DropResult) => void;
    enableDivisionManagement?: boolean;
    onEditDivision?: (opts: {shiftNurseId: number; level: number; direction: 1 | -1}) => void;
    clearSelectionOnClickAway?: boolean;
}

function ShiftCalendar({
    shift,
    doc,
    readonly = false,
    onCellClick,
    disableInitialSelection = false,
    focus,
    showLayer,
    violations,
    foldedLevels,
    onToggleFoldLevel,
    onUpdateCarry,
    onSelectNurse,
    enableDragAndDrop = false,
    onDragEnd,
    enableDivisionManagement = false,
    onEditDivision,
    clearSelectionOnClickAway = true,
}: IShiftCalendarProps) {
    const {
        state: {separateWeekendColor, shiftTypeColorStyle},
    } = useUIConfig();
    const commands = useShiftEditorCommands();
    const selection = useShiftEditorStore((s) => s.selection);
    const focusedCellRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const didClearInitialSelection = useRef(false);
    const clickAwayRef = useOnclickOutside(() => {
        if (!clearSelectionOnClickAway) return;

        commands.clearSelection();
        onSelectNurse?.(null);
    });
    const {idToType, shortNameToType} = useMemo(() => {
        const idMap = new Map<number, TWardShiftType>();
        const shortNameMap = new Map<string, TWardShiftType>();

        for (const t of shift.wardShiftTypes) {
            idMap.set(t.wardShiftTypeId, t);
            shortNameMap.set(t.shortName, t);
        }

        return {idToType: idMap, shortNameToType: shortNameMap};
    }, [shift.wardShiftTypes]);
    const workerRowMap = useMemo(() => {
        const map = new Map<string, {row: TDutyDoc['rows'][number]; index: number}>();

        doc.rows.forEach((row, index) => {
            map.set(row.workerId, {row, index});
        });

        return map;
    }, [doc]);
    const divisions = useMemo(
        () =>
            shift.divisionShiftNurses.map((division) => ({
                rows: division.filter((x) => x.shiftNurse.isWorker),
            })),
        [shift.divisionShiftNurses],
    );
    const selectionRect = useMemo(() => {
        if (!selection) return null;

        return normalizeSelection(selection);
    }, [selection]);
    const derivedFocus = useMemo(() => {
        if (selection?.type !== 'single') return null;

        const workerId = doc.rows[selection.anchor.row]?.workerId;
        const shiftNurseId = workerId ? Number(workerId) : NaN;

        if (!workerId || Number.isNaN(shiftNurseId)) return null;

        return {shiftNurseId, day: selection.anchor.col};
    }, [doc.rows, selection]);
    const effectiveFocus = focus ?? derivedFocus;
    const layerFlags: TLayerFlags = showLayer ?? {fault: false, check: false, slash: false};

    useEffect(() => {
        if (!effectiveFocus) return;

        const focusRect = focusedCellRef.current?.getBoundingClientRect();
        const container = containerRef.current;

        if (!focusRect || !container) return;

        if (focusRect.x + focusRect.width > window.innerWidth)
            window.scroll({
                left: focusRect.left + container.scrollLeft,
            });

        if (focusRect.x - container.offsetLeft < 0) window.scroll({left: 0});

        if (focusRect.y + focusRect.height - container.offsetTop > container.clientHeight)
            window.scroll({
                top: focusRect.top + container.scrollTop,
            });

        if (focusRect.y - container.offsetTop < 0) window.scroll({top: focusRect.top + window.scrollY - 132});
    }, [effectiveFocus]);

    useEffect(() => {
        if (!disableInitialSelection || didClearInitialSelection.current) return;

        if (selection?.type === 'single' && selection.anchor.row === 0 && selection.anchor.col === 0) {
            commands.clearSelection();
            didClearInitialSelection.current = true;
        }
    }, [commands, disableInitialSelection, selection]);

    const handleDragEnd = (result: DropResult) => {
        if (!enableDragAndDrop || readonly) return;

        onDragEnd?.(result);
    };
    const handleCellClick = (rowIndex: number, colIndex: number) => {
        if (readonly) return;

        commands.select({row: rowIndex, col: colIndex});
        onCellClick?.(rowIndex, colIndex);
    };
    const getCellShiftType = (rowIndex: number, colIndex: number): TWardShiftType | null => {
        const cell = doc.rows[rowIndex]?.cells[colIndex] ?? null;

        if (cell === null || cell === '') return null;

        return shortNameToType.get(cell) ?? null;
    };

    return (
        <div id="calendar" ref={clickAwayRef} className="flex w-full flex-col overflow-hidden">
            <div className="z-20 flex items-center gap-5 py-[.75rem] pr-4">
                <div className="flex h-7.5 gap-5">
                    <div className="w-13.5 text-center font-apple text-[1rem] font-medium text-sub-3">{/* 구분 */}</div>
                    <div className="w-17.5 text-center font-apple text-[1rem] font-medium text-sub-3">이름</div>
                    <div className="w-7.5 text-center font-apple text-[1rem] font-medium text-sub-3">이월</div>
                    <div className="w-22.5 text-center font-apple text-[1rem] font-medium text-sub-3">전달 근무</div>
                    <div className="flex rounded-[2.5rem] border-[.0625rem] border-sub-4 px-4 py-[.1875rem]">
                        {shift.days.map((item, j) => (
                            <p
                                key={j}
                                className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${
                                    item.dayType === 'saturday'
                                        ? j === effectiveFocus?.day
                                            ? separateWeekendColor
                                                ? 'bg-blue text-white'
                                                : 'bg-red text-white'
                                            : separateWeekendColor
                                              ? 'text-blue'
                                              : 'text-red'
                                        : item.dayType === 'sunday' || item.dayType === 'holiday'
                                          ? j === effectiveFocus?.day
                                              ? 'bg-red text-white'
                                              : 'text-red'
                                          : item.dayType === 'workday'
                                            ? j === effectiveFocus?.day
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
                <div className="flex shrink-0 items-center gap-2 px-6.25 text-center">
                    {shift.wardShiftTypes
                        .filter((x) => x.isCounted)
                        .map((shiftType, index) => (
                            <div
                                key={index}
                                className="flex h-6 w-6 items-center justify-center rounded-[.375rem] p-2 font-poppins text-[1.25rem]"
                                style={
                                    shiftTypeColorStyle === 'background'
                                        ? {backgroundColor: shiftType.color, color: 'white'}
                                        : {color: shiftType.color, backgroundColor: 'white'}
                                }
                            >
                                {shiftType.shortName}
                            </div>
                        ))}
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded-[.375rem] bg-red p-2 font-poppins text-[0.8rem] text-white"
                        style={
                            shiftTypeColorStyle === 'background'
                                ? {
                                      backgroundColor: shift.wardShiftTypes.find((x) => x.name === '오프')?.color,
                                      color: 'white',
                                  }
                                : {
                                      color: shift.wardShiftTypes.find((x) => x.name === '오프')?.color,
                                      backgroundColor: 'white',
                                  }
                        }
                    >
                        WO
                    </div>
                </div>
            </div>
            <DragDropContext onDragEnd={handleDragEnd}>
                <div
                    className="-mt-5 scrollbar-hide flex flex-col gap-[.3125rem] overflow-x-hidden overflow-y-scroll pt-5 pr-4 pb-8"
                    ref={containerRef}
                >
                    {divisions.map((division, level) => {
                        const rows = division.rows;

                        if (!rows.length) return null;

                        if (foldedLevels?.[level]) {
                            return (
                                <div
                                    key={level}
                                    className="ml-5 flex h-7.5 w-[calc(100%-1.25rem)] cursor-pointer items-center gap-[.125rem] rounded-[.625rem] bg-sub-4.5 px-[.625rem]"
                                    onClick={() => onToggleFoldLevel?.(level)}
                                >
                                    <FoldDutyIcon className="h-5.5 w-5.5 rotate-180" />
                                </div>
                            );
                        }

                        return (
                            <Droppable droppableId={level.toString()} key={level.toString()}>
                                {(provided) => (
                                    <div ref={provided.innerRef} key={level} className="flex gap-5" {...provided.droppableProps}>
                                        <div className="relative ml-5 rounded-[1.25rem] shadow-banner">
                                            {!readonly && foldedLevels && onToggleFoldLevel && (
                                                <div className="absolute left-[-.9375rem] flex h-full w-7.5 items-center justify-center font-poppins font-light text-sub-2.5">
                                                    <FoldDutyIcon
                                                        className="absolute top-[50%] left-0 z-10 h-5.5 w-5.5 translate-x-[50%] translate-y-[-50%] cursor-pointer"
                                                        onClick={() => onToggleFoldLevel(level)}
                                                    />
                                                </div>
                                            )}
                                            {rows.map((row, rowIndex) => {
                                                const workerId = String(row.shiftNurse.shiftNurseId);
                                                const docEntry = workerRowMap.get(workerId);
                                                const docRowIndex = docEntry?.index ?? -1;
                                                const docRow = docEntry?.row;
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
                                                                        ? rowIndex === rows.length - 1
                                                                            ? 'rounded-[1.25rem]'
                                                                            : 'rounded-t-[1.25rem]'
                                                                        : rowIndex === rows.length - 1
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

                                                                                if (e.key === 'ArrowUp')
                                                                                    onUpdateCarry(
                                                                                        row.shiftNurse.shiftNurseId,
                                                                                        row.shiftNurse.carried + 1,
                                                                                    );

                                                                                if (e.key === 'ArrowDown')
                                                                                    onUpdateCarry(
                                                                                        row.shiftNurse.shiftNurseId,
                                                                                        row.shiftNurse.carried - 1,
                                                                                    );
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
                                                                            selection?.type === 'single' &&
                                                                            selection.anchor.row === docRowIndex &&
                                                                            selection.anchor.col === j;
                                                                        const isInRange =
                                                                            selectionRect !== null &&
                                                                            docRowIndex >= selectionRect.top &&
                                                                            docRowIndex <= selectionRect.bottom &&
                                                                            j >= selectionRect.left &&
                                                                            j <= selectionRect.right;
                                                                        const isFocused = isRowFocused && effectiveFocus?.day === j;
                                                                        const selectionClass =
                                                                            !readonly && (isSelected || isInRange)
                                                                                ? 'outline-[.125rem] outline-main-1'
                                                                                : undefined;
                                                                        const violation = violations?.get(
                                                                            `${row.shiftNurse.shiftNurseId},${j}`,
                                                                        );

                                                                        return (
                                                                            <div
                                                                                key={j}
                                                                                className={`group relative flex h-full w-9 flex-1 items-center justify-center px-[.25rem] ${
                                                                                    weekendBg
                                                                                } ${effectiveFocus?.day === j ? 'bg-main-4' : ''}`}
                                                                                onClick={() => handleCellClick(docRowIndex, j)}
                                                                            >
                                                                                {!readonly && layerFlags.fault && violation && (
                                                                                    <ViolationLayer violation={violation} />
                                                                                )}
                                                                                {!readonly && request !== null && shiftType && (
                                                                                    <RequestLayer
                                                                                        isAccept={request === shiftType.wardShiftTypeId}
                                                                                        request={idToType.get(request)!}
                                                                                        showCheck={layerFlags.check}
                                                                                        showSlash={layerFlags.slash}
                                                                                    />
                                                                                )}
                                                                                <ShiftBadge
                                                                                    id={
                                                                                        rowIndex === 0 && j === 0
                                                                                            ? 'cell_sample'
                                                                                            : undefined
                                                                                    }
                                                                                    shiftType={shiftType}
                                                                                    isOnlyRequest={shiftType === null && request !== null}
                                                                                    className={`z-10 ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
                                                                                        isFocused ? 'outline-[.125rem] outline-main-1' : ''
                                                                                    } ${selectionClass ?? ''}`}
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
                                                                <div
                                                                    id="count_by_nurse"
                                                                    className="relative flex shrink-0 items-center gap-2 px-6.25 text-center"
                                                                >
                                                                    {shift.wardShiftTypes
                                                                        .filter((x) => x.isCounted)
                                                                        .map((wardShiftType) => (
                                                                            <div
                                                                                key={wardShiftType.wardShiftTypeId}
                                                                                className="w-6 text-center font-poppins text-[1.25rem] text-sub-2"
                                                                            >
                                                                                {getCountByNurse(wardShiftType.wardShiftTypeId)}
                                                                            </div>
                                                                        ))}
                                                                    <div className="w-6 text-center font-poppins text-[1.25rem] text-sub-2">
                                                                        {getOffCount()}
                                                                    </div>
                                                                </div>
                                                                {enableDivisionManagement && onEditDivision && !readonly && (
                                                                    <>
                                                                        {rowIndex !== rows.length - 1 ? (
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
        </div>
    );
}

export default ShiftCalendar;
