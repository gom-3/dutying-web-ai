import {cn} from '@dutying/utils/style';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TTwoShiftNightRecoveryDisplay} from '../../model';

interface INightRecoveryStepProps {
    value: TTwoShiftNightRecoveryDisplay | null;
    onChange: (display: TTwoShiftNightRecoveryDisplay) => void;
}

function ShiftChip({children, emphasis = false, exampleLabel}: {children: string; emphasis?: boolean; exampleLabel?: string}) {
    return (
        <span
            className={cn(
                'inline-flex min-h-8 items-center justify-center gap-1 rounded-[10px] px-2.5 py-1.5 font-apple text-[12px] leading-5 font-semibold whitespace-nowrap transition-colors sm:px-3 sm:text-[13px]',
                emphasis ? 'bg-[#FFF3C4] text-[#6F4D00]' : 'text-gray-2 bg-gray-7 group-hover:bg-white group-focus-visible:bg-white',
            )}
        >
            {exampleLabel ? (
                <>
                    <span className="text-[9px] leading-3 font-bold text-[#8A6200] sm:text-[10px]">{exampleLabel} ·</span>
                    <span>{children}</span>
                </>
            ) : (
                children
            )}
        </span>
    );
}

interface IExampleStep {
    date: string;
    shift: string;
    emphasis?: boolean;
    exampleLabel?: string;
}

function RecoveryExample({steps}: {steps: IExampleStep[]}) {
    return (
        <span
            className={cn(
                'grid w-full max-w-[440px] items-end gap-x-1 sm:gap-x-1.5',
                steps.length === 3
                    ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]'
                    : 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
            )}
            aria-hidden="true"
        >
            {steps.map((step, index) => (
                <span key={`${step.date}-${step.shift}`} className="contents">
                    <span className="flex min-w-0 flex-col items-center gap-2">
                        <span className="font-apple text-[12px] leading-4 font-medium whitespace-nowrap text-gray-4">{step.date}</span>
                        <ShiftChip emphasis={step.emphasis} exampleLabel={step.exampleLabel}>
                            {step.shift}
                        </ShiftChip>
                    </span>
                    {index < steps.length - 1 ? <span className="mb-2 text-center text-[14px] text-gray-4 sm:text-[16px]">→</span> : null}
                </span>
            ))}
        </span>
    );
}

function NightRecoveryStep({value, onChange}: INightRecoveryStepProps) {
    const {t} = useTypedTranslation();
    const nightShift = t('page.onboardingWardCreate.rotation.nightExampleShift');
    const offShift = t('page.onboardingWardCreate.rotation.offExampleShift');
    const firstDate = t('page.onboardingWardCreate.rotation.exampleFirstDate');
    const secondDate = t('page.onboardingWardCreate.rotation.exampleSecondDate');
    const thirdDate = t('page.onboardingWardCreate.rotation.exampleThirdDate');
    const options = [
        {
            value: 'NIGHT_CONTINUATION' as const,
            title: t('page.onboardingWardCreate.rotation.nightContinuationTitle'),
            description: t('page.onboardingWardCreate.rotation.nightContinuationDescription'),
            exampleSteps: [
                {date: firstDate, shift: nightShift},
                {
                    date: secondDate,
                    shift: t('page.onboardingWardCreate.rotation.nightContinuationExampleShift'),
                    emphasis: true,
                    exampleLabel: t('page.onboardingWardCreate.rotation.exampleLabel'),
                },
                {date: thirdDate, shift: offShift},
            ],
        },
        {
            value: 'OFF' as const,
            title: t('page.onboardingWardCreate.rotation.offRecoveryTitle'),
            description: t('page.onboardingWardCreate.rotation.offRecoveryDescription'),
            exampleSteps: [
                {date: firstDate, shift: nightShift},
                {
                    date: secondDate,
                    shift: t('page.onboardingWardCreate.rotation.offRecoveryExampleShift'),
                    emphasis: true,
                },
                {date: thirdDate, shift: offShift},
            ],
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
                                'group w-full rounded-[20px] bg-white p-4 text-left transition-colors outline-none hover:bg-gray-7 focus-visible:bg-main-light sm:p-6',
                                selected && 'bg-main-light hover:bg-main-light',
                            )}
                        >
                            <span className="grid w-full min-w-0 gap-4">
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
                                    <span
                                        className={cn(
                                            'text-gray-1 min-w-0 font-apple text-[16px] leading-6 font-semibold group-focus-visible:text-main-1',
                                            selected && 'text-main-1',
                                        )}
                                    >
                                        {option.title}
                                    </span>
                                </span>
                                <span className="grid min-w-0 gap-4 sm:pl-8">
                                    <RecoveryExample steps={option.exampleSteps} />
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
