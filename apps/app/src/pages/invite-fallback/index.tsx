import {Helmet} from 'react-helmet';
import {useLocation} from 'react-router-dom';
import {
    ANDROID_PLAY_STORE_URL,
    buildInviteSchemeUrl,
    DEEP_LINK_APP_ORIGIN,
    IOS_APP_STORE_URL,
    type TInviteKind,
} from '@/shared/config/invite';

export type TDeepLinkFallbackKind = TInviteKind | 'nultalk' | 'ward' | 'notice';

type TContentFallbackKind = Exclude<TDeepLinkFallbackKind, TInviteKind>;

const INVITE_COPY_BY_KIND: Record<
    TInviteKind,
    {
        codeLabel: string;
        description: string;
        openButtonLabel: string;
        pageLabel: string;
        title: string;
    }
> = {
    friend: {
        codeLabel: '친구 코드',
        description: '듀팅 앱에서 친구 초대를 이어서 확인하세요.',
        openButtonLabel: '듀팅 앱에서 친구 추가하기',
        pageLabel: '친구 초대',
        title: '친구와 근무 일정을\n함께 확인해요',
    },
    moim: {
        codeLabel: '모임 코드',
        description: '듀팅 앱에서 모임 초대를 이어서 확인하세요.',
        openButtonLabel: '듀팅 앱에서 모임 초대 확인하기',
        pageLabel: '모임 초대',
        title: '모임 멤버와 일정을\n함께 확인해요',
    },
};
const CONTENT_COPY_BY_KIND: Record<
    TContentFallbackKind,
    {
        description: string;
        eyebrow: string;
        title: string;
    }
> = {
    nultalk: {
        description: '공유받은 게시글은 듀팅 앱에서 안전하게 확인할 수 있어요.',
        eyebrow: '널톡 게시글',
        title: '듀팅 앱에서 게시글을 확인해주세요',
    },
    ward: {
        description: '병동 구성원만 볼 수 있는 내용이에요. 앱에서 접근 권한을 확인해주세요.',
        eyebrow: '병동 게시글',
        title: '듀팅 앱에서 게시글을 확인해주세요',
    },
    notice: {
        description: '최신 공지와 안내 내용을 듀팅 앱에서 확인할 수 있어요.',
        eyebrow: '듀팅 공지',
        title: '듀팅 앱에서 공지를 확인해주세요',
    },
};
const isInviteKind = (kind: TDeepLinkFallbackKind): kind is TInviteKind => kind === 'friend' || kind === 'moim';

function InviteActionIcon({kind}: {kind: TInviteKind}) {
    if (kind === 'friend') {
        return (
            <svg className="size-6 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M14.5 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM6.25 9.25V6.5h-2v2.75H1.5v2h2.75V14h2v-2.75H9v-2H6.25ZM14.5 13.5c-2.77 0-8 1.39-8 4.15V20.5h16v-2.85c0-2.76-5.23-4.15-8-4.15Z"
                />
            </svg>
        );
    }

    return (
        <svg className="size-6 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                fill="currentColor"
                d="M8.25 11.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm7.5.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM8.25 13.25c-2.5 0-7.25 1.25-7.25 3.75v3.25h10.4a5.78 5.78 0 0 1-.4-2.1c0-1.85.88-3.5 2.25-4.56a16.5 16.5 0 0 0-5-.34Zm9 1.25v2.25H15v2h2.25V21h2v-2.25h2.25v-2h-2.25V14.5h-2Z"
            />
        </svg>
    );
}

