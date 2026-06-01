import {CalendarDays, ChevronDown, Monitor, Smartphone} from 'lucide-react';
import {useEffect} from 'react';
import {Link} from 'react-router';
import {AppstoreIcon, PlaystoreIcon} from '@/shared/assets/svg';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import './landing-page.css';

const appStoreLink = 'https://abr.ge/bv13wa';
const inquiryLink = 'https://ye620.channel.io';
const webMakeLink = `${ROUTE.LOGIN}?next=%2Fmake`;
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
        background: 'bg-[#F7F9FB]',
    },
    {
        id: 'integration',
        label: '연동',
        title: '간호사와 병동을\n연동할 수 있어요',
        description: '근무표가 앱으로 즉시 전달돼요.\n원티드 신청까지 자연스럽게 이어져요.',
        image: '/img/landing_5.webp',
        align: 'left',
        background: 'bg-white',
    },
    {
        id: 'ward',
        label: '게시판',
        title: '병동 간호사에게\n필요한 내용 공유하기',
        description: '꼭 봐야 할 공지부터 가벼운 안내까지\n놓치지 않고 한 곳에서',
        image: '/img/landing_5.webp',
        align: 'left',
        background: 'bg-white',
    },
] as const;
const appFeatureSections = [
    {
        id: 'app-home',
        label: '홈',
        title: '근무 관리부터\n개인 일정까지 한 번에',
        description: '앱을 열지 않아도 위젯으로 바로 확인해요',
        image: '/img/landing_mobile_4.webp',
        reverse: false,
    },
    {
        id: 'app-ward',
        label: '병동',
        title: '병동 근무와\n동료 일정도 함께 확인해요',
        description: '교대 근무에 필요한 일정 확인과 조율을 더 간편하게',
        image: '/img/landing_mobile_5.webp',
        reverse: true,
    },
] as const;

function useRevealOnScroll() {
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
    }, []);
}

function TextLines({children}: {children: string}) {
    const lines = children.split('\n');

    return (
        <>
            {lines.map((line) => (
                <span key={line} className="block">
                    {line}
                </span>
            ))}
        </>
    );
}

function Pill({children}: {children: string}) {
    return <span className="inline-flex rounded-[6px] bg-main-light px-3 py-1 text-sm font-bold text-main-1">{children}</span>;
}

