import type {TAutofillAdjustKnob, TAutofillAdjustStrength} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

export type TAdjustKnobs = Partial<Record<TAutofillAdjustKnob, number>>;

type TChip = {
    key: string;
    knob: TAutofillAdjustKnob;
    /** 누르면 켜지는 값. 같은 값이 이미 켜져 있으면 끈다(0으로). */
    value: number;
    labelKey: 'offBalance' | 'clusterOn' | 'clusterOff' | 'seniorityMix';
};

/**
 * 뭉치기와 흩기는 한 축의 양 끝이라 상호배타다. 둘을 동시에 켜는 상태는 의미가 없고,
 * 사용자가 그렇게 눌렀을 때 무엇이 이겼는지 화면으로 설명할 방법도 없다.
 */
const CHIPS: TChip[] = [
    {key: 'offBalance', knob: 'OFF_BALANCE', value: 1, labelKey: 'offBalance'},
    {key: 'clusterOn', knob: 'CLUSTERING', value: 1, labelKey: 'clusterOn'},
    {key: 'clusterOff', knob: 'CLUSTERING', value: -1, labelKey: 'clusterOff'},
    {key: 'seniorityMix', knob: 'SENIORITY_MIX', value: 1, labelKey: 'seniorityMix'},
];

type TProps = {
    knobs: TAdjustKnobs;
    strength: TAutofillAdjustStrength;
    disabled: boolean;
    lastChangedCount: number | null;
    onToggle: (knob: TAutofillAdjustKnob, value: number) => void;
};

/**
 * 자동완성 결과 아래에 붙는 조절 칩.
 *
 * 칩은 토글이며, 켜진 칩들의 합이 지금 걸린 조절이다. 누를 때마다 그 상태로 다시 푼다 —
 * "적용" 버튼을 따로 두면 무엇이 반영된 상태인지 화면과 어긋나는 순간이 생긴다.
 */
export default function AiAdjustChipBar({knobs, strength, disabled, lastChangedCount, onToggle}: TProps) {
    const {t} = useTypedTranslation();

    return (
        <div className="ai-adjust-chip-bar flex flex-wrap items-center gap-2 px-4 py-2" data-preserve-duty-selection="true">
            <span className="text-12 text-sub shrink-0">{t('page.makeShift.aiRefill.adjust.title')}</span>

            {CHIPS.map((chip) => {
                const active = knobs[chip.knob] === chip.value;

                return (
                    <button
                        key={chip.key}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        onClick={() => onToggle(chip.knob, chip.value)}
                        className={cn(
                            'text-13 rounded-full border px-3 py-1 transition-colors',
                            active ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-line text-sub hover:bg-sub-bg',
                            disabled && 'cursor-not-allowed opacity-50',
                        )}
                    >
                        {t(`page.makeShift.aiRefill.adjust.${chip.labelKey}`)}
                    </button>
                );
            })}

            {lastChangedCount !== null && (
                <span className="text-12 text-sub ml-auto shrink-0">
                    {lastChangedCount > 0
                        ? t('page.makeShift.aiRefill.adjust.applied', {count: lastChangedCount})
                        : t('page.makeShift.aiRefill.adjust.noChange')}
                </span>
            )}

            <span className="sr-only">{strength}</span>
        </div>
    );
}
