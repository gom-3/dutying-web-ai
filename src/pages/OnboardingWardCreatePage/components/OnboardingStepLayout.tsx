import type {ReactNode} from 'react';
import type {TOnboardingStep} from '../model';
import WizardButton from './WizardButton';

interface IOnboardingStepLayoutProps {
    step: TOnboardingStep;
    onSkip: () => void;
    onPrev: () => void;
    onNext: () => void;
    children: ReactNode;
}

function OnboardingStepLayout({step, onSkip, onPrev, onNext, children}: IOnboardingStepLayoutProps) {
    return (
        <>
            {children}
            <div className="mt-14 flex items-center justify-between">
                <WizardButton variant="link" onClick={onSkip}>
                    건너뛰기
                </WizardButton>
                <div className="flex items-center gap-[42px]">
                    {step > 1 ? (
                        <WizardButton variant="secondary" onClick={onPrev}>
                            이전
                        </WizardButton>
                    ) : null}
                    <WizardButton onClick={onNext}>{step < 4 ? '다음' : '완료'}</WizardButton>
                </div>
            </div>
        </>
    );
}

export default OnboardingStepLayout;
