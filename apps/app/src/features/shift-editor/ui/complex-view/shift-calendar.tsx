import {DragDropContext, type DropResult} from '@hello-pangea/dnd';
import {cn} from '@dutying/utils/style';
import {type ComponentProps, useEffect, useMemo, useRef} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {type TWardShiftType, type TShift} from '@/entities';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import {type TDutyDoc, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor/model';
import {normalizeSelection} from '@/features/shift-editor/model/selection';
import {ShiftCalendarDivision} from './shift-calendar/shift-calendar-division';
import {ShiftCalendarHeader} from './shift-calendar/shift-calendar-header';
import {type TLayerFlags, type TShiftCalendarFocus} from './types';
import type ViolationLayer from './violation-layer';

type TViolationItem = ComponentProps<typeof ViolationLayer>['violation'];

interface IShiftCalendarProps {
    shift: TShift;
    doc: TDutyDoc;
    readonly?: boolean;
    onCellClick?: (rowIndex: number, colIndex: number) => void;
    disableInitialSelection?: boolean;
    focus?: TShiftCalendarFocus | null;
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
    exportMode?: boolean;
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
    exportMode = false,
}: IShiftCalendarProps) {
    const {separateWeekendColor, shiftTypeColorStyle} = useUIConfigStore();
    const commands = useShiftEditorCommands();
    const selection = useShiftEditorStore((s) => s.selection);
    const focusedCellRef = useRef<HTMLParagraphElement>(null);
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

        if (focusRect.x + focusRect.width > window.innerWidth) {
            window.scroll({left: focusRect.left + container.scrollLeft});
        }

        if (focusRect.x - container.offsetLeft < 0) {
            window.scroll({left: 0});
        }

        if (focusRect.y + focusRect.height - container.offsetTop > container.clientHeight) {
            window.scroll({top: focusRect.top + container.scrollTop});
        }

        if (focusRect.y - container.offsetTop < 0) {
            window.scroll({top: focusRect.top + window.scrollY - 132});
        }
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
        <div id="calendar" ref={clickAwayRef} className={cn('flex w-full flex-col', exportMode ? 'overflow-visible' : 'overflow-hidden')}>
            <ShiftCalendarHeader
                shift={shift}
                effectiveFocusDay={effectiveFocus?.day}
                separateWeekendColor={separateWeekendColor}
                shiftTypeColorStyle={shiftTypeColorStyle}
            />
            <DragDropContext onDragEnd={handleDragEnd}>
                <div
                    className={cn(
                        '-mt-5 scrollbar-hide flex flex-col gap-[.3125rem] pt-5 pr-4 pb-8',
                        exportMode ? 'overflow-visible' : 'overflow-x-hidden overflow-y-scroll',
                    )}
                    ref={containerRef}
                >
                    {divisions.map((division, level) => (
                        <ShiftCalendarDivision
                            key={level}
                            level={level}
                            rows={division.rows}
                            shift={shift}
                            readonly={readonly}
                            folded={Boolean(foldedLevels?.[level])}
                            enableDragAndDrop={enableDragAndDrop}
                            enableDivisionManagement={enableDivisionManagement}
                            onToggleFoldLevel={onToggleFoldLevel}
                            onEditDivision={onEditDivision}
                            onSelectNurse={onSelectNurse}
                            onUpdateCarry={onUpdateCarry}
                            workerRowMap={workerRowMap}
                            getCellShiftType={getCellShiftType}
                            idToType={idToType}
                            selection={selection}
                            selectionRect={selectionRect}
                            effectiveFocus={effectiveFocus}
                            layerFlags={layerFlags}
                            violations={violations}
                            separateWeekendColor={separateWeekendColor}
                            focusedCellRef={focusedCellRef}
                            onCellClick={handleCellClick}
                        />
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}

export default ShiftCalendar;
