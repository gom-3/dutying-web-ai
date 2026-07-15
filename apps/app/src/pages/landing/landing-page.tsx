import type {TPreferredLanguage} from '@dutying/domain';
import * as Dialog from '@radix-ui/react-dialog';
import {CalendarDays, ChevronDown, Globe, MessageCircle, UsersRound, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router';
import type {TAccount} from '@/entities/account';
import {ProfileImage} from '@/entities/account/ui/profile-image';
import useAuth from '@/features/auth';
import {ProfileContent} from '@/pages/profile';
import ROUTE from '@/shared/constant/path';
import {getIsPhoneDevice, usePhoneDevice} from '@/shared/hook/use-phone-device';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {normalizePreferredLanguage, SUPPORTED_LANGUAGES} from '@/shared/i18n/locale';
import './landing-page.css';

const appStoreLink = 'https://abr.ge/bv13wa';
const inquiryLink = 'https://ye620.channel.io';
const termsOfServiceLink = 'https://www.notion.so/37698c0fae2580d1a3d2dcbb0c163fc9?source=copy_link';
const privacyPolicyLink = 'https://www.notion.so/35c98c0fae25805cb6d5e2ce5f591f42?source=copy_link';
const webMakeLoginLink = `${ROUTE.LOGIN}?next=%2Fmake`;
const getWebMakeLink = (isAuth: boolean) => (isAuth ? ROUTE.MAKE : webMakeLoginLink);
const webCtaIconSrc = '/img/web.png';
const appCtaIconSrc = '/img/app.png';
const softPurpleBackground = 'bg-[linear-gradient(135deg,#FEFDFF_0%,#FBF9FF_48%,#F7F3FF_100%)]';
const landingViewPreferenceKey = 'dutying:landing-view-preference';
const desktopViewportMetaContent = 'width=1180';
const languageOptions = SUPPORTED_LANGUAGES;
const landingHeroImageByLanguage: Record<TPreferredLanguage, string> = {
    ko: '/img/landing-hero-kr.png',
    ja: '/img/landing-hero-jp.png',
    en: '/img/landing-hero-en.png',
    zh: '/img/landing-hero-cn.png',
    th: '/img/landing-hero-en.png',
    vi: '/img/landing-hero-en.png',
};
const landingWorkScheduleImageByLanguage: Record<TPreferredLanguage, string> = {
    ko: '/img/landing-work-schedule-2.png',
    ja: '/img/landing-work-schedule-jp.png',
    en: '/img/landing-work-schedule-en.png',
    zh: '/img/landing-work-schedule-cn.png',
    th: '/img/landing-work-schedule-th.png',
    vi: '/img/landing-work-schedule-vn.png',
};
const heroTitlePhraseKeys = ['page.landing.hero.phraseSchedule', 'page.landing.hero.phraseWard'] as const;
const mobileHeroPhraseSpecs = [
    {
        ariaLabelKey: 'page.landing.mobileHero.scheduleAria',
        lineKeys: ['page.landing.mobileHero.scheduleLine1', 'page.landing.mobileHero.scheduleLine2'],
    },
    {
        ariaLabelKey: 'page.landing.mobileHero.requestAria',
        lineKeys: ['page.landing.mobileHero.requestLine1', 'page.landing.mobileHero.requestLine2'],
    },
    {
        ariaLabelKey: 'page.landing.mobileHero.wardAria',
        lineKeys: ['page.landing.mobileHero.wardLine1', 'page.landing.mobileHero.wardLine2'],
    },
    {
        ariaLabelKey: 'page.landing.mobileHero.communityAria',
        lineKeys: ['page.landing.mobileHero.communityLine1', 'page.landing.mobileHero.communityLine2'],
    },
] as const satisfies readonly {ariaLabelKey: TI18nKey; lineKeys: readonly TI18nKey[]}[];
const featureSectionSpecs = [
    {
        id: 'ai',
        labelKey: 'page.landing.feature.ai.label',
        titleKey: 'page.landing.feature.ai.title',
        descriptionKey: 'page.landing.feature.ai.description',
        image: '/img/124.png',
        align: 'right',
        background: 'bg-white',
    },
    {
        id: 'review',
        labelKey: 'page.landing.feature.review.label',
        titleKey: 'page.landing.feature.review.title',
        descriptionKey: 'page.landing.feature.review.description',
        image: '/img/landing_3.webp',
        align: 'left',
        background: softPurpleBackground,
    },
    {
        id: 'integration',
        labelKey: 'page.landing.feature.integration.label',
        titleKey: 'page.landing.feature.integration.title',
        titleHighlightKeys: ['page.landing.feature.integration.highlight'],
        descriptionKey: 'page.landing.feature.integration.description',
        image: '/img/landing-work-schedule-2.png',
        align: 'left',
        background: 'bg-white',
    },
    {
        id: 'ward',
        labelKey: 'page.landing.feature.ward.label',
        titleKey: 'page.landing.feature.ward.title',
        titleHighlightKeys: ['page.landing.feature.ward.highlightNurse', 'page.landing.feature.ward.highlightShare'],
        descriptionKey: 'page.landing.feature.ward.description',
        image: '/img/image-1002.png',
        align: 'left',
        background: 'bg-white',
    },
] as const satisfies readonly {
    id: string;
    labelKey: TI18nKey;
    titleKey: TI18nKey;
    titleHighlightKeys?: readonly TI18nKey[];
    descriptionKey: TI18nKey;
    image: string;
    align: 'left' | 'right';
    background: string;
}[];
const appFeatureSectionSpecs = [
    {
        id: 'app-home',
        labelKey: 'page.landing.appFeature.home.label',
        titleKey: 'page.landing.appFeature.home.title',
        titleHighlightKeys: ['page.landing.appFeature.home.highlightSchedule', 'page.landing.appFeature.home.highlightPersonal'],
        descriptionKey: 'page.landing.appFeature.home.description',
        image: '/img/213213123123.png',
        reverse: false,
        background: 'bg-white',
    },
    {
        id: 'app-ward',
        labelKey: 'page.landing.appFeature.ward.label',
        titleKey: 'page.landing.appFeature.ward.title',
        titleHighlightKeys: ['page.landing.appFeature.ward.highlight'],
        descriptionKey: 'page.landing.appFeature.ward.description',
        image: '/img/ward-schedule.png',
        reverse: true,
        background: softPurpleBackground,
    },
    {
        id: 'app-community',
        labelKey: 'page.landing.appFeature.community.label',
        titleKey: 'page.landing.appFeature.community.title',
        titleHighlightKeys: ['page.landing.appFeature.community.highlight'],
        descriptionKey: 'page.landing.appFeature.community.description',
        image: '/img/12223.png',
        reverse: false,
        background: 'bg-white',
    },
] as const satisfies readonly {
    id: string;
    labelKey: TI18nKey;
    titleKey: TI18nKey;
    titleHighlightKeys?: readonly TI18nKey[];
    descriptionKey: TI18nKey;
    image: string;
    reverse: boolean;
    background: string;
}[];
const mobileAppBenefitSpecs = [
    {
        titleKey: 'page.landing.mobileBenefits.schedule.title',
        descriptionKey: 'page.landing.mobileBenefits.schedule.description',
        icon: CalendarDays,
    },
    {
        titleKey: 'page.landing.mobileBenefits.ward.title',
        descriptionKey: 'page.landing.mobileBenefits.ward.description',
        icon: UsersRound,
    },
    {
        titleKey: 'page.landing.mobileBenefits.community.title',
        descriptionKey: 'page.landing.mobileBenefits.community.description',
        icon: MessageCircle,
    },
] as const satisfies readonly {titleKey: TI18nKey; descriptionKey: TI18nKey; icon: typeof CalendarDays}[];

type TLandingViewPreference = 'auto' | 'desktop';

function getInitialLandingViewPreference(): TLandingViewPreference {
    if (typeof window === 'undefined') {
        return 'auto';
    }

    if (getIsPhoneDevice()) {
        return 'auto';
    }

    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');

    if (viewParam === 'desktop' || viewParam === 'pc') {
        return 'desktop';
    }

    try {
        return window.localStorage.getItem(landingViewPreferenceKey) === 'desktop' ? 'desktop' : 'auto';
    } catch {
        return 'auto';
    }
}

function updateLandingViewUrl(preference: TLandingViewPreference) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        const url = new URL(window.location.href);

        if (preference === 'desktop') {
            url.searchParams.set('view', 'desktop');
        } else {
            url.searchParams.delete('view');
        }

        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
        // URL updates are optional; rendering still works without them.
    }
}

