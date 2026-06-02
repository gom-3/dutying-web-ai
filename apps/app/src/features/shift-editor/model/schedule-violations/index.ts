export type {TScheduleValidationSnapshot, TScheduleViolationPersisted} from './types';
export {violationsFromSpringValidation} from './convert-spring-validation';
/** @deprecated FastAPI validation 형식 — Spring ValidationRes는 violationsFromSpringValidation 사용 */
export {violationsFromApiValidation} from './convert-api-validation';
export {
    createScheduleValidationSnapshot,
    migratePersistedViolations,
    resolveScheduleDisplayViolations,
    toScheduleViolationPersisted,
} from './resolve-display-violations';
export {refreshScheduleViolations, type TRefreshScheduleViolationsParams} from './refresh-schedule-violations';
export {fetchAndApplyScheduleValidation} from './apply-schedule-validation';

/** @deprecated violationsFromApiValidation 사용 */
export {violationsFromApiValidation as aiValidationToViolations} from './convert-api-validation';