function StoreButton({store}: {store: 'google' | 'apple'}) {
    const Icon = store === 'google' ? PlaystoreIcon : AppstoreIcon;
    const label = store === 'google' ? 'Google Play' : 'App Store';

    return (
        <a
            href={appStoreLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-base font-bold text-[#18151F] shadow-[0_12px_34px_rgba(18,20,31,0.12)] transition-transform hover:-translate-y-0.5"
        >
            <Icon className="size-5" />
            {label}
        </a>
    );
}

function DarkActionButton({type}: {type: 'web' | 'app'}) {
    const isWeb = type === 'web';
    const Icon = isWeb ? CalendarDays : Smartphone;
    const label = isWeb ? '웹에서 근무표 만들기' : '앱에서 근무표 확인하기';
    const href = isWeb ? webMakeLink : appStoreLink;
    const className =
        'inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#060A12] px-6 text-base font-bold text-white transition-transform hover:-translate-y-0.5';

    if (isWeb) {
        return (
            <Link to={href} className={className}>
                <Icon className="size-5" />
                {label}
            </Link>
        );
    }

    return (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
            <Icon className="size-5" />
            {label}
        </a>
    );
}

function BackgroundFeatureSection({section}: {section: (typeof featureSections)[number]}) {
    const isAiSection = section.id === 'ai';
    const hideImage = section.id === 'review' || section.id === 'integration' || section.id === 'ward';
    const copy = (
        <article className="reveal-on-scroll relative z-10 max-w-[470px]">
            <Pill>{section.label}</Pill>
            <h2 className="mt-6 text-[34px] leading-[1.35] font-extrabold text-[#11131A] md:text-[42px]">
                <TextLines>{section.title}</TextLines>
            </h2>
            <p className="mt-12 text-lg leading-8 font-medium whitespace-pre-line text-[#777487]">{section.description}</p>
        </article>
    );

    if (isAiSection) {
        return (
            <section id={section.id} className={section.background}>
                <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-5 py-20 md:grid-cols-[1.04fr_0.96fr] md:gap-20 md:px-8 md:py-28">
                    <picture className="reveal-on-scroll reveal-on-scroll--image mx-auto flex w-full max-w-[620px] items-center justify-center md:mx-0">
                        <img src={section.image} alt="" className="w-full max-w-[560px] object-contain object-center md:max-w-[620px]" />
                    </picture>

                    <div className="mx-auto w-full max-w-[470px] md:mx-0">{copy}</div>
                </div>
            </section>
        );
    }

    return (
        <section id={section.id} className={`relative overflow-hidden ${section.background}`}>
            {!hideImage && (
                <div className="reveal-on-scroll reveal-on-scroll--image absolute inset-y-0 right-0 left-0 hidden md:block" aria-hidden="true">
                    <img src={section.image} alt="" className="size-full object-cover" />
                </div>
            )}

            <div
                className={`mx-auto flex min-h-[680px] max-w-[1280px] items-center px-5 py-20 md:min-h-[780px] md:px-8 ${section.align === 'right' ? 'justify-end' : 'justify-start'}`}
            >
                {copy}
            </div>

            {!hideImage && (
                <div className="px-5 pb-16 md:hidden">
                    <img
                        src={section.image}
                        alt=""
                        className="reveal-on-scroll reveal-on-scroll--image mt-6 aspect-video w-full rounded-[8px] object-cover shadow-[0_18px_50px_rgba(37,22,91,0.08)]"
                    />
                </div>
            )}
        </section>
    );
}

function AppFeatureSection({section}: {section: (typeof appFeatureSections)[number]}) {
    return (
        <section id={section.id} className={section.reverse ? 'bg-[#F7F8FB]' : 'bg-white'}>
            <div
                className={`mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28 ${section.reverse ? 'md:[&>picture]:order-2' : ''}`}
            >
                <picture className="reveal-on-scroll reveal-on-scroll--image mx-auto w-full max-w-[360px]">
                    <img
                        src={section.image}
                        alt=""
                        className="h-[520px] w-full rounded-[24px] object-cover object-bottom shadow-[0_24px_80px_rgba(37,22,91,0.14)]"
                    />
                </picture>

                <article className="reveal-on-scroll mx-auto w-full max-w-[470px]">
                    <Pill>{section.label}</Pill>
                    <h2 className="mt-6 text-[32px] leading-[1.36] font-extrabold text-[#11131A] md:text-[40px]">
                        <TextLines>{section.title}</TextLines>
                    </h2>
                    <p className="mt-10 text-lg leading-8 font-medium text-[#777487]">{section.description}</p>
                </article>
            </div>
        </section>
    );
}

function LandingPage() {
    useRevealOnScroll();

    return (
        <main className="landing-main min-h-screen bg-white font-apple text-[#150B3C]">
            <header className="sticky top-0 z-50 border-b border-[#EEEAF8] bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 md:h-18 md:px-8">
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

                    <div className="flex items-center gap-3">
                        <Link
                            to={ROUTE.LOGIN}
                            className="flex h-10 items-center rounded-[10px] bg-main-1 px-4 text-sm font-bold text-white transition-colors hover:bg-[#5832E7]"
                        >
                            로그인
                        </Link>
                    </div>
                </div>
            </header>

            <section className="relative overflow-hidden bg-white">
                <div
                    className="absolute inset-x-0 top-0 h-[210px] bg-[linear-gradient(135deg,#A18DFF_0%,#6C4DF6_48%,#5F3FE7_100%)] md:h-[360px]"
                    aria-hidden="true"
                />
                <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1280px] grid-cols-1 items-start gap-8 px-5 pt-12 pb-20 md:min-h-[calc(100svh-4.5rem)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 md:px-8 md:pt-32 lg:gap-16">
                    <div className="relative z-10 min-w-0">
                        <h1 className="reveal-on-scroll max-w-[580px] text-[29px] leading-[1.28] font-extrabold text-white md:text-[51px]">
                            교대 근무표,
                            <br />
                            듀팅으로 더 간편하게
                        </h1>

                        <div className="reveal-on-scroll reveal-on-scroll--delay-1 mt-24 flex max-w-[560px] flex-col gap-4 sm:flex-row md:mt-28">
                            <DarkActionButton type="web" />
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
                            className="w-[92vw] object-contain object-center md:w-[118%] md:max-w-none md:translate-x-8 lg:w-[131%] lg:translate-x-14"
                        />
                    </picture>
                </div>

                <ChevronDown
                    className="reveal-on-scroll reveal-on-scroll--delay-2 absolute bottom-9 left-1/2 size-8 -translate-x-1/2 text-[#B4B3BE]"
                    aria-hidden="true"
                />
            </section>

            <section id="web" className="bg-[#F7F8FB]">
                <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-5 py-[6.9rem] md:grid-cols-[1.08fr_0.92fr] md:gap-24 md:px-8 md:py-[9.7rem]">
                    <div className="reveal-on-scroll reveal-on-scroll--image relative aspect-[1420/722] overflow-hidden rounded-[8px] shadow-[0_24px_80px_rgba(37,22,91,0.12)]">
                        <div className="absolute inset-0 rounded-[8px] bg-[#37404F]" aria-hidden="true" />
                        <img
                            src="/img/image-987.png"
                            alt="듀팅 웹 근무표 작성 화면"
                            className="absolute right-0 bottom-0 left-0 z-10 mx-auto w-[94%] object-contain"
                        />
                    </div>

                    <article className="reveal-on-scroll reveal-on-scroll--delay-1">
                        <Pill>Web</Pill>
                        <h2 className="mt-6 text-[34px] leading-[1.35] font-extrabold text-[#11131A] md:text-[42px]">
                            복잡한 근무표,
                            <br />
                            이제 <span className="text-highlight-soft">AI로 1분</span> 만에 만들기
                        </h2>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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
                                <Monitor className="size-5" />
                                근무표 만들기
                            </Link>
                        </div>
                    </article>
                </div>
            </section>

            {featureSections.map((section) => (
                <BackgroundFeatureSection key={section.id} section={section} />
            ))}

            <section id="app" className="relative overflow-hidden bg-[#070D18]">
                <div className="absolute inset-y-0 left-0 hidden w-[46%] bg-[#070D18] md:block" aria-hidden="true" />

                <div className="relative mx-auto grid min-h-[520px] max-w-[1280px] items-center gap-10 px-5 py-20 md:grid-cols-[0.95fr_1.05fr] md:px-8">
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
                        className="reveal-on-scroll reveal-on-scroll--image mx-auto w-[120%] max-w-none rounded-[12px] object-contain"
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

            <section className="bg-white">
                <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-20 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-28">
                    <img
                        src="/img/landing_1.webp"
                        alt="듀팅 웹과 앱 연동 화면"
                        className="reveal-on-scroll reveal-on-scroll--image w-full rounded-[8px] object-cover object-right shadow-[0_20px_70px_rgba(37,22,91,0.1)]"
                    />

                    <article className="reveal-on-scroll reveal-on-scroll--delay-1">
                        <p className="text-lg font-extrabold text-main-1">1분이면 충분해요</p>
                        <h2 className="mt-4 text-[34px] leading-[1.36] font-extrabold text-[#11131A] md:text-[42px]">
                            웹과 앱을 연동해서
                            <br />
                            관리해 보세요
                        </h2>
                        <p className="mt-12 text-xl font-extrabold text-[#777487]">앱 다운로드</p>
                        <div className="mt-5 flex flex-col gap-4 sm:flex-row">
                            <StoreButton store="google" />
                            <StoreButton store="apple" />
                        </div>
                    </article>
                </div>
            </section>

            <section className="bg-[#15111E] px-5 py-16 text-white md:px-8 md:py-24">
                <div className="reveal-on-scroll mx-auto flex max-w-[1280px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-[34px] leading-[1.35] font-extrabold md:text-[42px]">
                        교대근무,
                        <br />더 이상 어렵지 않게
                    </h2>
                    <img src="/img/group-19.png" alt="dutying" className="h-[54px] w-auto brightness-0 invert md:h-[72px]" />
                </div>
            </section>

            <footer className="bg-[#F7F8FB] px-5 py-10 text-sm font-medium text-[#777487] md:px-8">
                <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
                    <div className="flex flex-wrap gap-5">
                        <a href={RUNTIME_CONFIG.docs.termsOfService} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            이용약관
                        </a>
                        <a href={RUNTIME_CONFIG.docs.privacyPolicy} target="_blank" rel="noreferrer" className="hover:text-main-1">
                            개인정보 처리방침
                        </a>
                    </div>
                    <p>ⓒ 2024 리팅랩. All Rights Reserved</p>
                </div>
            </footer>
        </main>
    );
}

export default LandingPage;
