import {Helmet} from 'react-helmet';
import {useLocation} from 'react-router-dom';
import {buildFriendInviteAppUrl, IOS_APP_STORE_URL} from '@/shared/config/invite';

function FriendInvitePage() {
    const location = useLocation();
    const inviteCode = new URLSearchParams(location.search).get('code')?.trim();
    const appInviteUrl = buildFriendInviteAppUrl(location.search);

    return (
        <main className="grid min-h-dvh place-items-center bg-[#F7F8FA] px-5 py-8 font-apple text-[#191F28] max-[420px]:place-items-stretch max-[420px]:px-[18px] max-[420px]:py-[18px]">
            <Helmet>
                <title>듀팅 초대 열기</title>
                <meta name="description" content="듀팅 앱에서 친구 초대를 이어서 확인하세요." />
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <section
                className="w-full max-w-[400px] rounded-[8px] bg-white px-6 pt-9 pb-6 text-center max-[420px]:self-center max-[420px]:px-5 max-[420px]:pt-8 max-[420px]:pb-[22px] max-[340px]:px-4"
                aria-labelledby="invite-title"
            >
                <a className="mb-8 inline-flex items-center justify-center" href="/" aria-label="듀팅 홈">
                    <img src="/img/group-19.png" alt="dutying" className="h-auto w-[118px]" />
                </a>

                <div className="grid gap-3 break-keep">
                    <p className="m-0 text-[13px] leading-[1.25] font-extrabold text-[#6C5CE7]">친구 초대</p>
                    <h1 id="invite-title" className="m-0 text-[26px] leading-[1.32] font-extrabold tracking-normal max-[420px]:text-[23px]">
                        듀팅 앱에서 초대를 열어주세요
                    </h1>
                    <p className="m-0 text-[clamp(14px,3.6vw,15px)] leading-[1.6] font-medium text-[#6B7684]">
                        <span className="block whitespace-nowrap">앱이 바로 열리지 않나요?</span>
                        <span className="block whitespace-nowrap">아래 버튼으로 초대를 이어서 확인하세요.</span>
                    </p>
                </div>

                {inviteCode ? (
                    <div className="mt-5 flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[8px] bg-[#F3F0FF] px-[18px] py-4 text-left text-[#6C5CE7] break-keep max-[420px]:px-4 max-[340px]:grid max-[340px]:justify-items-center max-[340px]:text-center">
                        <span className="whitespace-nowrap text-[13px] leading-[1.3] font-extrabold">친구 코드</span>
                        <strong className="font-mono text-[clamp(24px,7.2vw,30px)] leading-[1.1] font-black tracking-[0.06em] whitespace-nowrap text-[#191F28]">
                            {inviteCode}
                        </strong>
                    </div>
                ) : null}

                <div className="mt-[26px] grid gap-3">
                    <a
                        className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] bg-[#6C5CE7] px-[18px] py-3.5 text-[clamp(14px,4vw,16px)] leading-[1.35] font-bold whitespace-nowrap text-white no-underline max-[340px]:px-3 max-[340px]:text-[13px]"
                        href={appInviteUrl}
                    >
                        듀팅 앱에서 초대 열기
                    </a>

                    <div className="rounded-[8px] bg-[#F8F6FF] px-4 pt-[18px] pb-4 break-keep" aria-label="앱 설치 안내">
                        <p className="m-0 text-[clamp(14px,3.6vw,15px)] leading-[1.6] font-medium text-[#6B7684]">
                            <strong className="mx-auto mb-[5px] block text-[clamp(18px,4.8vw,20px)] leading-[1.25] font-black tracking-normal text-[#6C5CE7]">
                                앱이 아직 없다면?
                            </strong>
                            <span className="block whitespace-nowrap">App Store에서 먼저 설치해주세요.</span>
                        </p>
                        <a
                            className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[8px] bg-[#191F28] px-[18px] py-3.5 text-[clamp(14px,4vw,16px)] leading-[1.35] font-bold whitespace-nowrap text-white no-underline max-[340px]:px-3 max-[340px]:text-[13px]"
                            href={IOS_APP_STORE_URL}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <img src="/img/apple.png" alt="" aria-hidden="true" className="size-[18px] object-contain brightness-0 invert" />
                            App Store에서 듀팅 받기
                        </a>
                    </div>
                </div>
            </section>
        </main>
    );
}

export default FriendInvitePage;
