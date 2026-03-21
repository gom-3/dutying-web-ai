import type {ReactNode} from 'react';
import type {TOnboardingStep} from '../model';
import WizardButton from './WizardButton';

interface IOnboardingStepLayoutProps {
    step: TOnboardingStep;
    onSkip: () => void;
    onPrev: () => void;
    onNext: () => void;
    nextDisabled?: boolean;
    actionsDisabled?: boolean;
    nextLabel?: string;
    children: ReactNode;
}

function OnboardingStepLayout({
    step,
    onSkip,
    onPrev,
    onNext,
    nextDisabled = false,
    actionsDisabled = false,
    nextLabel,
    children,
}: IOnboardingStepLayoutProps) {
    return (
        <>
            {children}
            <div className="mt-14 flex items-center justify-between">
                <WizardButton variant="link" onClick={onSkip} disabled={actionsDisabled}>
                    건너뛰기
                </WizardButton>
                <div className="flex items-center gap-[42px]">
                    {step > 1 ? (
                        <WizardButton variant="secondary" onClick={onPrev} disabled={actionsDisabled}>
                            이전
                        </WizardButton>
                    ) : null}
                    <WizardButton onClick={onNext} disabled={nextDisabled}>
                        {nextLabel ?? (step < 4 ? '다음' : '완료')}
                    </WizardButton>
                </div>
            </div>
        </>
    );
}

export default OnboardingStepLayout;
