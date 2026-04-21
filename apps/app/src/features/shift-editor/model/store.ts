import {create} from 'zustand';
import {devtools} from 'zustand/middleware';
import type {TDutyDoc, TDutyRuleBoard, TDutyValidationInput, THistoryState, TSelection, TViolation} from './types';

export type TEditorMode = 'normal' | 'fixed';

export type TShiftEditorStore = {
    // state (data only)
    doc: TDutyDoc;
    selection: TSelection | null;
    violations: TViolation[];
    history: THistoryState;
    dutyValidationInput: TDutyValidationInput | null;
    dutyRuleBoard: TDutyRuleBoard | null;
    editorMode: TEditorMode;

    // primitive setters (no business rules here)
    setDoc: (doc: TDutyDoc) => void;
    setSelection: (selection: TSelection | null) => void;
    setViolations: (violations: TViolation[]) => void;
    setHistory: (history: THistoryState) => void;
    setDutyValidationInput: (input: TDutyValidationInput | null) => void;
    setDutyRuleBoard: (board: TDutyRuleBoard | null) => void;
    setEditorMode: (mode: TEditorMode) => void;

    reset: (opts?: {maxHistoryDepth?: number}) => void;
};

const emptyDoc: TDutyDoc = {columns: [], rows: [], workerMeta: {}, fixedCells: {}, requestCells: {}};
const initialHistory: THistoryState = {past: [], future: [], maxDepth: 200};

export const useShiftEditorStore = create<TShiftEditorStore>()(
    devtools((set) => ({
        doc: emptyDoc,
        selection: null,
        violations: [],
        history: initialHistory,
        dutyValidationInput: null,
        dutyRuleBoard: null,
        editorMode: 'normal',

        setDoc: (doc) => set(() => ({doc})),
        setSelection: (selection) => set(() => ({selection})),
        setViolations: (violations) => set(() => ({violations})),
        setHistory: (history) => set(() => ({history})),
        setDutyValidationInput: (dutyValidationInput) => set(() => ({dutyValidationInput})),
        setDutyRuleBoard: (dutyRuleBoard) => set(() => ({dutyRuleBoard})),
        setEditorMode: (editorMode) => set(() => ({editorMode})),

        reset: (opts) => {
            const maxDepth = opts?.maxHistoryDepth ?? initialHistory.maxDepth;

            set(() => ({
                doc: emptyDoc,
                selection: null,
                violations: [],
                history: {past: [], future: [], maxDepth},
                dutyValidationInput: null,
                dutyRuleBoard: null,
                editorMode: 'normal',
            }));
        },
    })),
);
