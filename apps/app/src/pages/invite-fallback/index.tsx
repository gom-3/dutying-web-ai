import {Helmet} from 'react-helmet';
import {useLocation} from 'react-router-dom';
import {ANDROID_PLAY_STORE_URL, DEEP_LINK_APP_ORIGIN, IOS_APP_STORE_URL, type TInviteKind} from '@/shared/config/invite';

export type TDeepLinkFallbackKind = TInviteKind | 'nultalk' | 'ward' | 'notice';

const COPY_BY_KIND: Record<
    TDeepLinkFallbackKind,
    {
        description: string;
        eyebrow: string;
        title: string;
        codeLabel?: string;
    }
> = {
    friend: {
        description: '듀팅 앱에서 친구 초대를 이어서 확인하세요.',
        eyebrow: '친구 초대',
        title: '듀팅 앱에서 초대를 열어주세요',
        codeLabel: '친구 코드',
    },
    moim: {
        description: '듀팅 앱에서 모임 초대를 이어서 확인하세요.',
        eyebrow: '모임 초대',
        title: '듀팅 앱에서 초대를 열어주세요',
        codeLabel: '모임 코드',
    },
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

function DeepLinkFallbackPage({kind}: {kind: TDeepLinkFallbackKind}) {
    const location = useLocation();
    const inviteCode = kind === 'friend' || kind === 'moim' ? new URLSearchParams(location.search).get('code')?.trim() : null;
    const appUrl = `${DEEP_LINK_APP_ORIGIN}${location.pathname}${location.search}${location.hash}`;
    const copy = COPY_BY_KIND[kind];
    const openButtonLabel = kind === 'friend' || kind === 'moim' ? '듀팅 앱에서 초대 열기' : '듀팅 앱에서 열기';

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

                {inviteCode ? (
                    <div className="mt-5 flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[8px] bg-[#F3F0FF] px-[18px] py-4 text-left break-keep text-[#6C5CE7] max-[420px]:px-4 max-[340px]:grid max-[340px]:justify-items-center max-[340px]:text-center">
                        <span className="text-[13px] leading-[1.3] font-extrabold whitespace-nowrap">{copy.codeLabel}</span>
                        <strong className="font-mono text-[clamp(24px,7.2vw,30px)] leading-[1.1] font-black tracking-[0.06em] whitespace-nowrap text-[#191F28]">
                            {inviteCode}
                        </strong>
                    </div>
                ) : null}

                <div className="mt-[26px] grid gap-3">
                    <a
                        className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] bg-[#6C5CE7] px-[18px] py-3.5 text-[clamp(14px,4vw,16px)] leading-[1.35] font-bold whitespace-nowrap text-white no-underline max-[340px]:px-3 max-[340px]:text-[13px]"
                        href={appUrl}
                    >
                        {openButtonLabel}
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

export default DeepLinkFallbackPage;
