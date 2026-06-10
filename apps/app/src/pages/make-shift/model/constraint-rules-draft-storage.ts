import type {TShiftConstraintRuleDraft} from './shift-constraint-rules';

const STORAGE_KEY_PREFIX = 'make-shift:constraint-rules';
const STORAGE_VERSION = 1;

type TStoredConstraintRulesDraft = {
    version: typeof STORAGE_VERSION;
    rules: TShiftConstraintRuleDraft[];
};

export function buildConstraintRulesDraftKey(wardId: number, shiftTeamId: number, year: number, month: number): string {
    return `${STORAGE_KEY_PREFIX}:${wardId}:${shiftTeamId}:${year}:${month}`;
}

function isRuleDraft(value: unknown): value is TShiftConstraintRuleDraft {
    if (!value || typeof value !== 'object') return false;

    const maybe = value as Partial<TShiftConstraintRuleDraft>;

    return (
        typeof maybe.clientId === 'string' &&
        typeof maybe.templateCode === 'string' &&
        typeof maybe.category === 'string' &&
        (maybe.severity === 'HARD' || maybe.severity === 'SOFT') &&
        typeof maybe.sortOrder === 'number' &&
        Boolean(maybe.params) &&
        typeof maybe.params === 'object'
    );
}

function parseStoredDraft(raw: string | null): TShiftConstraintRuleDraft[] | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<TStoredConstraintRulesDraft>;

        if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.rules)) return null;

        const rules = parsed.rules.filter(isRuleDraft);

        return rules.length === parsed.rules.length ? rules : null;
    } catch {
        return null;
    }
}

export function loadConstraintRulesDraft(
    wardId: number,
    shiftTeamId: number,
    year: number,
    month: number,
): TShiftConstraintRuleDraft[] | null {
    if (typeof window === 'undefined') return null;

    return parseStoredDraft(window.localStorage.getItem(buildConstraintRulesDraftKey(wardId, shiftTeamId, year, month)));
}

export function saveConstraintRulesDraft(
    wardId: number,
    shiftTeamId: number,
    year: number,
    month: number,
    rules: TShiftConstraintRuleDraft[],
): void {
    if (typeof window === 'undefined') return;

    const payload: TStoredConstraintRulesDraft = {
        version: STORAGE_VERSION,
        rules: rules.map((rule, index) => ({...rule, sortOrder: index + 1})),
    };

    window.localStorage.setItem(buildConstraintRulesDraftKey(wardId, shiftTeamId, year, month), JSON.stringify(payload));
}

export function clearConstraintRulesDraft(wardId: number, shiftTeamId: number, year: number, month: number): void {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem(buildConstraintRulesDraftKey(wardId, shiftTeamId, year, month));
}
