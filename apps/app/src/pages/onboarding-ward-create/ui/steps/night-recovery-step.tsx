import {cn} from '@dutying/utils/style';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TTwoShiftNightRecoveryDisplay} from '../../model';

interface INightRecoveryStepProps {
    value: TTwoShiftNightRecoveryDisplay | null;
    onChange: (display: TTwoShiftNightRecoveryDisplay) => void;
}

function ShiftChip({children, emphasis = false}: {children: string; emphasis?: boolean}) {
    return (
        <span
            className={cn(
                'inline-flex min-h-8 items-center justify-center rounded-[10px] px-3 py-1.5 font-apple text-[13px] leading-5 font-semibold whitespace-nowrap',
                emphasis ? 'bg-main-light text-main-1' : 'text-gray-2 bg-white',
            )}
        >
            {children}
        </span>
    );
}

function NightRecoveryStep({value, onChange}: INightRecoveryStepProps) {
    const {t} = useTypedTranslation();
    const options = [
        {
            value: 'NIGHT_CONTINUATION' as const,
            title: t('page.onboardingWardCreate.rotation.nightContinuationTitle'),
            middleShift: t('page.onboardingWardCreate.rotation.nightContinuationExampleShift'),
            description: t('page.onboardingWardCreate.rotation.nightContinuationDescription'),
        },
        {
            value: 'OFF' as const,
            title: t('page.onboardingWardCreate.rotation.offRecoveryTitle'),
            middleShift: t('page.onboardingWardCreate.rotation.offRecoveryExampleShift'),
            description: t('page.onboardingWardCreate.rotation.offRecoveryDescription'),
        },
    ];

    return (
        <fieldset>
            <legend className="sr-only">{t('page.onboardingWardCreate.rotation.nightRecoveryQuestion')}</legend>
            <div className="grid gap-4">
                {options.map((option) => {
                    const selected = value === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(option.value)}
                            className={cn(
                                'group w-full rounded-[20px] bg-white p-5 text-left transition-colors outline-none hover:bg-gray-7 focus-visible:bg-main-light sm:p-6',
                                selected && 'bg-main-light hover:bg-main-light',
                            )}
                        >
                            <span className="flex items-start gap-3">
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-6 transition-colors group-hover:bg-gray-5',
                                        'group-focus-visible:bg-main-1',
                                        selected && 'bg-main-1 group-hover:bg-main-1',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-2 rounded-full bg-transparent group-focus-visible:bg-white',
                                            selected && 'bg-white',
                                        )}
                                    />
                                </span>
                                <span className="grid min-w-0 flex-1 gap-4">
                                    <span
                                        className={cn(
                                            'text-gray-1 font-apple text-[16px] leading-6 font-semibold group-focus-visible:text-main-1',
                                            selected && 'text-main-1',
                                        )}
                                    >
                                        {option.title}
                                    </span>
                                    <span className="flex flex-wrap items-center gap-2" aria-hidden="true">
                                        <ShiftChip>{t('page.onboardingWardCreate.rotation.nightExampleShift')}</ShiftChip>
                                        <span className="text-[16px] text-gray-4">→</span>
                                        <ShiftChip emphasis={option.value === 'NIGHT_CONTINUATION'}>{option.middleShift}</ShiftChip>
                                        <span className="text-[16px] text-gray-4">→</span>
                                        <ShiftChip>{t('page.onboardingWardCreate.rotation.offExampleShift')}</ShiftChip>
                                    </span>
                                    <span className="font-apple text-[14px] leading-6 text-gray-3">{option.description}</span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

export default NightRecoveryStep;
