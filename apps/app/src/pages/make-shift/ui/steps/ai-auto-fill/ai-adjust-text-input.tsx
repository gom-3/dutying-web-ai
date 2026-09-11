import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestItem, TScheduleMonthRequestLifetime} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';

const MAX_TEXT_LENGTH = 500;

type TProps = {
    disabled: boolean;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: (items: TInterpretCardItem[], requestText: string) => void;
};

type TCard = {
    requestText: string;
    items: TInterpretCardItem[];
    unmapped: TScheduleAdjustInterpretRes['unmapped'];
};

function toCardItems(items: TScheduleMonthRequestItem[]): TInterpretCardItem[] {
    // 기본 수명은 언제나 MONTH. lifetimeHint 는 배지 옆 보조 표시일 뿐이다 —
    // "이번 달만"이 다음 달로 새는 쪽이 훨씬 나쁜 실패라서 기본값을 해석에 맡기지 않는다.
    return items.map((item) => ({item, lifetime: 'MONTH'}));
}

/**
 * 칩 아래의 문장 입력. 문장은 서버가 축으로 해석하고, 사용자는 카드에서 확인한 뒤 적용한다.
 * 카드가 떠 있는 동안 입력창은 잠근다 — 해석과 적용이 다른 문장을 가리키는 순간을 만들지 않기 위해서다.
 */
export default function AiAdjustTextInput({disabled, interpret, onApply}: TProps) {
    const {t} = useTypedTranslation();
    const [text, setText] = useState('');
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [card, setCard] = useState<TCard | null>(null);
    const [error, setError] = useState<string | null>(null);
    const trimmed = text.trim();
    const canSubmit = !disabled && !isInterpreting && card === null && trimmed.length > 0;
    const handleSubmit = async () => {
        if (!canSubmit) return;

        setIsInterpreting(true);
        setError(null);

        try {
            const result = await interpret(trimmed);

            setCard({requestText: trimmed, items: toCardItems(result.items ?? []), unmapped: result.unmapped ?? []});
        } catch {
            setError(t('page.makeShift.aiRefill.adjust.interpretFailed'));
        } finally {
            setIsInterpreting(false);
        }
    };
    const handleLifetimeChange = (index: number, lifetime: TScheduleMonthRequestLifetime) => {
        setCard((current) =>
            current ? {...current, items: current.items.map((entry, i) => (i === index ? {...entry, lifetime} : entry))} : current,
        );
    };
    const handleApply = () => {
        if (!card) return;

        onApply(card.items, card.requestText);
        setCard(null);
        setText('');
    };
    const handleCancel = () => setCard(null);
    const applicableCount = card?.items.filter(({item}) => item.kind === 'KNOB').length ?? 0;

    return (
        <div className="ai-adjust-text-input flex flex-col gap-2 px-4 pb-2" data-preserve-duty-selection="true">
            <div className="flex items-start gap-2">
                <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void handleSubmit();
                        }
                    }}
                    disabled={disabled || isInterpreting || card !== null}
                    rows={1}
                    maxLength={MAX_TEXT_LENGTH}
                    aria-label={t('page.makeShift.aiRefill.adjust.textInput.label')}
                    placeholder={t('page.makeShift.aiRefill.adjust.textInput.placeholder')}
                    className="text-13 border-line min-h-[36px] flex-1 resize-none rounded-lg border px-3 py-2 outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => void handleSubmit()}
                    className={cn(
                        'text-13 shrink-0 rounded-full border border-primary px-3 py-1 font-semibold text-primary transition-colors',
                        canSubmit ? 'hover:bg-primary/10' : 'cursor-not-allowed opacity-50',
                    )}
                >
                    {isInterpreting
                        ? t('page.makeShift.aiRefill.adjust.textInput.interpreting')
                        : t('page.makeShift.aiRefill.adjust.textInput.submit')}
                </button>
            </div>

            {error && <p className="text-12 text-red">{error}</p>}

            {card && (
                <section
                    aria-label={t('page.makeShift.aiRefill.adjust.card.title')}
                    className="border-line bg-sub-bg flex flex-col gap-2 rounded-lg border px-3 py-2"
                >
                    <h3 className="text-13 font-semibold">{t('page.makeShift.aiRefill.adjust.card.title')}</h3>

                    {card.items.length === 0 ? (
                        <p className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.card.empty')}</p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {card.items.map(({item, lifetime}, index) => (
                                <li
                                    key={`${item.kind}:${item.knob ?? item.nurseId ?? index}:${index}`}
                                    className="flex flex-wrap items-center gap-2"
                                >
                                    <span className="text-13">{item.displayLabel ?? item.knob}</span>
                                    {item.kind === 'RULE' ? (
                                        <span className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.card.ruleNote')}</span>
                                    ) : (
                                        <>
                                            <select
                                                value={lifetime}
                                                aria-label={t('page.makeShift.aiRefill.adjust.card.lifetimeLabel', {
                                                    label: item.displayLabel ?? item.knob ?? '',
                                                })}
                                                onChange={(event) =>
                                                    handleLifetimeChange(index, event.target.value as TScheduleMonthRequestLifetime)
                                                }
                                                className="text-12 border-line rounded-full border bg-white px-2 py-0.5"
                                            >
                                                <option value="MONTH">{t('page.makeShift.aiRefill.adjust.lifetime.MONTH')}</option>
                                                <option value="TEAM">{t('page.makeShift.aiRefill.adjust.lifetime.TEAM')}</option>
                                            </select>
                                            {item.lifetimeHint === 'TEAM' && lifetime !== 'TEAM' && (
                                                <span className="text-12 text-sub">
                                                    {t('page.makeShift.aiRefill.adjust.card.teamHint')}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {card.unmapped.length > 0 && (
                        <ul className="flex flex-col gap-0.5">
                            {card.unmapped.map((entry, index) => (
                                <li key={`${entry.text}:${index}`} className="text-12 text-sub">
                                    <span className="line-through">{entry.text}</span>
                                    {entry.hint && <span> — {entry.hint}</span>}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-13 border-line text-sub rounded-full border px-3 py-1 transition-colors hover:bg-white"
                        >
                            {t('page.makeShift.aiRefill.adjust.card.cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={applicableCount === 0 || disabled}
                            onClick={handleApply}
                            className={cn(
                                'text-13 rounded-full bg-primary px-3 py-1 font-semibold text-white transition-colors',
                                (applicableCount === 0 || disabled) && 'cursor-not-allowed opacity-50',
                            )}
                        >
                            {t('page.makeShift.aiRefill.adjust.card.apply')}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
