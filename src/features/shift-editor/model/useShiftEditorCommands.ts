import {type TWardConstraint} from '@/entities';
import {copySelection, pastePayload} from './clipboard';
import {applyBoardToWardConstraint, buildInitialDutyRuleBoard, buildRuleLevelByKeyFromBoard} from './duty-constraints';
import {applyOperation, invertOperation} from './operation';
import {createShiftEditorPersistence} from './persistence';
import {getCellsInSelection, makeSelectAllSelection, moveSelection as moveSelectionModel, moveSelectionToEdge} from './selection';
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
import {createDutyValidator} from './validator';

const DEFAULT_STORAGE_KEY = 'shift-editor:draft';
const persistence = createShiftEditorPersistence({storageKey: DEFAULT_STORAGE_KEY, saveDebounceMs: 400});

function computeViolations(doc: TDutyDoc, input: TDutyValidationInput | null): TViolation[] {
    if (!input) return [];

    const validator = createDutyValidator(input);

    return validator(doc as never) as TViolation[];
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

function persistDoc(doc: TDutyDoc, history: THistoryState) {
    persistence.save(doc, history);
}

/**
 * UI는 상태를 store에서 읽고, 변경은 이 command 훅에서만 수행하는 것을 권장.
 * (store 메서드를 직접 호출하지 않고 이 훅으로만 접근하는 “약한 규칙”)
 */
export function useShiftEditorCommands() {
    const setDutyValidationInput = useShiftEditorStore((s) => s.setDutyValidationInput);
    const setDutyRuleBoard = useShiftEditorStore((s) => s.setDutyRuleBoard);
    const setDoc = useShiftEditorStore((s) => s.setDoc);
    const setHistory = useShiftEditorStore((s) => s.setHistory);
    const setSelection = useShiftEditorStore((s) => s.setSelection);
    const setViolations = useShiftEditorStore((s) => s.setViolations);
    const reset = useShiftEditorStore((s) => s.reset);
    const getState = () => useShiftEditorStore.getState();
    const cmdSetCells = (cells: TCellPos[], value: TCellValue, source: TTxSource = 'user') => {
        const {doc, history, dutyValidationInput, selection} = getState();

        if (cells.length === 0) return;

        const changed: Array<{row: number; col: number; prev: TCellValue; next: TCellValue}> = [];

        for (const {row, col} of cells) {
            if (row < 0 || row >= doc.rows.length || col < 0 || col >= doc.columns.length) continue;

            const prev = doc.rows[row]?.cells[col] ?? null;

            if (prev === value) continue;

            changed.push({row, col, prev, next: value});
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
        setViolations(computeViolations(nextDoc, dutyValidationInput));

        persistDoc(nextDoc, nextHistory);
    };
    const cmdSetSelectionValue = (value: TCellValue, source?: TTxSource) => {
        const {selection} = getState();

        if (!selection) return;

        const cells = getCellsInSelection(selection);

        cmdSetCells(cells, value, source ?? 'user');
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
            setViolations(computeViolations(doc, dutyValidationInput));

            persistDoc(doc, nextHistory);
        },
        getPersisted: (): TPersisted | null => persistence.load(),
        hydrate: (persisted: TPersisted) => {
            const {dutyValidationInput, history: currentHistory} = getState();

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
            setViolations(computeViolations(persisted.doc, dutyValidationInput));
        },
        discardPersisted: () => persistence.clear(),
        setDutyValidationInput: (input: TDutyValidationInput | null) => {
            const {doc} = getState();

            setDutyValidationInput(input);
            setViolations(computeViolations(doc, input));

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
            const {doc} = getState();

            setDutyValidationInput(nextInput);
            setViolations(computeViolations(doc, nextInput));
        },
        setWardConstraint: (wardConstraint: TWardConstraint) => {
            const {dutyValidationInput, doc} = getState();

            if (!dutyValidationInput) return;

            const nextInput: TDutyValidationInput = {
                ...dutyValidationInput,
                wardConstraint,
            };

            setDutyValidationInput(nextInput);
            setViolations(computeViolations(doc, nextInput));
        },
        select: (cell: TCellPos) => setSelection({type: 'single', anchor: cell}),
        clearSelection: () => setSelection(null),
        moveSelection: (dir: 'up' | 'down' | 'left' | 'right', extend: boolean, moveEnd?: boolean) => {
            const {doc, selection} = getState();
            const bounds = {rowCount: doc.rows.length, colCount: doc.columns.length};
            const next = moveEnd ? moveSelectionToEdge(selection, dir, extend, bounds) : moveSelectionModel(selection, dir, extend, bounds);

            setSelection(next);
        },
        selectAll: () => {
            const {doc} = getState();
            const sel = makeSelectAllSelection({rowCount: doc.rows.length, colCount: doc.columns.length});

            setSelection(sel);
        },
        setCells: cmdSetCells,
        setSelectionValue: cmdSetSelectionValue,
        clearSelectionCells: (source?: TTxSource) => cmdSetSelectionValue(null, source),
        applySchedule: (schedule: Record<string, TCellValue[]>, source: TTxSource = 'ai') => {
            const {doc, history, dutyValidationInput, selection} = getState();
            const changed: TSetCellsOp['cells'] = [];

            for (let rowIdx = 0; rowIdx < doc.rows.length; rowIdx += 1) {
                const row = doc.rows[rowIdx];

                if (!row) continue;

                const values = schedule[row.workerId];

                if (!values) continue;

                for (let col = 0; col < Math.min(values.length, doc.columns.length); col += 1) {
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
            setViolations(computeViolations(nextDoc, dutyValidationInput));

            persistDoc(nextDoc, nextHistory);
        },
        reorderRowsByName: (source: TTxSource = 'user') => {
            const {doc, history, dutyValidationInput, selection} = getState();

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
            setViolations(computeViolations(nextDoc, dutyValidationInput));

            persistDoc(nextDoc, nextHistory);
        },
        copy: (): TClipboardPayload | null => {
            const {doc, selection} = getState();

            return copySelection(doc, selection);
        },
        paste: (payload: TClipboardPayload, source: TTxSource = 'user') => {
            const {doc, selection, history, dutyValidationInput} = getState();

            if (!selection) return;

            const op = pastePayload(payload, selection, doc);

            if (op.cells.length === 0) return;

            const tx: TTransaction<TOperation> = {ops: [op], source, timestamp: Date.now()};
            const inverseOps = invertOps(tx.ops);
            const nextDoc = applyOperation(doc, op);
            const entry: THistoryEntry = {tx, inverseOps, selectionBefore: selection, selectionAfter: selection};
            const nextHistory = pushHistory(history, entry);

            setDoc(nextDoc);
            setHistory(nextHistory);
            setViolations(computeViolations(nextDoc, dutyValidationInput));

            persistDoc(nextDoc, nextHistory);
        },
        undo: () => {
            const {doc, history, dutyValidationInput, selection} = getState();
            const entry = history.past[history.past.length - 1];

            if (!entry) return;

            const nextDoc = entry.inverseOps.reduce((d, op) => applyOperation(d, op), doc);
            const nextHistory: THistoryState = {
                past: history.past.slice(0, -1),
                future: history.future.concat(entry),
                maxDepth: history.maxDepth,
            };

            setDoc(nextDoc);
            setHistory(nextHistory);
            setViolations(computeViolations(nextDoc, dutyValidationInput));
            setSelection(entry.selectionBefore ?? selection);

            persistDoc(nextDoc, nextHistory);
        },
        redo: () => {
            const {doc, history, dutyValidationInput, selection} = getState();
            const entry = history.future[history.future.length - 1];

            if (!entry) return;

            const nextDoc = entry.tx.ops.reduce((d, op) => applyOperation(d, op), doc);
            const nextPast = history.past.concat(entry);
            const trimmedPast = nextPast.length > history.maxDepth ? nextPast.slice(nextPast.length - history.maxDepth) : nextPast;
            const nextHistory: THistoryState = {
                past: trimmedPast,
                future: history.future.slice(0, -1),
                maxDepth: history.maxDepth,
            };

            setDoc(nextDoc);
            setHistory(nextHistory);
            setViolations(computeViolations(nextDoc, dutyValidationInput));
            setSelection(entry.selectionAfter ?? selection);

            persistDoc(nextDoc, nextHistory);
        },
    };
}
