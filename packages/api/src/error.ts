import type {TScheduleObservation} from './ward/contracts';

export type TApiErrorDisplayPolicy = 'CLIENT_TRANSLATE' | 'SERVER_TEXT' | 'SERVER_TEXT_WITH_LANGUAGE' | 'DEBUG_ONLY';

export type TApiValidationError = {
    field?: string;
    message?: string;
    messageKey?: string;
};

export type TApiErrorResponse = {
    scheduleObservation?: TScheduleObservation;
    code?: string;
    message?: string;
    messageKey?: string;
    displayPolicy?: TApiErrorDisplayPolicy;
    messageArgs?: Record<string, unknown>;
    locale?: string;
    requestId?: string;
    traceId?: string;
    errors?: TApiValidationError[];
};
