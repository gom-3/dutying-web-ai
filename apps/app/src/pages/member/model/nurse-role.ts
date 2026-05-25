export type TNurseRoleHelpType = 'preceptor' | 'preceptee';

export const NURSE_ROLE_HELP: Record<TNurseRoleHelpType, {label: string; description: string}> = {
    preceptor: {
        label: '프리셉터',
        description: '신규 또는 저연차 간호사의 적응과 교육을 도와주는 담당 간호사예요.',
    },
    preceptee: {
        label: '프리셉티',
        description: '프리셉터에게 교육과 적응 지원을 받는 신규 또는 저연차 간호사예요.',
    },
};

const PRECEPTEE_MEMO_MARKER = '프리셉티';

export const hasPrecepteeMemo = (memo?: string | null) =>
    Boolean(memo?.split(/\r?\n/).some((line) => line.trim() === PRECEPTEE_MEMO_MARKER));

export const setPrecepteeMemo = (memo: string | null | undefined, checked: boolean) => {
    const currentMemo = memo ?? '';

    if (checked) {
        if (hasPrecepteeMemo(currentMemo)) {
            return currentMemo;
        }

        const trimmedMemo = currentMemo.trim();

        return trimmedMemo ? `${PRECEPTEE_MEMO_MARKER}\n${trimmedMemo}` : PRECEPTEE_MEMO_MARKER;
    }

    return currentMemo
        .split(/\r?\n/)
        .filter((line) => line.trim() !== PRECEPTEE_MEMO_MARKER)
        .join('\n')
        .trim();
};
