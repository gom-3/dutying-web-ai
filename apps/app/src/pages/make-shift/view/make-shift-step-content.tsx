import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {renderMultilineText} from '@/shared/util/string';
import {ManagementActionButton} from '@/widgets/duty-management/ui';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {MAKE_SHIFT_STEP_CONFIG} from './make-shift-step-config';

type TMakeShiftStepContentProps = {
    currentStep: TMakeShiftStep;
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
};

export function MakeShiftStepContent({currentStep, canPrev, canNext, onPrev, onNext}: TMakeShiftStepContentProps) {
    const {t} = useTypedTranslation();
    const stepConfig = MAKE_SHIFT_STEP_CONFIG[currentStep];
    const StepComponent = stepConfig.Component;

    if (stepConfig.layout === 'wide') {
        return (
            <div className="flex flex-1 flex-col px-10 pt-[42px] pb-10">
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        );
    }

    const intro = stepConfig.intro;

    return (
        <div className="flex flex-1 gap-10 pt-[42px] pl-[59px]">
            <div className="w-[440px] shrink-0">
                <p className="font-apple text-[32px] font-semibold text-sub-1">{intro ? t(intro.titleKey) : ''}</p>
                <div className="mt-6 font-apple text-xl leading-[1.72] font-medium text-gray-3">
                    {intro ? renderMultilineText(t(intro.descriptionKey)) : null}
                </div>

                <div className="mt-[82px] flex items-center gap-8">
                    <ManagementActionButton variant="neutral" size="sm" onClick={onPrev} disabled={!canPrev}>
                        {t('page.makeShift.navigation.previous')}
                    </ManagementActionButton>
                    <ManagementActionButton size="sm" onClick={onNext} disabled={!canNext}>
                        {t('page.makeShift.navigation.next')}
                    </ManagementActionButton>
                </div>
            </div>

            <div className="min-w-0 flex-1">
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        </div>
    );
}
