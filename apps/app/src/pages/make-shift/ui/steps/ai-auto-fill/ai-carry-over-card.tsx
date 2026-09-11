import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    candidates: TScheduleMonthRequestRes[];
    isApplying: boolean;
    onApply: (requestIds: number[]) => void;
    onSkip: () => void;
};

/**
 * 다음 달 첫 진입 시 되묻기. 지난달의 "이번 달만" 요청을 골라 이번 달로 복사한다.
 * 전부 미선택으로 시작한다 — 기본 선택이면 지난달 사정이 확인 없이 이번 달로 새어 들어온다.
 */
export default function AiCarryOverCard({candidates, isApplying, onApply, onSkip}: TProps) {
    const {t} = useTypedTranslation();
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const toggle = (id: number, on: boolean) => {
        setSelected((current) => {
            const next = new Set(current);

            if (on) next.add(id);
            else next.delete(id);

            return next;
        });
    };
    const canApply = selected.size > 0 && !isApplying;

    return (
        <section
            aria-label={t('page.makeShift.aiRefill.adjust.carryOver.title')}
            data-preserve-duty-selection="true"
            className="ai-carry-over-card border-line bg-sub-bg mx-4 my-2 flex flex-col gap-2 rounded-lg border px-3 py-2"
        >
            <h3 className="text-13 font-semibold">{t('page.makeShift.aiRefill.adjust.carryOver.title')}</h3>
            <p className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.carryOver.description')}</p>

            <ul className="flex flex-col gap-1">
                {candidates.map((candidate) => {
                    const isSelected = selected.has(candidate.id);

                    return (
                        <li key={candidate.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-13">{candidate.displayLabel}</span>
                            <div role="group" aria-label={candidate.displayLabel} className="flex gap-1">
                                <button
                                    type="button"
                                    aria-pressed={isSelected}
                                    disabled={isApplying}
                                    onClick={() => toggle(candidate.id, true)}
                                    className={cn(
                                        'text-12 rounded-full border px-2 py-0.5 transition-colors',
                                        isSelected
                                            ? 'border-primary bg-primary/10 font-semibold text-primary'
                                            : 'border-line text-sub hover:bg-white',
                                    )}
                                >
                                    {t('page.makeShift.aiRefill.adjust.carryOver.yes')}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={!isSelected}
                                    disabled={isApplying}
                                    onClick={() => toggle(candidate.id, false)}
                                    className={cn(
                                        'text-12 rounded-full border px-2 py-0.5 transition-colors',
                                        !isSelected
                                            ? 'border-primary bg-primary/10 font-semibold text-primary'
                                            : 'border-line text-sub hover:bg-white',
                                    )}
                                >
                                    {t('page.makeShift.aiRefill.adjust.carryOver.no')}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    disabled={isApplying}
                    onClick={onSkip}
                    className="text-13 border-line text-sub rounded-full border px-3 py-1 transition-colors hover:bg-white disabled:opacity-50"
                >
                    {t('page.makeShift.aiRefill.adjust.carryOver.skip')}
                </button>
                <button
                    type="button"
                    disabled={!canApply}
                    onClick={() => onApply([...selected])}
                    className={cn(
                        'text-13 rounded-full bg-primary px-3 py-1 font-semibold text-white transition-colors',
                        !canApply && 'cursor-not-allowed opacity-50',
                    )}
                >
                    {t('page.makeShift.aiRefill.adjust.carryOver.apply')}
                </button>
            </div>
        </section>
    );
}