function writeLandingViewPreference(preference: TLandingViewPreference) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (preference === 'desktop') {
            window.localStorage.setItem(landingViewPreferenceKey, preference);
        } else {
            window.localStorage.removeItem(landingViewPreferenceKey);
        }
    } catch {
        // Storage can be unavailable in restricted browser contexts.
    }
}

function getLandingHeroImageSrc(language?: string | null) {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? 'en';

    return landingHeroImageByLanguage[normalizedLanguage];
}

function getLandingWorkScheduleImageSrc(language?: string | null) {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? 'en';

    return landingWorkScheduleImageByLanguage[normalizedLanguage];
}

function useLandingViewportMode() {
    const [viewPreference, setViewPreference] = useState<TLandingViewPreference>(getInitialLandingViewPreference);
    const isPhoneDevice = usePhoneDevice();
    const isDesktopVersionForced = !isPhoneDevice && viewPreference === 'desktop';

    useEffect(() => {
        if (!isPhoneDevice || viewPreference !== 'desktop') {
            return;
        }

        writeLandingViewPreference('auto');
        updateLandingViewUrl('auto');
        setViewPreference('auto');
    }, [isPhoneDevice, viewPreference]);

    useEffect(() => {
        if (typeof document === 'undefined' || !isDesktopVersionForced) {
            return undefined;
        }

        const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

        if (!viewportMeta) {
            return undefined;
        }

        const originalContent = viewportMeta.getAttribute('content') ?? '';

        viewportMeta.setAttribute('content', desktopViewportMetaContent);

        return () => viewportMeta.setAttribute('content', originalContent);
    }, [isDesktopVersionForced]);

    const selectAutomaticVersion = () => {
        writeLandingViewPreference('auto');
        updateLandingViewUrl('auto');
        setViewPreference('auto');
    };

    return {
        isDesktopVersionForced,
        selectAutomaticVersion,
        showMobileAppLanding: isPhoneDevice,
    };
}

function useRevealOnScroll(refreshKey: string) {
    useEffect(() => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal-on-scroll'));

        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            elements.forEach((element) => element.classList.add('is-visible'));

            return undefined;
        }

        if (!('IntersectionObserver' in window)) {
            elements.forEach((element) => element.classList.add('is-visible'));

            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            },
            {
                rootMargin: '0px 0px -12% 0px',
                threshold: 0.14,
            },
        );

        elements.forEach((element) => observer.observe(element));

        return () => observer.disconnect();
    }, [refreshKey]);
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({text, highlights = []}: {text: string; highlights?: readonly string[]}) {
    if (highlights.length === 0) {
        return text;
    }

    const highlightedTextPattern = new RegExp(`(${highlights.map(escapeRegExp).join('|')})`, 'g');

    return text.split(highlightedTextPattern).map((part, index) =>
        highlights.includes(part) ? (
            <span key={`${part}-${index}`} className="text-highlight-soft">
                {part}
            </span>
        ) : (
            part
        ),
    );
}

