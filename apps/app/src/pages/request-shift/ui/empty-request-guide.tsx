import {cn} from '@dutying/utils/style';
import {type ReactNode, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import emptyRequestGuideImage from '@/shared/assets/images/dutying-empty-request-guide.png';
import {resolveAndroidPlayStoreUrl, resolveIosAppStoreUrl} from '@/shared/config/invite';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

const EMPTY_REQUEST_GUIDE_DELAY_MS = 1_000;

type TEmptyRequestGuideProps = {
    children: ReactNode;
    contentTestId?: string;
    directEntryText?: string;
    enabled: boolean;
    resetKey: string;
    wrapperClassName?: string;
};

export function EmptyRequestGuide({
    children,
    contentTestId,
    directEntryText,
    enabled,
    resetKey,
    wrapperClassName,
}: TEmptyRequestGuideProps) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [hasShown, setHasShown] = useState(false);
    const currentLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
    const iosAppStoreUrl = resolveIosAppStoreUrl([currentLanguage]);
    const androidPlayStoreUrl = resolveAndroidPlayStoreUrl([currentLanguage]);

    useEffect(() => {
        setIsOpen(false);
        setHasShown(false);
    }, [resetKey]);

    useEffect(() => {
        if (!enabled || hasShown) return;

        const timeoutId = window.setTimeout(() => {
            setHasShown(true);
            setIsOpen(true);
        }, EMPTY_REQUEST_GUIDE_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [enabled, hasShown]);

    useEffect(() => {
        if (enabled) return;

        setIsOpen(false);
    }, [enabled]);

    return (
        <div className={cn('relative flex min-h-0 flex-col', wrapperClassName)}>
            <div
                data-testid={contentTestId}
                className={cn(
                    'flex min-h-0 flex-1 flex-col transition-[filter,opacity] duration-500 ease-out motion-reduce:transition-none',
                    isOpen && 'pointer-events-none opacity-65 blur-[3px]',
                )}
                aria-hidden={isOpen}
                inert={isOpen}
            >
                {children}
            </div>

            {isOpen ? (
                <div
                    className="absolute inset-0 z-20 scrollbar-hide flex min-h-[420px] items-center justify-center overflow-x-hidden overflow-y-auto px-3 py-6 sm:px-4 sm:py-8"
                    role="dialog"
                    aria-labelledby="empty-request-guide-title"
                    aria-describedby="empty-request-guide-description"
                    aria-live="polite"
                    aria-atomic="true"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setIsOpen(false);
                    }}
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-white/45 backdrop-blur-[3px]"
                        style={{
                            WebkitMaskImage: 'radial-gradient(ellipse at center, black 44%, rgba(0, 0, 0, 0.78) 67%, transparent 100%)',
                            maskImage: 'radial-gradient(ellipse at center, black 44%, rgba(0, 0, 0, 0.78) 67%, transparent 100%)',
                        }}
                    />
                    <div className="relative z-10 my-auto w-full max-w-[640px] min-w-0 animate-in rounded-[24px] bg-white px-4 pt-4 pb-5 text-center shadow-[0_10px_32px_rgba(25,31,40,0.10)] duration-500 ease-out fade-in-0 zoom-in-95 slide-in-from-bottom-2 motion-reduce:animate-none sm:rounded-[32px] sm:px-10 sm:pt-5 sm:pb-8">
                        <button
                            type="button"
                            aria-label={t('page.request.emptyGuide.close')}
                            className="absolute top-4 right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 hover:text-sub-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none motion-reduce:transition-none sm:top-5 sm:right-5"
                            onClick={() => setIsOpen(false)}
                            autoFocus
                        >
                            <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6.53 5.47a.75.75 0 0 0-1.06 1.06L10.94 12l-5.47 5.47a.75.75 0 1 0 1.06 1.06L12 13.06l5.47 5.47a.75.75 0 1 0 1.06-1.06L13.06 12l5.47-5.47a.75.75 0 1 0-1.06-1.06L12 10.94 6.53 5.47Z" />
                            </svg>
                        </button>
                        <img
                            src={emptyRequestGuideImage}
                            alt=""
                            aria-hidden="true"
                            className="mx-auto h-[88px] w-[132px] object-contain min-[360px]:h-[108px] min-[360px]:w-[162px] sm:h-[124px] sm:w-[186px]"
                        />
                        <h2
                            id="empty-request-guide-title"
                            className="mx-auto mt-4 max-w-full font-apple text-[20px] leading-[1.38] font-semibold tracking-[-0.025em] [text-wrap:balance] break-normal [overflow-wrap:anywhere] whitespace-normal text-sub-1 min-[360px]:text-[22px] sm:mt-5 sm:text-[25px]"
                        >
                            {t('page.request.emptyGuide.title')}
                        </h2>
                        <div
                            id="empty-request-guide-description"
                            className="mx-auto mt-3 max-w-[570px] min-w-0 font-apple text-[15px] leading-6 font-medium break-normal [overflow-wrap:anywhere] whitespace-normal text-gray-3 sm:text-[16px] sm:leading-7"
                        >
                            <p className="[text-wrap:pretty] [overflow-wrap:anywhere]">{t('page.request.emptyGuide.description')}</p>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                                <a
                                    href={iosAppStoreUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-[14px] font-semibold whitespace-nowrap text-sub-1 no-underline transition-colors hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none motion-reduce:transition-none sm:text-[15px]"
                                >
                                    <img src="/img/apple.png" alt="" aria-hidden="true" className="size-5 shrink-0 object-contain" />
                                    App Store
                                </a>
                                <a
                                    href={androidPlayStoreUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-[14px] font-semibold whitespace-nowrap text-sub-1 no-underline transition-colors hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none motion-reduce:transition-none sm:text-[15px]"
                                >
                                    <img src="/img/play.png" alt="" aria-hidden="true" className="size-5 shrink-0 object-contain" />
                                    Google Play
                                </a>
                            </div>
                            <p className="mt-4 rounded-[16px] bg-gray-7 px-3 py-3 text-[14px] leading-5.5 [text-wrap:pretty] [overflow-wrap:anywhere] text-gray-3 sm:px-4 sm:text-[15px] sm:leading-6">
                                {directEntryText ?? t('page.request.emptyGuide.directEntry')}
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
