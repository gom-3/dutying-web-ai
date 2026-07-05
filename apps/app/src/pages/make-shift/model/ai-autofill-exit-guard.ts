import {create} from 'zustand';
import type {TDutyDoc} from '@/features/shift-editor';

export type TAiAutofillExitGuardReason = 'aiGenerating' | 'unsavedChanges';

type TAiAutofillExitGuardState = {
    hasUnsavedChanges: boolean;
    isAiGenerating: boolean;
    setExitGuard: (state: {hasUnsavedChanges: boolean; isAiGenerating: boolean}) => void;
    resetExitGuard: () => void;
};

export function hasEditableDutyDocChanges(current: TDutyDoc, saved: TDutyDoc | null): boolean {
    if (!saved) return false;

    if (current.columns.length !== saved.columns.length || current.rows.length !== saved.rows.length) return true;

    for (let colIdx = 0; colIdx < current.columns.length; colIdx += 1) {
        if (current.columns[colIdx] !== saved.columns[colIdx]) return true;
    }

    for (let rowIdx = 0; rowIdx < current.rows.length; rowIdx += 1) {
        const currentRow = current.rows[rowIdx];
        const savedRow = saved.rows[rowIdx];

        if (!currentRow || !savedRow || currentRow.workerId !== savedRow.workerId) return true;

        const currentLastCells = currentRow.lastCells ?? [];
        const savedLastCells = savedRow.lastCells ?? [];

        if (currentLastCells.length !== savedLastCells.length) return true;

        for (let lastIdx = 0; lastIdx < currentLastCells.length; lastIdx += 1) {
            if ((currentLastCells[lastIdx] ?? null) !== (savedLastCells[lastIdx] ?? null)) return true;
        }

        if (currentRow.cells.length !== savedRow.cells.length) return true;

        for (let colIdx = 0; colIdx < currentRow.cells.length; colIdx += 1) {
            const date = current.columns[colIdx];

            if (!date) return true;

            const lockKey = `${currentRow.workerId}|${date}`;
            const isFixedOrRequestCell =
                current.fixedCells[lockKey] === true ||
                current.requestCells[lockKey] === true ||
                saved.fixedCells[lockKey] === true ||
                saved.requestCells[lockKey] === true;

            if (isFixedOrRequestCell) continue;

            if ((currentRow.cells[colIdx] ?? null) !== (savedRow.cells[colIdx] ?? null)) return true;
        }
    }

    return false;
}

export function getAiAutofillExitGuardReason(state: {
    hasUnsavedChanges: boolean;
    isAiGenerating: boolean;
}): TAiAutofillExitGuardReason | null {
    if (state.isAiGenerating) return 'aiGenerating';

    if (state.hasUnsavedChanges) return 'unsavedChanges';

    return null;
}

export const useAiAutofillExitGuardStore = create<TAiAutofillExitGuardState>()((set) => ({
    hasUnsavedChanges: false,
    isAiGenerating: false,
    setExitGuard: ({hasUnsavedChanges, isAiGenerating}) => set(() => ({hasUnsavedChanges, isAiGenerating})),
    resetExitGuard: () => set(() => ({hasUnsavedChanges: false, isAiGenerating: false})),
}));
