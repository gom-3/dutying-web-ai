import type {TScheduleAdjustInterpretUnmapped} from '@dutying/api/ward';

/** Legacy servers only return a hint. Keep compatibility separate from UI copy. */
export function interpretIssueCode(issue: TScheduleAdjustInterpretUnmapped) {
    if (issue.reasonCode && issue.reasonCode !== 'NEEDS_CLARIFICATION') return issue.reasonCode;

    const hint = issue.hint ?? '';

    if (/간호사.*(특정|찾|확인)|그 이름.*찾/.test(hint)) return 'NURSE_NOT_RESOLVED';

    if (/근무.*(이름|종류|하나 골라)|어떤 근무인지/.test(hint)) return 'SHIFT_NOT_RESOLVED';

    if (/날짜|며칠인지/.test(hint)) return 'INVALID_DATE';

    if (/아직.*(반영하지 못|조절할 수 없|조절할 수 있는 축)|지원하지/.test(hint)) return 'UNSUPPORTED_REQUEST';

    if (/잠시 후.*다시 시도|문장을 이해하지 못했어요\. 칩/.test(hint)) return 'INTERPRETATION_FAILED';

    if (/숫자|범위|사이만|사이로|횟수|정하지 못/.test(hint)) return 'INVALID_VALUE';

    return 'NEEDS_CLARIFICATION';
}

export function hasNamedNurse(request: string, nurses: {nurseId: number; name: string}[]) {
    const text = request.normalize('NFC');

    return nurses.some(({name}) => {
        const compact = name.normalize('NFC').trim().replace(/\s/g, '');

        if (!compact || /^\d+$/.test(compact)) return false;

        const escaped = [...compact].map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
        const pattern = /\d$/.test(compact)
            ? `${escaped}(?!\\d)`
            : /[A-Za-z]$/.test(compact)
              ? `(?<![A-Za-z])${escaped}(?![A-Za-z0-9])`
              : `${escaped}(?=$|[^가-힣A-Za-z0-9]|의|은|는|이|가|을|를|와|과|도|만|씨|쌤|선생님|근무|나이트|데이|이브닝|오프|[DENO]근무)`;

        return new RegExp(pattern).test(text);
    });
}

export function canRetryInterpretation(
    issues: TScheduleAdjustInterpretUnmapped[],
    request: string,
    nurses: {nurseId: number; name: string}[],
) {
    return issues.some((issue) => {
        const code = interpretIssueCode(issue);

        return code === 'INTERPRETATION_FAILED' || (code === 'NURSE_NOT_RESOLVED' && hasNamedNurse(request, nurses));
    });
}

export function readableIssueHint(hint?: string | null) {
    const text = hint?.trim();

    // Do not expose enum values/slot names or an empty placeholder as recovery copy.
    return text && !/^[\s•—-]*$|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b(?:period|operator|aggregation|target|nurseId)\b/.test(text)
        ? text
        : undefined;
}
