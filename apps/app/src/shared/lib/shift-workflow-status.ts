import type {TShift, TShiftWorkflowStatus} from '@/entities';

const SHIFT_WORKFLOW_STATUSES = new Set<TShiftWorkflowStatus>(['NOT_STARTED', 'IN_PROGRESS', 'CONFIRMED']);

export function getShiftWorkflowStatus(shift: TShift | null | undefined): TShiftWorkflowStatus | null {
    const status = shift?.workflowStatus;

    return status && SHIFT_WORKFLOW_STATUSES.has(status) ? status : null;
}

export function getWorkflowStatusFromStep(step: number | null | undefined): TShiftWorkflowStatus | null {
    if (step == null) return null;

    return step >= 6 ? 'CONFIRMED' : 'IN_PROGRESS';
}

export function getShiftWorkflowStep(shift: TShift | null | undefined): 1 | 2 | 3 | 4 | 5 | 6 | null {
    const step = shift?.workflowStep;

    if (step == null || !Number.isInteger(step) || step < 1 || step > 6) return null;

    return step as 1 | 2 | 3 | 4 | 5 | 6;
}
