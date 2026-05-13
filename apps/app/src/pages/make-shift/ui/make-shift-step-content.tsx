import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {renderMultilineText} from '@/shared/util/string';
import Button from '@/shared/ui/form-controls/Button';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {MAKE_SHIFT_STEP_CONFIG} from './make-shift-step-config';
import {MAKE_SHIFT_STEP_NAV_BUTTON_CLASS} from './make-shift-step-nav';

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
        // 3탭(신청 근무): 헤더만 있고 자식 루트에 pt가 없어 스텝퍼와의 간격을 래퍼에서 준다. 4·5탭은 자식이 이미 상단 여백을 둔다.
        const widePtClass = currentStep === 3 ? 'pt-[clamp(12px,1.25vw,28px)]' : '';

        return (
            <div
                className={`make-shift-step-content make-shift-step-content--wide flex w-full min-w-0 flex-1 flex-col pb-[clamp(12px,1.2vw,24px)] ${widePtClass}`}
            >
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        );
    }

    const intro = stepConfig.intro;

    return (
        // narrow layout(근무자 확인 / 제약 조건 등): 좌측 intro + 우측 step 본문.
        <div className="make-shift-step-content make-shift-step-content--narrow flex w-full min-w-0 flex-1 gap-[clamp(20px,2.0vw,40px)] pt-[clamp(12px,1.25vw,28px)] pb-[clamp(12px,1.2vw,24px)]">
            <div className="make-shift-step-content__intro w-[clamp(280px,30vw,440px)] shrink-0">
                <p className="make-shift-step-content__intro-title font-apple text-[clamp(20px,1.7vw,30px)] font-semibold text-sub-1">
                    {intro ? t(intro.titleKey) : ''}
                </p>
                <div className="make-shift-step-content__intro-description mt-[clamp(12px,1.2vw,24px)] font-apple text-[clamp(13px,1.1vw,20px)] leading-[1.72] font-medium text-gray-3">
                    {intro ? renderMultilineText(t(intro.descriptionKey)) : null}
                </div>

                <div className="make-shift-step-content__intro-actions mt-[clamp(28px,4.2vw,82px)] flex items-center gap-[clamp(12px,1.1vw,24px)]">
                    {currentStep > 1 && (
                        <Button
                            variant="secondary"
                            size="md"
                            type="button"
                            onClick={onPrev}
                            disabled={!canPrev}
                            className={`cursor-pointer disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                        >
                            {t('page.makeShift.navigation.previous')}
                        </Button>
                    )}
                    <Button
                        size="md"
                        type="button"
                        onClick={onNext}
                        disabled={!canNext}
                        className={`cursor-pointer border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                    >
                        {t('page.makeShift.navigation.next')}
                    </Button>
                </div>
            </div>

            <div className="make-shift-step-content__main min-w-0 flex-1">
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        </div>
    );
}