function TextLines({children, highlights}: {children: string; highlights?: readonly string[]}) {
    const lines = children.split('\n');

    return (
        <>
            {lines.map((line, index) => (
                <span key={`${line}-${index}`} className="block">
                    <HighlightedText text={line} highlights={highlights} />
                </span>
            ))}
        </>
    );
}

type TLandingTranslator = ReturnType<typeof useTypedTranslation>['t'];
type TMobileHeroPhrase = {ariaLabel: string; lines: readonly string[]};
type TFeatureSection = {
    id: string;
    label: string;
    title: string;
    titleHighlights?: readonly string[];
    description: string;
    image: string;
    align: 'left' | 'right';
    background: string;
};
type TAppFeatureSection = {
    id: string;
    label: string;
    title: string;
    titleHighlights?: readonly string[];
    description: string;
    image: string;
    reverse: boolean;
    background: string;
};

function buildFeatureSections(t: TLandingTranslator, language?: string | null): TFeatureSection[] {
    return featureSectionSpecs.map((section) => ({
        ...section,
        image: section.id === 'integration' ? getLandingWorkScheduleImageSrc(language) : section.image,
        label: t(section.labelKey),
        title: t(section.titleKey),
        titleHighlights: 'titleHighlightKeys' in section ? section.titleHighlightKeys.map((key) => t(key)) : undefined,
        description: t(section.descriptionKey),
    }));
}

function buildAppFeatureSections(t: TLandingTranslator): TAppFeatureSection[] {
    return appFeatureSectionSpecs.map((section) => ({
        ...section,
        label: t(section.labelKey),
        title: t(section.titleKey),
        titleHighlights: 'titleHighlightKeys' in section ? section.titleHighlightKeys.map((key) => t(key)) : undefined,
        description: t(section.descriptionKey),
    }));
}

function buildMobileHeroPhrases(t: TLandingTranslator): TMobileHeroPhrase[] {
    return mobileHeroPhraseSpecs.map((phrase) => ({
        ariaLabel: t(phrase.ariaLabelKey),
        lines: phrase.lineKeys.map((key) => t(key)),
    }));
}

function Pill({children}: {children: string}) {
    return <span className="inline-flex rounded-[6px] bg-main-light px-3 py-1 text-sm font-bold text-main-1">{children}</span>;
}

function RotatingHeroPhrase({phrases}: {phrases: readonly string[]}) {
    const [rotationState, setRotationState] = useState<{activeIndex: number; previousIndex: number | null}>({
        activeIndex: 0,
        previousIndex: null,
    });

    useEffect(() => {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setRotationState(({activeIndex}) => ({
                activeIndex: (activeIndex + 1) % phrases.length,
                previousIndex: activeIndex,
            }));
        }, 2600);

        return () => window.clearInterval(intervalId);
    }, [phrases.length]);

    return (
        <span className="hero-title-rotator" aria-hidden="true">
            {phrases.map((phrase, index) => (
                <span
                    key={`${phrase}-${index}`}
                    className={`hero-gradient-text hero-title-rotator__item ${
                        rotationState.activeIndex === index ? 'is-active' : ''
                    } ${rotationState.previousIndex === index && rotationState.activeIndex !== index ? 'is-exiting' : ''}`}
                >
                    {phrase}
                </span>
            ))}
        </span>
    );
}

function RotatingMobileHeroPhrase({phrases}: {phrases: readonly TMobileHeroPhrase[]}) {
    const [rotationState, setRotationState] = useState<{activeIndex: number; previousIndex: number | null}>({
        activeIndex: 0,
        previousIndex: null,
    });
    const activePhrase = phrases[rotationState.activeIndex] ?? phrases[0];

    useEffect(() => {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setRotationState(({activeIndex}) => ({
                activeIndex: (activeIndex + 1) % phrases.length,
                previousIndex: activeIndex,
            }));
        }, 3000);

        return () => window.clearInterval(intervalId);
    }, [phrases.length]);

    return (
        <>
            <span className="sr-only">{activePhrase?.ariaLabel}</span>
            <span className="hero-title-rotator mobile-hero-title-rotator" aria-hidden="true">
                {phrases.map((phrase, index) => (
                    <span
                        key={`${phrase.ariaLabel}-${index}`}
                        className={`hero-gradient-text hero-title-rotator__item mobile-hero-title-rotator__item ${
                            rotationState.activeIndex === index ? 'is-active' : ''
                        } ${rotationState.previousIndex === index && rotationState.activeIndex !== index ? 'is-exiting' : ''}`}
                    >
                        {phrase.lines.map((line, lineIndex) => (
                            <span key={`${line}-${lineIndex}`} className="block">
                                {line}
                            </span>
                        ))}
                    </span>
                ))}
            </span>
        </>
    );
}

