import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TOnboardingTutorialVideo} from '../model/tutorial-video';

const GUIDE_BUTTON_CLASS =
    'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#EEE8FA] px-3 font-apple text-sm font-semibold text-[#6241A5] transition-colors hover:bg-[#E3D8F7] focus-visible:bg-[#6241A5] focus-visible:text-white motion-reduce:transition-none sm:px-4';
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function InlineVideoPlayer({
    video,
    playbackRate,
    onPlaybackRateChange,
    onRetry,
}: {
    video: TOnboardingTutorialVideo;
    playbackRate: number;
    onPlaybackRateChange: (rate: number) => void;
    onRetry: () => void;
}) {
    const {t} = useTypedTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);

    useEffect(() => {
        const element = videoRef.current;

        if (!element) return;

        // Restore the source when React replays effects in Strict Mode.
        if (element.getAttribute('src') !== video.src) {
            element.src = video.src;
        }

        return () => {
            element.pause();
            element.removeAttribute('src');
            element.load();
        };
    }, [video.src]);

    useEffect(() => {
        const element = videoRef.current;

        if (!element) return;

        element.defaultPlaybackRate = playbackRate;
        element.playbackRate = playbackRate;
    }, [playbackRate]);

    return (
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#19151F]">
            <video
                ref={videoRef}
                src={video.src}
                poster={video.poster}
                aria-label={t('page.onboardingWardCreate.video.title')}
                className="h-full w-full"
                width={1920}
                height={1080}
                controls
                playsInline
                autoPlay
                preload="none"
                onLoadedMetadata={(event) => {
                    event.currentTarget.playbackRate = playbackRate;
                }}
                onRateChange={(event) => onPlaybackRateChange(event.currentTarget.playbackRate)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onCanPlay={() => setIsBuffering(false)}
                onError={() => setHasError(true)}
            />
            {isBuffering && !hasError ? (
                <p role="status" className="pointer-events-none absolute top-3 left-3 rounded-lg bg-white px-3 py-2 text-sm text-text-1">
                    {t('page.onboardingWardCreate.video.loading')}
                </p>
            ) : null}
            {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#F4F0FA] p-4 text-center">
                    <p role="alert" className="text-sm text-text-1">
                        {t('page.onboardingWardCreate.video.error')}
                    </p>
                    <button type="button" className={GUIDE_BUTTON_CLASS} onClick={onRetry}>
                        {t('page.onboardingWardCreate.video.retry')}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function ScheduleVideoGuide({video, children}: {video: TOnboardingTutorialVideo; children: ReactNode}) {
    const {t} = useTypedTranslation();
    const panelId = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [playbackAttempt, setPlaybackAttempt] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const closeVideo = () => {
        setIsOpen(false);
        buttonRef.current?.focus();
    };

    return (
        <div className="mb-10">
            <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-6">
                {children}
                <button
                    ref={buttonRef}
                    type="button"
                    className={GUIDE_BUTTON_CLASS}
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? panelId : undefined}
                    onClick={() => setIsOpen((open) => !open)}
                >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="currentColor">
                        <path d="M6 3.8a1 1 0 0 1 1.5-.86l9.3 5.35a1.98 1.98 0 0 1 0 3.42l-9.3 5.35A1 1 0 0 1 6 16.2V3.8Z" />
                    </svg>
                    <span>{t('page.onboardingWardCreate.video.action')}</span>
                    <span className="hidden tabular-nums sm:inline">· {video.durationLabel}</span>
                </button>
            </div>
            {isOpen ? (
                <section
                    id={panelId}
                    aria-label={t('page.onboardingWardCreate.video.title')}
                    className="mt-6 max-w-[960px]"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            closeVideo();
                        }
                    }}
                >
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <h2 className="font-apple text-base font-semibold text-text-1">{t('page.onboardingWardCreate.video.title')}</h2>
                        <button type="button" className={GUIDE_BUTTON_CLASS} onClick={closeVideo}>
                            {t('page.onboardingWardCreate.video.close')}
                        </button>
                    </div>
                    <InlineVideoPlayer
                        key={playbackAttempt}
                        video={video}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={setPlaybackRate}
                        onRetry={() => setPlaybackAttempt((attempt) => attempt + 1)}
                    />
                    <label className="mt-3 flex items-center justify-end gap-3 font-apple text-sm text-gray-3">
                        <span>{t('page.onboardingWardCreate.video.playbackSpeed')}</span>
                        <select
                            className={GUIDE_BUTTON_CLASS}
                            value={playbackRate}
                            onChange={(event) => setPlaybackRate(Number(event.target.value))}
                        >
                            {PLAYBACK_RATES.map((rate) => (
                                <option key={rate} value={rate}>
                                    {Number.isInteger(rate) ? rate.toFixed(1) : rate}×
                                </option>
                            ))}
                            {!PLAYBACK_RATES.includes(playbackRate) ? <option value={playbackRate}>{playbackRate}×</option> : null}
                        </select>
                    </label>
                </section>
            ) : null}
        </div>
    );
}

export default ScheduleVideoGuide;
