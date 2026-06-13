import {LoaderCircle, TriangleAlert, X} from 'lucide-react';
import {CheckmarkIcon} from 'react-hot-toast';
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
    const isSuccess = submitStatus === 'success';

    if (isSuccess) {
        return (
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5 shadow-[0_24px_80px_rgba(18,23,38,0.2)]"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    aria-label="닫기"
                    className="absolute top-4 right-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 hover:text-sub-2"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" strokeWidth={2.2} />
                </button>

                <div className="flex min-h-[196px] flex-col items-center justify-center pt-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center" aria-hidden="true">
                        <div className="scale-[2.4]">
                            <CheckmarkIcon primary="#61D345" secondary="#FFFFFF" />
                        </div>
                    </div>
                    <h1 className="mt-6 font-apple text-[20px] leading-7 font-semibold text-sub-1">{feedback.title}</h1>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                    <button
                        type="button"
                        className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                        onClick={onRestart}
                    >
                        다른 요청 보기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5 shadow-[0_24px_80px_rgba(18,23,38,0.2)]"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="flex items-start justify-between gap-4">
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isError ? 'bg-[#FFF5F5] text-[#D14343]' : 'bg-[#F3F4F6] text-main-1'
                    }`}
                    aria-hidden={!isLoading}
                    aria-label={isLoading ? '처리 중' : undefined}
                >
                    {isLoading ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                    ) : isError ? (
                        <TriangleAlert className="h-5 w-5" strokeWidth={2.2} />
                    ) : null}
                </div>
                <button
                    type="button"
                    aria-label="닫기"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 hover:text-sub-2"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
            </div>

            <h1 className="mt-4 font-apple text-[20px] leading-7 font-semibold text-sub-1">{feedback.title}</h1>
            {feedback.description ? (
                <p className="mt-2 font-apple text-[15px] leading-6 whitespace-pre-line text-gray-3">{feedback.description}</p>
            ) : null}

            <div className="mt-6">
                {isLoading ? (
                    <button
                        type="button"
                        className="h-11 w-full rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[15px] font-semibold text-gray-3"
                        disabled
                    >
                        처리 중...
                    </button>
                ) : isError ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                            onClick={onBack}
                        >
                            이전 단계
                        </button>
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                            onClick={onRetry}
                        >
                            다시 시도
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                            onClick={onClose}
                        >
                            닫기
                        </button>
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                            onClick={onRestart}
                        >
                            다른 요청 보기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectionManageCompleteStep;
