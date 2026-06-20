import {LoaderCircle, TriangleAlert, X} from 'lucide-react';
import {CheckmarkIcon} from 'react-hot-toast';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type TConnectMode, getConnectionManageResultCopy, type TConnectionManageSubmitStatus} from '../../model/connection-manage';

interface IConnectionManageCompleteStepProps {
    submitStatus: TConnectionManageSubmitStatus;
    connectMode: TConnectMode;
    waitingNurseName?: string;
    targetLabel?: string | null;
    hasOtherWaitingRequests: boolean;
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
    hasOtherWaitingRequests,
    onRestart,
    onBack,
    onRetry,
    onClose,
}: IConnectionManageCompleteStepProps) {
    const {t} = useTypedTranslation();

    if (submitStatus === 'idle') return null;

    const feedback = getConnectionManageResultCopy({
        submitStatus,
        connectMode,
        waitingNurseName,
        targetLabel,
        t,
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
                    aria-label={t('page.member.common.close')}
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

                <div className={hasOtherWaitingRequests ? 'mt-2 grid grid-cols-2 gap-3' : 'mt-2'}>
                    <button
                        type="button"
                        className="h-11 w-full rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                        onClick={onClose}
                    >
                        {t('page.member.common.close')}
                    </button>
                    {hasOtherWaitingRequests ? (
                        <button
                            type="button"
                            className="h-11 w-full rounded-[10px] bg-main-1 px-4 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                            onClick={onRestart}
                        >
                            {t('page.member.connectionManage.complete.viewOtherRequests')}
                        </button>
                    ) : null}
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
                    aria-label={isLoading ? t('page.member.common.processing') : undefined}
                >
                    {isLoading ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                    ) : isError ? (
                        <TriangleAlert className="h-5 w-5" strokeWidth={2.2} />
                    ) : null}
                </div>
                <button
                    type="button"
                    aria-label={t('page.member.common.close')}
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
                        {t('page.member.common.processingEllipsis')}
                    </button>
                ) : isError ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                            onClick={onBack}
                        >
                            {t('page.member.common.previousStep')}
                        </button>
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                            onClick={onRetry}
                        >
                            {t('page.member.common.retry')}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                            onClick={onClose}
                        >
                            {t('page.member.common.close')}
                        </button>
                        <button
                            type="button"
                            className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-main-1-hover"
                            onClick={onRestart}
                        >
                            {t('page.member.connectionManage.complete.viewOtherRequests')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectionManageCompleteStep;
