import type {TI18nKey} from '@/shared/hook/use-typed-translation';

export type TNurseRoleHelpType = 'preceptor' | 'preceptee';

export const NURSE_ROLE_HELP: Record<TNurseRoleHelpType, {labelKey: TI18nKey; descriptionKey: TI18nKey}> = {
    preceptor: {
        labelKey: 'page.member.roleHelp.preceptor.label',
        descriptionKey: 'page.member.roleHelp.preceptor.description',
    },
    preceptee: {
        labelKey: 'page.member.roleHelp.preceptee.label',
        descriptionKey: 'page.member.roleHelp.preceptee.description',
    },
};

const LEGACY_PRECEPTEE_MEMO_MARKER = '\uD504\uB9AC\uC149\uD2F0';
const PRECEPTEE_MEMO_MARKERS = new Set(['__PRECEPTEE__', LEGACY_PRECEPTEE_MEMO_MARKER]);

export const hasPrecepteeMemo = (memo?: string | null) =>
    Boolean(memo?.split(/\r?\n/).some((line) => PRECEPTEE_MEMO_MARKERS.has(line.trim())));

export const getMemoWithoutPrecepteeMarker = (memo: string | null | undefined) =>
    (memo ?? '')
        .split(/\r?\n/)
        .filter((line) => !PRECEPTEE_MEMO_MARKERS.has(line.trim()))
        .join('\n');

export const setPrecepteeMemo = (memo: string | null | undefined, checked: boolean) => {
    const currentMemo = memo ?? '';

    if (checked) {
        if (hasPrecepteeMemo(currentMemo)) {
            return currentMemo;
        }

        return currentMemo.length > 0 ? `__PRECEPTEE__\n${currentMemo}` : '__PRECEPTEE__';
    }

    return currentMemo
        .split(/\r?\n/)
        .filter((line) => !PRECEPTEE_MEMO_MARKERS.has(line.trim()))
        .join('\n');
};