function InviteFallbackPage({appUrl, inviteCode, kind}: {appUrl: string; inviteCode: string | null; kind: TInviteKind}) {
    const copy = INVITE_COPY_BY_KIND[kind];

    return (
        <main className="min-h-dvh overflow-x-hidden bg-[#F7F9FB] font-apple text-[#191F28]">
            <Helmet>
                <title>{`${copy.pageLabel} 열기 | 듀팅`}</title>
                <meta name="description" content={copy.description} />
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-white">
                <section
                    className="relative z-10 px-7 pt-10 pb-[34px] text-center sm:px-12 sm:pt-14 sm:pb-12"
                    aria-labelledby="invite-title"
                >
                    <a
                        className="inline-flex min-h-11 items-center justify-center rounded-[12px] px-2 transition-colors duration-150 hover:bg-[#F0ECFF] focus-visible:bg-[#EDE4FF] focus-visible:text-[#34207A] motion-reduce:transition-none"
                        href="/"
                        aria-label="듀팅 홈"
                    >
                        <img src="/img/group-19.png" alt="dutying" className="h-auto w-[122px]" />
                    </a>

                    <h1
                        id="invite-title"
                        className="mt-6 mb-0 text-[30px] leading-[1.34] font-extrabold tracking-[-0.035em] break-keep whitespace-pre-line text-[#15151A] sm:mt-8 sm:text-[34px]"
                    >
                        {copy.title}
                    </h1>

                    {inviteCode ? (
                        <div className="mt-8 flex min-h-[76px] w-full items-center justify-between gap-4 rounded-[22px] bg-[#EDE4FF] px-6 py-4 text-left max-[340px]:px-4 sm:min-h-[84px] sm:px-8">
                            <span className="shrink-0 text-[15px] leading-[1.3] font-bold whitespace-nowrap text-[#663DFA] sm:text-base">
                                {copy.codeLabel}
                            </span>
                            <strong className="min-w-0 overflow-hidden font-sans text-[28px] leading-none font-black tracking-[0.05em] text-ellipsis whitespace-nowrap text-[#15151A] tabular-nums sm:text-[30px]">
                                {inviteCode}
                            </strong>
                        </div>
                    ) : null}

                    <p
                        className={`${inviteCode ? 'mt-[18px]' : 'mt-8'} mb-0 text-[15px] leading-[1.65] font-medium break-keep whitespace-pre-line text-[#657084] sm:text-base`}
                    >
                        {'앱이 바로 열리지 않나요?\n아래 버튼으로 초대를 확인하세요.'}
                    </p>

                    <a
                        className="mt-[18px] inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-[18px] bg-[#663DFA] px-5 py-4 text-[16px] leading-[1.35] font-extrabold break-keep text-white no-underline transition-colors duration-150 hover:bg-[#5832E7] focus-visible:bg-[#34207A] focus-visible:text-[#FFF0A6] active:bg-[#4724C4] motion-reduce:transition-none max-[340px]:gap-2 max-[340px]:px-3 max-[340px]:text-[14px] sm:text-[17px]"
                        href={appUrl}
                    >
                        <InviteActionIcon kind={kind} />
                        {copy.openButtonLabel}
                    </a>
                </section>

                <section
                    className="relative flex min-h-[258px] flex-1 overflow-hidden bg-[#EDE4FF] px-7 pt-9 pb-8 sm:min-h-[280px] sm:px-12 sm:pt-11"
                    aria-labelledby="download-title"
                >
                    <svg
                        className="pointer-events-none absolute inset-x-0 top-0 h-[180px] w-full"
                        viewBox="0 0 560 180"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <path fill="#D4C3FF" d="M-50 105C105 52 306 58 610 137v27C307 91 105 83-50 136v-31Z" />
                        <path fill="#B08BFF" d="M345-30c35 72 103 123 265 155v31C426 124 345 70 311-13l34-17Z" />
                    </svg>

                    <div
                        className="absolute top-9 right-7 flex size-[72px] rotate-[8deg] items-center justify-center rounded-[22px] bg-[#663DFA] sm:top-10 sm:right-11 sm:size-[82px]"
                        aria-hidden="true"
                    >
                        <img src="/svg/logo_v2.svg" alt="" className="size-[46px] brightness-0 invert sm:size-[52px]" />
                    </div>

                    <div className="relative z-10 flex w-full flex-col justify-between">
                        <div>
                            <h2
                                id="download-title"
                                className="m-0 max-w-[230px] text-[28px] leading-[1.3] font-extrabold tracking-[-0.035em] break-keep text-[#15151A] sm:max-w-[280px] sm:text-[32px]"
                            >
                                <span className="text-[#663DFA]">듀팅 앱</span>이
                                <br />
                                아직 없다면?
                            </h2>
                            <p className="mt-4 mb-0 max-w-[330px] text-[15px] leading-[1.6] font-medium break-keep text-[#595961] sm:text-base">
                                앱을 설치한 뒤 초대를 이어서 확인할 수 있어요.
                            </p>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-2" aria-label="앱 설치 안내">
                            <a
                                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] bg-[#151A20] px-3 py-3 text-[14px] leading-[1.3] font-bold whitespace-nowrap text-white no-underline transition-colors duration-150 hover:bg-[#2D333B] focus-visible:bg-[#663DFA] focus-visible:text-[#FFF0A6] active:bg-black motion-reduce:transition-none"
                                href={IOS_APP_STORE_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <img
                                    src="/img/apple.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="size-[18px] object-contain brightness-0 invert"
                                />
                                App Store
                            </a>
                            <a
                                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] bg-[#151A20] px-3 py-3 text-[14px] leading-[1.3] font-bold whitespace-nowrap text-white no-underline transition-colors duration-150 hover:bg-[#2D333B] focus-visible:bg-[#663DFA] focus-visible:text-[#FFF0A6] active:bg-black motion-reduce:transition-none"
                                href={ANDROID_PLAY_STORE_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <img
                                    src="/img/play.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="size-[18px] object-contain brightness-0 invert"
                                />
                                Google Play
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

function ContentFallbackPage({kind}: {kind: TContentFallbackKind}) {
    const location = useLocation();
    const appUrl = `${DEEP_LINK_APP_ORIGIN}${location.pathname}${location.search}${location.hash}`;
    const copy = CONTENT_COPY_BY_KIND[kind];

    return (
        <main className="grid min-h-dvh place-items-center bg-[#F7F8FA] px-5 py-8 font-apple text-[#191F28] max-[420px]:place-items-stretch max-[420px]:px-[18px] max-[420px]:py-[18px]">
            <Helmet>
                <title>{`${copy.eyebrow} 열기 | 듀팅`}</title>
                <meta name="description" content={copy.description} />
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <section
                className="w-full max-w-[400px] rounded-[8px] bg-white px-6 pt-9 pb-6 text-center max-[420px]:self-center max-[420px]:px-5 max-[420px]:pt-8 max-[420px]:pb-[22px] max-[340px]:px-4"
                aria-labelledby="deep-link-title"
            >
                <a className="mb-8 inline-flex items-center justify-center" href="/" aria-label="듀팅 홈">
                    <img src="/img/group-19.png" alt="dutying" className="h-auto w-[118px]" />
                </a>

                <div className="grid gap-3 break-keep">
                    <p className="m-0 text-[13px] leading-[1.25] font-extrabold text-[#6C5CE7]">{copy.eyebrow}</p>
                    <h1
                        id="deep-link-title"
                        className="m-0 text-[26px] leading-[1.32] font-extrabold tracking-normal max-[420px]:text-[23px]"
                    >
                        {copy.title}
                    </h1>
                    <p className="m-0 text-[clamp(14px,3.6vw,15px)] leading-[1.6] font-medium text-[#6B7684]">{copy.description}</p>
                </div>

                <div className="mt-[26px] grid gap-3">
                    <a
                        className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] bg-[#6C5CE7] px-[18px] py-3.5 text-[clamp(14px,4vw,16px)] leading-[1.35] font-bold whitespace-nowrap text-white no-underline max-[340px]:px-3 max-[340px]:text-[13px]"
                        href={appUrl}
                    >
                        듀팅 앱에서 열기
                    </a>

                    <div className="rounded-[8px] bg-[#F8F6FF] px-4 pt-[18px] pb-4 break-keep" aria-label="앱 설치 안내">
                        <p className="m-0 text-[clamp(14px,3.6vw,15px)] leading-[1.6] font-medium text-[#6B7684]">
                            <strong className="mx-auto mb-[5px] block text-[clamp(18px,4.8vw,20px)] leading-[1.25] font-black tracking-normal text-[#6C5CE7]">
                                앱이 아직 없다면?
                            </strong>
                            <span className="block whitespace-nowrap">스토어에서 먼저 설치해주세요.</span>
                        </p>
                        <div className="mt-3 grid gap-2.5">
                            <a
                                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[8px] bg-[#191F28] px-[18px] py-3.5 text-[clamp(14px,4vw,16px)] leading-[1.35] font-bold whitespace-nowrap text-white no-underline max-[340px]:px-3 max-[340px]:text-[13px]"
                                href={IOS_APP_STORE_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <img
                                    src="/img/apple.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="size-[18px] object-contain brightness-0 invert"
                                />
                                App Store에서 받기
                            </a>
                            <a
                                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[8px] bg-[#191F28] px-[18px] py-3.5 text-[clamp(14px,4vw,16px)] leading-[1.35] font-bold whitespace-nowrap text-white no-underline max-[340px]:px-3 max-[340px]:text-[13px]"
                                href={ANDROID_PLAY_STORE_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <img
                                    src="/img/play.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="size-[18px] object-contain brightness-0 invert"
                                />
                                Google Play에서 받기
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

function DeepLinkFallbackPage({kind}: {kind: TDeepLinkFallbackKind}) {
    const location = useLocation();

    if (!isInviteKind(kind)) {
        return <ContentFallbackPage kind={kind} />;
    }

    const inviteCode = new URLSearchParams(location.search).get('code')?.trim() ?? null;
    const appUrl = `${buildInviteSchemeUrl(kind, location.search)}${location.hash}`;

    return <InviteFallbackPage appUrl={appUrl} inviteCode={inviteCode} kind={kind} />;
}

export default DeepLinkFallbackPage;
