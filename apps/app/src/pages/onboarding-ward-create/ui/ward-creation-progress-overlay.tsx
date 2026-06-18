import {LoaderCircle} from 'lucide-react';
import {useEffect, useState} from 'react';
import {CheckmarkIcon} from 'react-hot-toast';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';

const INITIAL_PROGRESS = 12;
const FAST_PROGRESS_TARGET = 90;
const SLOW_PROGRESS_LIMIT = 96;
const FAST_PROGRESS_DURATION_MS = 1800;
const SLOW_PROGRESS_DURATION_MS = 6500;
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const clampProgressRatio = (value: number) => Math.max(0, Math.min(1, value));
const getSimulatedProgress = (elapsedMs: number) => {
    if (elapsedMs <= FAST_PROGRESS_DURATION_MS) {
        const progressRatio = easeOutCubic(clampProgressRatio(elapsedMs / FAST_PROGRESS_DURATION_MS));

        return INITIAL_PROGRESS + (FAST_PROGRESS_TARGET - INITIAL_PROGRESS) * progressRatio;
    }

    const slowProgressRatio = clampProgressRatio((elapsedMs - FAST_PROGRESS_DURATION_MS) / SLOW_PROGRESS_DURATION_MS);
    const easedSlowProgressRatio = 1 - Math.exp(-4 * slowProgressRatio);

    return FAST_PROGRESS_TARGET + (SLOW_PROGRESS_LIMIT - FAST_PROGRESS_TARGET) * easedSlowProgressRatio;
};
const getCreationProgressMessageKey = (progress: number, isComplete: boolean): TI18nKey => {
    if (isComplete) {
        return 'page.onboardingWardCreate.progress.navigateDuty';
    }

    if (progress < 45) {
        return 'page.onboardingWardCreate.progress.inputWardInfo';
    }

    if (progress < 75) {
        return 'page.onboardingWardCreate.progress.shiftTypesAndTeams';
    }

    if (progress < 90) {
        return 'page.onboardingWardCreate.progress.nurses';
    }

    return 'page.onboardingWardCreate.progress.finalCheck';
};

type TWardCreationProgressOverlayProps = {
    isComplete: boolean;
};

function WardCreationProgressOverlay({isComplete}: TWardCreationProgressOverlayProps) {
    const {t} = useTypedTranslation();
    const [progress, setProgress] = useState(() => (isComplete ? 100 : INITIAL_PROGRESS));

    useEffect(() => {
        if (isComplete) {
            setProgress(100);

            return undefined;
        }

        setProgress(INITIAL_PROGRESS);

        const startTime = performance.now();

        let animationFrameId = 0;

        const updateProgress = (currentTime: number) => {
            setProgress(getSimulatedProgress(currentTime - startTime));
            animationFrameId = window.requestAnimationFrame(updateProgress);
        };

        animationFrameId = window.requestAnimationFrame(updateProgress);

        return () => window.cancelAnimationFrame(animationFrameId);
    }, [isComplete]);

    const progressValue = Math.round(progress);
    const message = t(getCreationProgressMessageKey(progressValue, isComplete));

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ward-creation-progress-title"
            className="fixed inset-0 z-[100002] flex items-center justify-center bg-[#17132E]/62 px-4 backdrop-blur-[3px]"
        >
            <div className="w-full max-w-[420px] rounded-[20px] bg-white px-7 py-8 text-center shadow-[0_22px_80px_rgba(45,32,92,0.24)]">
                <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F3F4F6] text-main-1">
                    {isComplete ? (
                        <div className="scale-[1.72]">
                            <CheckmarkIcon primary="#61D345" secondary="#FFFFFF" />
                        </div>
                    ) : (
                        <LoaderCircle className="h-[22px] w-[22px] animate-spin" />
                    )}
                </div>
                <p id="ward-creation-progress-title" className="mt-5 font-apple text-[24px] leading-[1.35] font-bold text-sub-1">
                    {isComplete
                        ? t('page.onboardingWardCreate.progress.completeTitle')
                        : t('page.onboardingWardCreate.progress.settingTitle')}
                </p>
                <div className="mt-7">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressValue}
                        aria-label={t('page.onboardingWardCreate.progress.ariaLabel')}
                        className="h-2 overflow-hidden rounded-full bg-[#ECE6FF]"
                    >
                        <div
                            className="h-full origin-left rounded-full bg-main-1 will-change-transform"
                            style={{transform: `scaleX(${progress / 100})`}}
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-apple text-[13px] font-semibold">
                        <span className="min-w-0 text-left text-gray-3">{message}</span>
                        <span className="shrink-0 font-poppins text-main-1">{progressValue}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WardCreationProgressOverlay;
