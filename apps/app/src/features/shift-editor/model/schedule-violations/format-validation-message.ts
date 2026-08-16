import i18n from '@/i18n';

type TMessageArgValue = string | number | boolean | null | undefined;

type TValidationMessageSource = {
    message_key?: string | null;
    messageKey?: string | null;
    message_args?: Record<string, TMessageArgValue> | null;
    messageArgs?: Record<string, TMessageArgValue> | null;
    message?: string | null;
    templateCode?: string | null;
    nurse_id?: string | number | null;
    nurseId?: string | number | null;
    nurse_name?: string | null;
    nurseName?: string | null;
    shift?: string | null;
    expected?: string | number | null;
    actual?: string | number | null;
};

const MESSAGE_KEY_PREFIX = 'schedule.validation.';
const VALIDATION_I18N_KEY_PREFIX = 'feature.shiftEditor.validation.';
const MAX_CONSECUTIVE_WORK_MESSAGE_PATTERN =
    /^(.+?)님은\s+근무가\s+(\d+)일\s+연속이에요\.?\s*최대\s+(\d+)일까지\s+가능해요\.?$/;
const MAX_CONSECUTIVE_NIGHT_MESSAGE_PATTERN =
    /^(.+?)님은\s+(.+?)\s+근무가\s+(\d+)(?:일|회)\s+연속이에요\.?\s*최대\s+(\d+)(?:일|회)까지\s+가능해요\.?$/;
const MIN_STAFF_BY_SHIFT_MESSAGE_PATTERN = /^(.+?)\s+근무\s+인원이\s+(\d+)명이에요\.?\s*최소\s+(\d+)명이\s+필요해요\.?$/;
const MAX_STAFF_BY_SHIFT_MESSAGE_PATTERN =
    /^(.+?)\s+근무\s+인원이\s+(\d+)명이에요\.?\s*최대\s+(\d+)명까지\s+가능해요\.?$/;
const MIN_MONTHLY_OFF_MESSAGE_PATTERN = /^(.+?)님은\s+월\s+OFF가\s+(\d+)일이에요\.?\s*최소\s+(\d+)일이\s+필요해요\.?$/;
const MIN_OFF_AFTER_NIGHT_MESSAGE_PATTERN =
    /^(.+?)님은\s+N\s+근무\s+뒤\s+OFF가\s+부족해요\.?\s*최소\s+(\d+)일이\s+필요해요\.?$/;
const NIGHT_CONTINUATION_REQUIRED_MESSAGE_PATTERN = /^(.+?)님의\s+연속\s+(.+?)\s+근무\s+후에는\s+(.+?)가\s+필요해요\.?$/;

function toCamelCase(value: string) {
    return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeMessageArgs(source: TValidationMessageSource): Record<string, TMessageArgValue> {
    const rawArgs = {
        ...(source.message_args ?? {}),
        ...(source.messageArgs ?? {}),
    };
    const normalized = Object.entries(rawArgs).reduce<Record<string, TMessageArgValue>>((acc, [key, value]) => {
        acc[key] = value;
        acc[toCamelCase(key)] = value;

        return acc;
    }, {});

    return {
        ...normalized,
        nurseId: normalized.nurseId ?? source.nurse_id ?? source.nurseId ?? undefined,
        nurseName: normalized.nurseName ?? source.nurse_name ?? source.nurseName ?? undefined,
        shift: normalized.shift ?? source.shift ?? undefined,
        expected: normalized.expected ?? source.expected ?? undefined,
        actual: normalized.actual ?? source.actual ?? undefined,
    };
}

export function formatScheduleValidationMessage(source: TValidationMessageSource): string | null {
    const messageKey = source.message_key ?? source.messageKey;

    if (!messageKey?.startsWith(MESSAGE_KEY_PREFIX)) return null;

    const key = `${VALIDATION_I18N_KEY_PREFIX}${messageKey.slice(MESSAGE_KEY_PREFIX.length)}`;

    if (!i18n.exists(key)) return null;

    return i18n.t(key, normalizeMessageArgs(source));
}

export function formatKnownScheduleValidationMessage(message: string): string | null {
    const trimmed = message.trim();
    const [, detail = trimmed] = trimmed.match(/^[^:]+:\s*(.+)$/) ?? [];
    const normalized = detail.trim();
    const maxWorkMatch = normalized.match(MAX_CONSECUTIVE_WORK_MESSAGE_PATTERN);

    if (maxWorkMatch) {
        const [, , actual, expected] = maxWorkMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}l1ConsecutiveWork`, {actual, expected});
    }

    const maxNightMatch = normalized.match(MAX_CONSECUTIVE_NIGHT_MESSAGE_PATTERN);

    if (maxNightMatch) {
        const [, nurseName, shift, actual, expected] = maxNightMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}maxConsecutiveNight`, {
            nurseName,
            actual,
            expected,
            shift,
        });
    }

    const minStaffMatch = normalized.match(MIN_STAFF_BY_SHIFT_MESSAGE_PATTERN);

    if (minStaffMatch) {
        const [, shift, actual, expected] = minStaffMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}minStaffByShift`, {shift, actual, expected});
    }

    const maxStaffMatch = normalized.match(MAX_STAFF_BY_SHIFT_MESSAGE_PATTERN);

    if (maxStaffMatch) {
        const [, shift, actual, expected] = maxStaffMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}maxStaffByShift`, {shift, actual, expected});
    }

    const minMonthlyOffMatch = normalized.match(MIN_MONTHLY_OFF_MESSAGE_PATTERN);

    if (minMonthlyOffMatch) {
        const [, nurseName, actual, expected] = minMonthlyOffMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}minMonthlyOff`, {nurseName, actual, expected});
    }

    const minOffAfterNightMatch = normalized.match(MIN_OFF_AFTER_NIGHT_MESSAGE_PATTERN);

    if (minOffAfterNightMatch) {
        const [, nurseName, expected] = minOffAfterNightMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}minOffAfterNight`, {nurseName, expected});
    }

    const nightContinuationMatch = normalized.match(NIGHT_CONTINUATION_REQUIRED_MESSAGE_PATTERN);

    if (nightContinuationMatch) {
        const [, nurseName, nightShift, nightContinuationShift] = nightContinuationMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}nightContinuationRequired`, {
            nurseName,
            nightShift,
            nightContinuationShift,
        });
    }

    return null;
}

export function localizeScheduleValidationMessage(source: TValidationMessageSource): string {
    const keyedMessage = formatScheduleValidationMessage(source);

    if (keyedMessage) return keyedMessage;

    if (source.message) {
        const knownMessage = formatKnownScheduleValidationMessage(source.message);

        if (knownMessage) return knownMessage;
    }

    return source.message?.trim() ?? '';
}
