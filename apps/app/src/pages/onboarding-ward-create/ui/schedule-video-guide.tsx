import * as Dialog from '@radix-ui/react-dialog';
import {useEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TOnboardingTutorialVideo} from '../model/tutorial-video';

const GUIDE_BUTTON_CLASS =
    'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-black px-4 font-apple text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#262626] focus-visible:bg-[#EEE8FA] focus-visible:text-black motion-reduce:transition-none';
const PLAYER_CONTROL_CLASS =
    'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#302B3A] px-3 font-apple text-sm font-semibold text-white transition-colors hover:bg-[#45404F] focus-visible:bg-white focus-visible:text-[#19151F] motion-reduce:transition-none';
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function VideoPlayer({
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
        <div className="relative aspect-video max-h-[calc(100dvh-176px)] shrink-0 overflow-hidden bg-black">
            <video
                ref={videoRef}
                src={video.src}
                poster={video.poster}
                aria-label={t('page.onboardingWardCreate.video.title')}
                className="h-full w-full object-contain"
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

function ScheduleVideoGuide({video}: {video: TOnboardingTutorialVideo}) {
    const {t} = useTypedTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [playbackAttempt, setPlaybackAttempt] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);

    return (
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Trigger asChild>
                <button type="button" className={GUIDE_BUTTON_CLASS}>
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="currentColor">
                        <path d="M6 3.8a1 1 0 0 1 1.5-.86l9.3 5.35a1.98 1.98 0 0 1 0 3.42l-9.3 5.35A1 1 0 0 1 6 16.2V3.8Z" />
                    </svg>
                    <span>{t('page.onboardingWardCreate.video.action')}</span>
                    <span>· {video.durationLabel}</span>
                </button>
            </Dialog.Trigger>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#111019]/70 backdrop-blur-[8px]" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className="fixed top-1/2 left-1/2 z-[1101] flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[1120px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl bg-[#19151F] sm:rounded-3xl"
                >
                    <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
                        <Dialog.Title className="font-apple text-base font-semibold text-white sm:text-lg">
                            {t('page.onboardingWardCreate.video.title')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className={`${PLAYER_CONTROL_CLASS} size-11`}
                                aria-label={t('page.onboardingWardCreate.video.close')}
                            >
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
                                    <path d="m5.05 3.64 4.95 4.95 4.95-4.95 1.41 1.41L11.41 10l4.95 4.95-1.41 1.41L10 11.41l-4.95 4.95-1.41-1.41L8.59 10 3.64 5.05Z" />
                                </svg>
                            </button>
                        </Dialog.Close>
                    </div>
                    <VideoPlayer
                        key={playbackAttempt}
                        video={video}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={setPlaybackRate}
                        onRetry={() => setPlaybackAttempt((attempt) => attempt + 1)}
                    />
                    <label className="flex shrink-0 items-center justify-end gap-3 px-4 py-3 font-apple text-sm text-[#D8D2E2] sm:px-6">
                        <span>{t('page.onboardingWardCreate.video.playbackSpeed')}</span>
                        <select
                            className={PLAYER_CONTROL_CLASS}
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
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export default ScheduleVideoGuide;
