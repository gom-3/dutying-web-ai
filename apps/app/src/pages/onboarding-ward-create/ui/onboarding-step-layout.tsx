import {cn} from '@dutying/utils/style';
import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TOnboardingStep} from '../model';
import WizardButton from './wizard-button';

interface IOnboardingStepLayoutProps {
    step: TOnboardingStep;
    onPrev: () => void;
    onNext: () => void;
    onNextDisabledClick?: () => void;
    leftAction?: ReactNode;
    nextDisabled?: boolean;
    actionsDisabled?: boolean;
    hidePrevious?: boolean;
    nextLabel?: string;
    children: ReactNode;
}

function OnboardingStepLayout({
    step,
    onPrev,
    onNext,
    onNextDisabledClick,
    leftAction,
    nextDisabled = false,
    actionsDisabled = false,
    hidePrevious = false,
    nextLabel,
    children,
}: IOnboardingStepLayoutProps) {
    const {t} = useTypedTranslation();

    return (
        <>
            {children}
            <div className="mt-14 flex items-center justify-between">
                {leftAction ?? <div />}
                <div className="flex items-center gap-[42px]">
                    {step > 1 && !hidePrevious ? (
                        <WizardButton variant="secondary" onClick={onPrev} disabled={actionsDisabled}>
                            {t('page.onboardingWardCreate.action.previous')}
                        </WizardButton>
                    ) : null}
                    <WizardButton
                        onClick={() => {
                            if (nextDisabled) {
                                onNextDisabledClick?.();

                                return;
                            }

                            onNext();
                        }}
                        disabled={actionsDisabled}
                        aria-disabled={nextDisabled}
                        className={cn(
                            nextDisabled && 'border-0 bg-[#EFEAFF] text-[#A69BCF] hover:bg-[#EFEAFF] hover:text-[#A69BCF] active:scale-100',
                        )}
                    >
                        {nextLabel ??
                            (step < 5 ? t('page.onboardingWardCreate.action.next') : t('page.onboardingWardCreate.action.complete'))}
                    </WizardButton>
                </div>
            </div>
        </>
    );
}

export default OnboardingStepLayout;
