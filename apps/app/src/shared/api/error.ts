import type {TApiErrorDisplayPolicy, TApiErrorResponse} from '@dutying/api';
import i18n from 'i18next';

export type {TApiErrorDisplayPolicy, TApiErrorResponse};

export type TApiClientError = Error & {
    code: number;
    serverCode?: string;
    messageKey?: string;
    displayPolicy?: TApiErrorDisplayPolicy;
    requestId?: string;
    traceId?: string;
    responseBody?: TApiErrorResponse;
    originalError: unknown;
};

export const SCHEDULE_ROSTER_CHANGED_EVENT = 'dutying:schedule-roster-changed';

export type TScheduleRosterChangedEventDetail = {
    message?: string;
    requestId?: string;
    traceId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDisplayPolicy(value: unknown): value is TApiErrorDisplayPolicy {
    return value === 'CLIENT_TRANSLATE' || value === 'SERVER_TEXT' || value === 'SERVER_TEXT_WITH_LANGUAGE' || value === 'DEBUG_ONLY';
}

function optionalString(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function scheduleObservation(value: unknown): TApiErrorResponse['scheduleObservation'] {
    if (!isRecord(value)) return undefined;
    const {flowId, serverEventId, wardId, shiftTeamId, year, month} = value;

    if (
        typeof flowId !== 'string' ||
        !/^(?:conversation:[0-9]+|[0-9a-fA-F-]{36})$/.test(flowId) ||
        typeof serverEventId !== 'string' ||
        !/^[0-9a-fA-F-]{36}$/.test(serverEventId) ||
        typeof wardId !== 'number' ||
        !Number.isSafeInteger(wardId) ||
        wardId < 1 ||
        typeof shiftTeamId !== 'number' ||
        !Number.isSafeInteger(shiftTeamId) ||
        shiftTeamId < 1 ||
        typeof year !== 'number' ||
        !Number.isInteger(year) ||
        typeof month !== 'number' ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    )
        return undefined;

    return {flowId, serverEventId, wardId, shiftTeamId, year, month};
}

export function normalizeApiErrorResponse(value: unknown): TApiErrorResponse | undefined {
    if (!isRecord(value)) return undefined;

    const observation = scheduleObservation(value.scheduleObservation);

    return {
        ...(observation ? {scheduleObservation: observation} : {}),
        code: optionalString(value.code),
        message: optionalString(value.message),
        messageKey: optionalString(value.messageKey),
        messageArgs: isRecord(value.messageArgs) ? value.messageArgs : undefined,
        locale: optionalString(value.locale),
        displayPolicy: isDisplayPolicy(value.displayPolicy) ? value.displayPolicy : undefined,
        requestId: optionalString(value.requestId),
        traceId: optionalString(value.traceId),
        errors: Array.isArray(value.errors)
            ? value.errors.filter(isRecord).map((error) => ({
                  field: optionalString(error.field),
                  message: optionalString(error.message),
                  messageKey: optionalString(error.messageKey),
              }))
            : undefined,
    };
}

export function isScheduleRosterChangedApiError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'serverCode' in error &&
        (error as {serverCode?: unknown}).serverCode === 'SCHEDULE_ROSTER_CHANGED'
    );
}

export function emitScheduleRosterChanged(errorResponse: TApiErrorResponse | undefined) {
    if (errorResponse?.code !== 'SCHEDULE_ROSTER_CHANGED' || typeof window === 'undefined') return;

    window.dispatchEvent(
        new CustomEvent<TScheduleRosterChangedEventDetail>(SCHEDULE_ROSTER_CHANGED_EVENT, {
            detail: {
                message: errorResponse.message,
                requestId: errorResponse.requestId,
                traceId: errorResponse.traceId,
            },
        }),
    );
}

export function onScheduleRosterChanged(listener: (detail: TScheduleRosterChangedEventDetail) => void) {
    if (typeof window === 'undefined') return () => undefined;

    const handle = (event: Event) => listener((event as CustomEvent<TScheduleRosterChangedEventDetail>).detail);

    window.addEventListener(SCHEDULE_ROSTER_CHANGED_EVENT, handle);

    return () => window.removeEventListener(SCHEDULE_ROSTER_CHANGED_EVENT, handle);
}

function translateMessageKey(errorResponse: TApiErrorResponse | undefined) {
    if (!errorResponse?.messageKey || !i18n.exists(errorResponse.messageKey)) return undefined;

    return i18n.t(errorResponse.messageKey, errorResponse.messageArgs ?? {});
}

export function resolveApiErrorMessage(errorResponse: TApiErrorResponse | undefined, fallbackMessage = i18n.t('shared.api.requestFailed')) {
    const translated = translateMessageKey(errorResponse);
    const serverMessage = errorResponse?.message;

    switch (errorResponse?.displayPolicy) {
        case 'CLIENT_TRANSLATE':
            return translated ?? serverMessage ?? fallbackMessage;
        case 'SERVER_TEXT':
        case 'SERVER_TEXT_WITH_LANGUAGE':
            return serverMessage ?? translated ?? fallbackMessage;
        case 'DEBUG_ONLY':
            return fallbackMessage;
        default:
            return translated ?? serverMessage ?? fallbackMessage;
    }
}
