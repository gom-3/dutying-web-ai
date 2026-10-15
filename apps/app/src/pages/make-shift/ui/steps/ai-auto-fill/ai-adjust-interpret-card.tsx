import type {TAutofillAdjustStrength, TScheduleAdjustInterpretRes, TScheduleMonthRequestItem} from '@dutying/api/ward';
import i18n from '@/i18n';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {formatInterpretationDates, summarizeInterpretationItems} from '../../../model/ai-adjust-summary';
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';
import {AiAdjustInterpretIssues} from './ai-adjust-interpret-issues';

export type TAdjustCard = {
    requestText: string;
    items: TInterpretCardItem[];
    llmPrompt?: string;
    unmapped: TScheduleAdjustInterpretRes['unmapped'];
    strength: TAutofillAdjustStrength;
};

type TProps = {
    card: TAdjustCard;
    nurses: {nurseId: number; name: string}[];
    showDetails?: boolean;
};

/** The assistant's interpretation is a message; answers are collected in separate user bubbles. */
export function AiAdjustInterpretCard({card, nurses, showDetails = true}: TProps) {
    const {t} = useTypedTranslation();
    const displayItems = summarizeInterpretationItems(card.items.map(({item}) => item));
    const nurseName = (id: number) => nurses.find((nurse) => nurse.nurseId === id)?.name ?? t('aiAdjust.nurse', {id});
    const fieldLabels = {
        target: 'aiAdjust.review.target',
        nurseIds: 'aiAdjust.review.target',
        nurseId: 'aiAdjust.review.target',
        shift: 'aiAdjust.review.shift',
        shiftCode: 'aiAdjust.review.shift',
        count: 'aiAdjust.review.count',
        value: 'aiAdjust.review.value',
        days: 'aiAdjust.review.days',
        pattern: 'aiAdjust.review.pattern',
        date: 'aiAdjust.review.date',
        dates: 'aiAdjust.review.date',
        period: 'aiAdjust.review.countPeriod',
        operator: 'aiAdjust.review.countOperator',
        aggregation: 'aiAdjust.review.aggregation',
        PATIENT_COUNT: 'aiAdjust.review.patientCount',
    } as const;
    const fieldLabel = (field: string) =>
        Object.prototype.hasOwnProperty.call(fieldLabels, field) ? t(fieldLabels[field as keyof typeof fieldLabels]) : field;
    const itemFieldLabel = (item: TScheduleMonthRequestItem, field: string) =>
        item.templateCode === 'MAX_CONSECUTIVE_SHIFT' && field === 'count' ? t('aiAdjust.review.consecutiveDays') : fieldLabel(field);
    const optionLabels = {
        period: {
            DAY: 'aiAdjust.review.periods.DAY',
            WEEK: 'aiAdjust.review.periods.WEEK',
            ROLLING_7_DAYS: 'aiAdjust.review.periods.ROLLING_7_DAYS',
            MONTH: 'aiAdjust.review.periods.MONTH',
        },
        operator: {
            MIN: 'aiAdjust.review.countOperators.MIN',
            MAX: 'aiAdjust.review.countOperators.MAX',
            EXACT: 'aiAdjust.review.countOperators.EXACT',
            TARGET: 'aiAdjust.review.countOperators.TARGET',
        },
        aggregation: {
            EACH: 'aiAdjust.review.aggregations.EACH',
            PER_NURSE: 'aiAdjust.review.aggregations.PER_NURSE',
            GROUP_TOTAL: 'aiAdjust.review.aggregations.GROUP_TOTAL',
        },
    } as const;
    const optionValue = (value: unknown): unknown => (value && typeof value === 'object' && 'type' in value ? value.type : value);
    const formatValue = (value: unknown, field = ''): string => {
        if (field === 'period' || field === 'operator' || field === 'aggregation') {
            const label = Object.entries(optionLabels[field]).find(([key]) => key === optionValue(value))?.[1];

            if (label) return t(label);
        }

        if (value === 'ALL') return t('aiAdjust.allNurses');
        if (typeof value === 'boolean') return t(value ? 'aiAdjust.review.yes' : 'aiAdjust.review.no');
        if (Array.isArray(value)) return value.map((entry) => formatValue(entry, field)).join(', ');
        if (['target', 'nurseId', 'nurseIds'].includes(field) && typeof value === 'number') return nurseName(value);
        if (value && typeof value === 'object')
            return Object.entries(value)
                .map(([key, entry]) => `${fieldLabel(key)}: ${formatValue(entry, key)}`)
                .join(' · ');
        return String(value ?? '—');
    };
    const countRuleSummary = (item: TScheduleMonthRequestItem) => {
        if (item.kind !== 'RULE' || item.templateCode !== 'SHIFT_COUNT_PER_PERIOD') return null;

        const params = item.params ?? {};
        const period = optionValue(params.period);
        const operator = optionValue(params.operator);
        const aggregation = optionValue(params.aggregation) ?? 'EACH';

        if (
            !['DAY', 'WEEK', 'ROLLING_7_DAYS', 'MONTH'].includes(String(period)) ||
            !['MIN', 'MAX', 'EXACT'].includes(String(operator)) ||
            !['EACH', 'PER_NURSE', 'GROUP_TOTAL'].includes(String(aggregation)) ||
            typeof params.count !== 'number' ||
            !Number.isInteger(params.count) ||
            params.count < 0 ||
            typeof params.shift !== 'string' ||
            !(
                params.target === 'ALL' ||
                (Array.isArray(params.target) && params.target.length > 0 && params.target.every((id) => typeof id === 'number'))
            ) ||
            Object.keys(params).some((key) => !['target', 'shift', 'period', 'operator', 'aggregation', 'count'].includes(key))
        )
            return null;

        const limit = t(`aiAdjust.review.countLimit.${operator as 'MIN' | 'MAX' | 'EXACT'}`, {count: params.count});
        const frequency = t(`aiAdjust.review.frequency.${period as 'DAY' | 'WEEK' | 'ROLLING_7_DAYS' | 'MONTH'}`, {limit});
        const multiple = params.target === 'ALL' || (Array.isArray(params.target) && params.target.length > 1);

        return {
            target: formatValue(params.target, 'target'),
            text: t('aiAdjust.review.countRule', {
                shift: params.shift,
                frequency,
                aggregation:
                    aggregation === 'GROUP_TOTAL' ? t('aiAdjust.review.groupTotal') : multiple ? t('aiAdjust.review.perNurse') : '',
            }),
            frequency,
            particle: operator === 'MIN' ? '으로' : '로',
        };
    };
    const detailItems = displayItems.filter(
        (item) =>
            (!countRuleSummary(item) && Object.keys(item.params ?? {}).length > 0) ||
            Boolean(item.condition) ||
            Boolean(item.operation) ||
            item.kind === 'GOAL',
    );
    const hasContent = displayItems.length > 0 || Boolean(card.llmPrompt?.trim());
    const title = t(card.unmapped.length ? 'aiAdjust.issue.partialTitle' : 'aiAdjust.understood');

    if (!hasContent) return <AiAdjustInterpretIssues card={card} nurses={nurses} partial={false} />;

    return (
        <section aria-label={title} className="min-w-0 space-y-3 text-[14.5px] leading-7">
            <h3 className="font-semibold">{title}</h3>
            {displayItems.length > 0 && (
                <ul className="space-y-2">
                    {displayItems.map((item, index) => {
                        const countSummary = countRuleSummary(item);

                        return (
                            <li key={index} className="min-w-0 space-y-1">
                                {item.kind === 'CELL' || item.kind === 'CELL_SET' ? (
                                    <div className="space-y-1">
                                        <p className="font-medium break-keep">
                                            {(item.kind === 'CELL' ? [item.nurseId] : (item.nurseIds ?? []))
                                                .filter((id): id is number => id !== undefined)
                                                .map(nurseName)
                                                .join(', ')}
                                        </p>
                                        <p className="break-keep">
                                            {formatInterpretationDates(
                                                (item.kind === 'CELL' ? [item.date] : (item.dates ?? [])).filter((date): date is string =>
                                                    Boolean(date),
                                                ),
                                                i18n.language,
                                            )}
                                            {' · '}
                                            {t('aiAdjust.review.fixedShift', {shift: item.shiftCode ?? '—'})}
                                        </p>
                                    </div>
                                ) : countSummary ? (
                                    <div className="space-y-1 break-keep">
                                        <p className="font-medium">{countSummary.target}</p>
                                        <p>{countSummary.text}</p>
                                    </div>
                                ) : (
                                    <p className="break-keep">
                                        {displayItems.length > 1 && '• '}
                                        {item.displayLabel || (item.knob ? t(`aiAdjust.knob.${item.knob}`) : card.requestText)}
                                    </p>
                                )}
                                {!!item.applyMonths?.length && (
                                    <p className="text-[13px] text-[#475467]">
                                        {t('aiAdjust.review.months')} ·{' '}
                                        <span>{item.applyMonths.map(({year, month}) => `${year}.${month}`).join(', ')}</span>
                                    </p>
                                )}
                                {(item.requiresConfirmation || item.assumedSlots?.length || item.lifetimeHint === 'TEAM') && (
                                    <div className="space-y-1 text-[13px] break-keep text-[#86540E]">
                                        {item.confirmationReasons
                                            ?.filter((reason) => reason !== 'ASSUMED_VALUE' || !item.assumedSlots?.length)
                                            .map((reason) => <p key={reason}>{t(`aiAdjust.${reason}`)}</p>)}
                                        {item.lifetimeHint === 'TEAM' && !item.confirmationReasons?.includes('RECURRING_SCOPE') && (
                                            <p>{t('aiAdjust.RECURRING_SCOPE')}</p>
                                        )}
                                        {item.assumedSlots?.map((slot) => (
                                            <p key={slot}>
                                                {slot === 'count' && countSummary
                                                    ? t('aiAdjust.review.countSuggestion', {
                                                          value: countSummary.frequency,
                                                          particle: countSummary.particle,
                                                      })
                                                    : t('aiAdjust.review.suggestion', {
                                                          field: itemFieldLabel(item, slot),
                                                          value: formatValue(
                                                              item.params?.[slot] ?? (item as Record<string, unknown>)[slot],
                                                              slot,
                                                          ),
                                                      })}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {card.llmPrompt && <p className="break-words whitespace-pre-wrap">{card.llmPrompt}</p>}
            {card.unmapped.length > 0 && <AiAdjustInterpretIssues card={card} nurses={nurses} partial />}
            {showDetails && detailItems.length > 0 && (
                <details className="group text-[13px] leading-5 text-[#475467]">
                    <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 font-medium hover:bg-white focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none">
                        {t('aiAdjust.review.details')}
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 group-open:rotate-180" fill="currentColor">
                            <path d="m5 7 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L5 7Z" />
                        </svg>
                    </summary>
                    <div className="space-y-3 py-2">
                        {detailItems.map((item, index) => (
                            <div key={index} className="space-y-1 break-words">
                                {card.items.length > 1 && <p className="font-medium">{item.displayLabel}</p>}
                                {item.params && (
                                    <dl className="space-y-1">
                                        {Object.entries(item.params).map(([key, value]) => (
                                            <div key={key} className="flex flex-wrap gap-x-2">
                                                <dt>{itemFieldLabel(item, key)}</dt>
                                                <dd>{formatValue(value, key)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                                {item.condition && (
                                    <p>
                                        {t('aiAdjust.condition')} · {fieldLabel(item.condition.key)} · {formatValue(item.condition.value)}{' '}
                                        {t(`aiAdjust.review.operator.${item.condition.operator}`)}
                                    </p>
                                )}
                                {item.operation && (
                                    <p>
                                        {t(`aiAdjust.operation.${item.operation}`, {count: item.targetOff ?? item.minimumOff ?? 0})}
                                        {item.source && ` · ${t(`aiAdjust.source.${item.source}`)}`}
                                    </p>
                                )}
                                {item.kind === 'GOAL' && (
                                    <>
                                        <p>
                                            {t('aiAdjust.review.goalTarget')} · {(item.targetNurseIds ?? []).map(nurseName).join(', ')}
                                        </p>
                                        <p>
                                            {t('aiAdjust.review.comparison')} · {(item.comparisonNurseIds ?? []).map(nurseName).join(', ')}
                                        </p>
                                        <p>
                                            {t('aiAdjust.review.offDifference')} ·{' '}
                                            {item.maxOffDifference === undefined
                                                ? '—'
                                                : t('aiAdjust.chat.withinDays', {count: item.maxOffDifference})}
                                        </p>
                                        <p>{t(item.required ? 'aiAdjust.review.required' : 'aiAdjust.review.preferred')}</p>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}
