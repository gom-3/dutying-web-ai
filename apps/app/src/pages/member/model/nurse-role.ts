import type {TI18nKey} from '@/shared/hook/use-typed-translation';

export type TNurseRoleHelpType = 'preceptor' | 'preceptee';
export type TNurseRoleLike = {
    isPreceptor?: boolean | null;
    isPreceptee?: boolean | null;
    memo?: string | null;
};

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
const LEGACY_PRECEPTOR_MEMO_MARKER = '\uD504\uB9AC\uC149\uD130';
const PRECEPTOR_MEMO_MARKERS = new Set(['__PRECEPTOR__', LEGACY_PRECEPTOR_MEMO_MARKER]);
const PRECEPTEE_MEMO_MARKERS = new Set(['__PRECEPTEE__', LEGACY_PRECEPTEE_MEMO_MARKER]);

export const hasPreceptorMemo = (memo?: string | null) =>
    Boolean(memo?.split(/\r?\n/).some((line) => PRECEPTOR_MEMO_MARKERS.has(line.trim())));

export const hasPrecepteeMemo = (memo?: string | null) =>
    Boolean(memo?.split(/\r?\n/).some((line) => PRECEPTEE_MEMO_MARKERS.has(line.trim())));

export const getMemoWithoutRoleMarkers = (memo: string | null | undefined) =>
    (memo ?? '')
        .split(/\r?\n/)
        .filter((line) => !PRECEPTOR_MEMO_MARKERS.has(line.trim()) && !PRECEPTEE_MEMO_MARKERS.has(line.trim()))
        .join('\n');

export const getMemoWithoutPrecepteeMarker = getMemoWithoutRoleMarkers;

export const hasNursePreceptorRole = (nurse: TNurseRoleLike | null | undefined) =>
    nurse?.isPreceptor === true || hasPreceptorMemo(nurse?.memo);

export const hasNursePrecepteeRole = (nurse: TNurseRoleLike | null | undefined) =>
    nurse?.isPreceptee === true || hasPrecepteeMemo(nurse?.memo);

export const normalizeNurseRoleFields = <T extends TNurseRoleLike>(nurse: T): T & {isPreceptor: boolean; isPreceptee: boolean; memo: string} => {
    const isPreceptor = hasNursePreceptorRole(nurse);

    return {
        ...nurse,
        isPreceptor,
        isPreceptee: !isPreceptor && hasNursePrecepteeRole(nurse),
        memo: getMemoWithoutRoleMarkers(nurse.memo),
    };
};

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
