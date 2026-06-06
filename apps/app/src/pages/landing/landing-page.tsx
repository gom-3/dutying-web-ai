import {CalendarDays, ChevronDown, MessageCircle, UserRound, UsersRound} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Link} from 'react-router';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import './landing-page.css';

const appStoreLink = 'https://abr.ge/bv13wa';
const inquiryLink = 'https://ye620.channel.io';
const termsOfServiceLink = 'https://www.notion.so/37698c0fae2580d1a3d2dcbb0c163fc9?source=copy_link';
const privacyPolicyLink = 'https://www.notion.so/35c98c0fae25805cb6d5e2ce5f591f42?source=copy_link';
const webMakeLoginLink = `${ROUTE.LOGIN}?next=%2Fmake`;
const getWebMakeLink = (isAuth: boolean) => (isAuth ? ROUTE.MAKE : webMakeLoginLink);
const webCtaIconSrc = '/img/web.png';
const appCtaIconSrc = '/img/app.png';
const heroTitlePhrases = ['교대 근무표,', '병동 관리,'] as const;
const mobileHeroPhrases = [
    {
        ariaLabel: '내 근무 일정, 듀팅에서 바로 확인해요',
        lines: ['내 근무 일정,', '듀팅에서 바로 확인해요'],
    },
    {
        ariaLabel: '신청근무와 휴일 요청을 더 쉽게 보내요',
        lines: ['신청근무와 휴일 요청을', '더 쉽게 보내요'],
    },
    {
        ariaLabel: '병동 소식도 듀팅으로 바로 받아요',
        lines: ['병동 소식도', '듀팅으로 바로 받아요'],
    },
    {
        ariaLabel: '커리어, 임상, 고민까지 듀팅에서 나눠요',
        lines: ['커리어, 임상, 고민까지', '듀팅에서 나눠요'],
    },
] as const;
const softPurpleBackground = 'bg-[linear-gradient(135deg,#FEFDFF_0%,#FBF9FF_48%,#F7F3FF_100%)]';
const landingViewPreferenceKey = 'dutying:landing-view-preference';
const phoneViewportQuery = '(max-width: 767px)';
const desktopViewportMetaContent = 'width=1180';
const featureSections = [
    {
        id: 'ai',
        label: 'AI 자동채우기',
        title: '빈 근무표를\n처음부터 채우지 않아도 돼요',
        description: '놓치기 쉬운 조건을\n단계별로 확인하고 반영할 수 있어요',
        image: '/img/124.png',
        align: 'right',
        background: 'bg-white',
    },
    {
        id: 'review',
        label: 'AI 자동채우기',
        title: '잘못된 근무를\n바로 확인하고, 수정까지',
        description: '수정이 필요한 부분을\n바로 보고, 수정안까지 볼 수 있어요.',
        image: '/img/landing_3.webp',
        align: 'left',
        background: softPurpleBackground,
    },
    {
        id: 'integration',
        label: '연동',
        title: '간호사와 병동을\n연동할 수 있어요',
        titleHighlights: ['연동'],
        description: '신청근무를 앱에서 보낼 수 있어요.\n근무표가 확정되면 앱으로 즉시 전달돼요.',
        image: '/img/landing-work-schedule-2.png',
        align: 'left',
        background: 'bg-white',
    },
    {
        id: 'ward',
        label: '게시판',
        title: '병동 간호사에게\n필요한 내용을 쉽게 공유해요',
        titleHighlights: ['간호사', '공유'],
        description: '꼭 봐야 할 공지부터 가벼운 안내까지\n놓치지 않고 한 곳에서',
        image: '/img/image-1002.png',
        align: 'left',
        background: 'bg-white',
    },
] as const;
const visibleFeatureSections = featureSections.filter((section) => section.id !== 'review');
const appFeatureSections = [
    {
        id: 'app-home',
        label: '홈',
        title: '근무 일정부터\n개인 일정까지 한 번에',
        titleHighlights: ['근무 일정', '개인 일정'],
        description: '앱을 열지 않아도 위젯으로 바로 확인해요',
        image: '/img/213213123123.png',
        reverse: false,
        background: 'bg-white',
    },
    {
        id: 'app-ward',
        label: '병동',
        title: '병동과 연동하고\n동료 일정을 함께 확인해요',
        titleHighlights: ['병동과 연동'],
        description: '교대 근무에 필요한 일정 확인과 조율을 더 간편하게',
        image: '/img/ward-schedule.png',
        reverse: true,
        background: softPurpleBackground,
    },
    {
        id: 'app-community',
        label: '널톡',
        title: '간호사들의 진짜 이야기가\n모이는 곳',
        titleHighlights: ['진짜 이야기'],
        description: '궁금했던 정보부터\n말하기 어려웠던 고민까지 익명으로 나눠요.',
        image: '/img/12223.png',
        reverse: false,
        background: 'bg-white',
    },
] as const;
const mobileAppBenefits = [
    {
        title: '근무 일정 확인',
        description: '내 근무표와 개인 일정을 앱에서 바로 확인해요.',
        icon: CalendarDays,
    },
    {
        title: '병동 연동',
        description: '병동과 연결해 신청근무와 휴일 요청을 간편하게 보내요.',
        icon: UsersRound,
    },
    {
        title: '널톡 커뮤니티',
        description: '간호사끼리 필요한 정보와 이야기를 가볍게 나눠요.',
        icon: MessageCircle,
    },
] as const;

