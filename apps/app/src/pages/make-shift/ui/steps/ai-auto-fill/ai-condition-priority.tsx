import {useId} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TPriority = 'SOFT' | 'HARD';
type TProps = {
    name: string;
    value: TPriority;
    disabled: boolean;
    onChange: (value: TPriority) => void;
};

export function AiConditionPriority({name, value, disabled, onChange}: TProps) {
    const {t} = useTypedTranslation();
    const id = useId();

    return (
        <fieldset className="mt-2.5 min-w-0" disabled={disabled}>
            <legend className="sr-only">{t('aiAutofillUi.semanticReview.priority')}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-7 p-1">
                {(['SOFT', 'HARD'] as const).map((option) => (
                    <label key={option} className={`min-w-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                            type="radio"
                            className="peer sr-only forced-colors:not-sr-only"
                            name={name}
                            value={option}
                            checked={value === option}
                            aria-describedby={`${id}-${option}`}
                            onChange={() => onChange(option)}
                        />
                        <span className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center text-[13px] leading-5 font-medium break-keep text-sub-2 transition-colors peer-checked:bg-main-light peer-checked:font-semibold peer-checked:text-main-1 peer-focus-visible:bg-[#4620B8] peer-focus-visible:font-bold peer-focus-visible:text-white peer-focus-visible:underline peer-disabled:opacity-40 hover:bg-main-light motion-reduce:transition-none forced-colors:peer-focus-visible:outline">
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 16 16"
                                className={`size-3.5 shrink-0 ${value === option ? '' : 'invisible'}`}
                                fill="currentColor"
                            >
                                <path d="m6.2 11.8-4-4L3.6 6.4 6.2 9l6.2-6.2 1.4 1.4z" />
                            </svg>
                            {t(
                                option === 'HARD'
                                    ? 'aiAutofillUi.conversationConfirmation.required'
                                    : 'aiAutofillUi.semanticReview.preferred',
                            )}
                        </span>
                    </label>
                ))}
            </div>
            {(['SOFT', 'HARD'] as const).map((option) => (
                <span key={option} id={`${id}-${option}`} className="sr-only">
                    {t(
                        option === 'HARD'
                            ? 'aiAutofillUi.semanticReview.aResultThatMissesThisConditionCannotBeApplied'
                            : 'aiAutofillUi.semanticReview.weTryToMeetThisPreferenceOtherConditionsMayPreventIt',
                    )}
                </span>
            ))}
        </fieldset>
    );
}
