import type {TSnapshotCellDTO, TValidationRes} from '@dutying/api/ward';
import toast from 'react-hot-toast';
import type {TShift} from '@/entities';
import {type TWardConstraint} from '@/entities';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {copySelection, pastePayload} from './clipboard';
import {useShiftEditorDraftStatusStore} from './draft-status-store';
import {applyBoardToWardConstraint, buildInitialDutyRuleBoard, buildRuleLevelByKeyFromBoard} from './duty-constraints';
import {getDutyCellLockKey, getDutyDocMinColumn, isDutyCellPositionInBounds, readDutyCell} from './duty-doc-cells';
import {applyOperation, invertOperation} from './operation';
import {createShiftEditorPersistence} from './persistence';
import {
    createScheduleValidationSnapshot,
    migratePersistedViolations,
    toScheduleViolationPersisted,
    type TScheduleViolationPersisted,
} from './schedule-violations';
import {getCellsInSelection, makeSelectAllSelection, moveSelection as moveSelectionModel, moveSelectionToEdge} from './selection';
import {buildWardShiftTypeMaps} from './shift-adapter';
import {useShiftEditorStore} from './store';
import type {
    TCellPos,
    TCellValue,
    TClipboardPayload,
    TDutyDoc,
    TDutyRuleBoard,
    TDutyValidationInput,
    THistoryEntry,
    THistoryState,
    TOperation,
    TPersisted,
    TSetCellsOp,
    TTransaction,
    TTxSource,
    TViolation,
} from './types';

const DEFAULT_STORAGE_KEY = 'shift-editor:draft';
const DRAFT_SAVE_DEBOUNCE_MS = 1500;
const persistence = createShiftEditorPersistence({
    storageKey: DEFAULT_STORAGE_KEY,
    saveDebounceMs: DRAFT_SAVE_DEBOUNCE_MS,
    onStatusChange: (status) => useShiftEditorDraftStatusStore.getState().setStatus(status),
});

export function getShiftEditorDraftStorageKey(ctx: {wardId: number; shiftTeamId: number; year: number; month: number}): string {
    return `${DEFAULT_STORAGE_KEY}:${ctx.wardId}:${ctx.shiftTeamId}:${ctx.year}:${ctx.month}`;
}

function invertOps(ops: TOperation[]): TOperation[] {
    return ops
        .slice()
        .reverse()
        .map((op) => invertOperation(op));
}

function pushHistory(history: THistoryState, entry: THistoryEntry): THistoryState {
    const nextPast = history.past.concat(entry);
    const trimmedPast = nextPast.length > history.maxDepth ? nextPast.slice(nextPast.length - history.maxDepth) : nextPast;

    return {past: trimmedPast, future: [], maxDepth: history.maxDepth};
}

function scheduleViolationsFromState(state: {
    scheduleValidationSnapshot: ReturnType<typeof useShiftEditorStore.getState>['scheduleValidationSnapshot'];
    legacyDisplayViolations: TViolation[];
}): TScheduleViolationPersisted {
    return toScheduleViolationPersisted(state.scheduleValidationSnapshot, state.legacyDisplayViolations);
}

function persistDoc(doc: TDutyDoc, history: THistoryState, scheduleViolations: TScheduleViolationPersisted) {
    persistence.save(doc, history, scheduleViolations);
}

function persistDocImmediate(doc: TDutyDoc, history: THistoryState, scheduleViolations: TScheduleViolationPersisted) {
    persistence.saveImmediate(doc, history, scheduleViolations);
}

/**
 * undo/redo 시 고정근무/신청근무로 잠긴 셀은 건너뛴다.
 * 고정근무와 신청근무가 AI 자동 채우기 등 일반 편집보다 우선순위가 높기 때문이다.
 */
function filterOpAgainstLocks(op: TOperation, doc: TDutyDoc): TOperation {
    if (op.kind !== 'setCells') return op;

    const filteredCells = op.cells.filter(({row, col}) => {
        const key = getDutyCellLockKey(doc, row, col);

        if (key === null) return isDutyCellPositionInBounds(doc, row, col);

        return !(doc.fixedCells[key] === true || doc.requestCells[key] === true);
    });

    return {...op, cells: filteredCells};
}

