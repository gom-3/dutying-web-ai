import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';

const INITIAL_PROGRESS = 8;
const FAST_PROGRESS_TARGET = 90;
const SLOW_PROGRESS_LIMIT = 99.2;
const FAST_PROGRESS_TIME_CONSTANT_MS = 8_000;
const SLOW_PROGRESS_TIME_CONSTANT_MS = 90_000;
const COMPLETION_PROGRESS_DURATION_MS = 520;
const COMPLETION_SETTLE_MS = 180;
const clampProgressRatio = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

function getElapsedMs(startedAt: number | null) {
    if (startedAt === null) return 0;

    return Math.max(0, Date.now() - startedAt);
}

function getSimulatedProgress(elapsedMs: number) {
    const fastProgressRatio = 1 - Math.exp(-elapsedMs / FAST_PROGRESS_TIME_CONSTANT_MS);
    const slowProgressRatio = 1 - Math.exp(-elapsedMs / SLOW_PROGRESS_TIME_CONSTANT_MS);

    // Both curves keep slowing down, without a speed jump between loading stages.
    return (
        INITIAL_PROGRESS +
        (FAST_PROGRESS_TARGET - INITIAL_PROGRESS) * fastProgressRatio +
        (SLOW_PROGRESS_LIMIT - FAST_PROGRESS_TARGET) * slowProgressRatio
    );
}

type TAiAutofillLoadingOverlayProps = {
    sidebarOpen?: boolean;
    operation?: TConversationOperation;
    onBackground?: () => void;
    onOpenConversation?: () => void;
    onCancel?: (() => void) | null;
    cancelling?: boolean;
    isFinishing?: boolean;
    onFinish?: () => void;
    startedAt: number | null;
    /** 조절이면 "채우는 중"이 아니라 "방향을 조절하는 중"이다. 빈칸을 채우는 게 아니기 때문이다. */
    isAdjusting?: boolean;
};

