import {type TMakeShiftStep} from '../model/make-shift-store';

export const STEP_LABELS: Record<TMakeShiftStep, string> = {
    1: '근무자 확인',
    2: '제약 조건',
    3: '신청 근무 확정',
    4: '고정 근무',
    5: 'AI 자동 채우기',
};

function StepCircle({state, step}: {state: 'prev' | 'current' | 'next'; step: number}) {
    const base = 'grid size-8 place-items-center rounded-full font-poppins text-xl font-medium';
    if (state === 'prev') return <div className={`${base} bg-gray-4 text-white`}>{step}</div>;
    if (state === 'current') return <div className={`${base} bg-main-1 text-white`}>{step}</div>;
    return <div className={`${base} border border-main-1 bg-white text-main-1`}>{step}</div>;
}

export function MakeShiftStepper({
    currentStep,
    onClickStep,
}: {
    currentStep: TMakeShiftStep;
    onClickStep: (step: TMakeShiftStep) => void;
}) {
    return (
        <div className="border-b border-gray-6">
            <div className="flex flex-wrap items-center justify-between gap-6 px-10 py-6">
                {([1, 2, 3, 4, 5] as const).map((step) => {
                    const clickable = step < currentStep;
                    const state: 'prev' | 'current' | 'next' =
                        step < currentStep ? 'prev' : step === currentStep ? 'current' : 'next';

                    return (
                        <button
                            key={step}
                            type="button"
                            onClick={() => clickable && onClickStep(step)}
                            className={`relative flex items-center gap-3 pb-2 ${
                                clickable ? 'cursor-pointer' : 'cursor-default'
                            }`}
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
                                {STEP_LABELS[step]}
                            </div>

                            {state === 'current' && (
                                <div className="absolute -bottom-px left-0 right-0 h-[2px] bg-main-1" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


