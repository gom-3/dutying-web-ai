import {cn} from '@dutying/utils/style';
import {useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

/**
 * 예시 문장 목록. 누르면 **입력창에 채워질 뿐** 바로 실행되지 않는다.
 *
 * 칩(즉시 토글)을 없애고 이것으로 대체했다. 칩의 문제는 문구가 아니라 구조였다 —
 * "근무 뭉치기"는 엔진 용어(work run)를 그대로 노출한 것이고, 그 뜻을 한 단어로 담을
 * 한국어가 없다. 무엇보다 칩은 고칠 수 없다. 수간호사가 원하는 것은 "데이는 4일
 * 연속까지만"처럼 숫자와 근무가 들어간 문장이고, 예시는 그 문장의 출발점이어야 한다.
 *
 * 첫 줄에는 모양·연속·회복·사람을 하나씩 놓고 나머지는 접는다. 전부 펼쳐 두면 목록이
 * 입력창보다 길어져 "쓰는 화면"이 아니라 "고르는 화면"이 된다.
 */
const PRIMARY_KEYS = ['clusterOn', 'clusterOff', 'maxConsecutiveDay', 'offAfterNight', 'nurseAvoidShift'] as const;
const MORE_KEYS = [
    'offBalance',
    'seniorityMix',
    'maxConsecutiveNight',
    'maxConsecutiveWork',
    'noIsolatedOff',
    'forbidNightThenDay',
    'forbidEveningThenDay',
    'monthlyNightCap',
    'weekendCap',
    'nurseForbidWeekend',
    'pairNotSameShift',
    'combined',
] as const;

type TExampleKey = (typeof PRIMARY_KEYS)[number] | (typeof MORE_KEYS)[number];

type TProps = {
    disabled: boolean;
    /** 문장을 입력창에 채운다. 실행은 사용자가 "조절"을 눌러야 일어난다. */
    onPick: (sentence: string) => void;
};

export default function AiAdjustExamples({disabled, onPick}: TProps) {
    const {t} = useTypedTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const keys: TExampleKey[] = isExpanded ? [...PRIMARY_KEYS, ...MORE_KEYS] : [...PRIMARY_KEYS];

    return (
        <div className="ai-adjust-examples flex flex-wrap items-center gap-2 px-4 py-2" data-preserve-duty-selection="true">
            <span className="text-12 text-sub shrink-0">{t('page.makeShift.aiRefill.adjust.title')}</span>

            {keys.map((key) => {
                const sentence = t(`page.makeShift.aiRefill.adjust.examples.${key}`);

                return (
                    <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(sentence)}
                        className={cn(
                            'text-13 border-line text-sub hover:bg-sub-bg rounded-full border px-3 py-1 transition-colors',
                            disabled && 'cursor-not-allowed opacity-50',
                        )}
                    >
                        {sentence}
                    </button>
                );
            })}

            <button type="button" onClick={() => setIsExpanded((current) => !current)} className="text-12 text-sub shrink-0 underline">
                {t(isExpanded ? 'page.makeShift.aiRefill.adjust.examplesLess' : 'page.makeShift.aiRefill.adjust.examplesMore')}
            </button>
        </div>
    );
}
