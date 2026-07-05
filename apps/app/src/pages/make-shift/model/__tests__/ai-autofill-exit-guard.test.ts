import {describe, expect, it} from 'vitest';
import type {TDutyDoc} from '@/features/shift-editor';
import {getAiAutofillExitGuardReason, hasEditableDutyDocChanges} from '../ai-autofill-exit-guard';

function createDoc(overrides: Partial<TDutyDoc> = {}): TDutyDoc {
    return {
        columns: ['2026-07-01', '2026-07-02', '2026-07-03'],
        rows: [
            {
                workerId: '1',
                lastCells: ['N'],
                cells: ['D', 'E', null],
            },
        ],
        workerMeta: {'1': {name: 'A'}},
        fixedCells: {'1|2026-07-01': true},
        requestCells: {'1|2026-07-02': true},
        ...overrides,
    };
}

describe('hasEditableDutyDocChanges', () => {
    it('ignores fixed and request cell value differences', () => {
        const saved = createDoc();
        const current = createDoc({
            rows: [
                {
                    workerId: '1',
                    lastCells: ['N'],
                    cells: ['N', 'D', null],
                },
            ],
        });

        expect(hasEditableDutyDocChanges(current, saved)).toBe(false);
    });

    it('detects editable cell changes outside fixed and request cells', () => {
        const saved = createDoc();
        const current = createDoc({
            rows: [
                {
                    workerId: '1',
                    lastCells: ['N'],
                    cells: ['D', 'E', 'N'],
                },
            ],
        });

        expect(hasEditableDutyDocChanges(current, saved)).toBe(true);
    });

    it('detects previous-shift edits', () => {
        const saved = createDoc();
        const current = createDoc({
            rows: [
                {
                    workerId: '1',
                    lastCells: ['D'],
                    cells: ['D', 'E', null],
                },
            ],
        });

        expect(hasEditableDutyDocChanges(current, saved)).toBe(true);
    });
});

describe('getAiAutofillExitGuardReason', () => {
    it('prioritizes AI generation over unsaved changes', () => {
        expect(getAiAutofillExitGuardReason({hasUnsavedChanges: true, isAiGenerating: true})).toBe('aiGenerating');
    });

    it('returns unsaved changes when only edits are pending', () => {
        expect(getAiAutofillExitGuardReason({hasUnsavedChanges: true, isAiGenerating: false})).toBe('unsavedChanges');
    });
});
