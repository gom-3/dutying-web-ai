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
        },
        {
            value: 'TWO' as const,
            title: t('page.onboardingWardCreate.rotation.twoTitle'),
        },
        {
            value: 'MIXED' as const,
            title: t('page.onboardingWardCreate.rotation.mixedTitle'),
        },
    ];

    return (
        <fieldset className="rounded-[24px] bg-white p-6">
            <legend className="sr-only">{t('page.onboardingWardCreate.section.rotation.title')}</legend>
            <div className="grid gap-2">
                {options.map((option) => {
                    const selected = rotationMode === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onRotationModeChange(option.value)}
                            className={cn(
                                'group flex min-h-14 w-full items-center gap-3 rounded-[14px] bg-gray-7 px-4 py-3.5 text-left text-sub-1 transition-colors outline-none hover:bg-gray-6/50 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none',
                                selected && 'bg-main-light text-main-1 hover:bg-main-light',
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-6 transition-colors group-hover:bg-gray-5 group-focus-visible:bg-main-1',
                                    selected && 'bg-main-1 group-hover:bg-main-1 group-focus-visible:bg-main-1',
                                )}
                            >
                                <span className={cn('size-2 rounded-full bg-transparent', selected && 'bg-white')} />
                            </span>
                            <span className="min-w-0 font-apple text-[15px] leading-5 font-semibold">{option.title}</span>
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

export default RotationStep;