type TLandingViewPreference = 'auto' | 'desktop';

function getIsPhoneViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    return window.matchMedia(phoneViewportQuery).matches;
}

function getInitialLandingViewPreference(): TLandingViewPreference {
    if (typeof window === 'undefined') {
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

function useLandingViewportMode() {
    const [viewPreference, setViewPreference] = useState<TLandingViewPreference>(getInitialLandingViewPreference);
    const [isPhoneViewport, setIsPhoneViewport] = useState(getIsPhoneViewport);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(phoneViewportQuery);
        const updatePhoneViewport = () => setIsPhoneViewport(mediaQuery.matches);

        updatePhoneViewport();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updatePhoneViewport);

            return () => mediaQuery.removeEventListener('change', updatePhoneViewport);
        }

        mediaQuery.addListener(updatePhoneViewport);

        return () => mediaQuery.removeListener(updatePhoneViewport);
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined' || viewPreference !== 'desktop') {
            return undefined;
        }

        const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

        if (!viewportMeta) {
            return undefined;
        }

        const originalContent = viewportMeta.getAttribute('content') ?? '';

        viewportMeta.setAttribute('content', desktopViewportMetaContent);

        return () => viewportMeta.setAttribute('content', originalContent);
    }, [viewPreference]);

    const selectDesktopVersion = () => {
        writeLandingViewPreference('desktop');
        updateLandingViewUrl('desktop');
        setViewPreference('desktop');
    };
    const selectAutomaticVersion = () => {
        writeLandingViewPreference('auto');
        updateLandingViewUrl('auto');
        setViewPreference('auto');

        if (typeof window !== 'undefined') {
            window.setTimeout(() => setIsPhoneViewport(getIsPhoneViewport()), 0);
        }
    };

    return {
        isDesktopVersionForced: viewPreference === 'desktop',
        selectAutomaticVersion,
        selectDesktopVersion,
        showMobileAppLanding: isPhoneViewport && viewPreference !== 'desktop',
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

function Pill({children}: {children: string}) {
    return <span className="inline-flex rounded-[6px] bg-main-light px-3 py-1 text-sm font-bold text-main-1">{children}</span>;
}

function RotatingHeroPhrase() {
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
                activeIndex: (activeIndex + 1) % heroTitlePhrases.length,
                previousIndex: activeIndex,
            }));
        }, 2600);

        return () => window.clearInterval(intervalId);
    }, []);

    return (
        <span className="hero-title-rotator" aria-hidden="true">
            {heroTitlePhrases.map((phrase, index) => (
                <span
                    key={phrase}
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

function RotatingMobileHeroPhrase() {
    const [rotationState, setRotationState] = useState<{activeIndex: number; previousIndex: number | null}>({
        activeIndex: 0,
        previousIndex: null,
    });
    const activePhrase = mobileHeroPhrases[rotationState.activeIndex] ?? mobileHeroPhrases[0];

    useEffect(() => {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setRotationState(({activeIndex}) => ({
                activeIndex: (activeIndex + 1) % mobileHeroPhrases.length,
                previousIndex: activeIndex,
            }));
        }, 3000);

        return () => window.clearInterval(intervalId);
    }, []);

    return (
        <>
            <span className="sr-only">{activePhrase.ariaLabel}</span>
            <span className="hero-title-rotator mobile-hero-title-rotator" aria-hidden="true">
                {mobileHeroPhrases.map((phrase, index) => (
                    <span
                        key={phrase.ariaLabel}
                        className={`hero-gradient-text hero-title-rotator__item mobile-hero-title-rotator__item ${
                            rotationState.activeIndex === index ? 'is-active' : ''
                        } ${rotationState.previousIndex === index && rotationState.activeIndex !== index ? 'is-exiting' : ''}`}
                    >
                        {phrase.lines.map((line) => (
                            <span key={line} className="block">
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

function HeaderActions({isAuth}: {isAuth: boolean}) {
    if (!isAuth) {
        return (
            <Link
                to={ROUTE.LOGIN}
                className="flex h-10 items-center rounded-[10px] bg-main-1 px-4 text-sm font-bold text-white transition-colors hover:bg-[#5832E7]"
            >
                로그인
            </Link>
        );
    }

    return (
        <>
            <Link
                to={ROUTE.MAKE}
                aria-label="근무표 만들기"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-main-1 px-3 text-sm font-bold text-white transition-colors hover:bg-[#5832E7] sm:px-4"
            >
                <CtaIcon src={webCtaIconSrc} className="size-4" />
                <span className="hidden sm:inline">근무표 만들기</span>
                <span className="sm:hidden">근무표</span>
            </Link>
            <Link
                to={ROUTE.PROFILE}
                aria-label="마이페이지"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#E5DEF8] bg-white px-3 text-sm font-bold text-[#5F557F] transition-colors hover:border-main-3 hover:text-main-1 sm:px-4"
            >
                <UserRound className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">마이페이지</span>
            </Link>
        </>
    );
}

function DarkActionButton({type, isAuth}: {type: 'web' | 'app'; isAuth?: boolean}) {
    const isWeb = type === 'web';
    const iconSrc = isWeb ? webCtaIconSrc : appCtaIconSrc;
    const label = isWeb ? (isAuth ? '근무표 만들기' : '웹에서 근무표 만들기') : '앱에서 근무표 확인하기';
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

function BackgroundFeatureSection({section}: {section: (typeof featureSections)[number]}) {
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
                <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-5 py-20 md:grid-cols-[1.04fr_0.96fr] md:gap-20 md:px-8 md:py-28">
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
                <div className="mx-auto grid min-h-[680px] max-w-[1440px] items-center gap-12 px-5 py-20 md:min-h-[780px] md:grid-cols-[0.76fr_1.24fr] md:gap-10 md:px-8 md:py-28 lg:gap-12">
                    <div className="mr-auto w-full max-w-[470px] md:mx-0">{copy}</div>

                    <picture className="reveal-on-scroll reveal-on-scroll--image flex w-full justify-center md:justify-end">
                        <img
                            src={section.image}
                            alt="간호사가 앱으로 근무 신청을 확인하는 모습"
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
                <div className="mx-auto grid min-h-[680px] max-w-[1440px] items-center gap-12 px-5 py-20 md:min-h-[780px] md:grid-cols-[0.72fr_1.28fr] md:gap-10 md:px-8 md:py-28 lg:gap-14">
                    <div className="mr-auto w-full max-w-[470px] md:mx-0">{copy}</div>

                    <picture className="reveal-on-scroll reveal-on-scroll--image flex w-full justify-center md:justify-end">
                        <img
                            src={section.image}
                            alt="병동 게시판 화면"
                            className="w-full object-contain object-center md:w-[120%] md:max-w-[984px] md:translate-x-20 lg:translate-x-24"
                        />
                    </picture>
                </div>
            </section>
        );
    }

    return (
        <section id={section.id} className={`relative overflow-hidden ${section.background}`}>
            <div className="mx-auto flex min-h-[680px] max-w-[1440px] items-center justify-start px-5 py-20 md:min-h-[780px] md:px-8">
                {copy}
            </div>
        </section>
    );
}

function AppFeatureSection({section}: {section: (typeof appFeatureSections)[number]}) {
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
                className={`mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28 ${section.reverse ? 'md:[&>picture]:order-2' : ''}`}
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

function MobileAppLanding({onSelectDesktopVersion}: {onSelectDesktopVersion: () => void}) {
    return (
        <main className="landing-main landing-main--mobile-app min-h-screen bg-white font-apple text-[#150B3C]">
            <header className="sticky top-0 z-50 border-b border-[#EEEAF8] bg-white/96 backdrop-blur">
                <div className="mx-auto flex h-15 max-w-[520px] items-center justify-between px-5">
                    <Link to={ROUTE.ROOT} aria-label="듀팅 랜딩 홈" className="flex shrink-0 items-center">
                        <img src="/img/group-19.png" alt="dutying" className="h-[27px] w-auto" />
                    </Link>

                    <a
                        href={appStoreLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-[8px] bg-main-1 px-4 text-sm font-bold text-white"
                    >
                        앱 다운로드
                    </a>
                </div>
            </header>

            <section className={`relative overflow-hidden ${softPurpleBackground}`}>
                <div className="mx-auto flex min-h-[calc(100svh-60px)] max-w-[520px] flex-col px-5 pt-8 pb-7">
                    <div className="relative z-10">
                        <h1 className="reveal-on-scroll text-[36px] leading-[1.18] font-extrabold">
                            <RotatingMobileHeroPhrase />
                        </h1>
                        <p className="reveal-on-scroll reveal-on-scroll--delay-1 mt-4 text-base leading-7 font-medium text-[#6F6B7A]">
                            근무 확인부터 신청근무/휴일 요청, 병동 소식까지 앱에서 바로 챙겨요.
                        </p>

                        <div className="reveal-on-scroll reveal-on-scroll--delay-1 mt-7 grid grid-cols-2 gap-3">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </div>

                    <picture className="reveal-on-scroll reveal-on-scroll--hero pointer-events-none mt-auto flex min-h-[310px] items-end justify-center pt-8">
                        <img
                            src="/img/iPhone 15_1.png"
                            alt="듀팅 앱 근무 일정 화면"
                            className="w-[118%] max-w-[500px] -translate-x-3 object-contain"
                        />
                    </picture>
                </div>
            </section>

            <section className="bg-white px-5 py-14">
                <div className="mx-auto max-w-[520px]">
                    <Pill>앱 주요 기능</Pill>
                    <h2 className="reveal-on-scroll mt-5 text-[26px] leading-[1.36] font-extrabold text-[#11131A]">
                        간호사에게 꼭 필요한 기능을
                        <br />
                        듀팅에 담았어요
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
                    <p className="text-sm font-extrabold text-[#D9CCFF]">듀팅 앱 다운로드</p>
                    <h2 className="mt-3 text-[26px] leading-[1.36] font-extrabold">
                        내 근무와 병동 소식을
                        <br />
                        앱으로 놓치지 마세요
                    </h2>
                    <div className="mt-8 grid grid-cols-2 gap-3">
                        <StoreButton store="google" />
                        <StoreButton store="apple" />
                    </div>
                </div>
            </section>

            <footer className={`${softPurpleBackground} px-5 py-9 text-sm font-medium text-[#777487]`}>
                <div className="mx-auto flex max-w-[520px] flex-col gap-6">
                    <button
                        type="button"
                        onClick={onSelectDesktopVersion}
                        className="h-11 w-full rounded-[8px] border border-[#DED6F5] bg-white text-sm font-bold text-[#5F557F] transition-colors hover:border-main-3 hover:text-main-1"
                    >
                        PC 버전으로 보기
                    </button>

                    <div className="flex flex-wrap gap-5">
                        <a href={termsOfServiceLink} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            이용약관
                        </a>
                        <a href={privacyPolicyLink} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            개인정보 처리방침
                        </a>
                    </div>
                    <p>ⓒ 2026 듀팅. All Rights Reserved</p>
                </div>
            </footer>
        </main>
    );
}

function LandingPage() {
    const {
        state: {isAuth},
    } = useAuth();
    const webMakeLink = getWebMakeLink(isAuth);
    const {isDesktopVersionForced, selectAutomaticVersion, selectDesktopVersion, showMobileAppLanding} = useLandingViewportMode();

    useRevealOnScroll(showMobileAppLanding ? 'mobile-app' : 'full-landing');

    if (showMobileAppLanding) {
        return <MobileAppLanding onSelectDesktopVersion={selectDesktopVersion} />;
    }

    return (
        <main
            className={`landing-main min-h-screen bg-white font-apple text-[#150B3C] ${
                isDesktopVersionForced ? 'landing-main--desktop-forced' : ''
            }`}
        >
            <header className="sticky top-0 z-50 border-b border-[#EEEAF8] bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:h-18 md:px-8">
                    <Link to={ROUTE.ROOT} aria-label="듀팅 랜딩 홈" className="flex shrink-0 items-center">
                        <img src="/img/group-19.png" alt="dutying" className="h-[28px] w-auto md:h-[32px]" />
                    </Link>

                    <nav className="hidden items-center gap-12 text-sm font-semibold text-[#5F557F] md:flex" aria-label="랜딩 섹션">
                        <a href="#web" className="transition-colors hover:text-main-1">
                            근무표 관리자 웹
                        </a>
                        <a href="#app" className="transition-colors hover:text-main-1">
                            간호사 앱
                        </a>
                        <a href={inquiryLink} target="_blank" rel="noreferrer" className="transition-colors hover:text-main-1">
                            문의하기
                        </a>
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <HeaderActions isAuth={isAuth} />
                    </div>
                </div>
            </header>

            <section className={`relative overflow-hidden ${softPurpleBackground}`}>
                <div className="landing-hero-grid relative mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-8 px-5 pt-12 pb-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 md:px-8 md:pt-32 md:pb-6 lg:gap-20">
                    <div className="relative z-10 min-w-0">
                        <h1
                            aria-label="교대 근무표, 듀팅으로 더 간편하게"
                            className="reveal-on-scroll max-w-[580px] text-[29px] leading-[1.28] font-extrabold md:text-[51px]"
                        >
                            <RotatingHeroPhrase />
                            <br />
                            <span className="hero-gradient-text">듀팅으로 더 간편하게</span>
                        </h1>
                        <p className="reveal-on-scroll reveal-on-scroll--delay-1 mt-5 max-w-[620px] text-base leading-7 font-medium text-[#6F6B7A] md:text-lg md:leading-8 2xl:whitespace-nowrap">
                            AI로 근무표를 쉽고 빠르게 만들고,
                            <br className="hidden md:block 2xl:hidden" />
                            <span className="md:hidden 2xl:inline"> </span>
                            간호사와 연동해 병동 관리를 더 간편하게
                        </p>

                        <div className="reveal-on-scroll reveal-on-scroll--delay-1 mt-12 flex max-w-[560px] flex-col gap-4 sm:mt-16 sm:flex-row md:mt-28">
                            <DarkActionButton type="web" isAuth={isAuth} />
                            <DarkActionButton type="app" />
                        </div>
                    </div>

                    <picture
                        className="reveal-on-scroll reveal-on-scroll--hero pointer-events-none relative z-0 flex justify-center md:-mt-16 md:justify-end"
                        aria-hidden="true"
                    >
                        <img
                            src="/img/image-999-1.png"
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
                <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-5 py-[6.9rem] md:grid-cols-[1.08fr_0.92fr] md:gap-24 md:px-8 md:py-[9.7rem]">
                    <div className="reveal-on-scroll reveal-on-scroll--image relative aspect-[1420/722] overflow-hidden rounded-[8px] shadow-[0_24px_80px_rgba(37,22,91,0.12)]">
                        <div className="absolute inset-0 rounded-[8px] bg-[#37404F]" aria-hidden="true" />
                        <img
                            src="/img/image-987.png"
                            alt="듀팅 웹 근무표 작성 화면"
                            className="absolute right-0 bottom-0 left-0 z-10 mx-auto w-[94%] object-contain"
                        />
                    </div>

                    <article className="reveal-on-scroll reveal-on-scroll--delay-1 text-left lg:translate-x-3">
                        <Pill>Web</Pill>
                        <h2 className="mt-6 text-[34px] leading-[1.35] font-extrabold text-[#11131A] md:text-[42px]">
                            복잡한 근무표,
                            <br />
                            이제 <span className="text-highlight-soft">AI로 1분</span> 만에 만들기
                        </h2>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            {isAuth ? (
                                <Link
                                    to={webMakeLink}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-main-1 px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                                >
                                    <CtaIcon src={webCtaIconSrc} />
                                    근무표 만들기
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to={webMakeLink}
                                        className="inline-flex h-12 items-center justify-center rounded-[10px] bg-[#060A12] px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                                    >
                                        체험하기
                                    </Link>
                                    <Link
                                        to={ROUTE.LOGIN}
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-main-1 px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
                                    >
                                        <CtaIcon src={webCtaIconSrc} />
                                        근무표 만들기
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

                <div className="relative mx-auto grid min-h-[520px] max-w-[1440px] items-center gap-10 px-5 py-20 md:grid-cols-[0.95fr_1.05fr] md:px-8">
                    <article className="reveal-on-scroll max-w-[500px] text-white">
                        <Pill>APP</Pill>
                        <h2 className="mt-6 text-[34px] leading-[1.36] font-extrabold md:text-[42px]">
                            근무 일정 관리부터
                            <br />
                            병동까지 한 번에
                        </h2>
                        <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </article>

                    <img
                        src="/img/temp.png"
                        alt="앱 화면"
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
                <div className="mx-auto grid min-h-[442px] max-w-[1440px] items-center gap-12 px-5 pt-[68px] pb-[23px] md:min-h-[476px] md:grid-cols-[0.85fr_1.15fr] md:px-8 md:pt-[95px] md:pb-[32px]">
                    <article className="reveal-on-scroll reveal-on-scroll--delay-1 relative z-10 max-w-[470px] text-left">
                        <p className="text-lg font-extrabold text-[#F4EDFF]">1분이면 충분해요</p>
                        <h2 className="mt-4 text-[34px] leading-[1.36] font-extrabold text-white md:text-[42px]">
                            웹과 앱을 연동해서
                            <br />
                            관리해 보세요
                        </h2>
                        <p className="mt-12 text-xl font-extrabold text-white/85">앱 다운로드</p>
                        <div className="mt-5 flex flex-col gap-4 sm:flex-row">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </article>

                    <div className="reveal-on-scroll reveal-on-scroll--image relative -mx-5 flex justify-center md:mx-0 md:justify-end">
                        <img
                            src="/img/temp222.png"
                            alt="듀팅 앱 로고 이미지"
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
                            모바일 버전으로 보기
                        </button>
                    )}

                    <div className="flex flex-wrap gap-5">
                        <a href={termsOfServiceLink} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            이용약관
                        </a>
                        <a href={privacyPolicyLink} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            개인정보 처리방침
                        </a>
                    </div>
                    <p>ⓒ 2026 듀팅. All Rights Reserved</p>
                </div>
            </footer>
        </main>
    );
}

export default LandingPage;
