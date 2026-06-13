import i18n from '@/i18n';

type TMessageArgValue = string | number | boolean | null | undefined;

type TValidationMessageSource = {
    message_key?: string | null;
    messageKey?: string | null;
    message_args?: Record<string, TMessageArgValue> | null;
    messageArgs?: Record<string, TMessageArgValue> | null;
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
