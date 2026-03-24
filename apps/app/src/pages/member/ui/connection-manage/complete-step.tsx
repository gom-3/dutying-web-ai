import {TriangleAlert} from 'lucide-react';
import {SuccessCircleIcon} from '@/shared/assets/svg';
import {type TConnectMode, getConnectionManageResultCopy, type TConnectionManageSubmitStatus} from '../../model/connection-manage';

interface IConnectionManageCompleteStepProps {
    submitStatus: TConnectionManageSubmitStatus;
    connectMode: TConnectMode;
    waitingNurseName?: string;
    targetLabel?: string | null;
    onRestart: () => void;
    onBack: () => void;
    onRetry: () => void;
    onClose: () => void;
}

function ConnectionManageCompleteStep({
    submitStatus,
    connectMode,
    waitingNurseName,
    targetLabel,
    onRestart,
    onBack,
    onRetry,
    onClose,
}: IConnectionManageCompleteStepProps) {
    if (submitStatus === 'idle') return null;

    const feedback = getConnectionManageResultCopy({
        submitStatus,
        connectMode,
        waitingNurseName,
        targetLabel,
    });
    const isLoading = submitStatus === 'loading';
    const isError = submitStatus === 'error';

    return (
        <div
            className="flex min-h-96 w-[40%] min-w-190 flex-col items-center justify-center rounded-[1.25rem] bg-white"
            onClick={(event) => event.stopPropagation()}
        >
            {isLoading ? (
                <div
                    className="h-15 w-15 animate-spin rounded-full border-[.25rem] border-main-2/20 border-t-main-1"
                    aria-label="loading"
                />
            ) : isError ? (
                <div className="flex h-15 w-15 items-center justify-center rounded-full bg-[#FFE7EA] text-red">
                    <TriangleAlert className="h-8 w-8" />
                </div>
            ) : (
                <SuccessCircleIcon className="h-15 w-15" />
            )}
            <h1 className="mt-5 font-apple text-[1.75rem] font-semibold text-text-1">{feedback.title}</h1>
            <p className="mt-[.5rem] max-w-115 text-center font-apple text-[1rem] leading-7 text-sub-3">{feedback.description}</p>

            <div className="mt-12 flex w-100">
                {isLoading ? (
                    <button
                        className="h-11.5 flex-1 rounded-[3.125rem] border-[.0625rem] border-sub-4.5 bg-sub-5 font-apple text-[1.5rem] font-medium text-sub-2.5"
                        disabled
                    >
                        처리 중...
                    </button>
                ) : isError ? (
                    <>
                        <button
                            className="h-11.5 flex-1 rounded-l-[3.125rem] border-[.0625rem] border-sub-3 bg-sub-5 font-apple text-[1.5rem] font-medium text-sub-2.5"
                            onClick={onBack}
                        >
                            이전 단계
                        </button>
                        <button
                            className="h-11.5 flex-1 rounded-r-[3.125rem] border-[.0625rem] border-main-3 bg-main-1 font-apple text-[1.5rem] font-medium text-white"
                            onClick={onRetry}
                        >
                            다시 시도
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            className="h-11.5 flex-1 rounded-l-[3.125rem] border-[.0625rem] border-main-3 bg-main-1 font-apple text-[1.5rem] font-medium text-white"
                            onClick={onRestart}
                        >
                            다른 신청 보기
                        </button>
                        <button
                            className="h-11.5 flex-1 rounded-r-[3.125rem] border-[.0625rem] border-main-3 bg-sub-5 font-apple text-[1.5rem] font-medium text-sub-2.5"
                            onClick={onClose}
                        >
                            닫기
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default ConnectionManageCompleteStep;
