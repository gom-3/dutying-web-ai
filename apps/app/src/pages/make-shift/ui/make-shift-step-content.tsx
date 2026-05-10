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
    /** 스텝 1·2·3: wide 래퍼에서도 상단 여백을 narrow와 맞추기 위해 pt를 한 단계 키움(스텝 4·5는 기존 유지). */
    const roomierTopForEarlySteps = currentStep <= 3;
    const wideTopPadding = roomierTopForEarlySteps ? 'pt-[clamp(16px,1.6vw,32px)]' : 'pt-[clamp(8px,0.8vw,16px)]';

    if (stepConfig.layout === 'wide') {
        return (
            // wide layout(신청 근무 확정 / 고정 근무 / AI 자동 채우기 등): 자식이 자체적으로 상단 패딩(pt)을 가질 수 있어
            // 여기서는 stepper와 사이의 최소 여백, 페이지 하단의 최소 여백만 화면 폭에 비례해 둔다.
            <div
                className={`make-shift-step-content make-shift-step-content--wide flex w-full min-w-0 flex-1 flex-col ${wideTopPadding} pb-[clamp(12px,1.2vw,24px)]`}
            >
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        );
    }

    const intro = stepConfig.intro;

    return (
        // narrow layout(근무자 확인 / 제약 조건 / 신청 근무 확정 등): 좌측 intro + 우측 step 본문.
        // 상단은 wide와 동일한 pt 한 번 + intro 타이틀 기준 같은 간격을 한 번 더 (pt 합 ≈ clamp(16px,1.6vw,32px)).
        <div className="make-shift-step-content make-shift-step-content--narrow flex w-full min-w-0 flex-1 gap-[clamp(20px,2.0vw,40px)] pt-[clamp(16px,1.6vw,32px)] pb-[clamp(12px,1.2vw,24px)]">
            <div className="make-shift-step-content__intro w-[clamp(280px,30vw,440px)] shrink-0">
                <p className="make-shift-step-content__intro-title font-apple text-[clamp(20px,1.7vw,30px)] font-semibold text-sub-1">
                    {intro ? t(intro.titleKey) : ''}
                </p>
                <div className="make-shift-step-content__intro-description mt-[clamp(12px,1.2vw,24px)] font-apple text-[clamp(13px,1.1vw,20px)] leading-[1.72] font-medium text-gray-3">
                    {intro ? renderMultilineText(t(intro.descriptionKey)) : null}
                </div>

                <div className="make-shift-step-content__intro-actions mt-[clamp(28px,4.2vw,82px)] flex items-center gap-[clamp(12px,1.6vw,32px)]">
                    <ManagementActionButton variant="neutral" size="sm" onClick={onPrev} disabled={!canPrev}>
                        {t('page.makeShift.navigation.previous')}
                    </ManagementActionButton>
                    <ManagementActionButton size="sm" onClick={onNext} disabled={!canNext}>
                        {t('page.makeShift.navigation.next')}
                    </ManagementActionButton>
                </div>
            </div>

            <div className="make-shift-step-content__main min-w-0 flex-1">
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        </div>
    );
}
