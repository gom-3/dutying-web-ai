import {observer} from 'mobx-react-lite';
import {useContext} from 'react';
import {MakeShiftContext} from '../model/provider';
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

export const MakeShiftPageView = observer(() => {
    const deps = useContext(MakeShiftContext);

    if (!deps) throw new Error('MakeShiftContext is not provided.');

    const {
        store: {flowStore, editDutyStore},
        useCase: {flowUseCase},
    } = deps;
    const isOverview = flowStore.phase === 'overview';
    const {shiftStatus, shift} = editDutyStore;

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
                            {shiftStatus === 'success' && shift && '현재 월 근무표가 존재합니다. (상세 UI는 단계 진행 후 표시)'}
                            {shiftStatus === 'error' && '현재 월 근무표가 없습니다.'}
                            {shiftStatus === 'idle' && '근무표 상태를 확인 중입니다.'}
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                className="h-10 rounded-lg bg-main-2 px-4 font-apple text-base font-semibold text-white disabled:opacity-50"
                                onClick={() => flowUseCase.start()}
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
                                const active = flowStore.currentStep === step;
                                const clickable = step < flowStore.currentStep;

                                return (
                                    <button
                                        key={step}
                                        className={`rounded-full px-3 py-1 font-apple text-sm ${
                                            active ? 'bg-main-4 text-main-1' : 'bg-sub-5 text-sub-2.5'
                                        } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                                        onClick={() => clickable && flowUseCase.goToStep(step)}
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
                                onClick={() => flowUseCase.prev()}
                                disabled={!flowStore.canGoPrev()}
                            >
                                이전
                            </button>
                            <button
                                className="h-9 rounded-lg bg-main-2 px-3 font-apple text-sm text-white disabled:opacity-50"
                                onClick={() => flowUseCase.next()}
                                disabled={!flowStore.canGoNext()}
                            >
                                다음
                            </button>
                            {flowStore.currentStep === 5 && (
                                <button
                                    className="h-9 rounded-lg bg-sub-3 px-3 font-apple text-sm text-white"
                                    onClick={() => flowUseCase.complete()}
                                    type="button"
                                >
                                    완료
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-1">
                        {flowStore.currentStep === 1 && <Workers />}
                        {flowStore.currentStep === 2 && <Constraints />}
                        {flowStore.currentStep === 3 && <RequestsShifts />}
                        {flowStore.currentStep === 4 && <FixedShifts />}
                        {flowStore.currentStep === 5 && <AiAutofill />}
                    </div>
                </>
            )}

            <RestoreDraftModal />
        </div>
    );
});
