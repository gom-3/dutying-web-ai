import {useMakeShiftStore, canGoNext, canGoPrev} from '../model/store';
import {useMakeShiftUseCase} from '../model/use-case';
import {RestoreDraftModal} from './restore-draft-modal';
import {AiAutofill} from './steps/ai-auto-fill';
import {Constraints} from './steps/constraints';
import {FixedShifts} from './steps/fixed-shifts';
import {RequestsShifts} from './steps/requests-shifts';
import {Workers} from './steps/workers';

const STEP_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: '근무자 확정',
    2: '제약조건',
    3: '신청 근무 확정',
    4: '고정 근무',
    5: 'AI 자동 채우기',
};

export const MakeShiftPageView = () => {
    const useCase = useMakeShiftUseCase();
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const shiftExists = useMakeShiftStore((s) => s.shiftExists);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const isOverview = phase === 'overview';

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 py-6">
            {isOverview ? (
                <div className="flex flex-col gap-4">
                    <div className="rounded-xl bg-white p-6 shadow-banner">
                        <p className="font-apple text-xl font-semibold text-sub-1">현재 근무 확인</p>
                        <p className="mt-2 font-apple text-sm text-sub-3">
                            현재 월 근무표를 확인하거나, 근무표가 없으면 새로 생성하여 작성 단계를 시작할 수 있어요.
                        </p>
                        <div className="mt-4 rounded-lg bg-main-bg p-4 font-apple text-sm text-sub-2.5">
                            {shiftStatus === 'pending' && '근무표를 불러오는 중입니다...'}
                            {shiftStatus === 'success' && shiftExists && '현재 월 근무표가 존재합니다. (상세 UI는 단계 진행 후 표시)'}
                            {shiftStatus === 'error' && '현재 월 근무표가 없습니다.'}
                            {shiftStatus === 'idle' && '근무표 상태를 확인 중입니다.'}
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                className="h-10 rounded-lg bg-main-2 px-4 font-apple text-base font-semibold text-white disabled:opacity-50"
                                onClick={() => useCase.start()}
                                disabled={shiftStatus === 'pending'}
                            >
                                근무표 생성
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {([1, 2, 3, 4, 5] as const).map((step) => {
                                const active = currentStep === step;
                                const clickable = step < currentStep;

                                return (
                                    <button
                                        key={step}
                                        className={`rounded-full px-3 py-1 font-apple text-sm ${
                                            active ? 'bg-main-4 text-main-1' : 'bg-sub-5 text-sub-2.5'
                                        } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                                        onClick={() => clickable && useCase.goToStep(step)}
                                        type="button"
                                    >
                                        {step}. {STEP_LABELS[step]}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                className="h-9 rounded-lg bg-sub-5 px-3 font-apple text-sm text-sub-2.5 disabled:opacity-50"
                                onClick={() => useCase.prev()}
                                disabled={!canPrev}
                            >
                                이전
                            </button>
                            <button
                                className="h-9 rounded-lg bg-main-2 px-3 font-apple text-sm text-white disabled:opacity-50"
                                onClick={() => useCase.next()}
                                disabled={!canNext}
                            >
                                다음
                            </button>
                            {currentStep === 5 && (
                                <button
                                    className="h-9 rounded-lg bg-sub-3 px-3 font-apple text-sm text-white"
                                    onClick={() => useCase.complete()}
                                    type="button"
                                >
                                    완료
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-1">
                        {currentStep === 1 && <Workers />}
                        {currentStep === 2 && <Constraints />}
                        {currentStep === 3 && <RequestsShifts />}
                        {currentStep === 4 && <FixedShifts />}
                        {currentStep === 5 && <AiAutofill />}
                    </div>
                </>
            )}

            <RestoreDraftModal />
        </div>
    );
};
