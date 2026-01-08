import {copySelection, pastePayload} from './clipboard';
import {applyOperation, invertOperation} from './operation';
import {createShiftEditorPersistence} from './persistence';
import {getCellsInSelection, makeSelectAllSelection, moveSelection as moveSelectionModel, moveSelectionToEdge} from './selection';
import {useShiftEditorStore} from './store';
import type {
    TCellPos,
    TCellValue,
    TClipboardPayload,
    TDutyDoc,
    TDutyValidationInput,
    THistoryEntry,
    THistoryState,
    TOperation,
    TPersisted,
    TSelection,
    TTransaction,
    TTxSource,
    TViolation,
} from './types';
import {createDutyValidator} from './validator';

const DEFAULT_STORAGE_KEY = 'shift-editor:draft';
const persistence = createShiftEditorPersistence({storageKey: DEFAULT_STORAGE_KEY, saveDebounceMs: 400});

function computeSelectionInit(doc: TDutyDoc): TSelection | null {
    if (doc.rows.length === 0 || doc.columns.length === 0) return null;

    return {type: 'single', anchor: {row: 0, col: 0}};
}

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
            reset(opts);

            const {dutyValidationInput, history} = getState();
            const nextHistory: THistoryState = {...history, past: [], future: [], maxDepth: opts?.maxHistoryDepth ?? history.maxDepth};

            setDoc(doc);
            setSelection(computeSelectionInit(doc));
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
            setSelection(computeSelectionInit(persisted.doc));
            setHistory(appliedHistory);
            setViolations(computeViolations(persisted.doc, dutyValidationInput));
        },
        discardPersisted: () => persistence.clear(),
        setDutyValidationInput: (input: TDutyValidationInput | null) => {
            const {doc} = getState();

            setDutyValidationInput(input);
            setViolations(computeViolations(doc, input));
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
