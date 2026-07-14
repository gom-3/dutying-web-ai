import {LoaderCircle} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';

const INITIAL_PROGRESS = 8;
const FAST_PROGRESS_TARGET = 90;
const TARGET_PROGRESS = 98;
const SLOW_PROGRESS_LIMIT = 99.2;
const TARGET_DURATION_MS = 120_000;
const FAST_PROGRESS_DURATION_MS = 72_000;
const SLOW_PROGRESS_DURATION_MS = TARGET_DURATION_MS - FAST_PROGRESS_DURATION_MS;
const EXTRA_SLOW_DURATION_MS = 120_000;
const COMPLETION_PROGRESS_DURATION_MS = 520;
const COMPLETION_SETTLE_MS = 180;
const clampProgressRatio = (value: number) => Math.max(0, Math.min(1, value));
const easeOutQuad = (value: number) => 1 - (1 - value) ** 2;
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const easeOutExponential = (value: number) => {
    const clampedValue = clampProgressRatio(value);
    const maxEasedValue = 1 - Math.exp(-4);

    return (1 - Math.exp(-4 * clampedValue)) / maxEasedValue;
};

function getElapsedMs(startedAt: number | null) {
    if (startedAt === null) return 0;

    return Math.max(0, Date.now() - startedAt);
}

function getSimulatedProgress(elapsedMs: number) {
    if (elapsedMs <= FAST_PROGRESS_DURATION_MS) {
        const progressRatio = easeOutQuad(clampProgressRatio(elapsedMs / FAST_PROGRESS_DURATION_MS));

        return INITIAL_PROGRESS + (FAST_PROGRESS_TARGET - INITIAL_PROGRESS) * progressRatio;
    }

    if (elapsedMs <= TARGET_DURATION_MS) {
        const slowProgressRatio = clampProgressRatio((elapsedMs - FAST_PROGRESS_DURATION_MS) / SLOW_PROGRESS_DURATION_MS);

        return FAST_PROGRESS_TARGET + (TARGET_PROGRESS - FAST_PROGRESS_TARGET) * easeOutExponential(slowProgressRatio);
    }

    const extraSlowProgressRatio = 1 - Math.exp(-(elapsedMs - TARGET_DURATION_MS) / EXTRA_SLOW_DURATION_MS);

    return TARGET_PROGRESS + (SLOW_PROGRESS_LIMIT - TARGET_PROGRESS) * extraSlowProgressRatio;
}

function getLoadingProgressMessageKey(progress: number): TI18nKey {
    if (progress < 55) {
        return 'page.makeShift.aiRefill.loadingOverlay.checkingRequests';
    }

    if (progress < FAST_PROGRESS_TARGET) {
        return 'page.makeShift.aiRefill.loadingOverlay.fillingBlanks';
    }

    if (progress < TARGET_PROGRESS) {
        return 'page.makeShift.aiRefill.loadingOverlay.finalReview';
    }

    return 'page.makeShift.aiRefill.loadingOverlay.almostDone';
}

type TAiAutofillLoadingOverlayProps = {
    isFinishing?: boolean;
    onFinish?: () => void;
    startedAt: number | null;
};

export function AiAutofillLoadingOverlay({isFinishing = false, onFinish, startedAt}: TAiAutofillLoadingOverlayProps) {
    const {t} = useTypedTranslation();
    const [progress, setProgress] = useState(() => getSimulatedProgress(getElapsedMs(startedAt)));
    const progressRef = useRef(progress);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        if (isFinishing) {
            const startedProgress = Math.max(progressRef.current, getSimulatedProgress(getElapsedMs(startedAt)));
            const startTime = performance.now();

            let animationFrameId = 0;
            let finishTimerId = 0;

            const updateCompletionProgress = (currentTime: number) => {
                const progressRatio = clampProgressRatio((currentTime - startTime) / COMPLETION_PROGRESS_DURATION_MS);
                const nextProgress = startedProgress + (100 - startedProgress) * easeOutCubic(progressRatio);

                setProgress(nextProgress);

                if (progressRatio >= 1) {
                    setProgress(100);
                    finishTimerId = window.setTimeout(() => onFinish?.(), COMPLETION_SETTLE_MS);

                    return;
                }

                animationFrameId = window.requestAnimationFrame(updateCompletionProgress);
            };

            animationFrameId = window.requestAnimationFrame(updateCompletionProgress);

            return () => {
                window.cancelAnimationFrame(animationFrameId);

                if (finishTimerId > 0) {
                    window.clearTimeout(finishTimerId);
                }
            };
        }

        setProgress(getSimulatedProgress(getElapsedMs(startedAt)));

        if (startedAt === null) return undefined;

        let animationFrameId = 0;

        const updateProgress = () => {
            setProgress(getSimulatedProgress(getElapsedMs(startedAt)));
            animationFrameId = window.requestAnimationFrame(updateProgress);
        };

        animationFrameId = window.requestAnimationFrame(updateProgress);

        return () => window.cancelAnimationFrame(animationFrameId);
    }, [isFinishing, onFinish, startedAt]);

    const portalContainer = typeof document === 'undefined' ? null : (document.getElementById('modal-root') ?? document.body);

    if (portalContainer === null) return null;

    const progressValue = Math.round(progress);
    const progressMessage = t(getLoadingProgressMessageKey(progressValue));

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-autofill-loading-title"
            className="fixed inset-0 z-[100002] flex items-center justify-center bg-transparent px-4"
        >
            <div className="w-full max-w-[420px] rounded-[20px] bg-white px-7 py-8 text-center shadow-[0_22px_80px_rgba(45,32,92,0.24)]">
                <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F3F4F6] text-main-1">
                    <LoaderCircle className="h-[22px] w-[22px] animate-spin" aria-hidden />
                </div>
                <p id="ai-autofill-loading-title" className="mt-5 font-apple text-[24px] leading-[1.35] font-bold text-sub-1">
                    {t('page.makeShift.aiRefill.loadingOverlay.title')}
                </p>
                <p className="mx-auto mt-3 max-w-[300px] font-apple text-[15px] leading-[1.6] font-medium whitespace-pre-line text-gray-3">
                    {t('page.makeShift.aiRefill.loadingOverlay.description')}
                </p>
                <div className="mt-7">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressValue}
                        aria-label={t('page.makeShift.aiRefill.loadingOverlay.ariaLabel')}
                        className="h-2 overflow-hidden rounded-full bg-[#ECE6FF]"
                    >
                        <div className="h-full rounded-full bg-main-1" style={{width: `${progress}%`}} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-apple text-[13px] font-semibold">
                        <span className="min-w-0 text-left text-gray-3" aria-live="polite">
                            {progressMessage}
                        </span>
                        <span className="shrink-0 font-poppins text-main-1">{progressValue}%</span>
                    </div>
                </div>
            </div>
        </div>,
        portalContainer,
    );
}
