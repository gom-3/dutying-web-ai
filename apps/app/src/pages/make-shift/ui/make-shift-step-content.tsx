import {BouncingDots} from '@/components/loading-ui/bouncing-dots';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import {MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT} from '../model/make-shift-events';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {MAKE_SHIFT_STEP_CONFIG} from './make-shift-step-config';
import {
    MAKE_SHIFT_STEP_HEADING_PADDING_CLASS,
    MAKE_SHIFT_STEP_INTRO_SUBTITLE_CLASS,
    MAKE_SHIFT_STEP_TITLE_CLASS,
} from './make-shift-step-layout';
import {MAKE_SHIFT_STEP_NAV_BUTTON_CLASS} from './make-shift-step-nav';
import {useFlowTransitionFeedback} from './use-flow-transition-feedback';

type TMakeShiftStepContentProps = {
    currentStep: TMakeShiftStep;
    canPrev: boolean;
    canNext: boolean;
    nextBusy?: boolean;
    onPrev: () => void;
    onNext: () => void;
};

function ImportantIntroBadge() {
    const {t} = useTypedTranslation();

    return (
        <span className="mx-1 inline-flex h-6 translate-y-[-1px] items-center justify-center rounded-full bg-[#FFF3D6] px-2 font-apple text-[12px] font-bold text-[#B86E00] ring-1 ring-[#FFD88A]">
            {t('page.makeShift.stepContent.importantBadge')}
        </span>
    );
}

function StepIntroDescription({currentStep, description}: {currentStep: TMakeShiftStep; description: string}) {
    const {t} = useTypedTranslation();

    if (currentStep === 2) {
        return (
            <div className={MAKE_SHIFT_STEP_INTRO_SUBTITLE_CLASS}>
                <p>
                    {t('page.makeShift.stepContent.importantPrefix')} <ImportantIntroBadge />{' '}
                    {t('page.makeShift.stepContent.importantSuffix')}
                </p>
            </div>
        );
    }

    return <p className={`${MAKE_SHIFT_STEP_INTRO_SUBTITLE_CLASS} whitespace-pre-line`}>{description}</p>;
}

export function MakeShiftStepContent({currentStep, canPrev, canNext, nextBusy = false, onPrev, onNext}: TMakeShiftStepContentProps) {
    const {t} = useTypedTranslation();
    const {transitioning, runTransition} = useFlowTransitionFeedback();
    const stepConfig = MAKE_SHIFT_STEP_CONFIG[currentStep];
    const isNextButtonBusy = transitioning === 'next' || nextBusy;

    if (!stepConfig) {
        return (
            <div className="make-shift-step-content flex w-full min-w-0 flex-1 items-center justify-center pb-3">
                <PageState
                    tone="error"
                    title={t('page.makeShift.stepLoadFailed')}
                    description={t('page.state.errorDescription')}
                    className="py-0"
                />
            </div>
        );
    }

    const StepComponent = stepConfig.Component;

    if (stepConfig.layout === 'wide') {
        const widePtClass = currentStep === 3 ? 'pt-3' : '';

        return (
            <div className={`make-shift-step-content make-shift-step-content--wide flex w-full min-w-0 flex-col pb-3 ${widePtClass}`}>
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        );
    }

    const intro = stepConfig.intro;
    const handleNext = () => {
        if (currentStep === 2 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(MAKE_SHIFT_CONSTRAINTS_OPTIMIZE_EVENT));
        }

        onNext();
    };

    return (
        <div className="make-shift-step-content make-shift-step-content--narrow flex w-full min-w-0 gap-2 pt-3 pb-3 min-[1400px]:gap-3 min-[1600px]:gap-4">
            <aside className="make-shift-step-content__intro flex w-[300px] shrink-0 flex-col min-[1400px]:w-[320px] min-[1600px]:w-[clamp(400px,25vw,440px)]">
                <div className={`${MAKE_SHIFT_STEP_HEADING_PADDING_CLASS} min-h-[130px] min-[1600px]:min-h-[140px]`}>
                    <p className={`make-shift-step-content__intro-title ${MAKE_SHIFT_STEP_TITLE_CLASS}`}>
                        {intro ? t(intro.titleKey) : ''}
                    </p>
                    {intro && <StepIntroDescription currentStep={currentStep} description={t(intro.descriptionKey)} />}
                </div>

                <div className="make-shift-step-content__intro-actions mt-6 grid w-[252px] grid-cols-[auto_auto] items-center justify-end gap-2 min-[1400px]:w-[260px] min-[1600px]:mt-[50px] min-[1600px]:w-[292px]">
                    {currentStep > 1 ? (
                        <Button
                            variant="secondary"
                            size="md"
                            type="button"
                            onClick={() => runTransition('prev', onPrev)}
                            disabled={!canPrev || transitioning !== null}
                            className={`cursor-pointer border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                        >
                            {transitioning === 'prev' ? <BouncingDots className="w-5 shrink-0 text-main-1" /> : null}
                            {transitioning === 'prev' ? t('page.makeShift.navigation.moving') : t('page.makeShift.navigation.previous')}
                        </Button>
                    ) : (
                        <span aria-hidden="true" className={`invisible ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`} />
                    )}
                    <Button
                        size="md"
                        type="button"
                        onClick={() => runTransition('next', handleNext)}
                        disabled={!canNext || transitioning !== null || nextBusy}
                        className={`cursor-pointer border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed ${MAKE_SHIFT_STEP_NAV_BUTTON_CLASS}`}
                    >
                        {isNextButtonBusy ? <BouncingDots className="w-5 shrink-0 text-white" /> : null}
                        {nextBusy
                            ? t('page.makeShift.navigation.saving')
                            : transitioning === 'next'
                              ? t('page.makeShift.navigation.moving')
                              : t('page.makeShift.navigation.next')}
                    </Button>
                </div>
            </aside>

            <div className="make-shift-step-content__main min-w-[720px] flex-1 min-[1400px]:min-w-[740px] min-[1600px]:min-w-[920px]">
                <p className="sr-only">{t(stepConfig.labelKey)}</p>
                <StepComponent />
            </div>
        </div>
    );
}
