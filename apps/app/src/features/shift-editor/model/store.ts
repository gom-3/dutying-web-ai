import {create} from 'zustand';
import {devtools} from 'zustand/middleware';
import type {TScheduleValidationSnapshot} from './schedule-violations';
import type {TDutyDoc, TDutyRuleBoard, TDutyValidationInput, THistoryState, TSelection, TViolation} from './types';

export type TEditorMode = 'normal' | 'fixed';

export type TShiftEditorStore = {
    // state (data only)
    doc: TDutyDoc;
    /** FE draft 변경 버전. validation 응답이 최신인지 확인용. */
    draftRevision: number;
    /** workspace에서 받은 제약조건 버전 hash */
    rulesHash: string | null;
    selection: TSelection | null;
    /** 서버 validation 원본 스냅샷 — 표시는 doc 기준으로 재변환 */
    scheduleValidationSnapshot: TScheduleValidationSnapshot | null;
    /** 구 드래프트 호환: snapshot 없을 때만 사용 */
    legacyDisplayViolations: TViolation[];
    history: THistoryState;
    dutyValidationInput: TDutyValidationInput | null;
    dutyRuleBoard: TDutyRuleBoard | null;
    editorMode: TEditorMode;

    // primitive setters (no business rules here)
    setDoc: (doc: TDutyDoc) => void;
    setSelection: (selection: TSelection | null) => void;
    setScheduleValidationSnapshot: (snapshot: TScheduleValidationSnapshot | null) => void;
    setLegacyDisplayViolations: (violations: TViolation[]) => void;
    setHistory: (history: THistoryState) => void;
    setDutyValidationInput: (input: TDutyValidationInput | null) => void;
    setDutyRuleBoard: (board: TDutyRuleBoard | null) => void;
    setEditorMode: (mode: TEditorMode) => void;
    setRulesHash: (rulesHash: string | null) => void;

    reset: (opts?: {maxHistoryDepth?: number}) => void;
};

const emptyDoc: TDutyDoc = {columns: [], rows: [], workerMeta: {}, fixedCells: {}, requestCells: {}};
const initialHistory: THistoryState = {past: [], future: [], maxDepth: 200};

export const useShiftEditorStore = create<TShiftEditorStore>()(
    devtools((set) => ({
        doc: emptyDoc,
        draftRevision: 0,
        rulesHash: null,
        selection: null,
        scheduleValidationSnapshot: null,
        legacyDisplayViolations: [],
        history: initialHistory,
        dutyValidationInput: null,
        dutyRuleBoard: null,
        editorMode: 'normal',

        setDoc: (doc) => set((s) => ({doc, draftRevision: s.draftRevision + 1})),
        setSelection: (selection) => set(() => ({selection})),
        setScheduleValidationSnapshot: (scheduleValidationSnapshot) => set(() => ({scheduleValidationSnapshot})),
        setLegacyDisplayViolations: (legacyDisplayViolations) => set(() => ({legacyDisplayViolations})),
        setHistory: (history) => set(() => ({history})),
        setDutyValidationInput: (dutyValidationInput) => set(() => ({dutyValidationInput})),
        setDutyRuleBoard: (dutyRuleBoard) => set(() => ({dutyRuleBoard})),
        setEditorMode: (editorMode) => set(() => ({editorMode})),
        setRulesHash: (rulesHash) => set(() => ({rulesHash})),

        reset: (opts) => {
            const maxDepth = opts?.maxHistoryDepth ?? initialHistory.maxDepth;

            set(() => ({
                doc: emptyDoc,
                draftRevision: 0,
                rulesHash: null,
                selection: null,
                scheduleValidationSnapshot: null,
                legacyDisplayViolations: [],
                history: {past: [], future: [], maxDepth},
                dutyValidationInput: null,
                dutyRuleBoard: null,
                editorMode: 'normal',
            }));
        },
    })),
);
