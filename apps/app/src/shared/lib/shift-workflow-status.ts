import type {TShift, TShiftWorkflowStatus} from '@dutying/domain/shift';

const SHIFT_WORKFLOW_STATUSES = new Set<TShiftWorkflowStatus>(['NOT_STARTED', 'IN_PROGRESS', 'CONFIRMED']);

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readStringAt(value: unknown, path: string[]): string | null {
    let current: unknown = value;

    for (const key of path) {
        const record = readRecord(current);

        if (!record) return null;

        current = record[key];
    }

    return typeof current === 'string' ? current : null;
}

function readNumberAt(value: unknown, path: string[]): number | null {
    let current: unknown = value;

    for (const key of path) {
        const record = readRecord(current);

        if (!record) return null;

        current = record[key];
    }

    return typeof current === 'number' ? current : null;
}

function normalizeWorkflowStatus(status: string | null): TShiftWorkflowStatus | null {
    if (!status) return null;

    const normalized = status.toUpperCase();

    return SHIFT_WORKFLOW_STATUSES.has(normalized as TShiftWorkflowStatus) ? (normalized as TShiftWorkflowStatus) : null;
}

export function getShiftWorkflowStatus(shift: TShift | unknown | null | undefined): TShiftWorkflowStatus | null {
    const status =
        readStringAt(shift, ['workflowStatus']) ??
        readStringAt(shift, ['scheduleWorkflowStatus']) ??
        readStringAt(shift, ['authoringStatus']) ??
        readStringAt(shift, ['workflow', 'status']) ??
        readStringAt(shift, ['scheduleWorkflow', 'status']) ??
        readStringAt(shift, ['authoring', 'status']);

    return normalizeWorkflowStatus(status);
}

export function getWorkflowStatusFromStep(step: number | null | undefined): TShiftWorkflowStatus | null {
    if (step == null) return null;

    if (step >= 1 && step <= 4) return 'IN_PROGRESS';

    if (step === 5) return 'CONFIRMED';

    return null;
}

export function getShiftWorkflowStep(shift: TShift | unknown | null | undefined): 1 | 2 | 3 | 4 | 5 | null {
    const step =
        readNumberAt(shift, ['workflowStep']) ??
        readNumberAt(shift, ['scheduleWorkflowStep']) ??
        readNumberAt(shift, ['authoringStep']) ??
        readNumberAt(shift, ['currentStep']) ??
        readNumberAt(shift, ['step']) ??
        readNumberAt(shift, ['workflow', 'step']) ??
        readNumberAt(shift, ['scheduleWorkflow', 'step']) ??
        readNumberAt(shift, ['authoring', 'step']);

    if (step == null || !Number.isInteger(step) || step < 1 || step > 5) return null;

    return step as 1 | 2 | 3 | 4 | 5;
}
