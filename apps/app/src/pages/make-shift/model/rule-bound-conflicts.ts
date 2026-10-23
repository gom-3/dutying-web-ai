import type {TShiftConstraintRuleDraft} from './shift-constraint-rules';

const identity = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    const option = value as Record<string, unknown>;
    return JSON.stringify(
        Object.fromEntries(
            Object.entries(option)
                .filter(([key]) => !['label', 'name', 'color', 'shortName'].includes(key))
                .sort(([a], [b]) => a.localeCompare(b)),
        ),
    );
};
const kind = (value: unknown) => (typeof value === 'string' ? value : (value as {type?: string} | undefined)?.type);

/** Only prove contradictions for exactly matching scopes; never infer overlap from labels. */
export function findRuleBoundConflicts(rules: TShiftConstraintRuleDraft[]) {
    const groups = new Map<string, {rule: TShiftConstraintRuleDraft; min: number; max: number}[]>();
    for (const rule of rules) {
        if (rule.templateCode !== 'SHIFT_COUNT_PER_PERIOD' || rule.severity !== 'HARD' || rule.selected === false) continue;
        const p = rule.params;
        if (p.count == null || p.count === '' || p.target == null || p.shift == null || p.period == null) continue;
        const count = Number(p.count);
        const operator = kind(p.operator);
        if (!Number.isFinite(count) || count < 0 || !['MIN', 'MAX', 'EXACT'].includes(operator ?? '')) continue;
        const key = ['target', 'shift', 'period', 'aggregation']
            .map((k) => identity(p[k] ?? (k === 'aggregation' ? {type: 'EACH'} : undefined)))
            .join('|');
        const group = groups.get(key) ?? [];
        group.push({rule, min: operator === 'MAX' ? -Infinity : count, max: operator === 'MIN' ? Infinity : count});
        groups.set(key, group);
    }
    return [...groups.values()].flatMap((group) => {
        const lower = group.reduce((a, b) => (a.min > b.min ? a : b));
        const upper = group.reduce((a, b) => (a.max < b.max ? a : b));
        return lower.min > upper.max ? [{lower: lower.rule, upper: upper.rule, minimum: lower.min, maximum: upper.max}] : [];
    });
}
