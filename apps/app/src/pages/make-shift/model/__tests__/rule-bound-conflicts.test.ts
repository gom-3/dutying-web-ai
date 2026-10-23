import {describe, expect, it} from 'vitest';
import {findRuleBoundConflicts} from '../rule-bound-conflicts';
import type {TShiftConstraintRuleDraft} from '../shift-constraint-rules';
const rule = (operator: string, count: number, overrides: Partial<TShiftConstraintRuleDraft> = {}): TShiftConstraintRuleDraft => ({
    clientId: operator,
    templateCode: 'SHIFT_COUNT_PER_PERIOD',
    category: 'CUSTOM',
    severity: 'HARD',
    sortOrder: 0,
    params: {
        target: {type: 'DIVISION', divisionNum: 1},
        shift: {type: 'ALL'},
        period: {type: 'MONTH'},
        aggregation: {type: 'EACH'},
        operator: {type: operator},
        count,
    },
    ...overrides,
});
describe('bound conflict evidence', () => {
    it('links both RN monthly conditions without changing them', () => {
        const rules = [rule('MIN', 21), rule('MAX', 20)];
        const before = JSON.stringify(rules);
        expect(findRuleBoundConflicts(rules)).toEqual([{lower: rules[0], upper: rules[1], minimum: 21, maximum: 20}]);
        expect(JSON.stringify(rules)).toBe(before);
    });
    it('does not confuse hard requirements and soft preferences', () => {
        expect(findRuleBoundConflicts([rule('MIN', 21), rule('MAX', 20, {severity: 'SOFT'})])).toEqual([]);
        expect(
            findRuleBoundConflicts([
                rule('MAX', 5, {templateCode: 'CORE_MAX_CONTINUOUS_WORK'}),
                rule('MAX', 4, {templateCode: 'CORE_MAX_CONTINUOUS_WORK', severity: 'SOFT'}),
            ]),
        ).toEqual([]);
    });
    it('allows valid ranges and redundant bounds', () => {
        expect(findRuleBoundConflicts([rule('MIN', 19), rule('MIN', 20), rule('MAX', 21)])).toEqual([]);
    });
    it('detects incompatible exact counts', () => {
        expect(findRuleBoundConflicts([rule('EXACT', 21), rule('MAX', 20)])).toHaveLength(1);
    });
    it.each(['target', 'period', 'aggregation'])('does not combine distinct %s', (key) => {
        const upper = rule('MAX', 20);
        upper.params[key] = {type: 'OTHER'};
        expect(findRuleBoundConflicts([rule('MIN', 21), upper])).toEqual([]);
    });
    it('ignores deselected conditions', () => {
        expect(findRuleBoundConflicts([rule('MIN', 21), rule('MAX', 20, {selected: false})])).toEqual([]);
    });
});
