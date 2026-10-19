import type {TSemanticPlan} from '../../../model/schedule-conversation-api';

type TProps = {
    condition: TSemanticPlan['conditions'][number];
    nurseName: (id: number) => string;
    rosterNurseIds: number[];
    copy: (ko: string, en: string) => string;
};

function period(dates: string[], copy: TProps['copy']) {
    const sorted = [...dates].sort();
    const format = (date: string) => {
        const [, month, day] = date.split('-').map(Number);

        return copy(`${month}월 ${day}일`, `${month}/${day}`);
    };

    if (!sorted.length) return '';

    const consecutive = sorted.every((date, index) => index === 0 || Date.parse(date) - Date.parse(sorted[index - 1]) === 86400000);

    if (sorted.length > 1 && consecutive) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const [, month, day] = first.split('-').map(Number);

        return first.slice(0, 7) === last.slice(0, 7)
            ? copy(`${month}월 ${day}~${Number(last.slice(-2))}일`, `${format(first)}–${format(last)}`)
            : `${format(first)} ~ ${format(last)}`;
    }

    return sorted.map(format).join(', ');
}

function description(condition: TProps['condition'], copy: TProps['copy']) {
    const shifts = condition.shiftCodes.join(', ');

    if (condition.action === 'FORBID') return copy(`${shifts} 근무 제외`, `Exclude ${shifts} shifts`);

    if (condition.action === 'ASSIGN')
        return condition.modality === 'SOFT'
            ? copy(`${shifts} 근무 선호`, `Prefer ${shifts} shifts`)
            : copy(`${shifts} 근무 배정`, `Assign ${shifts} shifts`);

    if (condition.action === 'MAX_CONSECUTIVE_WORK')
        return copy(`연속 근무 최대 ${condition.count}일`, `At most ${condition.count} consecutive work days`);

    const operator =
        condition.operator === 'MIN'
            ? copy('최소', 'at least')
            : condition.operator === 'MAX'
              ? copy('최대', 'at most')
              : copy('정확히', 'exactly');

    if (condition.quantifier === 'GROUP_TOTAL' && condition.dates.length === 1) {
        const names = condition.shiftCodes.map((code) => (code === 'O' ? copy('휴무', 'off-duty') : code)).join(', ');

        return copy(`${names} 인원 · ${operator} ${condition.count}명`, `${names} headcount · ${operator} ${condition.count} nurses`);
    }

    return condition.quantifier === 'GROUP_TOTAL'
        ? copy(`${shifts} 근무 · 합계 ${operator} ${condition.count}회`, `${shifts} shifts · ${operator} ${condition.count} total`)
        : copy(`${shifts} 근무 · ${operator} ${condition.count}회씩`, `${shifts} shifts · ${operator} ${condition.count} times each`);
}

export function AiSemanticCondition({condition, nurseName, rosterNurseIds, copy}: TProps) {
    const everyone =
        rosterNurseIds.length > 0 &&
        new Set(condition.nurseIds).size === new Set(rosterNurseIds).size &&
        rosterNurseIds.every((id) => condition.nurseIds.includes(id));
    const subject =
        condition.action === 'CATALOG_RULE'
            ? condition.displayText?.trim() || copy('요청 조건을 다시 확인해 주세요.', 'Review the request conditions again.')
            : everyone
              ? copy('전체 간호사', 'All nurses')
              : condition.nurseIds.map((id) => copy(`${nurseName(id)}님`, nurseName(id))).join(', ');
    const dates = period(condition.dates, copy);

    return (
        <li className="rounded-xl bg-white px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[13.5px] leading-5 font-semibold break-keep text-[#333D4B]">{subject}</p>
                <span className="shrink-0 text-[11px] leading-5 text-[#667085]">
                    {condition.modality === 'HARD' ? copy('필수 조건', 'Required') : copy('선호 조건', 'Preferred')}
                </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-5 break-keep text-[#667085]">
                {dates && (
                    <>
                        {dates}
                        {condition.action !== 'CATALOG_RULE' && ' · '}
                    </>
                )}
                {condition.action !== 'CATALOG_RULE' && description(condition, copy)}
            </p>
        </li>
    );
}
