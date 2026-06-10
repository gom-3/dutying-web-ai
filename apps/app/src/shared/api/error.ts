import i18n from 'i18next';
import type {TApiErrorDisplayPolicy, TApiErrorResponse} from '@dutying/api';

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDisplayPolicy(value: unknown): value is TApiErrorDisplayPolicy {
    return (
        value === 'CLIENT_TRANSLATE' ||
        value === 'SERVER_TEXT' ||
        value === 'SERVER_TEXT_WITH_LANGUAGE' ||
        value === 'DEBUG_ONLY'
    );
}

function optionalString(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function normalizeApiErrorResponse(value: unknown): TApiErrorResponse | undefined {
    if (!isRecord(value)) return undefined;

    return {
        code: optionalString(value.code),
        message: optionalString(value.message),
        messageKey: optionalString(value.messageKey),
        messageArgs: isRecord(value.messageArgs) ? value.messageArgs : undefined,
        locale: optionalString(value.locale),
        displayPolicy: isDisplayPolicy(value.displayPolicy) ? value.displayPolicy : undefined,
        requestId: optionalString(value.requestId),
        traceId: optionalString(value.traceId),
        errors: Array.isArray(value.errors) ? value.errors.filter(isRecord).map((error) => ({
            field: optionalString(error.field),
            message: optionalString(error.message),
            messageKey: optionalString(error.messageKey),
        })) : undefined,
    };
}

function translateMessageKey(errorResponse: TApiErrorResponse | undefined) {
    if (!errorResponse?.messageKey || !i18n.exists(errorResponse.messageKey)) return undefined;

    return i18n.t(errorResponse.messageKey, errorResponse.messageArgs ?? {});
}

export function resolveApiErrorMessage(
    errorResponse: TApiErrorResponse | undefined,
    fallbackMessage = i18n.t('shared.api.requestFailed'),
) {
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
