import type {
    TScheduleAdjustInterpretRes,
    TScheduleMonthRequestItem,
    TScheduleMonthRequestLifetime,
    TScheduleMonthRequestSeverity,
} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useImperativeHandle, useState, type Ref} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';

const MAX_TEXT_LENGTH = 500;

export type TAdjustTextInputHandle = {
    /** 예시 문장이나 대안 문장을 입력창에 채운다. 실행은 사용자가 "조절"을 눌러야 일어난다. */
    fill: (sentence: string) => void;
};

type TProps = {
    disabled: boolean;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: (items: TInterpretCardItem[], requestText: string) => void;
    ref?: Ref<TAdjustTextInputHandle>;
};

type TCard = {
    requestText: string;
    items: TInterpretCardItem[];
    unmapped: TScheduleAdjustInterpretRes['unmapped'];
};

function toCardItems(items: TScheduleMonthRequestItem[]): TInterpretCardItem[] {
    // 기본 수명은 언제나 MONTH. lifetimeHint 는 배지 옆 보조 표시일 뿐이다 —
    // "이번 달만"이 다음 달로 새는 쪽이 훨씬 나쁜 실패라서 기본값을 해석에 맡기지 않는다.
    return items.map((item) => ({item, lifetime: 'MONTH', severity: item.severity ?? 'SOFT'}));
}

/**
 * 칩 아래의 문장 입력. 문장은 서버가 축 또는 이번 달 규칙으로 해석하고, 사용자는 카드에서
 * 확인한 뒤 적용한다. 카드가 떠 있는 동안 입력창은 잠근다 — 해석과 적용이 다른 문장을
 * 가리키는 순간을 만들지 않기 위해서다.
 *
 * 되묻기는 대화형이 아니다. 해석하지 못한 조각은 **그대로 다시 보낼 수 있는 완성 문장**으로
 * 돌아오고, 사용자가 그것을 눌러 입력창에 채운 뒤 고쳐서 보낸다. 질문에 답하는 UI 를 두면
 * 조절이 대화가 되고, 그 순간 칩보다 느려진다.
 */
export default function AiAdjustTextInput({disabled, interpret, onApply, ref}: TProps) {
    const {t} = useTypedTranslation();
    const [text, setText] = useState('');
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [card, setCard] = useState<TCard | null>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        fill: (sentence: string) => {
            setCard(null);
            setError(null);
            setText(sentence.slice(0, MAX_TEXT_LENGTH));
        },
    }));

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
    const handleSeverityChange = (index: number, severity: TScheduleMonthRequestSeverity) => {
        setCard((current) =>
            current ? {...current, items: current.items.map((entry, i) => (i === index ? {...entry, severity} : entry))} : current,
        );
    };
    const handleApply = () => {
        if (!card) return;

        onApply(card.items, card.requestText);
        setCard(null);
        setText('');
    };
    const handleCancel = () => setCard(null);
    const handleUseSuggestion = (sentence: string) => {
        setCard(null);
        setText(sentence.slice(0, MAX_TEXT_LENGTH));
    };
    const applicableCount = card?.items.length ?? 0;

    return (
        <div className="ai-adjust-text-input flex flex-col gap-2 px-4 pb-2" data-preserve-duty-selection="true">
            <p className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.inputHint')}</p>

            <div className="flex items-start gap-2">
                <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
                    onKeyDown={(event) => {
                        // 에디터 루트의 셀 키 바인딩(Backspace·방향키·근무키)으로 새지 않게 막는다.
                        event.stopPropagation();

                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void handleSubmit();
                        }
                    }}
                    onPaste={(event) => event.stopPropagation()}
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

                    {card.items.length > 0 && (
                        <ul className="flex flex-col gap-1">
                            {card.items.map(({item, lifetime, severity}, index) => (
                                <li
                                    key={`${item.kind}:${item.knob ?? item.templateCode ?? index}:${index}`}
                                    className="flex flex-wrap items-center gap-2"
                                >
                                    <span className="text-13">{item.displayLabel ?? item.knob ?? item.templateCode}</span>

                                    {item.kind === 'RULE' ? (
                                        <>
                                            <span className="text-12 text-sub border-line rounded-full border px-2 py-0.5">
                                                {t('page.makeShift.aiRefill.adjust.monthRuleBadge')}
                                            </span>
                                            <select
                                                value={severity}
                                                aria-label={t('page.makeShift.aiRefill.adjust.severity.label', {
                                                    label: item.displayLabel ?? item.templateCode ?? '',
                                                })}
                                                onChange={(event) =>
                                                    handleSeverityChange(index, event.target.value as TScheduleMonthRequestSeverity)
                                                }
                                                className="text-12 border-line rounded-full border bg-white px-2 py-0.5"
                                            >
                                                <option value="SOFT">{t('page.makeShift.aiRefill.adjust.severity.SOFT')}</option>
                                                <option value="HARD">{t('page.makeShift.aiRefill.adjust.severity.HARD')}</option>
                                            </select>
                                        </>
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
                        <ul className="flex flex-col gap-1">
                            {card.unmapped.map((entry, index) => (
                                <li key={`${entry.text}:${index}`} className="text-12 text-sub flex flex-col gap-0.5">
                                    {/* 취소선을 쓰지 않는다. 사용자의 말이 틀린 것이 아니라 아직 못 하는 것이고, */}
                                    {/* 다음 행동은 문장을 고쳐 다시 보내는 것이다. */}
                                    <span>{entry.hint ?? entry.text}</span>
                                    {entry.hint && (
                                        <button
                                            type="button"
                                            onClick={() => handleUseSuggestion(suggestionOf(entry.hint ?? ''))}
                                            className="text-12 self-start text-primary underline"
                                        >
                                            {t('page.makeShift.aiRefill.adjust.useSuggestion')}
                                        </button>
                                    )}
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

/**
 * hint 에서 다시 보낼 문장만 꺼낸다.
 *
 * 해석기는 "그건 아직 안 돼요. 이렇게 써 보세요: 주말 근무는 사람마다 3번 이하로" 꼴로
 * 돌려준다. 앞의 설명까지 입력창에 넣으면 그것을 다시 해석하게 되므로 콜론 뒤만 쓴다.
 * 콜론이 없으면 hint 전체를 쓴다 — 빈 입력창보다는 낫다.
 */
function suggestionOf(hint: string): string {
    const separator = hint.lastIndexOf(':');

    return separator >= 0 ? hint.slice(separator + 1).trim() : hint.trim();
}