export function AiAutofillLoadingOverlay({
    sidebarOpen = false,
    onBackground,
    onOpenConversation,
    onCancel,
    cancelling = false,
    isFinishing = false,
    onFinish,
    startedAt,
    isAdjusting = false,
}: TAiAutofillLoadingOverlayProps) {
    const {t} = useTypedTranslation();
    const backgroundMode = Boolean(onBackground);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (backgroundMode) dialogRef.current?.focus();
    }, [backgroundMode]);

    const [mountedAt] = useState(Date.now);
    const progressStartedAt = startedAt ?? mountedAt;
    const [progress, setProgress] = useState(() => getSimulatedProgress(getElapsedMs(progressStartedAt)));
    const progressRef = useRef(progress);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        if (isFinishing) {
            const startedProgress = Math.max(progressRef.current, getSimulatedProgress(getElapsedMs(progressStartedAt)));
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

        setProgress(getSimulatedProgress(getElapsedMs(progressStartedAt)));

        let animationFrameId = 0;

        const updateProgress = () => {
            setProgress(getSimulatedProgress(getElapsedMs(progressStartedAt)));
            animationFrameId = window.requestAnimationFrame(updateProgress);
        };

        animationFrameId = window.requestAnimationFrame(updateProgress);

        return () => window.cancelAnimationFrame(animationFrameId);
    }, [isFinishing, onFinish, progressStartedAt]);

    const portalContainer = typeof document === 'undefined' ? null : (document.getElementById('modal-root') ?? document.body);

    if (portalContainer === null) return null;

    const progressValue = Math.round(progress);
    const title = isFinishing
        ? t('aiAutofillUi.autofillLoadingOverlay.yourScheduleIsReady')
        : isAdjusting
          ? t('aiAutofillUi.autofillLoadingOverlay.updatingYourSchedule')
          : t('aiAutofillUi.autofillLoadingOverlay.fillingYourSchedule');
    const progressLabel =
        isFinishing && progressValue === 100
            ? t('aiAutofillUi.autofillLoadingOverlay.complete')
            : t('aiAutofillUi.autofillLoadingOverlay.estimatedProgress');

    return createPortal(
        <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal={!sidebarOpen}
            aria-labelledby="ai-autofill-loading-title"
            data-ai-autofill-loading="true"
            className={`fixed z-[1401] flex flex-col items-center overflow-y-auto bg-[#121726]/55 p-4 ${sidebarOpen ? 'inset-x-0 top-0 bottom-[50dvh] md:right-[var(--make-ai-adjust-sidebar-width,407px)] md:bottom-0' : 'inset-0'}`}
            onKeyDown={(event) => {
                if (backgroundMode && event.key === 'Tab') {
                    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
                    const first = buttons[0];
                    const last = buttons[buttons.length - 1];

                    if (
                        first &&
                        (event.target === event.currentTarget ||
                            (!event.shiftKey && event.target === last) ||
                            (event.shiftKey && event.target === first))
                    ) {
                        event.preventDefault();
                        (event.shiftKey ? last : first)?.focus();
                    }
                }

                if (event.key === 'Escape' && onBackground && !isFinishing) {
                    event.stopPropagation();
                    onBackground();
                }
            }}
        >
            <div className="my-auto w-full max-w-[420px] shrink-0 rounded-[20px] bg-white px-5 py-5 text-center sm:px-7 sm:py-8">
                <div aria-hidden="true" className="mx-auto grid size-[60px] grid-cols-3 gap-1 p-3">
                    {Array.from({length: 9}, (_, cell) => (
                        <span
                            key={cell}
                            className={`rounded-[3px] bg-main-1 ${isFinishing ? '' : 'ai-adjust-review-dot'}`}
                            style={{animationDelay: `${(cell % 3) * 0.18 + Math.floor(cell / 3) * 0.12}s`}}
                        />
                    ))}
                </div>
                <p
                    id="ai-autofill-loading-title"
                    className="mt-4 font-apple text-xl leading-[1.35] font-bold text-sub-1 sm:mt-5 sm:text-2xl"
                >
                    {title}
                </p>
                <p
                    className="mx-auto mt-2 max-w-[300px] font-apple text-[13px] leading-[1.6] font-medium text-gray-3 sm:text-[15px]"
                    aria-live="polite"
                >
                    {isFinishing
                        ? t('aiAutofillUi.autofillLoadingOverlay.yourResultWillAppearShortly')
                        : t('aiAutofillUi.autofillLoadingOverlay.requestedAndFixedShiftsStayInPlace')}
                </p>
                <div className="mt-5 sm:mt-7">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressValue}
                        aria-valuetext={`${progressLabel} ${progressValue}%`}
                        aria-label={t('page.makeShift.aiRefill.loadingOverlay.ariaLabel')}
                        className="h-2 overflow-hidden rounded-full bg-[#ECE6FF]"
                    >
                        <div className="h-full rounded-full bg-main-1" style={{width: `${progress}%`}} />
                    </div>
                    <div className="mt-3 flex justify-end gap-2 font-apple text-[13px] font-semibold">
                        <span className="font-normal text-gray-3">{progressLabel}</span>
                        <span className="shrink-0 font-poppins text-main-1 tabular-nums">{progressValue}%</span>
                    </div>
                </div>
                {onBackground && !isFinishing && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 border-t border-gray-6 pt-1 font-apple text-[13px] leading-5 sm:text-sm">
                        <button
                            type="button"
                            onClick={onBackground}
                            className="min-h-11 rounded-lg px-2 text-[#475467] hover:bg-gray-6 focus-visible:outline-2 focus-visible:outline-main-1"
                        >
                            {t('aiAutofillUi.executionPresentation.continueInBackground')}
                        </button>
                        {onOpenConversation && (
                            <button
                                type="button"
                                onClick={onOpenConversation}
                                className="min-h-11 rounded-lg px-2 text-main-1 hover:bg-main-light focus-visible:outline-2 focus-visible:outline-main-1"
                            >
                                {t('aiAutofillUi.executionPresentation.openConversation')}
                            </button>
                        )}
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={cancelling}
                                className="min-h-11 rounded-lg px-2 text-[#475467] hover:bg-gray-6 focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-50"
                            >
                                {t('aiAutofillUi.conversationOperationStatus.cancelBackground')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        portalContainer,
    );
}