function StoreButton({store}: {store: 'google' | 'apple'}) {
    const label = store === 'google' ? 'Google Play' : 'App Store';
    const logoSrc = store === 'google' ? '/img/play.png' : '/img/apple.png';

    return (
        <a
            href={appStoreLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-base font-bold text-[#18151F] shadow-[0_12px_34px_rgba(18,20,31,0.12)] transition-transform hover:-translate-y-0.5 sm:w-[180px]"
        >
            <img src={logoSrc} alt="" aria-hidden="true" className="size-6 shrink-0 object-contain" />
            <span className="whitespace-nowrap">{label}</span>
        </a>
    );
}

function CtaIcon({src, className = 'size-5'}: {src: string; className?: string}) {
    return <img src={src} alt="" aria-hidden="true" className={`${className} shrink-0 object-contain`} />;
}

function ProfileSettingsDialog({open, onClose}: {open: boolean; onClose: () => void}) {
    const {t} = useTypedTranslation();
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1000] bg-[#121726]/45 backdrop-blur-[2px]" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className="fixed top-1/2 left-1/2 z-[1001] flex max-h-[calc(100svh-32px)] w-[calc(100vw-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-white/70 bg-white shadow-[0_20px_64px_rgba(18,23,38,0.18)] focus-visible:outline-none"
                >
                    <Dialog.Title className="sr-only">{t('page.landing.common.profile')}</Dialog.Title>
                    <Dialog.Close asChild>
                        <button
                            type="button"
                            className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-[#F2F4F6] text-[#6B7684] transition-colors hover:bg-[#E5E8EB] hover:text-[#333D4B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1"
                            aria-label={t('page.landing.common.profileClose')}
                        >
                            <X className="size-4" strokeWidth={2.2} />
                        </button>
                    </Dialog.Close>
                    <div className="min-h-0 overflow-y-auto overscroll-contain">
                        <ProfileContent layout="modal" />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function HeaderLanguageMenu() {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const currentLanguage = normalizePreferredLanguage(i18n.resolvedLanguage ?? i18n.language) ?? 'en';

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) {
                return;
            }

            setIsOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('touchstart', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('touchstart', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isOpen]);

    const getLanguageLabel = (language: TPreferredLanguage) => {
        switch (language) {
            case 'ko':
                return t('page.profile.language.ko');
            case 'ja':
                return t('page.profile.language.ja');
            case 'en':
                return t('page.profile.language.en');
            case 'zh':
                return t('page.profile.language.zh');
            case 'th':
                return t('page.profile.language.th');
            case 'vi':
                return t('page.profile.language.vi');
        }
    };
    const handleLanguageChange = (language: TPreferredLanguage) => {
        setIsOpen(false);
        void i18n.changeLanguage(language);
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={t('page.landing.common.languageSelect')}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex size-10 items-center justify-center rounded-full text-[#8B8797] transition-colors hover:bg-[#F5F2FA] hover:text-[#6F6B7A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1"
            >
                <Globe className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    aria-label={t('page.landing.common.languageSelect')}
                    className="absolute top-[calc(100%+10px)] right-0 z-50 w-44 overflow-hidden rounded-[8px] border border-[#E5DEF8] bg-white py-1 shadow-[0_18px_44px_rgba(37,22,91,0.16)]"
                >
                    {languageOptions.map((language) => {
                        const isSelected = language === currentLanguage;

                        return (
                            <button
                                key={language}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleLanguageChange(language)}
                                className={`flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-main-light hover:text-main-1 ${
                                    isSelected ? 'bg-main-light text-main-1' : 'text-[#5F557F]'
                                }`}
                            >
                                {getLanguageLabel(language)}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function HeaderActions({
    accountMe,
    isAuth,
    onLogout,
}: {
    accountMe: TAccount | null;
    isAuth: boolean;
    onLogout: (fallBackPath?: string) => Promise<void> | void;
}) {
    const {t} = useTypedTranslation();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const accountProfileImage = accountMe?.profileImgUrl ? {profileImgUrl: accountMe.profileImgUrl} : undefined;

    useEffect(() => {
        if (!isProfileMenuOpen) {
            return undefined;
        }

        const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (!(event.target instanceof Node) || profileMenuRef.current?.contains(event.target)) {
                return;
            }

            setIsProfileMenuOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('touchstart', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('touchstart', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isProfileMenuOpen]);

    if (!isAuth) {
        return (
            <>
                <nav
                    aria-label={t('page.navigationBar.items.account')}
                    className="flex h-10 items-center gap-2 px-1 text-sm font-bold text-[#150B3C]"
                >
                    <Link to={ROUTE.LOGIN} className="transition-colors hover:text-main-1">
                        {t('page.landing.common.login')}
                    </Link>
                    <span aria-hidden="true" className="text-[#A29BB7]">
                        |
                    </span>
                    <Link to={ROUTE.SIGN_UP} className="transition-colors hover:text-main-1">
                        {t('page.login.signupLink')}
                    </Link>
                </nav>
                <HeaderLanguageMenu />
            </>
        );
    }

    const closeProfileMenu = () => setIsProfileMenuOpen(false);
    const openProfileSettings = () => {
        closeProfileMenu();
        setIsProfileSettingsOpen(true);
    };
    const handleLogoutClick = () => {
        closeProfileMenu();
        void onLogout(ROUTE.ROOT);
    };

    return (
        <>
            <Link
                to={ROUTE.MAKE}
                aria-label={t('page.landing.common.makeSchedule')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-main-1 px-3 text-sm font-bold text-white transition-colors hover:bg-main-1-hover sm:px-4"
            >
                <CtaIcon src={webCtaIconSrc} className="size-4" />
                <span className="hidden sm:inline">{t('page.landing.common.makeSchedule')}</span>
                <span className="sm:hidden">{t('page.landing.common.schedule')}</span>
            </Link>
            <div ref={profileMenuRef} className="relative">
                <button
                    type="button"
                    aria-label={t('page.landing.common.profileMenu')}
                    aria-haspopup="menu"
                    aria-expanded={isProfileMenuOpen}
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="flex size-10 items-center justify-center rounded-full border border-[#E5DEF8] bg-white p-0.5 transition-colors hover:border-main-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1"
                >
                    <ProfileImage className="size-full" name={accountMe?.name} profileImg={accountProfileImage} />
                </button>

                {isProfileMenuOpen && (
                    <div
                        role="menu"
                        className="absolute top-[calc(100%+10px)] right-0 z-50 w-36 overflow-hidden rounded-[8px] border border-[#E5DEF8] bg-white py-1 shadow-[0_18px_44px_rgba(37,22,91,0.16)]"
                    >
                        <button
                            type="button"
                            role="menuitem"
                            onClick={openProfileSettings}
                            className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-[#5F557F] transition-colors hover:bg-main-light hover:text-main-1"
                        >
                            {t('page.landing.common.profile')}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogoutClick}
                            className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-[#5F557F] transition-colors hover:bg-main-light hover:text-main-1"
                        >
                            {t('page.landing.common.logout')}
                        </button>
                    </div>
                )}
            </div>
            <HeaderLanguageMenu />
            <ProfileSettingsDialog open={isProfileSettingsOpen} onClose={() => setIsProfileSettingsOpen(false)} />
        </>
    );
}

function DarkActionButton({type, isAuth}: {type: 'web' | 'app'; isAuth?: boolean}) {
    const {t} = useTypedTranslation();
    const isWeb = type === 'web';
    const iconSrc = isWeb ? webCtaIconSrc : appCtaIconSrc;
    const label = isWeb
        ? isAuth
            ? t('page.landing.common.makeSchedule')
            : t('page.landing.common.webMakeSchedule')
        : t('page.landing.common.appSchedule');
    const href = isWeb ? getWebMakeLink(Boolean(isAuth)) : appStoreLink;
    const className =
        'inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#060A12] px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5';

    if (isWeb) {
        return (
            <Link to={href} className={className}>
                <CtaIcon src={iconSrc} />
                {label}
            </Link>
        );
    }

    return (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
            <CtaIcon src={iconSrc} />
            {label}
        </a>
    );
}

function BackgroundFeatureSection({section}: {section: TFeatureSection}) {
    const {t} = useTypedTranslation();
    const isAiSection = section.id === 'ai';
    const isIntegrationSection = section.id === 'integration';
    const isWardSection = section.id === 'ward';
    const copy = (
        <article className="reveal-on-scroll relative z-10 max-w-[470px] text-left">
            <Pill>{section.label}</Pill>
            <h2 className="mt-6 text-[34px] leading-[1.35] font-extrabold text-[#11131A] md:text-[42px]">
                <TextLines highlights={'titleHighlights' in section ? section.titleHighlights : undefined}>{section.title}</TextLines>
            </h2>
            <p className="mt-12 text-lg leading-8 font-medium whitespace-pre-line text-[#777487]">{section.description}</p>
        </article>
    );

    if (isAiSection) {
        return (
            <section id={section.id} className={section.background}>
                <div className="landing-feature-section__inner mx-auto grid max-w-[1440px] items-center gap-14 px-5 py-20 md:grid-cols-[1.04fr_0.96fr] md:gap-20 md:px-8 md:py-28">
                    <picture className="reveal-on-scroll reveal-on-scroll--image mx-auto flex w-full max-w-[893px] items-center justify-center md:mx-0">
                        <img src={section.image} alt="" className="w-full max-w-[806px] object-contain object-center md:max-w-[893px]" />
                    </picture>

                    <div className="mr-auto w-full max-w-[470px] md:mx-0 lg:translate-x-10">{copy}</div>
                </div>
            </section>
        );
    }

    if (isIntegrationSection) {
        return (
            <section id={section.id} className={section.background}>
                <div className="landing-feature-section__inner mx-auto grid min-h-[680px] max-w-[1440px] items-center gap-12 px-5 py-20 md:min-h-[780px] md:grid-cols-[0.76fr_1.24fr] md:gap-10 md:px-8 md:py-28 lg:gap-12">
                    <div className="mr-auto w-full max-w-[470px] md:mx-0">{copy}</div>

                    <picture className="reveal-on-scroll reveal-on-scroll--image flex w-full justify-center md:justify-end">
                        <img
                            src={section.image}
                            alt={t('page.landing.imageAlt.integration')}
                            className="w-[93%] object-contain object-center"
                        />
                    </picture>
                </div>
            </section>
        );
    }

    if (isWardSection) {
        return (
            <section id={section.id} className={section.background}>
                <div className="landing-feature-section__inner mx-auto grid min-h-[680px] max-w-[1440px] items-center gap-12 px-5 py-20 md:min-h-[780px] md:grid-cols-[0.72fr_1.28fr] md:gap-10 md:px-8 md:py-28 lg:gap-14">
                    <div className="mr-auto w-full max-w-[470px] md:mx-0">{copy}</div>

                    <picture className="reveal-on-scroll reveal-on-scroll--image flex w-full justify-center md:justify-end">
                        <img
                            src={section.image}
                            alt={t('page.landing.imageAlt.wardBoard')}
                            className="w-full object-contain object-center md:w-[120%] md:max-w-[984px] md:translate-x-20 lg:translate-x-24"
                        />
                    </picture>
                </div>
            </section>
        );
    }

    return (
        <section id={section.id} className={`relative overflow-hidden ${section.background}`}>
            <div className="landing-feature-section__inner mx-auto flex min-h-[680px] max-w-[1440px] items-center justify-start px-5 py-20 md:min-h-[780px] md:px-8">
                {copy}
            </div>
        </section>
    );
}

function AppFeatureSection({section}: {section: TAppFeatureSection}) {
    const isHomeSection = section.id === 'app-home';
    const isWardSection = section.id === 'app-ward';
    const isCommunitySection = section.id === 'app-community';
    const imageMaxWidthClass = isHomeSection ? 'max-w-[566px]' : isCommunitySection ? 'max-w-[748px]' : 'max-w-[560px]';
    const imageClassName = isCommunitySection
        ? 'h-[506px] w-full object-contain object-center md:h-[792px]'
        : isHomeSection
          ? 'w-full object-contain object-center'
          : isWardSection
            ? 'w-full object-contain object-center'
            : 'h-[520px] w-full rounded-[24px] object-cover object-bottom shadow-[0_24px_80px_rgba(37,22,91,0.14)]';

    return (
        <section id={section.id} className={section.background}>
            <div
                className={`landing-app-feature-section__inner mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28 ${section.reverse ? 'md:[&>picture]:order-2' : ''}`}
            >
                <picture className={`reveal-on-scroll reveal-on-scroll--image mx-auto w-full ${imageMaxWidthClass}`}>
                    <img src={section.image} alt="" className={imageClassName} />
                </picture>

                <article
                    className={`reveal-on-scroll mr-auto w-full max-w-[470px] text-left ${section.reverse ? '' : 'md:mx-auto lg:translate-x-7 2xl:-translate-x-2'}`}
                >
                    <Pill>{section.label}</Pill>
                    <h2 className="mt-6 text-[32px] leading-[1.36] font-extrabold text-[#11131A] md:text-[40px]">
                        <TextLines highlights={'titleHighlights' in section ? section.titleHighlights : undefined}>
                            {section.title}
                        </TextLines>
                    </h2>
                    {isHomeSection && (
                        <div className="mt-14 flex items-center gap-3 md:mt-16 md:gap-4">
                            <img src="/img/image-992.png" alt="" className="h-[136px] w-auto rounded-[8px] object-contain md:h-[158px]" />
                            <img src="/img/image-991.png" alt="" className="h-[136px] w-auto rounded-[8px] object-contain md:h-[158px]" />
                        </div>
                    )}
                    <p className={`${isHomeSection ? 'mt-12' : 'mt-10'} text-lg leading-8 font-medium whitespace-pre-line text-[#777487]`}>
                        {section.description}
                    </p>
                </article>
            </div>
        </section>
    );
}

function MobileAppLanding() {
    const {t} = useTypedTranslation();
    const mobileHeroPhrases = buildMobileHeroPhrases(t);
    const mobileAppBenefits = mobileAppBenefitSpecs.map((benefit) => ({
        ...benefit,
        title: t(benefit.titleKey),
        description: t(benefit.descriptionKey),
    }));

    return (
        <main className="landing-main landing-main--mobile-app min-h-screen bg-white font-apple text-[#150B3C]">
            <header className="sticky top-0 z-50 border-b border-[#EEEAF8] bg-white/96 backdrop-blur">
                <div className="mx-auto flex h-15 max-w-[520px] items-center justify-between px-5">
                    <Link to={ROUTE.ROOT} aria-label={t('page.landing.header.homeAria')} className="flex shrink-0 items-center">
                        <img src="/img/group-19.png" alt="dutying" className="h-[27px] w-auto" />
                    </Link>

                    <a
                        href={appStoreLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-[8px] bg-main-1 px-4 text-sm font-bold text-white"
                    >
                        {t('page.landing.common.appDownload')}
                    </a>
                </div>
            </header>

            <section className={`relative overflow-hidden ${softPurpleBackground}`}>
                <div className="mx-auto flex min-h-[calc(100svh-60px)] max-w-[520px] flex-col px-5 pt-8 pb-7">
                    <div className="relative z-10">
                        <h1 className="reveal-on-scroll text-[36px] leading-[1.18] font-extrabold">
                            <RotatingMobileHeroPhrase phrases={mobileHeroPhrases} />
                        </h1>
                        <p className="reveal-on-scroll reveal-on-scroll--delay-1 mt-3 text-base leading-7 font-medium text-[#6F6B7A]">
                            {t('page.landing.mobileHero.description')}
                        </p>

                        <div className="reveal-on-scroll reveal-on-scroll--delay-1 mt-7 grid grid-cols-2 gap-3">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </div>

                    <picture className="reveal-on-scroll reveal-on-scroll--hero pointer-events-none mt-auto flex min-h-[310px] items-end justify-center pt-8">
                        <img
                            src="/img/iPhone 15_1.png"
                            alt={t('page.landing.imageAlt.mobileHero')}
                            className="w-[118%] max-w-[500px] -translate-x-3 object-contain"
                        />
                    </picture>
                </div>
            </section>

            <section className="bg-white px-5 py-14">
                <div className="mx-auto max-w-[520px]">
                    <Pill>{t('page.landing.mobileHero.benefitsLabel')}</Pill>
                    <h2 className="reveal-on-scroll mt-5 text-[26px] leading-[1.36] font-extrabold text-[#11131A]">
                        {t('page.landing.mobileHero.benefitsTitleLine1')}
                        <br />
                        {t('page.landing.mobileHero.benefitsTitleLine2')}
                    </h2>

                    <div className="mt-8 grid gap-3">
                        {mobileAppBenefits.map((benefit) => {
                            const Icon = benefit.icon;

                            return (
                                <article
                                    key={benefit.title}
                                    className="reveal-on-scroll flex gap-4 rounded-[8px] border border-[#EEEAF8] bg-white p-4 shadow-[0_14px_34px_rgba(37,22,91,0.06)]"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-main-light text-main-1">
                                        <Icon className="size-5" aria-hidden="true" />
                                    </span>
                                    <div>
                                        <h3 className="text-base font-extrabold text-[#11131A]">{benefit.title}</h3>
                                        <p className="mt-2 text-sm leading-6 font-medium text-[#777487]">{benefit.description}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-[#070D18] px-5 py-14 text-white">
                <div className="mx-auto max-w-[520px]">
                    <p className="text-sm font-extrabold text-[#D9CCFF]">{t('page.landing.mobileHero.downloadEyebrow')}</p>
                    <h2 className="mt-3 text-[26px] leading-[1.36] font-extrabold">
                        {t('page.landing.mobileHero.downloadTitleLine1')}
                        <br />
                        {t('page.landing.mobileHero.downloadTitleLine2')}
                    </h2>
                    <div className="mt-8 grid grid-cols-2 gap-3">
                        <StoreButton store="google" />
                        <StoreButton store="apple" />
                    </div>
                </div>
            </section>

            <footer className={`${softPurpleBackground} px-5 py-9 text-sm font-medium text-[#777487]`}>
                <div className="mx-auto flex max-w-[520px] flex-col gap-6">
                    <div className="flex flex-wrap gap-5">
                        <a href={termsOfServiceLink} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            {t('page.login.termsOfService')}
                        </a>
                        <a href={privacyPolicyLink} target="_blank" rel="noreferrer" className="font-bold hover:text-main-1">
                            {t('page.login.privacyPolicy')}
                        </a>
                    </div>
                    <p>{t('page.landing.common.copyright')}</p>
                </div>
            </footer>
        </main>
    );
}

function LandingPage() {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const {
        state: {accountMe, isAuth},
        actions: {handleLogout},
    } = useAuth();
    const webMakeLink = getWebMakeLink(isAuth);
    const {isDesktopVersionForced, selectAutomaticVersion, showMobileAppLanding} = useLandingViewportMode();
    const heroTitlePhrases = heroTitlePhraseKeys.map((key) => t(key));
    const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
    const heroImageSrc = getLandingHeroImageSrc(currentLanguage);
    const featureSections = buildFeatureSections(t, currentLanguage);
    const visibleFeatureSections = featureSections.filter((section) => section.id !== 'review');
    const appFeatureSections = buildAppFeatureSections(t);

    useRevealOnScroll(showMobileAppLanding ? 'mobile-app' : 'full-landing');

    if (showMobileAppLanding) {
        return <MobileAppLanding />;
    }

    return (
        <main
            className={`landing-main landing-main--web-fixed min-h-screen bg-white font-apple text-[#150B3C] ${
                isDesktopVersionForced ? 'landing-main--desktop-forced' : ''
            }`}
        >
            <header className="sticky top-0 z-50 border-b border-[#EEEAF8] bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:h-18 md:px-8">
                    <Link to={ROUTE.ROOT} aria-label={t('page.landing.header.homeAria')} className="flex shrink-0 items-center">
                        <img src="/img/group-19.png" alt="dutying" className="h-[28px] w-auto md:h-[32px]" />
                    </Link>

                    <nav
                        className="landing-section-nav hidden items-center gap-12 text-sm font-semibold text-[#5F557F] md:flex"
                        aria-label={t('page.landing.header.sectionAria')}
                    >
                        <a href="#web" className="transition-colors hover:text-main-1">
                            {t('page.landing.header.web')}
                        </a>
                        <a href="#app" className="transition-colors hover:text-main-1">
                            {t('page.landing.header.app')}
                        </a>
                        <a href={inquiryLink} target="_blank" rel="noreferrer" className="transition-colors hover:text-main-1">
                            {t('page.landing.header.inquiry')}
                        </a>
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <HeaderActions accountMe={accountMe} isAuth={isAuth} onLogout={handleLogout} />
                    </div>
                </div>
            </header>

            <section className={`relative overflow-hidden ${softPurpleBackground}`}>
                <div className="landing-hero-grid relative mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-8 px-5 pt-12 pb-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 md:px-8 md:pt-32 md:pb-6 lg:gap-20">
                    <div className="relative z-10 min-w-0">
                        <h1
                            aria-label={t('page.landing.hero.ariaLabel')}
                            className="landing-hero-title reveal-on-scroll max-w-[580px] text-[29px] leading-[1.28] font-extrabold md:text-[51px]"
                        >
                            <RotatingHeroPhrase phrases={heroTitlePhrases} />
                            <br />
                            <span className="hero-gradient-text">{t('page.landing.hero.suffix')}</span>
                        </h1>
                        <p className="landing-hero-description reveal-on-scroll reveal-on-scroll--delay-1 mt-5 max-w-[620px] text-base leading-7 font-medium text-[#6F6B7A] md:text-lg md:leading-8 2xl:whitespace-nowrap">
                            <TextLines>{t('page.landing.hero.description')}</TextLines>
                        </p>

                        <div className="landing-hero-actions reveal-on-scroll reveal-on-scroll--delay-1 mt-12 flex max-w-[560px] flex-col gap-4 sm:mt-16 sm:flex-row md:mt-28">
                            <DarkActionButton type="web" isAuth={isAuth} />
                            <DarkActionButton type="app" />
                        </div>
                    </div>

                    <picture
                        className="reveal-on-scroll reveal-on-scroll--hero pointer-events-none relative z-0 flex justify-center md:-mt-16 md:justify-end"
                        aria-hidden="true"
                    >
                        <img
                            src={heroImageSrc}
                            alt=""
                            className="w-[92vw] max-w-[520px] object-contain object-center md:w-[118%] md:max-w-none md:translate-x-8 lg:w-[131%] lg:translate-x-14"
                        />
                    </picture>
                </div>

                <ChevronDown
                    className="reveal-on-scroll reveal-on-scroll--delay-2 absolute bottom-9 left-1/2 size-8 -translate-x-1/2 text-[#B4B3BE]"
                    aria-hidden="true"
                />
            </section>

            <section id="web" className={softPurpleBackground}>
                <div className="landing-web-section__inner mx-auto grid max-w-[1440px] items-center gap-14 px-5 py-[6.9rem] md:grid-cols-[1.08fr_0.92fr] md:gap-24 md:px-8 md:py-[9.7rem]">
                    <div className="reveal-on-scroll reveal-on-scroll--image relative aspect-[1420/722] overflow-hidden rounded-[8px] shadow-[0_24px_80px_rgba(37,22,91,0.12)]">
                        <div className="absolute inset-0 rounded-[8px] bg-[#37404F]" aria-hidden="true" />
                        <img
                            src="/img/image-987.png"
                            alt={t('page.landing.imageAlt.webSchedule')}
                            className="absolute right-0 bottom-0 left-0 z-10 mx-auto w-[94%] object-contain"
                        />
                    </div>

                    <article className="reveal-on-scroll reveal-on-scroll--delay-1 text-left lg:translate-x-3">
                        <Pill>{t('page.landing.webSection.pill')}</Pill>
                        <h2 className="mt-6 text-[34px] leading-[1.35] font-extrabold text-[#11131A] md:text-[42px]">
                            {t('page.landing.webSection.titleLine1')}
                            <br />
                            {t('page.landing.webSection.titleLine2Prefix')}{' '}
                            <span className="text-highlight-soft">{t('page.landing.webSection.titleHighlight')}</span>{' '}
                            {t('page.landing.webSection.titleLine2Suffix')}
                        </h2>
                        <div className="landing-web-actions mt-10 flex flex-col gap-3 sm:flex-row">
                            {isAuth ? (
                                <Link
                                    to={webMakeLink}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-main-1 px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                                >
                                    <CtaIcon src={webCtaIconSrc} />
                                    {t('page.landing.common.makeSchedule')}
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to={webMakeLink}
                                        className="inline-flex h-12 items-center justify-center rounded-[10px] bg-[#060A12] px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                                    >
                                        {t('page.landing.common.tryDemo')}
                                    </Link>
                                    <Link
                                        to={ROUTE.LOGIN}
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-main-1 px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                                    >
                                        <CtaIcon src={webCtaIconSrc} />
                                        {t('page.landing.common.makeSchedule')}
                                    </Link>
                                </>
                            )}
                        </div>
                    </article>
                </div>
            </section>

            {visibleFeatureSections.map((section) => (
                <BackgroundFeatureSection key={section.id} section={section} />
            ))}

            <section id="app" className="relative overflow-hidden bg-[#070D18]">
                <div className="absolute inset-y-0 left-0 hidden w-[46%] bg-[#070D18] md:block" aria-hidden="true" />

                <div className="landing-app-section__inner relative mx-auto grid min-h-[520px] max-w-[1440px] items-center gap-10 px-5 py-20 md:grid-cols-[0.95fr_1.05fr] md:px-8">
                    <article className="reveal-on-scroll max-w-[500px] text-white">
                        <Pill>{t('page.landing.appSection.pill')}</Pill>
                        <h2 className="mt-6 text-[34px] leading-[1.36] font-extrabold md:text-[42px]">
                            {t('page.landing.appSection.titleLine1')}
                            <br />
                            {t('page.landing.appSection.titleLine2')}
                        </h2>
                        <div className="landing-cta-row mt-12 flex flex-col gap-4 sm:flex-row">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </article>

                    <img
                        src="/img/temp.png"
                        alt={t('page.landing.imageAlt.appScreen')}
                        className="reveal-on-scroll reveal-on-scroll--image mx-auto w-[120%] max-w-none rounded-[12px] object-contain md:-translate-x-10 lg:-translate-x-14"
                    />
                </div>

                <ChevronDown
                    className="reveal-on-scroll reveal-on-scroll--delay-1 absolute bottom-8 left-1/2 size-8 -translate-x-1/2 text-white/55"
                    aria-hidden="true"
                />
            </section>

            {appFeatureSections.map((section) => (
                <AppFeatureSection key={section.id} section={section} />
            ))}

            <section className="relative overflow-hidden bg-black">
                <div className="landing-final-cta__inner mx-auto grid min-h-[442px] max-w-[1440px] items-center gap-12 px-5 pt-[68px] pb-[23px] md:min-h-[476px] md:grid-cols-[0.85fr_1.15fr] md:px-8 md:pt-[95px] md:pb-[32px]">
                    <article className="reveal-on-scroll reveal-on-scroll--delay-1 relative z-10 max-w-[470px] text-left">
                        <p className="text-lg font-extrabold text-[#F4EDFF]">{t('page.landing.finalCta.eyebrow')}</p>
                        <h2 className="mt-4 text-[34px] leading-[1.36] font-extrabold text-white md:text-[42px]">
                            {t('page.landing.finalCta.titleLine1')}
                            <br />
                            {t('page.landing.finalCta.titleLine2')}
                        </h2>
                        <p className="mt-12 text-xl font-extrabold text-white/85">{t('page.landing.finalCta.download')}</p>
                        <div className="landing-cta-row mt-5 flex flex-col gap-4 sm:flex-row">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </article>

                    <div className="reveal-on-scroll reveal-on-scroll--image relative -mx-5 flex justify-center md:mx-0 md:justify-end">
                        <img
                            src="/img/temp24222.png"
                            alt={t('page.landing.imageAlt.appLogo')}
                            className="w-[min(765px,127.5vw)] max-w-none rounded-[12px] object-contain md:w-[646px] lg:w-[765px] xl:translate-x-12"
                        />
                    </div>
                </div>
            </section>

            <footer className={`${softPurpleBackground} px-5 py-10 text-sm font-medium text-[#777487] md:px-8`}>
                <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
                    {isDesktopVersionForced && (
                        <button
                            type="button"
                            onClick={selectAutomaticVersion}
                            className="h-11 w-full max-w-[220px] rounded-[8px] border border-[#DED6F5] bg-white text-sm font-bold text-[#5F557F] transition-colors hover:border-main-3 hover:text-main-1"
                        >
                            {t('page.landing.common.viewMobile')}
                        </button>
                    )}

                    <div className="flex flex-wrap gap-5">
                        <a href={termsOfServiceLink} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            {t('page.login.termsOfService')}
                        </a>
                        <a href={privacyPolicyLink} target="_blank" rel="noreferrer" className="font-bold hover:text-main-1">
                            {t('page.login.privacyPolicy')}
                        </a>
                    </div>
                    <p>{t('page.landing.common.copyright')}</p>
                </div>
            </footer>
        </main>
    );
}

export default LandingPage;
