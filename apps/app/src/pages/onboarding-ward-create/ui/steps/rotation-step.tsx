import {cn} from '@dutying/utils/style';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TOnboardingRotationMode} from '../../model';

interface IRotationStepProps {
    rotationMode: TOnboardingRotationMode;
    onRotationModeChange: (rotationMode: TOnboardingRotationMode) => void;
}

function RotationStep({rotationMode, onRotationModeChange}: IRotationStepProps) {
    const {t} = useTypedTranslation();
    const options = [
        {
            value: 'THREE' as const,
            title: t('page.onboardingWardCreate.rotation.threeTitle'),
            disabled: false,
        },
        {
            value: 'TWO' as const,
            title: t('page.onboardingWardCreate.rotation.twoTitle'),
            disabled: true,
        },
        {
            value: 'MIXED' as const,
            title: t('page.onboardingWardCreate.rotation.mixedTitle'),
            disabled: true,
        },
    ];

    return (
        <fieldset className="rounded-[24px] bg-white p-6">
            <legend className="sr-only">{t('page.onboardingWardCreate.section.rotation.title')}</legend>
            <div className="grid gap-2">
                {options.map((option) => {
                    const selected = rotationMode === option.value;
                    const disabled = option.disabled;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            onClick={disabled ? undefined : () => onRotationModeChange(option.value)}
                            className={cn(
                                'group flex min-h-14 w-full items-center gap-3 rounded-[14px] bg-gray-7 px-4 py-3.5 text-left text-sub-1 transition-colors outline-none',
                                disabled
                                    ? 'cursor-not-allowed text-gray-4 opacity-70'
                                    : 'hover:bg-gray-6/50 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none',
                                selected && !disabled && 'bg-main-light text-main-1 hover:bg-main-light',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-6 transition-colors',
                                    disabled ? 'bg-gray-6' : 'group-hover:bg-gray-5 group-focus-visible:bg-main-1',
                                    selected && !disabled && 'bg-main-1 group-hover:bg-main-1 group-focus-visible:bg-main-1',
                                    selected && disabled && 'bg-gray-4',
                                )}
                            >
                                <span className={cn('size-2 rounded-full bg-transparent', selected && 'bg-white')} />
                            </span>
                            <span className="min-w-0 flex-1 font-apple text-[15px] leading-5 font-semibold">{option.title}</span>
                            {disabled ? (
                                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-apple text-[11px] font-semibold text-gray-4">
                                    {t('page.dutying.comingSoon')}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

export default RotationStep;
