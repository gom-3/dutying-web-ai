import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type TMakeShiftStep} from '../model/make-shift-store';
import {MAKE_SHIFT_STEP_CONFIG} from './make-shift-step-config';

type TStepState = 'prev' | 'current' | 'next';

const STEP_CIRCLE_BASE =
    'flex shrink-0 items-center justify-center rounded-full font-poppins font-medium leading-none size-[clamp(20px,1.6vw,26px)] text-[clamp(11px,0.85vw,14px)]';
const STEP_LABEL_BASE = 'whitespace-nowrap font-apple text-[clamp(13px,1.05vw,18px)] leading-[1.05]';

function StepCircle({state, step}: {state: TStepState; step: number}) {
    if (state === 'current') {
        return <div className={`${STEP_CIRCLE_BASE} bg-main-1 text-white`}>{step}</div>;
    }

    if (state === 'prev') {
        return <div className={`${STEP_CIRCLE_BASE} bg-gray-4 text-white`}>{step}</div>;
    }

    return <div className={`${STEP_CIRCLE_BASE} border-[1.5px] border-current bg-transparent text-gray-3`}>{step}</div>;
}

export function MakeShiftStepper({
    currentStep,
    maxReachedStep,
    onClickStep,
}: {
    currentStep: TMakeShiftStep;
    maxReachedStep: TMakeShiftStep;
    onClickStep: (step: TMakeShiftStep) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <div
            id="make_stepper"
            // 사진 기준: stepper 하단에 매우 옅은 1px 분리선만 둔다 (이전 2px 진한 라인 → 1px gray-6).
            // current step의 강조 underline은 이 분리선 라인 "위에" 정확히 겹쳐 그려진다 (두 선이 따로 보이지 않게).
            className="make-shift-stepper relative w-full border-b border-gray-6"
        >
            {/*
             * 정렬 전략:
             * - justify-around(=space-around): 각 step 양옆에 동일한 공간을 자동 분배. 양 끝에는 그 절반씩이 자연스럽게 생기므로
             *   1번이 컨테이너 왼쪽 끝에, 5번이 오른쪽 끝에 바짝 붙지 않는다 (별도 좌우 padding 불필요).
             * - 컨테이너의 padding-y는 0으로 두고 각 step button이 직접 py-... 를 가져 button의 bottom = 분리선 위치가 되도록 한다.
             *   (그래야 button 내부의 absolute indicator를 -bottom-px 로 두는 것만으로 회색 분리선과 정확히 같은 줄에 겹쳐 그려진다.)
             */}
            <div className="make-shift-stepper__list flex w-full flex-wrap items-center justify-around">
                {([1, 2, 3, 4, 5] as const).map((step) => {
                    const clickable = step !== currentStep && step <= maxReachedStep;
                    const state: TStepState = step < currentStep ? 'prev' : step === currentStep ? 'current' : 'next';

                    return (
                        <button
                            key={step}
                            type="button"
                            onClick={() => clickable && onClickStep(step)}
                            data-step={step}
                            data-step-state={state}
                            className={`make-shift-stepper__step relative flex items-center gap-[clamp(6px,0.55vw,10px)] py-[clamp(10px,0.95vw,18px)] ${
                                clickable ? 'cursor-pointer' : 'cursor-default'
                            }`}
                        >
                            <StepCircle state={state} step={step} />
                            <span
                                className={`make-shift-stepper__label flex items-center ${STEP_LABEL_BASE} ${
                                    state === 'current' ? 'font-semibold text-main-1' : 'font-medium text-gray-3'
                                }`}
                            >
                                {t(MAKE_SHIFT_STEP_CONFIG[step].labelKey)}
                            </span>

                            {state === 'current' && (
                                /*
                                 * 사진 기준 강조선:
                                 * - 위치: -bottom-px → 컨테이너의 border-b(1px)와 indicator의 가장 아래 1px이 정확히 같은 라인.
                                 *   결과적으로 회색 분리선이 보라색 굵은 선으로 "교체"된 것처럼 보이고 두 줄로 분리되지 않는다.
                                 * - 폭: inset-x-0 → step 영역(원+라벨) 폭만큼만 강조.
                                 * - 두께: clamp(2px,0.18vw,3px) → 분리선보다 굵게.
                                 */
                                <span
                                    aria-hidden
                                    className="make-shift-stepper__active-indicator pointer-events-none absolute inset-x-0 -bottom-px z-[1] h-[clamp(2px,0.18vw,3px)] rounded-full bg-main-1"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