function getUnlockedFilledCellClearOps(doc: TDutyDoc): TSetCellsOp['cells'] {
    const changed: TSetCellsOp['cells'] = [];

    for (let rowIdx = 0; rowIdx < doc.rows.length; rowIdx += 1) {
        const row = doc.rows[rowIdx];

        if (!row) continue;

        for (let col = 0; col < doc.columns.length; col += 1) {
            const key = `${row.workerId}|${doc.columns[col]}`;

            if (doc.fixedCells[key] === true) continue;

            if (doc.requestCells[key] === true) continue;

            const prev = row.cells[col] ?? null;

            if (prev === null) continue;

            changed.push({row: rowIdx, col, prev, next: null});
        }
    }

    return changed;
}

/**
 * UI는 상태를 store에서 읽고, 변경은 이 command 훅에서만 수행하는 것을 권장.
 * (store 메서드를 직접 호출하지 않고 이 훅으로만 접근하는 “약한 규칙”)
 */
export function useShiftEditorCommands() {
    const {t} = useTypedTranslation();
    const setDutyValidationInput = useShiftEditorStore((s) => s.setDutyValidationInput);
    const setDutyRuleBoard = useShiftEditorStore((s) => s.setDutyRuleBoard);
    const setDoc = useShiftEditorStore((s) => s.setDoc);
    const setHistory = useShiftEditorStore((s) => s.setHistory);
    const setSelection = useShiftEditorStore((s) => s.setSelection);
    const setScheduleValidationSnapshot = useShiftEditorStore((s) => s.setScheduleValidationSnapshot);
    const setLegacyDisplayViolations = useShiftEditorStore((s) => s.setLegacyDisplayViolations);
    const reset = useShiftEditorStore((s) => s.reset);
    const getState = () => useShiftEditorStore.getState();
    const notifyFixedLocked = () => toast.error(t('page.makeShift.fixedShifts.lockedToast'));
    const notifyRequestLocked = () => toast.error(t('page.makeShift.requests.lockedToast'));
    const cmdSetCells = (cells: TCellPos[], value: TCellValue, source: TTxSource = 'user') => {
        const {doc, history, selection, editorMode} = getState();

        if (cells.length === 0) return;

        const changed: Array<{row: number; col: number; prev: TCellValue; next: TCellValue}> = [];
        const fixedDelta: Array<{key: string; prev: boolean; next: boolean}> = [];

        let skippedByFixed = 0;
        let skippedByRequest = 0;

        for (const {row, col} of cells) {
            if (!isDutyCellPositionInBounds(doc, row, col)) continue;

            const r = doc.rows[row];

            if (!r) continue;

            const key = getDutyCellLockKey(doc, row, col);
            const prev = readDutyCell(r, col);
            const prevFixed = key !== null && doc.fixedCells[key] === true;
            const prevRequest = key !== null && doc.requestCells[key] === true;

            if (prevRequest) {
                skippedByRequest += 1;
                continue;
            }

            if (editorMode !== 'fixed' && prevFixed) {
                skippedByFixed += 1;
                continue;
            }

            if (editorMode === 'fixed' && key !== null && !prevFixed && value === null) {
                continue;
            }

            const cellChanged = prev !== value;
            const nextFixed = key !== null && editorMode === 'fixed' ? value !== null : prevFixed;
            const fixedChanged = prevFixed !== nextFixed;

            if (!cellChanged && !fixedChanged) continue;

            if (cellChanged) changed.push({row, col, prev, next: value});

            if (fixedChanged && key !== null) fixedDelta.push({key, prev: prevFixed, next: nextFixed});
        }

        if (source === 'user') {
            if (skippedByRequest > 0) notifyRequestLocked();
            else if (skippedByFixed > 0) notifyFixedLocked();
        }

        if (changed.length === 0 && fixedDelta.length === 0) return;

        const tx: TTransaction<TOperation> = {
            ops: [{kind: 'setCells', cells: changed, fixedDelta: fixedDelta.length > 0 ? fixedDelta : undefined}],
            source,
            timestamp: Date.now(),
        };
        const inverseOps = invertOps(tx.ops);
        const nextDoc = tx.ops.reduce((d, op) => applyOperation(d, op), doc);

        setDoc(nextDoc);

        if (editorMode !== 'fixed') {
            const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
            const nextHistory = pushHistory(history, entry);

            setHistory(nextHistory);
            persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
        } else {
            persistDocImmediate(nextDoc, history, scheduleViolationsFromState(getState()));
        }
    };
    const cmdSetSelectionValue = (value: TCellValue, source?: TTxSource) => {
        const {selection} = getState();

        if (!selection) return;

        const cells = getCellsInSelection(selection);

        cmdSetCells(cells, value, source ?? 'user');
    };
    const cmdSetCellsFixed = (cells: TCellPos[], fixed: boolean, source: TTxSource = 'user'): number => {
        const {doc, history, selection} = getState();
        const fixedDelta: TSetCellsOp['fixedDelta'] = [];

        let skippedByRequest = 0;

        for (const {row, col} of cells) {
            if (col < 0 || !isDutyCellPositionInBounds(doc, row, col)) continue;

            const dutyRow = doc.rows[row];

            if (!dutyRow) continue;

            const key = getDutyCellLockKey(doc, row, col);

            if (key === null) continue;

            if (doc.requestCells[key] === true) {
                skippedByRequest += 1;
                continue;
            }

            if (fixed && readDutyCell(dutyRow, col) === null) continue;

            const prevFixed = doc.fixedCells[key] === true;

            if (prevFixed === fixed) continue;

            fixedDelta.push({key, prev: prevFixed, next: fixed});
        }

        if (source === 'user' && skippedByRequest > 0) notifyRequestLocked();

        if (fixedDelta.length === 0) return 0;

        const tx: TTransaction<TOperation> = {
            ops: [{kind: 'setCells', cells: [], fixedDelta}],
            source,
            timestamp: Date.now(),
        };
        const inverseOps = invertOps(tx.ops);
        const nextDoc = tx.ops.reduce((d, op) => applyOperation(d, op), doc);
        const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
        const nextHistory = pushHistory(history, entry);

        setDoc(nextDoc);
        setHistory(nextHistory);
        persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));

        return fixedDelta.length;
    };
    const cmdSetSelectionFixed = (fixed: boolean, source?: TTxSource): number => {
        const {selection} = getState();

        if (!selection) return 0;

        return cmdSetCellsFixed(getCellsInSelection(selection), fixed, source ?? 'user');
    };
    const cmdClearUnlockedCells = (source: TTxSource = 'user'): number => {
        const {doc, history, selection} = getState();
        const changed = getUnlockedFilledCellClearOps(doc);

        if (changed.length === 0) return 0;

        const tx: TTransaction<TOperation> = {
            ops: [{kind: 'setCells', cells: changed}],
            source,
            timestamp: Date.now(),
        };
        const inverseOps = invertOps(tx.ops);
        const nextDoc = tx.ops.reduce((d, op) => applyOperation(d, op), doc);
        const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
        const nextHistory = pushHistory(history, entry);

        setDoc(nextDoc);
        setHistory(nextHistory);
        persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));

        return changed.length;
    };

    return {
        init: (doc: TDutyDoc, opts?: {maxHistoryDepth?: number}) => {
            const {dutyValidationInput, dutyRuleBoard} = getState();

            reset(opts);

            setDutyValidationInput(dutyValidationInput);
            setDutyRuleBoard(dutyRuleBoard);

            const {history} = getState();
            const nextHistory: THistoryState = {...history, past: [], future: [], maxDepth: opts?.maxHistoryDepth ?? history.maxDepth};

            setDoc(doc);
            setSelection(null);
            setHistory(nextHistory);
            setScheduleValidationSnapshot(null);
            setLegacyDisplayViolations([]);
            persistDoc(doc, nextHistory, {validationSnapshot: null});
        },
        getPersisted: (): TPersisted | null => persistence.load(),
        hydrate: (persisted: TPersisted) => {
            const {history: currentHistory} = getState();

            let nextHistory: THistoryState | null = null;

            try {
                nextHistory = JSON.parse(persisted.history) as THistoryState;
            } catch {
                nextHistory = null;
            }

            const appliedHistory = nextHistory ?? currentHistory;

            setDoc(persisted.doc);
            setSelection(null);
            setHistory(appliedHistory);

            const scheduleViolations = persisted.scheduleViolations ?? migratePersistedViolations(persisted);

            setScheduleValidationSnapshot(scheduleViolations.validationSnapshot);
            setLegacyDisplayViolations(scheduleViolations.legacyDisplayViolations ?? []);
        },
        discardPersisted: () => persistence.clear(),
        setPersistenceKey: (key: string) => persistence.setStorageKey(key),
        getCurrentPersistenceKey: () => persistence.storageKey,
        persistImmediate: () => {
            const {doc, history} = getState();

            persistDocImmediate(doc, history, scheduleViolationsFromState(getState()));
        },
        /** AI autofill·validate-snapshot 등 서버 validation 스냅샷 저장 — 표시는 현재 doc 기준으로 재변환 */
        setScheduleValidationFromApi: (validation: TValidationRes) => {
            const snapshot = createScheduleValidationSnapshot(validation);

            setScheduleValidationSnapshot(snapshot);
            setLegacyDisplayViolations([]);

            const {doc, history} = getState();

            persistDocImmediate(doc, history, {validationSnapshot: snapshot});
        },
        clearScheduleValidationFromApi: () => {
            setScheduleValidationSnapshot(null);
            setLegacyDisplayViolations([]);

            const {doc, history} = getState();

            persistDocImmediate(doc, history, {validationSnapshot: null});
        },
        setDutyValidationInput: (input: TDutyValidationInput | null) => {
            setDutyValidationInput(input);

            // constraints board는 input을 기반으로 UI에서 드래그/편집하기 쉽도록 별도로 유지한다.
            // - 기존 board가 없을 때만 초기화 (사용자가 이미 정렬/제외를 바꾼 경우 유지)
            const {dutyRuleBoard} = getState();

            if (input && !dutyRuleBoard) {
                setDutyRuleBoard(buildInitialDutyRuleBoard(input.wardConstraint, input.ruleLevelByKey));
            }
        },
        setDutyRuleBoard: (board: TDutyRuleBoard) => {
            const {dutyValidationInput} = getState();

            setDutyRuleBoard(board);

            if (!dutyValidationInput) return;

            const nextWardConstraint = applyBoardToWardConstraint(board, dutyValidationInput.wardConstraint);
            const nextRuleLevelByKey = buildRuleLevelByKeyFromBoard(board);
            const nextInput: TDutyValidationInput = {
                ...dutyValidationInput,
                wardConstraint: nextWardConstraint,
                ruleLevelByKey: nextRuleLevelByKey,
            };

            // validation도 즉시 재계산 (규칙 활성/레벨 변경 반영)
            setDutyValidationInput(nextInput);
        },
        setWardConstraint: (wardConstraint: TWardConstraint) => {
            const {dutyValidationInput} = getState();

            if (!dutyValidationInput) return;

            const nextInput: TDutyValidationInput = {
                ...dutyValidationInput,
                wardConstraint,
            };

            setDutyValidationInput(nextInput);
        },
        select: (cell: TCellPos) => setSelection({type: 'single', anchor: cell}),
        selectRange: (from: TCellPos, to: TCellPos) => setSelection({type: 'range', from, to}),
        clearSelection: () => setSelection(null),
        moveSelection: (dir: 'up' | 'down' | 'left' | 'right', extend: boolean, moveEnd?: boolean) => {
            const {doc, selection} = getState();
            const bounds = {rowCount: doc.rows.length, colCount: doc.columns.length, minCol: getDutyDocMinColumn(doc)};
            const next = moveEnd ? moveSelectionToEdge(selection, dir, extend, bounds) : moveSelectionModel(selection, dir, extend, bounds);

            setSelection(next);
        },
        selectAll: () => {
            const {doc} = getState();
            const sel = makeSelectAllSelection({rowCount: doc.rows.length, colCount: doc.columns.length, minCol: getDutyDocMinColumn(doc)});

            setSelection(sel);
        },
        setCells: cmdSetCells,
        setSelectionValue: cmdSetSelectionValue,
        setCellsFixed: cmdSetCellsFixed,
        setSelectionFixed: cmdSetSelectionFixed,
        clearSelectionCells: (source?: TTxSource) => cmdSetSelectionValue(null, source),
        clearUnlockedCells: cmdClearUnlockedCells,
        resetAutofilled: (source: TTxSource = 'user') => {
            cmdClearUnlockedCells(source);
        },
        applyChangedCells: (changedCells: TSnapshotCellDTO[], originalShift: TShift, source: TTxSource = 'ai') => {
            const {doc, history, selection} = getState();
            const {idToType} = buildWardShiftTypeMaps(originalShift);
            const changed: TSetCellsOp['cells'] = [];

            for (const cell of changedCells) {
                const workerId = String(cell.shiftNurseId);
                const rowIdx = doc.rows.findIndex((row) => row.workerId === workerId);

                if (rowIdx < 0) continue;

                const colIdx = doc.columns.indexOf(cell.date);

                if (colIdx < 0) continue;

                const key = `${workerId}|${cell.date}`;

                if (doc.fixedCells[key] === true || doc.requestCells[key] === true) continue;

                const resolvedNext =
                    (cell.wardShiftTypeId != null ? (idToType.get(cell.wardShiftTypeId)?.shortName ?? null) : null) ??
                    (cell.shiftCode && cell.shiftCode.length > 0 ? cell.shiftCode : null);
                const row = doc.rows[rowIdx]!;
                const prev = row.cells[colIdx] ?? null;

                if (prev === resolvedNext) continue;

                changed.push({row: rowIdx, col: colIdx, prev, next: resolvedNext});
            }

            if (changed.length === 0) return;

            const tx: TTransaction<TOperation> = {
                ops: [{kind: 'setCells', cells: changed}],
                source,
                timestamp: Date.now(),
            };
            const inverseOps = invertOps(tx.ops);
            const nextDoc = tx.ops.reduce((d, op) => applyOperation(d, op), doc);
            const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
            const nextHistory = pushHistory(history, entry);

            setDoc(nextDoc);
            setHistory(nextHistory);
            persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
        },
        applySchedule: (schedule: Record<string, TCellValue[]>, source: TTxSource = 'ai') => {
            const {doc, history, selection} = getState();
            const changed: TSetCellsOp['cells'] = [];

            for (let rowIdx = 0; rowIdx < doc.rows.length; rowIdx += 1) {
                const row = doc.rows[rowIdx];

                if (!row) continue;

                const values = schedule[row.workerId];

                if (!values) continue;

                for (let col = 0; col < Math.min(values.length, doc.columns.length); col += 1) {
                    const key = `${row.workerId}|${doc.columns[col]}`;

                    if (doc.fixedCells[key] === true) continue;

                    if (doc.requestCells[key] === true) continue;

                    const prev = row.cells[col] ?? null;
                    const next = values[col] ?? null;

                    if (prev === next) continue;

                    changed.push({row: rowIdx, col, prev, next});
                }
            }

            if (changed.length === 0) return;

            const tx: TTransaction<TOperation> = {
                ops: [{kind: 'setCells', cells: changed}],
                source,
                timestamp: Date.now(),
            };
            const inverseOps = invertOps(tx.ops);
            const nextDoc = tx.ops.reduce((d, op) => applyOperation(d, op), doc);
            const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
            const nextHistory = pushHistory(history, entry);

            setDoc(nextDoc);
            setHistory(nextHistory);

            persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
        },
        reorderRowsByName: (source: TTxSource = 'user') => {
            const {doc, history, selection} = getState();

            if (doc.rows.length <= 1) return;

            const prevOrder = doc.rows.map((_, idx) => idx);
            const nextOrder = prevOrder
                .slice()
                .sort((a, b) =>
                    (doc.workerMeta[doc.rows[a]!.workerId]?.name ?? '').localeCompare(doc.workerMeta[doc.rows[b]!.workerId]?.name ?? ''),
                );

            if (prevOrder.every((v, i) => v === nextOrder[i])) return;

            const tx: TTransaction<TOperation> = {
                ops: [{kind: 'reorderRows', prevOrder, nextOrder}],
                source,
                timestamp: Date.now(),
            };
            const inverseOps = invertOps(tx.ops);
            const nextDoc = tx.ops.reduce((d, op) => applyOperation(d, op), doc);
            const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: null};
            const nextHistory = pushHistory(history, entry);

            setDoc(nextDoc);
            setSelection(null);
            setHistory(nextHistory);

            persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
        },
        copy: (): TClipboardPayload | null => {
            const {doc, selection} = getState();

            return copySelection(doc, selection);
        },
        paste: (payload: TClipboardPayload, source: TTxSource = 'user') => {
            const {doc, selection, history, editorMode} = getState();

            if (!selection) return;

            const rawOp = pastePayload(payload, selection, doc);

            if (rawOp.cells.length === 0) return;

            let filteredCells = rawOp.cells;
            let skippedByRequest = 0;

            {
                const kept: typeof rawOp.cells = [];

                for (const cell of rawOp.cells) {
                    const r = doc.rows[cell.row];

                    if (!r) continue;

                    const key = getDutyCellLockKey(doc, cell.row, cell.col);

                    if (key !== null && doc.requestCells[key] === true) {
                        skippedByRequest += 1;
                        continue;
                    }

                    kept.push(cell);
                }

                filteredCells = kept;
            }

            if (editorMode !== 'fixed') {
                const kept: typeof filteredCells = [];

                let skippedByFixed = 0;

                for (const cell of filteredCells) {
                    const r = doc.rows[cell.row];

                    if (!r) continue;

                    const key = getDutyCellLockKey(doc, cell.row, cell.col);

                    if (key !== null && doc.fixedCells[key] === true) {
                        skippedByFixed += 1;
                        continue;
                    }

                    kept.push(cell);
                }

                filteredCells = kept;

                if (source === 'user') {
                    if (skippedByRequest > 0) notifyRequestLocked();
                    else if (skippedByFixed > 0) notifyFixedLocked();
                }
            } else {
                if (source === 'user' && skippedByRequest > 0) {
                    notifyRequestLocked();
                }

                const kept: typeof filteredCells = [];

                for (const cell of filteredCells) {
                    const key = getDutyCellLockKey(doc, cell.row, cell.col);
                    const prevFixed = key !== null && doc.fixedCells[key] === true;

                    if (key !== null && !prevFixed && cell.next === null) continue;

                    kept.push(cell);
                }

                filteredCells = kept;
            }

            const fixedDelta: Array<{key: string; prev: boolean; next: boolean}> = [];

            if (editorMode === 'fixed') {
                for (const cell of filteredCells) {
                    const r = doc.rows[cell.row];

                    if (!r) continue;

                    const key = getDutyCellLockKey(doc, cell.row, cell.col);

                    if (key === null) continue;

                    const prevFixed = doc.fixedCells[key] === true;
                    const nextFixed = cell.next !== null;

                    if (prevFixed !== nextFixed) fixedDelta.push({key, prev: prevFixed, next: nextFixed});
                }
            }

            if (filteredCells.length === 0 && fixedDelta.length === 0) return;

            const op: TSetCellsOp = {
                kind: 'setCells',
                cells: filteredCells,
                fixedDelta: fixedDelta.length > 0 ? fixedDelta : undefined,
            };
            const tx: TTransaction<TOperation> = {ops: [op], source, timestamp: Date.now()};
            const inverseOps = invertOps(tx.ops);
            const nextDoc = applyOperation(doc, op);

            setDoc(nextDoc);

            if (editorMode !== 'fixed') {
                const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
                const nextHistory = pushHistory(history, entry);

                setHistory(nextHistory);
                persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
            } else {
                persistDocImmediate(nextDoc, history, scheduleViolationsFromState(getState()));
            }
        },
        undo: () => {
            const {doc, history, selection} = getState();
            const entry = history.past[history.past.length - 1];

            if (!entry) return;

            const nextDoc = entry.inverseOps.reduce((d, op) => applyOperation(d, filterOpAgainstLocks(op, d)), doc);
            const nextHistory: THistoryState = {
                past: history.past.slice(0, -1),
                future: history.future.concat(entry),
                maxDepth: history.maxDepth,
            };

            setDoc(nextDoc);
            setHistory(nextHistory);
            setSelection(entry.selectionBefore ?? selection);

            persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
        },
        redo: () => {
            const {doc, history, selection} = getState();
            const entry = history.future[history.future.length - 1];

            if (!entry) return;

            const nextDoc = entry.tx.ops.reduce((d, op) => applyOperation(d, filterOpAgainstLocks(op, d)), doc);
            const nextPast = history.past.concat(entry);
            const trimmedPast = nextPast.length > history.maxDepth ? nextPast.slice(nextPast.length - history.maxDepth) : nextPast;
            const nextHistory: THistoryState = {
                past: trimmedPast,
                future: history.future.slice(0, -1),
                maxDepth: history.maxDepth,
            };

            setDoc(nextDoc);
            setHistory(nextHistory);
            setSelection(entry.selectionAfter ?? selection);

            persistDoc(nextDoc, nextHistory, scheduleViolationsFromState(getState()));
        },
    };
}
