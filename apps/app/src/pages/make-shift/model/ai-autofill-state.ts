import type {TDutyDoc} from '@/features/shift-editor';

export type TAiAutofillStatus = 'idle' | 'loading' | 'success' | 'error';
export type TAiAutofillDescriptionKey =
    | 'page.makeShift.aiRefill.description.idle'
    | 'page.makeShift.aiRefill.description.loading'
    | 'page.makeShift.aiRefill.description.success'
    | 'page.makeShift.aiRefill.description.error';
export type TAiAutofillDraftKey = 'page.makeShift.aiRefill.draft.saved' | 'page.makeShift.aiRefill.draft.none';
export type TAiAutofillStatusDescription = {
    primaryKey: TAiAutofillDescriptionKey;
    draftKey: TAiAutofillDraftKey;
};

export function canConfirmAiAutofill(status: TAiAutofillStatus): boolean {
    return status !== 'loading';
}

export function getAiAutofillStatusTone(status: TAiAutofillStatus): 'neutral' | 'progress' | 'success' | 'danger' {
    switch (status) {
        case 'loading':
            return 'progress';
        case 'success':
            return 'success';
        case 'error':
            return 'danger';
        default:
            return 'neutral';
    }
}

export function getAiAutofillActionLabel(
    status: TAiAutofillStatus,
    hasCompletedAiFill: boolean,
): 'action' | 'retry' | 'generating' | 'firstFill' {
    switch (status) {
        case 'loading':
            return 'generating';
        case 'error':
            return 'retry';
        default:
            return hasCompletedAiFill ? 'action' : 'firstFill';
    }
}

export function getAiAutofillStatusDescription(status: TAiAutofillStatus, hasDraftChanges: boolean): TAiAutofillStatusDescription {
    const draftKey: TAiAutofillDraftKey = hasDraftChanges ? 'page.makeShift.aiRefill.draft.saved' : 'page.makeShift.aiRefill.draft.none';

    switch (status) {
        case 'loading':
            return {primaryKey: 'page.makeShift.aiRefill.description.loading', draftKey};
        case 'success':
            return {primaryKey: 'page.makeShift.aiRefill.description.success', draftKey};
        case 'error':
            return {primaryKey: 'page.makeShift.aiRefill.description.error', draftKey};
        default:
            return {primaryKey: 'page.makeShift.aiRefill.description.idle', draftKey};
    }
}

/** Remember successful generation separately from transient preparation acknowledgements. */
export const autofillCompletionKey = (accountId: number | null, wardId: number, teamId: number, year: number, month: number) =>
    `dutying:autofill-completed:v1:${accountId ?? 'ward'}:${wardId}:${teamId}:${year}:${month}`;

export function readAutofillCompletion(key: string | null): boolean {
    if (!key) return false;

    try {
        return window.localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
}

export function writeAutofillCompletion(key: string | null, completed: boolean): void {
    if (!key) return;

    try {
        if (completed) window.localStorage.setItem(key, 'true');
        else window.localStorage.removeItem(key);
    } catch {
        // Keep the current session usable when browser storage is unavailable.
    }
}

/** A blank cell still needs autofill even when all existing assignments are protected. */
export function isScheduleFullyProtected(doc: TDutyDoc): boolean {
    return (
        doc.rows.length > 0 &&
        doc.columns.length > 0 &&
        doc.rows.every((row) =>
            doc.columns.every(
                (date, index) =>
                    row.cells[index] != null &&
                    (doc.fixedCells[`${row.workerId}|${date}`] === true || doc.requestCells[`${row.workerId}|${date}`] === true),
            ),
        )
    );
}
