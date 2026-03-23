import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {MAKE_SHIFT_STEP_CONFIG} from './make-shift-step-config';

function StepCircle({state, step}: {state: 'prev' | 'current' | 'next'; step: number}) {
    const base = 'flex size-8 items-center justify-center rounded-full font-poppins text-xl font-medium';

    if (state === 'prev') return <div className={`${base} bg-gray-4 text-white`}>{step}</div>;

    if (state === 'current') return <div className={`${base} bg-main-1 text-white`}>{step}</div>;

    return <div className={`${base} border border-main-1 bg-white text-main-1`}>{step}</div>;
}

export function MakeShiftStepper({currentStep, onClickStep}: {currentStep: TMakeShiftStep; onClickStep: (step: TMakeShiftStep) => void}) {
    const {t} = useTypedTranslation();

    return (
        <div className="border-b-[2px] border-gray-6">
            <div className="flex flex-wrap items-center justify-between gap-6 px-10">
                {([1, 2, 3, 4, 5] as const).map((step) => {
                    const clickable = step < currentStep;
                    const state: 'prev' | 'current' | 'next' = step < currentStep ? 'prev' : step === currentStep ? 'current' : 'next';

                    return (
                        <button
                            key={step}
                            type="button"
                            onClick={() => clickable && onClickStep(step)}
                            className={`relative flex items-center gap-3 py-[24px] ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <StepCircle state={state} step={step} />
                            <div
                                className={`font-apple text-xl ${
                                    state === 'current'
                                        ? 'font-bold text-main-1'
                                        : state === 'prev'
                                          ? 'font-medium text-gray-4'
                                          : 'font-medium text-gray-4'
                                }`}
                            >
                                {t(MAKE_SHIFT_STEP_CONFIG[step].labelKey)}
                            </div>

                            {state === 'current' && (
                                <div className="absolute -right-2 bottom-[-2px] -left-2 h-[4px] rounded-full bg-main-1" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
