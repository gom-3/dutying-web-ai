import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TSemanticPlan} from '../../../model/schedule-conversation-api';

type TProps = {
    children?: ReactNode;
    condition: TSemanticPlan['conditions'][number];
    nurseName: (id: number) => string;
    rosterNurseIds: number[];
    copy: (ko: string, en: string) => string;
    showPriority: boolean;
};

type TTranslate = ReturnType<typeof useTypedTranslation>['t'];

function period(dates: string[], t: TTranslate) {
    const sorted = [...dates].sort();
    const format = (date: string) => {
        const [, month, day] = date.split('-').map(Number);

        return t('aiAutofillUi.semanticCondition.dateLabel', {month, day});
    };

    if (!sorted.length) return '';

    const consecutive = sorted.every((date, index) => index === 0 || Date.parse(date) - Date.parse(sorted[index - 1]) === 86400000);

    if (sorted.length > 1 && consecutive) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const [, month, day] = first.split('-').map(Number);

        return first.slice(0, 7) === last.slice(0, 7)
            ? t('aiAutofillUi.semanticCondition.dateRange', {month, day, lastDay: Number(last.slice(-2))})
            : `${format(first)} ~ ${format(last)}`;
    }

    return sorted.map(format).join(', ');
}

function description(condition: TProps['condition'], t: TTranslate) {
    const shifts = condition.shiftCodes.join(', ');
    const count = String(condition.count);

    if (condition.action === 'FORBID') return t('aiAutofillUi.semanticCondition.excludeShifts', {shifts});

    if (condition.action === 'ASSIGN') return t('aiAutofillUi.semanticCondition.assignShifts', {shifts});

    if (condition.action === 'MAX_CONSECUTIVE_WORK') return t('aiAutofillUi.semanticCondition.atMostConsecutiveWorkDays', {count});

    const operator =
        condition.operator === 'MIN'
            ? t('aiAutofillUi.semanticCondition.atLeast')
            : condition.operator === 'MAX'
              ? t('aiAutofillUi.semanticCondition.atMost')
              : t('aiAutofillUi.semanticCondition.exactly');

    if (condition.quantifier === 'GROUP_TOTAL' && condition.dates.length === 1) {
        const names = condition.shiftCodes.map((code) => (code === 'O' ? t('aiAutofillUi.semanticCondition.offDuty') : code)).join(', ');

        return t('aiAutofillUi.semanticCondition.headcountNurses', {names, operator, count});
    }

    return condition.quantifier === 'GROUP_TOTAL'
        ? t('aiAutofillUi.semanticCondition.shiftsTotal', {shifts, operator, count})
        : t('aiAutofillUi.semanticCondition.shiftsTimesEach', {shifts, operator, count});
}

export function AiSemanticCondition({condition, nurseName, rosterNurseIds, showPriority, children}: TProps) {
    const {t} = useTypedTranslation();
    const everyone =
        rosterNurseIds.length > 0 &&
        new Set(condition.nurseIds).size === new Set(rosterNurseIds).size &&
        rosterNurseIds.every((id) => condition.nurseIds.includes(id));
    const catalogDescription = condition.displayText?.trim();
    const subject =
        condition.action === 'CATALOG_RULE'
            ? catalogDescription?.length
                ? catalogDescription
                : t('aiAutofillUi.semanticCondition.reviewTheRequestConditionsAgain')
            : everyone
              ? t('aiAutofillUi.semanticCondition.allNurses')
              : condition.nurseIds.map((id) => t('aiAutofillUi.semanticCondition.nurseName', {name: nurseName(id)})).join(', ');
    const dates = period(condition.dates, t);

    return (
        <li className="rounded-xl bg-white px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm leading-5 font-semibold break-keep text-[#333D4B]">{subject}</p>
                {showPriority && (
                    <span className="shrink-0 rounded-md bg-[#F1F3F5] px-2 text-[11px] leading-5 font-medium text-[#475467]">
                        {t(
                            condition.modality === 'HARD'
                                ? 'aiAutofillUi.semanticReview.required'
                                : 'aiAutofillUi.semanticReview.preferred',
                        )}
                    </span>
                )}
            </div>
            {condition.action !== 'CATALOG_RULE' && (
                <p className="mt-1 text-[13px] leading-5 break-keep text-[#333D4B]">{description(condition, t)}</p>
            )}
            {dates && <p className="mt-0.5 text-xs leading-5 break-keep text-[#667085]">{dates}</p>}
            {children}
        </li>
    );
}
