import type {TAutofillAdjustStrength, TScheduleAdjustInterpretRes, TScheduleMonthRequestItem} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';

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
};

/** The assistant's interpretation is a message; answers are collected in separate user bubbles. */
export function AiAdjustInterpretCard({card, nurses}: TProps) {
    const {t} = useTypedTranslation();
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
    } as const;
    const fieldLabel = (field: string) =>
        Object.prototype.hasOwnProperty.call(fieldLabels, field) ? t(fieldLabels[field as keyof typeof fieldLabels]) : field;
    const itemFieldLabel = (item: TScheduleMonthRequestItem, field: string) =>
        item.templateCode === 'MAX_CONSECUTIVE_SHIFT' && field === 'count' ? t('aiAdjust.review.consecutiveDays') : fieldLabel(field);
    const formatValue = (value: unknown, field = ''): string => {
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
    return (
        <section aria-label={t('aiAdjust.understood')} className="min-w-0 space-y-3 text-[16px] leading-7">
            <h3 className="font-semibold">{t('aiAdjust.understood')}</h3>
            <ul className="space-y-2">
                {card.items.map(({item}, index) => (
                    <li key={index} className="min-w-0 space-y-2">
                        <p className="break-words">
                            {card.items.length > 1 && '• '}
                            {item.displayLabel || (item.knob ? t(`aiAdjust.knob.${item.knob}`) : card.requestText)}
                        </p>
                        {(item.kind === 'CELL' || item.kind === 'CELL_SET') && (
                            <p className="text-[14px] text-[#475467]">
                                {(item.kind === 'CELL' ? [item.nurseId] : (item.nurseIds ?? []))
                                    .filter((id): id is number => id !== undefined)
                                    .map(nurseName)
                                    .join(', ')}
                                {' · '}
                                {(item.kind === 'CELL' ? [item.date] : (item.dates ?? [])).join(', ')}
                                {' · '}
                                {item.shiftCode}
                            </p>
                        )}
                        {!!item.applyMonths?.length && (
                            <p className="text-[14px] text-[#475467]">
                                {t('aiAdjust.review.months')} ·{' '}
                                <span>{item.applyMonths.map(({year, month}) => `${year}.${month}`).join(', ')}</span>
                            </p>
                        )}
                        {(item.requiresConfirmation || item.assumedSlots?.length || item.lifetimeHint === 'TEAM') && (
                            <div className="space-y-1 text-[14px] text-[#86540E]">
                                {item.confirmationReasons?.map((reason) => <p key={reason}>{t(`aiAdjust.${reason}`)}</p>)}
                                {item.lifetimeHint === 'TEAM' && !item.confirmationReasons?.includes('RECURRING_SCOPE') && (
                                    <p>{t('aiAdjust.RECURRING_SCOPE')}</p>
                                )}
                                {item.assumedSlots?.map((slot) => (
                                    <p key={slot}>
                                        {t('aiAdjust.assumed')} · {itemFieldLabel(item, slot)}:{' '}
                                        {formatValue(item.params?.[slot] ?? (item as Record<string, unknown>)[slot], slot)}
                                    </p>
                                ))}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {card.llmPrompt && <p className="break-words whitespace-pre-wrap">{card.llmPrompt}</p>}
            {card.unmapped.length > 0 && (
                <div className="space-y-2 text-[14px] text-[#86540E]">
                    <p className="font-medium">{t('aiAdjust.unmapped')}</p>
                    <p>{t('aiAdjust.partial')}</p>
                    {card.unmapped.map((entry, index) => (
                        <div key={index}>
                            <p>{entry.text}</p>
                            {entry.hint && <p>{entry.hint}</p>}
                        </div>
                    ))}
                </div>
            )}
            <details className="group text-[14px] leading-5 text-[#475467]">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 font-medium hover:bg-white focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none">
                    {t('aiAdjust.review.details')}
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 group-open:rotate-180" fill="currentColor">
                        <path d="m5 7 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L5 7Z" />
                    </svg>
                </summary>
                <div className="space-y-3 py-2">
                    {card.items.map(({item}, index) => (
                        <div key={index} className="space-y-1 break-words">
                            {card.items.length > 1 && <p className="font-medium">{item.displayLabel}</p>}
                            {item.knob && (
                                <p>
                                    {t(`aiAdjust.knob.${item.knob}`)} · {t('aiAdjust.review.value')} {item.value}
                                </p>
                            )}
                            {item.templateCode && (
                                <p>
                                    {t('aiAdjust.template')} · {item.templateCode}
                                </p>
                            )}
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
                                    {t('aiAdjust.condition')} · {item.condition.key} · {formatValue(item.condition.value)}{' '}
                                    {t(`aiAdjust.review.operator.${item.condition.operator}`)}
                                </p>
                            )}
                            {item.operation && (
                                <p>
                                    {t(`aiAdjust.operation.${item.operation}`, {count: item.targetOff ?? item.minimumOff ?? 0})}
                                    {item.source && ` · ${t(`aiAdjust.source.${item.source}`)}`}
                                </p>
                            )}
                            {item.kind === 'GOAL' && <p>{t(item.required ? 'aiAdjust.review.required' : 'aiAdjust.review.preferred')}</p>}
                        </div>
                    ))}
                    <p>
                        {t('aiAdjust.review.range')} · {t(`aiAdjust.${card.strength}`)}
                    </p>
                </div>
            </details>
        </section>
    );
}
