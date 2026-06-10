import {beforeEach, describe, expect, it} from 'vitest';
import type {TShiftConstraintRuleDraft} from '../shift-constraint-rules';
import {
    buildConstraintRulesDraftKey,
    clearConstraintRulesDraft,
    loadConstraintRulesDraft,
    saveConstraintRulesDraft,
} from '../constraint-rules-draft-storage';

const createRule = (params: Partial<TShiftConstraintRuleDraft> = {}): TShiftConstraintRuleDraft => ({
    clientId: params.clientId ?? 'draft-rule-1',
    templateCode: params.templateCode ?? 'IMPORTANT_MAX_WORK_STREAK',
    category: params.category ?? 'WORK_REST',
    severity: params.severity ?? 'SOFT',
    sortOrder: params.sortOrder ?? 1,
    params: params.params ?? {days: '5'},
    isImportant: params.isImportant ?? true,
    displayText: params.displayText ?? 'Max work streak',
    isValid: params.isValid ?? true,
    invalidReason: params.invalidReason ?? null,
});

describe('constraint-rules-draft-storage', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('stores drafts by ward, shift team, year, and month', () => {
        const rules = [createRule({sortOrder: 7})];

        saveConstraintRulesDraft(1, 10, 2026, 6, rules);

        expect(loadConstraintRulesDraft(1, 10, 2026, 6)).toEqual([createRule({sortOrder: 1})]);
        expect(loadConstraintRulesDraft(1, 20, 2026, 6)).toBeNull();
    });

    it('ignores invalid stored payloads', () => {
        window.localStorage.setItem(buildConstraintRulesDraftKey(1, 10, 2026, 6), JSON.stringify({version: 1, rules: [{clientId: 1}]}));

        expect(loadConstraintRulesDraft(1, 10, 2026, 6)).toBeNull();
    });

    it('clears the matching draft only', () => {
        saveConstraintRulesDraft(1, 10, 2026, 6, [createRule()]);
        saveConstraintRulesDraft(1, 20, 2026, 6, [createRule({clientId: 'other'})]);

        clearConstraintRulesDraft(1, 10, 2026, 6);

        expect(loadConstraintRulesDraft(1, 10, 2026, 6)).toBeNull();
        expect(loadConstraintRulesDraft(1, 20, 2026, 6)).toEqual([createRule({clientId: 'other'})]);
    });
});
