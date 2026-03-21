import {useNavigate} from 'react-router';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
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
    const navigate = useNavigate();
    const {t} = useTypedTranslation();
    const useCase = useMakeShiftUseCase();
    const phase = useMakeShiftStore((s) => s.phase);
    const currentStep = useMakeShiftStore((s) => s.currentStep);
    const year = useMakeShiftStore((s) => s.year);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const shiftExists = useMakeShiftStore((s) => s.shiftExists);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const setYearMonth = useMakeShiftStore((s) => s.setYearMonth);
    const canPrev = useMakeShiftStore((s) => canGoPrev(s));
    const canNext = useMakeShiftStore((s) => canGoNext(s));
    const isOverview = phase === 'overview';
    const currentShiftTeamName = shiftTeams.find((t) => t.shiftTeamId === currentShiftTeamId)?.name ?? '선택한 팀';
    const hasCurrentMonthShift = shiftStatus === 'success' && shiftExists;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const handleGoDuty = () => {
        const params = new URLSearchParams({
            year: String(year),
            month: String(month),
            shiftTeamId: String(currentShiftTeamId ?? ''),
        });

        navigate(`${ROUTE.DUTY}?${params.toString()}`);
    };
    const handleCreateCurrentMonth = () => {
        useCase.start();
    };
    const handleCreateNextMonth = () => {
        setYearMonth({year: nextYear, month: nextMonth});
        useCase.start();
    };

    return (
        <div className="flex min-h-screen w-full flex-col px-10 py-10">
            <MakeShiftHeader />

            <div className="mt-[14px] flex flex-1 flex-col rounded-[20px] bg-white">
                {isOverview ? (
                    <div className="flex flex-1 items-center justify-center px-10 py-16">
                        {shiftStatus === 'pending' || shiftStatus === 'idle' ? (
                            <PageState
                                tone="loading"
                                title={
                                    shiftStatus === 'pending' ? t('page.makeShift.overview.loading') : t('page.makeShift.overview.checking')
                                }
                                description={t('page.state.loadingDescription')}
                                className="py-0"
                            />
                        ) : shiftStatus === 'error' ? (
                            <PageState
                                tone="error"
                                title={t('page.makeShift.overview.error')}
                                description={t('page.state.errorDescription')}
                                action={{label: t('page.state.retry'), onClick: useCase.retryOverview}}
                                className="py-0"
                            />
                        ) : hasCurrentMonthShift ? (
                            <div className="text-center">
                                <p className="font-apple text-2xl font-semibold text-gray-3">
                                    {t('page.makeShift.overview.shiftExists', {teamName: currentShiftTeamName, month})}
                                </p>

                                <div className="mt-6 flex items-center justify-center gap-8">
                                    <button
                                        className="rounded-[20px] bg-main-light px-[42px] py-[22px] font-apple text-2xl font-semibold text-main-1"
                                        onClick={handleGoDuty}
                                        type="button"
                                    >
                                        {t('page.makeShift.overview.viewShift', {month})}
                                    </button>
                                    <button
                                        className="rounded-[20px] bg-main-1 px-[42px] py-[22px] font-apple text-2xl font-semibold text-white"
                                        onClick={handleCreateNextMonth}
                                        type="button"
                                    >
                                        {t('page.makeShift.overview.createShift', {month: nextMonth})}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <PageState
                                tone="empty"
                                title={t('page.makeShift.overview.shiftEmpty', {teamName: currentShiftTeamName, month})}
                                description={t('page.state.emptyDescription')}
                                className="py-0"
                            >
                                <div className="mt-1 flex justify-center">
                                    <button
                                        className="rounded-[20px] bg-main-light px-10 py-4 font-apple text-xl font-semibold text-main-1"
                                        onClick={handleCreateCurrentMonth}
                                        type="button"
                                    >
                                        {t('page.makeShift.overview.createShift', {month})}
                                    </button>
                                </div>
                            </PageState>
                        )}
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
