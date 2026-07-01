import type {TDutyDoc, TViolation} from '../types';
import {violationsFromSpringValidation} from './convert-spring-validation';
import type {TScheduleValidationSnapshot, TScheduleViolationPersisted} from './types';

export function createScheduleValidationSnapshot(
    validation: TScheduleValidationSnapshot['validation'],
): TScheduleValidationSnapshot {
    return {
        validation,
        capturedAt: Date.now(),
    };
}

/** Uses backend validation snapshots as the only source for visible schedule violations. */
export function resolveScheduleDisplayViolations(
    doc: TDutyDoc,
    validationSnapshot: TScheduleValidationSnapshot | null,
    _legacyDisplayViolations: TViolation[],
): TViolation[] {
    if (validationSnapshot) {
        return violationsFromSpringValidation(validationSnapshot.validation, doc);
    }

    return [];
}

export function toScheduleViolationPersisted(
    validationSnapshot: TScheduleValidationSnapshot | null,
    _legacyDisplayViolations: TViolation[],
): TScheduleViolationPersisted {
    if (validationSnapshot) {
        return {validationSnapshot};
    }

    return {validationSnapshot: null};
}

/** Keeps old drafts loadable while dropping pre-snapshot legacy violation displays. */
export function migratePersistedViolations(persisted: {
    scheduleViolations?: TScheduleViolationPersisted;
    llmViolations?: TViolation[];
}): TScheduleViolationPersisted {
    if (persisted.scheduleViolations) {
        return persisted.scheduleViolations;
    }

    return {validationSnapshot: null};
}
