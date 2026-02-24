import {useMakeShiftStore, canGoNext, canGoPrev} from '../model/make-shift-store';
import {useMakeShiftUseCase} from '../model/make-shift-use-case';
import {MakeShiftHeader} from './make-shift-header';
import {MakeShiftStepper, STEP_LABELS} from './make-shift-stepper';
import {AiAutofill} from './steps/ai-auto-fill';
import {Constraints} from './steps/constraints';
import {FixedShifts} from './steps/fixed-shifts';
import {RequestsShifts} from './steps/requests-shifts';
import {Workers} from './steps/workers';

const STEP_INTRO: Record<
    1 | 2 | 3 | 4 | 5,
    {
        title: string;
        desc: string[];
        isWideStep: boolean;
    }
> = {
    1: {
        title: '근무자를 확정해 주세요',
        desc: ["'근무투입'이 선택된 근무자만 불러왔어요", '목록 순서대로 근무표에 배치해 드릴게요'],
        isWideStep: false,
    },
    2: {
        title: '제약 조건을 확정해 주세요',
        desc: ['모든 제약 조건을 적용하기 어려울 수 있어요', '우선순위를 정해 주시면, 더 정확하게 반영해 드릴게요'],
        isWideStep: false,
    },
    3: {
        title: '신청 근무를 확정해 주세요',
        desc: ['제출된 신청 근무를 확인하고 확정해 주세요.'],
        isWideStep: true,
    },
    4: {
        title: '고정 근무를 확인해 주세요',
        desc: ['고정 근무를 확인하고 반영해 주세요.'],
        isWideStep: true,
    },
    5: {
        title: 'AI 자동 채우기를 진행해 주세요',
        desc: ['설정한 조건을 바탕으로 근무표를 자동으로 채워 드릴게요.'],
        isWideStep: true,
    },
};

export const MakeShiftPageView = () => {
    const useCase = useMakeShiftUseCase();
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const shiftExists = useMakeShiftStore((s) => s.shiftExists);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const isOverview = phase === 'overview';
    const currentShiftTeamName = shiftTeams.find((t) => t.shiftTeamId === currentShiftTeamId)?.name ?? '선택한 팀';

    return (
        <div className="flex min-h-screen w-full flex-col px-10 py-10">
            <MakeShiftHeader />

            <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-white">
                {isOverview ? (
                    <div className="flex flex-1 items-center justify-center px-10 py-16">
                        <div className="text-center">
                            <p className="font-apple text-2xl font-semibold text-gray-3">
                                {shiftStatus === 'pending' && '근무표를 불러오는 중입니다...'}
                                {shiftStatus === 'success' && shiftExists && `${currentShiftTeamName}의 ${month}월 근무표가 존재합니다.`}
                                {shiftStatus === 'error' && `${currentShiftTeamName}의 ${month}월 근무표가 비어있어요`}
                                {shiftStatus === 'idle' && '근무표 상태를 확인 중입니다.'}
                            </p>

                            <div className="mt-6 flex justify-center">
                                <button
                                    className="rounded-[20px] bg-main-light px-10 py-4 font-apple text-xl font-semibold text-main-1 disabled:opacity-50"
                                    onClick={() => useCase.start()}
                                    disabled={shiftStatus === 'pending'}
                                >
                                    {month}월 근무표 생성하기
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <MakeShiftStepper currentStep={currentStep} onClickStep={useCase.goToStep} />

                        {STEP_INTRO[currentStep].isWideStep ? (
                            <div className="flex flex-1 flex-col px-10 pt-[42px] pb-10">
                                <p className="sr-only">{STEP_LABELS[currentStep]}</p>
                                {currentStep === 3 && <RequestsShifts />}
                                {currentStep === 4 && <FixedShifts />}
                                {currentStep === 5 && <AiAutofill />}
                            </div>
                        ) : (
                            <div className="flex flex-1 gap-10 pt-[42px] pl-[59px]">
                                <div className="w-[440px] shrink-0">
                                    <p className="font-apple text-[32px] font-semibold text-sub-1">{STEP_INTRO[currentStep].title}</p>
                                    <div className="mt-6 font-apple text-xl leading-[1.72] font-medium text-gray-3">
                                        {STEP_INTRO[currentStep].desc.map((line) => (
                                            <p key={line}>{line}</p>
                                        ))}
                                    </div>

                                    <div className="mt-[82px] flex items-center gap-8">
                                        <button
                                            className="h-[42px] rounded-[10px] bg-gray-6 px-5 font-apple text-base font-semibold text-gray-3 disabled:opacity-50"
                                            onClick={() => useCase.prev()}
                                            disabled={!canPrev}
                                            type="button"
                                        >
                                            이전
                                        </button>
                                        <button
                                            className="h-[42px] rounded-[10px] bg-main-1 px-5 font-apple text-base font-semibold text-white disabled:opacity-50"
                                            onClick={() => useCase.next()}
                                            disabled={!canNext}
                                            type="button"
                                        >
                                            다음
                                        </button>
                                        {currentStep === 5 && (
                                            <button
                                                className="h-[42px] rounded-[10px] bg-sub-3 px-5 font-apple text-base font-semibold text-white"
                                                onClick={() => useCase.complete()}
                                                type="button"
                                            >
                                                완료
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="sr-only">{STEP_LABELS[currentStep]}</p>
                                    {currentStep === 1 && <Workers />}
                                    {currentStep === 2 && <Constraints />}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
