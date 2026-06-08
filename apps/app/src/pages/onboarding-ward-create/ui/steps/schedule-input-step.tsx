import {cn} from '@dutying/utils/style';
import {ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Trash2, UsersRound, X} from 'lucide-react';
import {
    type Dispatch,
    type KeyboardEvent,
    type MutableRefObject,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {PersonIcon} from '@/shared/assets/svg';
import {
    getOnboardingShiftCodeColor,
    normalizeOnboardingShiftCode,
    type TOnboardingNurseDraft,
    type TOnboardingScheduleRowDraft,
    type TOnboardingTeamScheduleDraft,
    type TOnboardingWardDraft,
} from '../../model';
import ScheduleFileUploadModal from './schedule-file-upload-modal';
import TeamTabs from './team-tabs';

type TScheduleFileUploadStatus = 'idle' | 'uploading' | 'success' | 'warning' | 'error';

type TScheduleFileUploadTargetMonth = {
    targetYear: number;
    targetMonth: number;
};

interface IScheduleInputStepProps {
    draft: TOnboardingWardDraft;
    selectedTeamId: string;
    onSelectTeam: (teamId: string) => void;
    onAddTeam: () => void;
    canAddTeam: boolean;
    onTeamNameChange: (teamId: string, teamName: string) => void;
    onScheduleChange: (teamId: string, schedule: TOnboardingTeamScheduleDraft) => void;
    onUploadFile: (file: File, options: TScheduleFileUploadTargetMonth) => Promise<void>;
    uploadStatus: TScheduleFileUploadStatus;
    uploadError: string | null;
    onDeleteTeam: () => void;
    isDeleteTeamDisabled: boolean;
}

type TCellPosition = {
    row: number;
    col: number;
};

type TCellRange = {
    start: TCellPosition;
    end: TCellPosition;
};

type TNormalizedRange = {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
};

type TMonthOption = {
    key: string;
    label: string;
    year: number;
    month: number;
};

type TCommitRowsOptions = {
    month?: TMonthOption;
    trackUndo?: boolean;
    previousRows?: TOnboardingScheduleRowDraft[];
    previousSelection?: TCellRange;
};

type TUndoSnapshot = {
    rows: TOnboardingScheduleRowDraft[];
    selection: TCellRange;
};

const MIN_VISIBLE_ROWS = 10;
const MAX_UNDO_HISTORY = 10;
const MAX_CELL_LENGTH = 5;
const NAME_COLUMN_INDEX = 0;
const NAME_COL = 'clamp(86px,6.8cqw,116px)';
const ROW_ACTION_COL = 'clamp(34px,3cqw,46px)';
const LEFT_GRID_TEMPLATE_COLUMNS = `${NAME_COL} minmax(0,1fr) ${ROW_ACTION_COL}`;
const ROW_GAP_X = 'clamp(8px,0.78cqw,14px)';
const DIVISION_PADDING_X = 'clamp(12px,1.15cqw,20px)';
const DAY_CELL_PADDING_X = 'clamp(3px,0.38cqw,7px)';
const NAME_TEXT_CLASS = 'text-[clamp(14px,1.08cqw,18px)]';
const SHIFT_BADGE_CELL_WRAP =
    'make-shift-calendar__shift-badge-wrap relative z-[20] flex size-[clamp(16px,1.4vw,25px)] min-w-0 shrink-0 items-center justify-center';
const SHIFT_INPUT_CLASS =
    'make-shift-calendar__shift-badge relative z-[20] h-full w-full min-h-0 min-w-0 rounded-[.375rem] border-0 px-0 text-center font-poppins text-[clamp(9px,0.82vw,18px)] leading-none outline-none';
const FALLBACK_SHIFT_COLOR = '#D6D6DE';
const EMPTY_SHIFT_TEXT_COLOR = '#FFFFFF';
const SHIFT_TERM_TEXT_COLOR = '#384255';
const SYMBOL_OFF_SHIFT_COLOR = '#555A64';
const SYMBOL_OFF_SHIFT_TEXT_COLOR = '#FFFFFF';
const FIXED_SHIFT_TEXT_COLOR = '#FFFFFF';
const FIXED_SHIFT_COLOR_BY_TERM = new Map([
    ['D', '#4DC2AD'],
    ['E', '#FF8BA5'],
    ['N', '#3580FF'],
    ['O', '#465B7A'],
]);
const SYMBOL_OFF_SHIFT_TERMS = new Set(['/', '-']);
const OFF_SHIFT_TERMS = new Set(['OFF', '오프', '휴', '휴무']);
const getMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const getCurrentMonthOption = (): TMonthOption => {
    const today = new Date();
    const date = new Date(today.getFullYear(), today.getMonth(), 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    return {
        key: getMonthKey(year, month),
        label: '최근 근무표',
        year,
        month,
    };
};
const moveMonthOption = (monthOption: TMonthOption, monthDelta: number): TMonthOption => {
    const date = new Date(monthOption.year, monthOption.month - 1 + monthDelta, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    return {
        key: getMonthKey(year, month),
        label: '최근 근무표',
        year,
        month,
    };
};
const formatScheduleMonthLabel = (year: number, month: number) => `${year}년 ${month}월`;
const createTabNurse = (teamId: string, id: string, name: string): TOnboardingNurseDraft => ({
    id,
    teamId,
    name,
    memo: '',
    isWorker: true,
    employmentDate: '',
    possibleShiftTypeIds: [],
    level: null,
    initialShifts: [],
});
const normalizeRange = ({start, end}: TCellRange): TNormalizedRange => ({
    minRow: Math.min(start.row, end.row),
    maxRow: Math.max(start.row, end.row),
    minCol: Math.min(start.col, end.col),
    maxCol: Math.max(start.col, end.col),
});
const hasMultiCellSelection = ({start, end}: TCellRange) => start.row !== end.row || start.col !== end.col;
const isCellInRange = (cell: TCellPosition, range: TNormalizedRange) =>
    cell.row >= range.minRow && cell.row <= range.maxRow && cell.col >= range.minCol && cell.col <= range.maxCol;
const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const getCellDayKey = (col: number) => String(col);
const normalizeShiftCode = normalizeOnboardingShiftCode;
const cloneSelection = (selection: TCellRange): TCellRange => ({
    start: {...selection.start},
    end: {...selection.end},
});
const cloneScheduleRows = (rows: TOnboardingScheduleRowDraft[]): TOnboardingScheduleRowDraft[] =>
    rows.map((row) => ({
        ...row,
        shifts: {...row.shifts},
    }));
const areScheduleRowsEqual = (left: TOnboardingScheduleRowDraft[], right: TOnboardingScheduleRowDraft[]) =>
    JSON.stringify(left) === JSON.stringify(right);
const parseClipboardText = (text: string) =>
    text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n$/, '')
        .split('\n')
        .map((row) => row.split('\t'));
const getCellValue = (rows: TOnboardingScheduleRowDraft[], rowIndex: number, colIndex: number) => {
    const row = rows[rowIndex];

    if (!row) {
        return '';
    }

    if (colIndex === NAME_COLUMN_INDEX) {
        return row.name;
    }

    return row.shifts[getCellDayKey(colIndex)] ?? '';
};
const getDayType = (year: number, month: number, day: number) => {
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    if (dayOfWeek === 0) return 'sunday';

    if (dayOfWeek === 6) return 'saturday';

    return 'weekday';
};
const limitCellValue = (value: string) => Array.from(value).slice(0, MAX_CELL_LENGTH).join('');
const getLatestSchedule = (scheduleInputs: TOnboardingWardDraft['scheduleInputs'][string]) =>
    Object.values(scheduleInputs ?? {})
        .filter((schedule): schedule is TOnboardingTeamScheduleDraft => Boolean(schedule))
        .sort((left, right) => right.year * 12 + right.month - (left.year * 12 + left.month))[0];
const isSymbolOffShiftCode = (value: string) => SYMBOL_OFF_SHIFT_TERMS.has(value.trim());
const getFixedShiftColor = (value: string) => {
    const term = normalizeShiftCode(value);

    return FIXED_SHIFT_COLOR_BY_TERM.get(OFF_SHIFT_TERMS.has(term) || SYMBOL_OFF_SHIFT_TERMS.has(term) ? 'O' : term) ?? null;
};
const collectCustomShiftTerms = (rows: TOnboardingScheduleRowDraft[]) => {
    const terms: string[] = [];
    const termSet = new Set<string>();

    rows.forEach((row) => {
        Object.entries(row.shifts)
            .sort(([leftDay], [rightDay]) => Number(leftDay) - Number(rightDay))
            .forEach(([, value]) => {
                const term = normalizeShiftCode(value);

                if (!term || termSet.has(term) || isSymbolOffShiftCode(term) || getFixedShiftColor(term)) {
                    return;
                }

                termSet.add(term);
                terms.push(term);
            });
    });

    return terms;
};
const appendNewShiftTerms = (currentOrder: string[], rows: TOnboardingScheduleRowDraft[]) => {
    const seenTerms = new Set(currentOrder);
    const nextOrder = [...currentOrder];

    collectCustomShiftTerms(rows).forEach((term) => {
        if (seenTerms.has(term)) {
            return;
        }

        seenTerms.add(term);
        nextOrder.push(term);
    });

    return nextOrder.length === currentOrder.length ? currentOrder : nextOrder;
};
const buildShiftTermColorMap = (termOrder: string[]) => new Map(termOrder.map((term) => [term, getOnboardingShiftCodeColor(term)]));

function ScheduleInputStep({
    draft,
    selectedTeamId,
    onSelectTeam,
    onAddTeam,
    canAddTeam,
    onTeamNameChange,
    onScheduleChange,
    onUploadFile,
    uploadStatus,
    uploadError,
    onDeleteTeam,
    isDeleteTeamDisabled,
}: IScheduleInputStepProps) {
    const rowIdRef = useRef(0);
    const calendarWrapRef = useRef<HTMLDivElement | null>(null);
    const inputRefByCell = useRef<Record<string, HTMLInputElement | null>>({});
    const pendingCompositionMoveRef = useRef<{rowDelta: number; colDelta: number} | null>(null);
    const undoHistoryRef = useRef<Record<string, TUndoSnapshot[]>>({});
    const [selection, setSelection] = useState<TCellRange>({start: {row: 0, col: 0}, end: {row: 0, col: 0}});
    const [isSelectionVisible, setIsSelectionVisible] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [fillDrag, setFillDrag] = useState<{source: TCellRange; target: TCellPosition} | null>(null);
    const [shiftTermOrderBySchedule, setShiftTermOrderBySchedule] = useState<Record<string, string[]>>({});
    const [selectedMonthOption, setSelectedMonthOption] = useState<TMonthOption>(() => getCurrentMonthOption());
    const [isScheduleFileUploadModalOpen, setIsScheduleFileUploadModalOpen] = useState(false);
    const maxMonthOption = useMemo(() => getCurrentMonthOption(), []);
    const hasActiveTeam = draft.teams.some((team) => team.id === selectedTeamId);
    const currentSchedule = draft.scheduleInputs?.[selectedTeamId]?.[selectedMonthOption.key];
    const activeMonthOption = selectedMonthOption;
    const maxMonthIndex = maxMonthOption.year * 12 + maxMonthOption.month;
    const isNextMonthDisabled = activeMonthOption.year * 12 + activeMonthOption.month >= maxMonthIndex;
    const activeScheduleKey = `${selectedTeamId}:${activeMonthOption.key}`;
    const dayCount = getDaysInMonth(activeMonthOption.year, activeMonthOption.month);
    const days = useMemo(() => Array.from({length: dayCount}, (_, index) => index + 1), [dayCount]);
    const goPreviousMonth = () => setSelectedMonthOption((prev) => moveMonthOption(prev, -1));
    const goNextMonth = () =>
        setSelectedMonthOption((prev) => {
            const nextMonthOption = moveMonthOption(prev, 1);
            const nextMonthIndex = nextMonthOption.year * 12 + nextMonthOption.month;

            return nextMonthIndex > maxMonthIndex ? prev : nextMonthOption;
        });
    const createRow = useCallback((input: Partial<TOnboardingScheduleRowDraft> = {}): TOnboardingScheduleRowDraft => {
        rowIdRef.current += 1;

        return {
            id: input.id ?? `schedule-row-${Date.now()}-${rowIdRef.current}`,
            nurseId: input.nurseId ?? null,
            name: input.name ?? '',
            shifts: input.shifts ?? {},
        };
    }, []);
    const ensureMinimumRows = useCallback(
        (rows: TOnboardingScheduleRowDraft[], requiredLength = 0, keepInitialRows = false) => {
            const nextRows = rows.map((row) => createRow(row));
            const targetLength = Math.max(requiredLength, keepInitialRows ? MIN_VISIBLE_ROWS : 0);

            while (nextRows.length < targetLength) {
                nextRows.push(createRow());
            }

            return nextRows;
        },
        [createRow],
    );
    const rows = useMemo(() => {
        if (!hasActiveTeam) {
            return [];
        }

        if (currentSchedule) {
            const nurseById = new Map(draft.nurses.map((nurse) => [nurse.id, nurse]));
            const scheduleRows = currentSchedule.rows.map((row) => {
                const nurse = row.nurseId ? nurseById.get(row.nurseId) : undefined;

                return {
                    ...row,
                    name: limitCellValue(nurse?.name ?? row.name),
                    shifts: Object.fromEntries(Object.entries(row.shifts).map(([day, value]) => [day, limitCellValue(value)])),
                };
            });

            return ensureMinimumRows(scheduleRows);
        }

        return ensureMinimumRows([], MIN_VISIBLE_ROWS, true);
    }, [currentSchedule, draft.nurses, ensureMinimumRows, hasActiveTeam]);
    const ensureShiftTermOrder = useCallback((scheduleKey: string, sourceRows: TOnboardingScheduleRowDraft[]) => {
        setShiftTermOrderBySchedule((prev) => {
            const currentOrder = prev[scheduleKey] ?? [];
            const nextOrder = appendNewShiftTerms(currentOrder, sourceRows);

            if (nextOrder === currentOrder) {
                return prev;
            }

            return {
                ...prev,
                [scheduleKey]: nextOrder,
            };
        });
    }, []);
    const shiftTermColorMap = useMemo(
        () => buildShiftTermColorMap(shiftTermOrderBySchedule[activeScheduleKey] ?? []),
        [activeScheduleKey, shiftTermOrderBySchedule],
    );
    const selectedRange = normalizeRange(selection);
    const fillRange = isSelectionVisible && fillDrag ? normalizeRange({start: selection.start, end: fillDrag.target}) : null;
    const tabNurses = useMemo(() => {
        const nurseByKey = new Map<string, TOnboardingNurseDraft>();

        draft.teams.forEach((team) => {
            const schedule = getLatestSchedule(draft.scheduleInputs?.[team.id]);

            (schedule?.rows ?? []).forEach((row) => {
                const trimmedName = row.name.trim();

                if (!trimmedName) {
                    return;
                }

                const key = row.nurseId ? `${team.id}:${row.nurseId}` : `${team.id}:${trimmedName}`;

                if (!nurseByKey.has(key)) {
                    nurseByKey.set(key, createTabNurse(team.id, row.nurseId ?? row.id, trimmedName));
                }
            });
        });

        return Array.from(nurseByKey.values());
    }, [draft.scheduleInputs, draft.teams]);
    const activeTeamNurseCount = tabNurses.filter((nurse) => nurse.teamId === selectedTeamId).length;

    useEffect(() => {
        ensureShiftTermOrder(activeScheduleKey, rows);
    }, [activeScheduleKey, ensureShiftTermOrder, rows]);

    const pushUndoSnapshot = useCallback(
        (previousRows: TOnboardingScheduleRowDraft[], previousSelection: TCellRange, month: TMonthOption) => {
            const historyKey = `${selectedTeamId}:${month.key}`;
            const snapshot = {
                rows: cloneScheduleRows(previousRows),
                selection: cloneSelection(previousSelection),
            };
            const history = undoHistoryRef.current[historyKey] ?? [];
            const latestSnapshot = history[history.length - 1];

            if (latestSnapshot && areScheduleRowsEqual(latestSnapshot.rows, snapshot.rows)) {
                return;
            }

            undoHistoryRef.current[historyKey] = [...history, snapshot].slice(-MAX_UNDO_HISTORY);
        },
        [selectedTeamId],
    );
    const commitRows = useCallback(
        (nextRows: TOnboardingScheduleRowDraft[], options: TCommitRowsOptions = {}) => {
            const month = options.month ?? activeMonthOption;
            const normalizedRows = ensureMinimumRows(
                nextRows.map((row) => ({
                    ...row,
                    name: limitCellValue(row.name),
                    shifts: Object.fromEntries(Object.entries(row.shifts).map(([day, value]) => [day, limitCellValue(value)])),
                })),
            );
            const previousRows = options.previousRows ?? rows;
            const previousSelection = options.previousSelection ?? selection;

            if (options.trackUndo !== false && !areScheduleRowsEqual(previousRows, normalizedRows)) {
                pushUndoSnapshot(previousRows, previousSelection, month);
            }

            ensureShiftTermOrder(`${selectedTeamId}:${month.key}`, normalizedRows);
            onScheduleChange(selectedTeamId, {
                year: month.year,
                month: month.month,
                rows: normalizedRows,
            });
        },
        [activeMonthOption, ensureMinimumRows, ensureShiftTermOrder, onScheduleChange, pushUndoSnapshot, rows, selectedTeamId, selection],
    );
    const focusCell = useCallback((rowIndex: number, colIndex: number, selectText = false) => {
        const input = inputRefByCell.current[`${rowIndex}:${colIndex}`];

        input?.focus();

        if (selectText) {
            input?.select();
        }

        requestAnimationFrame(() => {
            const nextInput = inputRefByCell.current[`${rowIndex}:${colIndex}`];

            nextInput?.focus();

            if (selectText) {
                nextInput?.select();
            }
        });
    }, []);
    const undoLastScheduleEdit = useCallback(() => {
        const historyKey = `${selectedTeamId}:${activeMonthOption.key}`;
        const history = undoHistoryRef.current[historyKey] ?? [];
        const snapshot = history[history.length - 1];

        if (!snapshot) {
            return;
        }

        undoHistoryRef.current[historyKey] = history.slice(0, -1);

        const restoredRows = ensureMinimumRows(snapshot.rows);
        const maxRow = Math.max(0, restoredRows.length - 1);
        const restoredSelection = {
            start: {
                row: Math.min(snapshot.selection.start.row, maxRow),
                col: Math.min(snapshot.selection.start.col, dayCount),
            },
            end: {
                row: Math.min(snapshot.selection.end.row, maxRow),
                col: Math.min(snapshot.selection.end.col, dayCount),
            },
        };

        onScheduleChange(selectedTeamId, {
            year: activeMonthOption.year,
            month: activeMonthOption.month,
            rows: restoredRows,
        });
        setSelection(restoredSelection);
        requestAnimationFrame(() => focusCell(restoredSelection.end.row, restoredSelection.end.col));
    }, [activeMonthOption, dayCount, ensureMinimumRows, focusCell, onScheduleChange, selectedTeamId]);
    const updateCellValue = useCallback(
        (rowIndex: number, colIndex: number, value: string) => {
            const nextRows = ensureMinimumRows(rows, rowIndex + 1);
            const nextValue = limitCellValue(value);

            if (colIndex === NAME_COLUMN_INDEX) {
                nextRows[rowIndex] = {
                    ...nextRows[rowIndex],
                    name: nextValue,
                };
            } else {
                nextRows[rowIndex] = {
                    ...nextRows[rowIndex],
                    shifts: {
                        ...nextRows[rowIndex]?.shifts,
                        [getCellDayKey(colIndex)]: nextValue,
                    },
                };
            }

            commitRows(nextRows);
        },
        [commitRows, ensureMinimumRows, rows],
    );
    const moveSelection = useCallback(
        (rowDelta: number, colDelta: number) => {
            const maxCol = dayCount;
            const maxRow = Math.max(0, rows.length - 1);
            const nextRow = Math.max(0, Math.min(maxRow, selection.end.row + rowDelta));
            const nextCol = Math.max(0, Math.min(maxCol, selection.end.col + colDelta));
            const nextSelection = {start: {row: nextRow, col: nextCol}, end: {row: nextRow, col: nextCol}};

            setSelection(nextSelection);
            focusCell(nextRow, nextCol);
        },
        [dayCount, focusCell, rows.length, selection.end.col, selection.end.row],
    );
    const clearSelectedCells = useCallback(() => {
        const range = normalizeRange(selection);
        const nextRows = ensureMinimumRows(rows, range.maxRow + 1);

        for (let rowIndex = range.minRow; rowIndex <= range.maxRow; rowIndex += 1) {
            if (!nextRows[rowIndex]) {
                nextRows[rowIndex] = createRow();
            }

            for (let colIndex = range.minCol; colIndex <= range.maxCol; colIndex += 1) {
                if (colIndex > dayCount) {
                    continue;
                }

                if (colIndex === NAME_COLUMN_INDEX) {
                    nextRows[rowIndex] = {
                        ...nextRows[rowIndex],
                        name: '',
                    };

                    continue;
                }

                const nextShifts = {...nextRows[rowIndex].shifts};

                delete nextShifts[getCellDayKey(colIndex)];
                nextRows[rowIndex] = {
                    ...nextRows[rowIndex],
                    shifts: nextShifts,
                };
            }
        }

        commitRows(nextRows);
        setSelection(selection);
    }, [commitRows, createRow, dayCount, ensureMinimumRows, rows, selection]);
    const queueCompositionMove = useCallback((rowDelta: number, colDelta: number) => {
        pendingCompositionMoveRef.current = {rowDelta, colDelta};
    }, []);
    const flushCompositionMove = useCallback(() => {
        const pendingMove = pendingCompositionMoveRef.current;

        if (!pendingMove) {
            return;
        }

        pendingCompositionMoveRef.current = null;
        requestAnimationFrame(() => {
            moveSelection(pendingMove.rowDelta, pendingMove.colDelta);
        });
    }, [moveSelection]);
    const buildSelectionText = useCallback(() => {
        const range = normalizeRange(selection);
        const copiedRows: string[] = [];

        for (let rowIndex = range.minRow; rowIndex <= range.maxRow; rowIndex += 1) {
            const copiedCells: string[] = [];

            for (let colIndex = range.minCol; colIndex <= range.maxCol; colIndex += 1) {
                copiedCells.push(getCellValue(rows, rowIndex, colIndex));
            }

            copiedRows.push(copiedCells.join('\t'));
        }

        return copiedRows.join('\n');
    }, [rows, selection]);
    const pasteText = useCallback(
        (text: string, start = selection.end) => {
            if (!text) {
                return;
            }

            const pastedRows = parseClipboardText(text);
            const nextRows = ensureMinimumRows(rows, start.row + pastedRows.length);

            pastedRows.forEach((pastedRow, rowOffset) => {
                const rowIndex = start.row + rowOffset;

                pastedRow.forEach((value, colOffset) => {
                    const colIndex = start.col + colOffset;
                    const nextValue = limitCellValue(value);

                    if (colIndex > dayCount) {
                        return;
                    }

                    if (!nextRows[rowIndex]) {
                        nextRows[rowIndex] = createRow();
                    }

                    if (colIndex === NAME_COLUMN_INDEX) {
                        nextRows[rowIndex] = {
                            ...nextRows[rowIndex],
                            name: nextValue,
                        };

                        return;
                    }

                    nextRows[rowIndex] = {
                        ...nextRows[rowIndex],
                        shifts: {
                            ...nextRows[rowIndex].shifts,
                            [getCellDayKey(colIndex)]: nextValue,
                        },
                    };
                });
            });

            const endRow = start.row + pastedRows.length - 1;
            const endCol = Math.min(dayCount, start.col + Math.max(...pastedRows.map((row) => row.length), 1) - 1);

            commitRows(nextRows);
            setSelection({start, end: {row: endRow, col: endCol}});
            focusCell(start.row, start.col);
        },
        [commitRows, createRow, dayCount, ensureMinimumRows, focusCell, rows, selection.end],
    );
    const applyFillDrag = useCallback(
        (source: TCellRange, target: TCellPosition) => {
            const sourceRange = normalizeRange(source);
            const targetRange = normalizeRange({start: source.start, end: target});
            const sourceHeight = sourceRange.maxRow - sourceRange.minRow + 1;
            const sourceWidth = sourceRange.maxCol - sourceRange.minCol + 1;
            const nextRows = ensureMinimumRows(rows, targetRange.maxRow + 1);

            for (let rowIndex = targetRange.minRow; rowIndex <= targetRange.maxRow; rowIndex += 1) {
                for (let colIndex = targetRange.minCol; colIndex <= targetRange.maxCol; colIndex += 1) {
                    const sourceRow = sourceRange.minRow + positiveModulo(rowIndex - sourceRange.minRow, sourceHeight);
                    const sourceCol = sourceRange.minCol + positiveModulo(colIndex - sourceRange.minCol, sourceWidth);
                    const value = limitCellValue(getCellValue(rows, sourceRow, sourceCol));

                    if (!nextRows[rowIndex]) {
                        nextRows[rowIndex] = createRow();
                    }

                    if (colIndex === NAME_COLUMN_INDEX) {
                        nextRows[rowIndex] = {
                            ...nextRows[rowIndex],
                            name: value,
                        };
                    } else {
                        nextRows[rowIndex] = {
                            ...nextRows[rowIndex],
                            shifts: {
                                ...nextRows[rowIndex].shifts,
                                [getCellDayKey(colIndex)]: value,
                            },
                        };
                    }
                }
            }

            commitRows(nextRows);
            setSelection({
                start: {row: targetRange.minRow, col: targetRange.minCol},
                end: {row: targetRange.maxRow, col: targetRange.maxCol},
            });
        },
        [commitRows, createRow, ensureMinimumRows, rows],
    );
    const deleteRow = (rowIndex: number) => {
        const nextRows = rows.filter((_, index) => index !== rowIndex);
        const nextRowIndex = Math.min(rowIndex, Math.max(0, nextRows.length - 1));

        commitRows(nextRows);
        setSelection({start: {row: nextRowIndex, col: 0}, end: {row: nextRowIndex, col: 0}});
        requestAnimationFrame(() => focusCell(nextRowIndex, 0));
    };
    const addRow = () => {
        const nextRows = [...rows, createRow()];
        const nextRowIndex = nextRows.length - 1;

        commitRows(nextRows);
        setSelection({start: {row: nextRowIndex, col: 0}, end: {row: nextRowIndex, col: 0}});
        focusCell(nextRowIndex, 0);
    };

    useEffect(() => {
        const stopSelection = () => {
            setIsSelecting(false);
        };

        document.addEventListener('mouseup', stopSelection);

        return () => {
            document.removeEventListener('mouseup', stopSelection);
        };
    }, []);

    useEffect(() => {
        if (!fillDrag) {
            return;
        }

        const finishFill = () => {
            applyFillDrag(fillDrag.source, fillDrag.target);
            setFillDrag(null);
        };

        document.addEventListener('mouseup', finishFill, {once: true});

        return () => {
            document.removeEventListener('mouseup', finishFill);
        };
    }, [applyFillDrag, fillDrag]);

    useEffect(() => {
        setSelection((prev) => {
            const nextSelection = {
                start: {...prev.start, col: Math.min(prev.start.col, dayCount)},
                end: {...prev.end, col: Math.min(prev.end.col, dayCount)},
            };

            if (nextSelection.start.col === prev.start.col && nextSelection.end.col === prev.end.col) {
                return prev;
            }

            return nextSelection;
        });
    }, [dayCount]);

    useEffect(() => {
        const clearSelectionOnOutsideMouseDown = (event: MouseEvent) => {
            const target = event.target instanceof Element ? event.target : null;

            if (!target || calendarWrapRef.current?.contains(target)) {
                return;
            }

            setIsSelectionVisible(false);
            setIsSelecting(false);
            setFillDrag(null);
        };

        document.addEventListener('mousedown', clearSelectionOnOutsideMouseDown);

        return () => document.removeEventListener('mousedown', clearSelectionOnOutsideMouseDown);
    }, []);

    return (
        <div
            ref={calendarWrapRef}
            className="fixed-shifts-calendar-wrap w-full min-w-0 rounded-[16px] bg-white p-[clamp(20px,2.2cqw,32px)] shadow-[0_12px_32px_rgba(49,55,74,0.06)]"
            onMouseDownCapture={(event) => {
                const target = event.target instanceof Element ? event.target : null;

                if (target?.closest('[data-schedule-cell],[data-fill-handle]')) {
                    return;
                }

                setIsSelectionVisible(false);
                setIsSelecting(false);
                setFillDrag(null);
            }}
            onCopy={(event) => {
                event.clipboardData.setData('text/plain', buildSelectionText());
                event.preventDefault();
            }}
            onPaste={(event) => {
                pasteText(event.clipboardData.getData('text/plain'));
                event.preventDefault();
            }}
        >
            <div className="space-y-5">
                <div className="flex w-full items-center justify-between gap-3">
                    <ScheduleMonthSelector
                        year={activeMonthOption.year}
                        month={activeMonthOption.month}
                        onPreviousMonth={goPreviousMonth}
                        onNextMonth={goNextMonth}
                        isNextMonthDisabled={isNextMonthDisabled}
                    />
                    <button
                        type="button"
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-[#107C41] px-4 font-apple text-[14px] font-semibold text-white transition-colors hover:bg-[#0E6F3A] focus-visible:outline-2 focus-visible:outline-[#107C41]/35 active:bg-[#0B5F31]"
                        onClick={() => setIsScheduleFileUploadModalOpen(true)}
                    >
                        <FileSpreadsheet className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                        근무표 파일 등록
                    </button>
                </div>
                <TeamTabs
                    teams={draft.teams}
                    nurses={tabNurses}
                    currentTeamId={selectedTeamId}
                    onSelect={onSelectTeam}
                    onAdd={onAddTeam}
                    canAdd={canAddTeam}
                    onRename={onTeamNameChange}
                />
                {hasActiveTeam ? (
                    <>
                        <div className="make-shift-calendar @container flex w-full min-w-0 flex-col gap-3">
                            <div className="make-shift-calendar__header flex w-full min-w-0 items-center py-1" style={{gap: 0}}>
                                <div
                                    className="make-shift-calendar__header-left grid min-w-0 flex-1 items-center"
                                    style={{
                                        gridTemplateColumns: LEFT_GRID_TEMPLATE_COLUMNS,
                                        columnGap: ROW_GAP_X,
                                        paddingLeft: DIVISION_PADDING_X,
                                        paddingRight: DIVISION_PADDING_X,
                                    }}
                                >
                                    <HeaderLabel
                                        className={cn('make-shift-calendar__header-label--name font-semibold text-sub-2', NAME_TEXT_CLASS)}
                                    >
                                        <span className="flex min-w-0 items-center justify-center gap-1.5">
                                            <span>간호사</span>
                                            <span className="inline-flex h-4 items-center gap-0.5 align-middle font-poppins text-[clamp(11px,0.8cqw,13px)] leading-none font-semibold text-[#6B7280]">
                                                <PersonIcon className="block h-3.5 w-3.5 shrink-0 text-[#7B8494]" aria-hidden="true" />
                                                <span className="block leading-none tabular-nums">{activeTeamNurseCount}</span>
                                            </span>
                                        </span>
                                    </HeaderLabel>
                                    <div
                                        className="make-shift-calendar__day-header-pill grid min-w-0 rounded-[12px] bg-gray-7 px-0 py-1"
                                        style={{gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`}}
                                    >
                                        {days.map((day) => {
                                            const dayType = getDayType(activeMonthOption.year, activeMonthOption.month, day);

                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    tabIndex={-1}
                                                    className={cn(
                                                        'make-shift-calendar__day-header-cell relative min-w-0 rounded-full text-center font-poppins text-[12px] leading-5 font-semibold tabular-nums',
                                                        'cursor-default',
                                                        dayType === 'saturday'
                                                            ? 'text-blue'
                                                            : dayType === 'sunday'
                                                              ? 'text-red'
                                                              : 'text-sub-2.5',
                                                    )}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div aria-hidden="true" />
                                </div>
                            </div>
                            <div className="make-shift-calendar__body flex w-full min-w-0 flex-col gap-2">
                                <div className="make-shift-calendar__division flex w-full min-w-0 items-stretch" style={{gap: 0}}>
                                    <div className="make-shift-calendar__division-card relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white">
                                        {rows.map((row, rowIndex) => (
                                            <div key={row.id} style={{paddingLeft: DIVISION_PADDING_X, paddingRight: DIVISION_PADDING_X}}>
                                                <div
                                                    data-row-index={rowIndex}
                                                    className="make-shift-calendar__row make-shift-calendar__row-left grid h-[clamp(32px,2.7cqw,44px)] w-full min-w-0 items-stretch"
                                                    style={{
                                                        gridTemplateColumns: LEFT_GRID_TEMPLATE_COLUMNS,
                                                        columnGap: ROW_GAP_X,
                                                    }}
                                                >
                                                    <NameCell
                                                        row={row}
                                                        rowIndex={rowIndex}
                                                        selection={selection}
                                                        isSelectionVisible={isSelectionVisible}
                                                        selectedRange={selectedRange}
                                                        fillRange={fillRange}
                                                        inputRefByCell={inputRefByCell}
                                                        isSelecting={isSelecting}
                                                        fillDrag={fillDrag}
                                                        onFocusCell={focusCell}
                                                        onShowSelection={() => setIsSelectionVisible(true)}
                                                        onSetSelection={setSelection}
                                                        onSetIsSelecting={setIsSelecting}
                                                        onSetFillDrag={setFillDrag}
                                                        onUpdate={updateCellValue}
                                                        onMove={moveSelection}
                                                        onClearSelection={clearSelectedCells}
                                                        onCopySelection={buildSelectionText}
                                                        onUndo={undoLastScheduleEdit}
                                                        onQueueCompositionMove={queueCompositionMove}
                                                        onFlushCompositionMove={flushCompositionMove}
                                                    />
                                                    <div
                                                        className="make-shift-calendar__row-days grid h-full min-w-0 items-stretch px-0"
                                                        style={{gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`}}
                                                    >
                                                        {days.map((day, dayIndex) => (
                                                            <ShiftCell
                                                                key={day}
                                                                row={row}
                                                                rowIndex={rowIndex}
                                                                colIndex={dayIndex + 1}
                                                                day={day}
                                                                dayType={getDayType(activeMonthOption.year, activeMonthOption.month, day)}
                                                                value={getCellValue(rows, rowIndex, dayIndex + 1)}
                                                                termColorMap={shiftTermColorMap}
                                                                selection={selection}
                                                                isSelectionVisible={isSelectionVisible}
                                                                selectedRange={selectedRange}
                                                                fillRange={fillRange}
                                                                inputRefByCell={inputRefByCell}
                                                                isSelecting={isSelecting}
                                                                fillDrag={fillDrag}
                                                                onFocusCell={focusCell}
                                                                onShowSelection={() => setIsSelectionVisible(true)}
                                                                onSetSelection={setSelection}
                                                                onSetIsSelecting={setIsSelecting}
                                                                onSetFillDrag={setFillDrag}
                                                                onUpdate={updateCellValue}
                                                                onMove={moveSelection}
                                                                onClearSelection={clearSelectedCells}
                                                                onCopySelection={buildSelectionText}
                                                                onUndo={undoLastScheduleEdit}
                                                                onQueueCompositionMove={queueCompositionMove}
                                                                onFlushCompositionMove={flushCompositionMove}
                                                            />
                                                        ))}
                                                    </div>
                                                    <RowDeleteCell row={row} rowIndex={rowIndex} onDelete={deleteRow} />
                                                </div>
                                            </div>
                                        ))}
                                        <div className="pt-3" style={{paddingLeft: DIVISION_PADDING_X, paddingRight: DIVISION_PADDING_X}}>
                                            <button
                                                type="button"
                                                aria-label="행 추가"
                                                className="mx-auto flex h-9 w-fit min-w-[104px] items-center justify-center gap-1.5 rounded-full bg-[#F2F4F6] px-4 font-apple text-[14px] font-semibold text-[#4E5968] transition-colors hover:bg-[#E5E8EB] focus-visible:outline-2 focus-visible:outline-main-1 active:bg-[#DDE3E8]"
                                                onClick={addRow}
                                            >
                                                <Plus className="h-3.5 w-3.5 text-[#8B95A1]" strokeWidth={2.8} />행 추가
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-start pt-1">
                            <button
                                type="button"
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] px-0 font-apple text-[16px] font-semibold text-[#C55252] transition-colors hover:text-[#A53F3F] focus-visible:outline-2 focus-visible:outline-[#C55252]/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[#C55252]"
                                disabled={isDeleteTeamDisabled}
                                onClick={onDeleteTeam}
                            >
                                <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />팀 삭제하기
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-[16px] border border-dashed border-[#D3D8E2] bg-[#F8FAFC] px-6 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#7B8494] shadow-[0_6px_18px_rgba(49,55,74,0.06)]">
                            <UsersRound className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
                        </div>
                        <p className="mt-4 font-apple text-[18px] font-semibold text-sub-1">팀을 먼저 만들어 주세요</p>
                        <p className="mt-1 font-apple text-[14px] leading-5 text-gray-3">
                            팀을 추가하면 간호사 이름과 근무표를 입력할 수 있어요.
                        </p>
                        <button
                            type="button"
                            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#3D4658] px-4 font-apple text-[14px] font-semibold text-white transition-colors hover:bg-[#303848] focus-visible:outline-2 focus-visible:outline-main-1"
                            onClick={onAddTeam}
                        >
                            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />팀 추가하기
                        </button>
                    </div>
                )}
            </div>
            <ScheduleFileUploadModal
                open={isScheduleFileUploadModalOpen}
                targetYear={activeMonthOption.year}
                targetMonth={activeMonthOption.month}
                uploadStatus={uploadStatus}
                uploadError={uploadError}
                onClose={() => setIsScheduleFileUploadModalOpen(false)}
                onUpload={onUploadFile}
            />
        </div>
    );
}

function HeaderLabel({children, className}: {children: ReactNode; className?: string}) {
    return (
        <div
            className={cn(
                'make-shift-calendar__header-label min-w-0 truncate text-center font-apple text-[clamp(10px,0.78cqw,14px)] font-medium text-sub-3',
                className,
            )}
        >
            {children}
        </div>
    );
}

function ScheduleMonthSelector({
    year,
    month,
    onPreviousMonth,
    onNextMonth,
    isNextMonthDisabled,
}: {
    year: number;
    month: number;
    onPreviousMonth: () => void;
    onNextMonth: () => void;
    isNextMonthDisabled: boolean;
}) {
    return (
        <div className="flex items-center">
            <div className="flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                    onClick={onPreviousMonth}
                    aria-label="이전 달"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-[112px] text-center font-apple text-[20px] font-semibold text-main-1">
                    {formatScheduleMonthLabel(year, month)}
                </div>
                <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-4"
                    onClick={onNextMonth}
                    disabled={isNextMonthDisabled}
                    aria-disabled={isNextMonthDisabled}
                    aria-label="다음 달"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

type TEditableCellProps = {
    rowIndex: number;
    colIndex: number;
    selection: TCellRange;
    isSelectionVisible: boolean;
    selectedRange: TNormalizedRange;
    fillRange: TNormalizedRange | null;
    inputRefByCell: MutableRefObject<Record<string, HTMLInputElement | null>>;
    isSelecting: boolean;
    fillDrag: {source: TCellRange; target: TCellPosition} | null;
    onFocusCell: (rowIndex: number, colIndex: number, selectText?: boolean) => void;
    onShowSelection: () => void;
    onSetSelection: Dispatch<SetStateAction<TCellRange>>;
    onSetIsSelecting: Dispatch<SetStateAction<boolean>>;
    onSetFillDrag: Dispatch<SetStateAction<{source: TCellRange; target: TCellPosition} | null>>;
    onUpdate: (rowIndex: number, colIndex: number, value: string) => void;
    onMove: (rowDelta: number, colDelta: number) => void;
    onClearSelection: () => void;
    onCopySelection: () => string;
    onUndo: () => void;
    onQueueCompositionMove: (rowDelta: number, colDelta: number) => void;
    onFlushCompositionMove: () => void;
};

type TNameCellProps = Omit<TEditableCellProps, 'colIndex'> & {
    row: TOnboardingScheduleRowDraft;
};

function NameCell({
    row,
    rowIndex,
    selection,
    isSelectionVisible,
    selectedRange,
    fillRange,
    inputRefByCell,
    isSelecting,
    fillDrag,
    onFocusCell,
    onShowSelection,
    onSetSelection,
    onSetIsSelecting,
    onSetFillDrag,
    onUpdate,
    onMove,
    onClearSelection,
    onCopySelection,
    onUndo,
    onQueueCompositionMove,
    onFlushCompositionMove,
}: TNameCellProps) {
    const colIndex = NAME_COLUMN_INDEX;
    const cell = {row: rowIndex, col: colIndex};
    const isActive = isSelectionVisible && selection.end.row === rowIndex && selection.end.col === colIndex;
    const isSelected = isSelectionVisible && isCellInRange(cell, selectedRange);
    const isFillHighlighted = fillRange ? isCellInRange(cell, fillRange) : false;
    const isFillHandleCell = isSelectionVisible && selectedRange.maxRow === rowIndex && selectedRange.maxCol === colIndex && !fillDrag;

    return (
        <div
            data-schedule-cell
            className={cn(
                'make-shift-calendar__row-name relative flex min-h-0 min-w-0 items-center justify-center truncate text-center font-apple leading-none whitespace-nowrap text-sub-1',
                NAME_TEXT_CLASS,
                isSelected && 'bg-main-light/50 outline outline-1 -outline-offset-1 outline-[#8AB4FF]',
                isActive && 'z-20 outline-2 -outline-offset-2 outline-main-1',
                isFillHighlighted && 'bg-main-light',
            )}
            title={row.name}
            onMouseDown={(event) => {
                if (event.button !== 0) return;

                if ((event.target as HTMLElement).closest('button,[data-fill-handle]')) return;

                event.preventDefault();
                onShowSelection();
                onSetIsSelecting(true);
                onSetSelection({start: cell, end: cell});
                onFocusCell(rowIndex, colIndex);
            }}
            onMouseEnter={() => {
                if (fillDrag) {
                    onSetFillDrag((prev) => (prev ? {...prev, target: cell} : prev));

                    return;
                }

                if (isSelecting) {
                    onSetSelection((prev) => ({...prev, end: cell}));
                }
            }}
            onDoubleClick={() => onFocusCell(rowIndex, colIndex, true)}
        >
            <input
                ref={(element) => {
                    inputRefByCell.current[`${rowIndex}:${colIndex}`] = element;
                }}
                value={row.name}
                aria-label={`${rowIndex + 1}행 간호사 이름`}
                placeholder="이름"
                maxLength={MAX_CELL_LENGTH}
                className={cn(
                    'h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-center font-apple text-sub-1 outline-none placeholder:text-gray-4',
                    NAME_TEXT_CLASS,
                )}
                onFocus={() => {
                    onShowSelection();
                    onSetSelection({start: cell, end: cell});
                }}
                onChange={(event) => onUpdate(rowIndex, colIndex, event.target.value)}
                onKeyDown={(event) =>
                    handleCellKeyDown(event, selection, onMove, onClearSelection, onCopySelection, onUndo, onQueueCompositionMove)
                }
                onCompositionEnd={onFlushCompositionMove}
            />
            {isFillHandleCell ? <FillHandle selection={selection} cell={cell} onSetFillDrag={onSetFillDrag} /> : null}
        </div>
    );
}

function RowDeleteCell({
    row,
    rowIndex,
    onDelete,
}: {
    row: TOnboardingScheduleRowDraft;
    rowIndex: number;
    onDelete: (rowIndex: number) => void;
}) {
    return (
        <div className="flex min-h-0 min-w-0 items-center justify-center">
            <button
                type="button"
                aria-label={`${row.name || `${rowIndex + 1}행`} 삭제`}
                className="flex size-5 items-center justify-center rounded-full bg-[#EEF2F6] text-[#7F899A] transition-colors hover:bg-[#FBE8EA] hover:text-[#D14343] focus-visible:outline-2 focus-visible:outline-main-1"
                onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(rowIndex);
                }}
            >
                <X className="h-3 w-3" strokeWidth={2.8} />
            </button>
        </div>
    );
}

type TShiftCellProps = TEditableCellProps & {
    row: TOnboardingScheduleRowDraft;
    day: number;
    dayType: 'weekday' | 'saturday' | 'sunday';
    value: string;
    termColorMap: Map<string, string>;
};

function ShiftCell({
    rowIndex,
    colIndex,
    day,
    dayType,
    value,
    termColorMap,
    selection,
    isSelectionVisible,
    selectedRange,
    fillRange,
    inputRefByCell,
    isSelecting,
    fillDrag,
    onFocusCell,
    onShowSelection,
    onSetSelection,
    onSetIsSelecting,
    onSetFillDrag,
    onUpdate,
    onMove,
    onClearSelection,
    onCopySelection,
    onUndo,
    onQueueCompositionMove,
    onFlushCompositionMove,
}: TShiftCellProps) {
    const cell = {row: rowIndex, col: colIndex};
    const isActive = isSelectionVisible && selection.end.row === rowIndex && selection.end.col === colIndex;
    const isSelected = isSelectionVisible && isCellInRange(cell, selectedRange);
    const isFillHighlighted = fillRange ? isCellInRange(cell, fillRange) : false;
    const isFillHandleCell = isSelectionVisible && selectedRange.maxRow === rowIndex && selectedRange.maxCol === colIndex && !fillDrag;
    const normalizedValue = normalizeShiftCode(value);
    const hasValue = Boolean(normalizedValue);
    const isSymbolOffValue = isSymbolOffShiftCode(value);
    const fixedShiftColor = getFixedShiftColor(value);
    const backgroundColor = isSymbolOffValue
        ? SYMBOL_OFF_SHIFT_COLOR
        : (fixedShiftColor ?? (hasValue ? (termColorMap.get(normalizedValue) ?? FALLBACK_SHIFT_COLOR) : FALLBACK_SHIFT_COLOR));
    const textColor = isSymbolOffValue
        ? SYMBOL_OFF_SHIFT_TEXT_COLOR
        : fixedShiftColor !== null
          ? FIXED_SHIFT_TEXT_COLOR
          : hasValue
            ? SHIFT_TERM_TEXT_COLOR
            : EMPTY_SHIFT_TEXT_COLOR;
    const weekendBg = dayType === 'saturday' ? 'bg-blue/5' : dayType === 'sunday' ? 'bg-red/5' : '';

    return (
        <div
            data-schedule-cell
            data-day-index={day - 1}
            className={cn(
                'make-shift-calendar__day-cell group relative z-[10] flex h-full min-w-0 cursor-pointer items-center justify-center',
                weekendBg,
                isSelected && 'outline outline-1 -outline-offset-1 outline-[#8AB4FF]',
                isActive && 'z-20 outline-2 -outline-offset-2 outline-main-1',
                isFillHighlighted && 'bg-main-light/60',
            )}
            style={{gridRow: 1, gridColumn: colIndex, paddingInline: DAY_CELL_PADDING_X}}
            onMouseDown={(event) => {
                if (event.button !== 0) return;

                if ((event.target as HTMLElement).closest('[data-fill-handle]')) return;

                event.preventDefault();
                onShowSelection();
                onSetIsSelecting(true);
                onSetSelection({start: cell, end: cell});
                onFocusCell(rowIndex, colIndex);
            }}
            onMouseEnter={() => {
                if (fillDrag) {
                    onSetFillDrag((prev) => (prev ? {...prev, target: cell} : prev));

                    return;
                }

                if (isSelecting) {
                    onSetSelection((prev) => ({...prev, end: cell}));
                }
            }}
            onDoubleClick={() => onFocusCell(rowIndex, colIndex, true)}
        >
            <span className={SHIFT_BADGE_CELL_WRAP}>
                <input
                    ref={(element) => {
                        inputRefByCell.current[`${rowIndex}:${colIndex}`] = element;
                    }}
                    value={value}
                    aria-label={`${rowIndex + 1}행 ${day}일 근무`}
                    placeholder="-"
                    maxLength={MAX_CELL_LENGTH}
                    className={cn(SHIFT_INPUT_CLASS, isActive && 'outline outline-2 outline-main-1')}
                    style={{backgroundColor, color: textColor}}
                    onFocus={() => {
                        onShowSelection();
                        onSetSelection({start: cell, end: cell});
                    }}
                    onChange={(event) => onUpdate(rowIndex, colIndex, event.target.value)}
                    onKeyDown={(event) =>
                        handleCellKeyDown(event, selection, onMove, onClearSelection, onCopySelection, onUndo, onQueueCompositionMove)
                    }
                    onCompositionEnd={onFlushCompositionMove}
                />
            </span>
            {isFillHandleCell ? <FillHandle selection={selection} cell={cell} onSetFillDrag={onSetFillDrag} /> : null}
        </div>
    );
}

function FillHandle({
    selection,
    cell,
    onSetFillDrag,
}: {
    selection: TCellRange;
    cell: TCellPosition;
    onSetFillDrag: Dispatch<SetStateAction<{source: TCellRange; target: TCellPosition} | null>>;
}) {
    return (
        <span
            data-fill-handle
            className="absolute right-[-4px] bottom-[-4px] z-30 h-2.5 w-2.5 cursor-crosshair rounded-[2px] border border-white bg-main-1"
            onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSetFillDrag({source: selection, target: cell});
            }}
        />
    );
}

function handleCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    selection: TCellRange,
    onMove: (rowDelta: number, colDelta: number) => void,
    onClearSelection: () => void,
    onCopySelection: () => string,
    onUndo: () => void,
    onQueueCompositionMove: (rowDelta: number, colDelta: number) => void,
) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onUndo();

        return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void navigator.clipboard?.writeText(onCopySelection());

        return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        return;
    }

    if ((event.key === 'Backspace' || event.key === 'Delete') && hasMultiCellSelection(selection)) {
        event.preventDefault();
        onClearSelection();

        return;
    }

    if (event.nativeEvent.isComposing) {
        if (event.key === 'Enter') {
            onQueueCompositionMove(event.shiftKey ? -1 : 1, 0);
        }

        return;
    }

    if (event.key === 'Process') {
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        onMove(-1, 0);

        return;
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        onMove(1, 0);

        return;
    }

    if (event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0) {
        event.preventDefault();
        onMove(0, -1);

        return;
    }

    if (event.key === 'ArrowRight' && event.currentTarget.selectionStart === event.currentTarget.value.length) {
        event.preventDefault();
        onMove(0, 1);

        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        onMove(event.shiftKey ? -1 : 1, 0);

        return;
    }

    if (event.key === 'Tab') {
        event.preventDefault();
        onMove(0, event.shiftKey ? -1 : 1);
    }
}

export default ScheduleInputStep;
