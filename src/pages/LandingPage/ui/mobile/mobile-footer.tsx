import {useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import useAuth from '@/features/auth/useAuth';
import {AppstoreGrayIcon, Logo, PlaystoreGrayIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';

export const MobileFooter = () => {
    const {
        state: {accountMe},
        actions: {demoTry},
    } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="h-[770px] w-screen">
            <div className="mx-auto mt-[62px] flex w-[85%] flex-col">
                <div>
                    <h1 className="font-apple text-[16px] font-semibold text-sub-2">듀팅 다운로드</h1>

                    <div className="mt-[24px] font-apple text-[14px] font-medium text-sub-2.5">모바일 앱</div>
                    <div className="mt-[15px] flex h-[38px] gap-[10px]">
                        <a
                            href="https://abr.ge/bv13wa"
                            target="_blank"
                            className="flex flex-1 cursor-pointer items-center justify-center gap-[9px] rounded-[8px] bg-sub-5 font-apple text-[16px] font-semibold"
                            rel="noreferrer"
                        >
                            <PlaystoreGrayIcon className="w-[17px]" />
                            Google Play
                        </a>
                        <a
                            href="https://abr.ge/bv13wa"
                            target="_blank"
                            className="flex flex-1 cursor-pointer items-center justify-center gap-[9px] rounded-[8px] bg-sub-5 font-apple text-[16px] font-semibold"
                            rel="noreferrer"
                        >
                            <AppstoreGrayIcon className="w-[19px]" />
                            App Store
                        </a>
                    </div>

                    <div className="mt-[32px] font-apple text-[14px] font-medium text-sub-2.5">웹</div>
                    <div className="mt-[12px] flex h-[38px] gap-[10px]">
                        {accountMe?.status === 'DEMO' ? (
                            <div
                                className="flex flex-1 cursor-pointer items-center justify-center rounded-[8px] bg-sub-5 font-apple text-[16px] font-semibold"
                                onClick={() => navigate(ROUTE.MAKE)}
                            >
                                데모 테스트 마저 하기
                            </div>
                        ) : (
                            <>
                                {!accountMe && (
                                    <div
                                        className="flex flex-1 cursor-pointer items-center justify-center rounded-[8px] bg-sub-5 font-apple text-[16px] font-semibold"
                                        onClick={() => {
                                            demoTry();
                                            sendEvent(events.landingPage.demoStart);
                                        }}
                                    >
                                        근무표 작성 체험하기
                                    </div>
                                )}
                                <div
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-[9px] rounded-[8px] bg-sub-5 font-apple text-[16px] font-semibold"
                                    onClick={() => {
                                        navigate(ROUTE.MAKE);
                                        sendEvent(events.landingPage.makeDuty);
                                    }}
                                >
                                    <Logo className="w-[17px]" />
                                    근무표 만들기
                                </div>
                            </>
                        )}
                    </div>

                    <a
                        href="http://ye620.channel.io"
                        className="mt-[62px] block font-apple text-[16px] font-medium text-sub-2"
                        onClick={() => {
                            sendEvent(events.landingPage.footer.partnership);
                        }}
                    >
                        제휴 문의
                    </a>
                </div>
            </div>

            <div className="h-px w-full bg-sub-4.5" />
            <div className="mx-auto flex w-[85%] gap-[24px] pt-[24px]">
                <a
                    className="block font-apple text-[14px] font-bold text-sub-2.5"
                    href="https://gom3.notion.site/5ed51c04dd5d475c868367ed05a7d903?pvs=4"
                    target="_blank"
                    onClick={() => {
                        sendEvent(events.landingPage.footer.terms);
                    }}
                    rel="noreferrer"
                >
                    이용 약관
                </a>
                <a
                    className="block font-apple text-[14px] font-bold text-sub-2.5"
                    href="https://gom3.notion.site/5ed51c04dd5d475c868367ed05a7d903?pvs=4"
                    target="_blank"
                    onClick={() => {
                        sendEvent(events.landingPage.footer.terms);
                    }}
                    rel="noreferrer"
                >
                    개인 정보 처리 방침
                </a>
            </div>
        </div>
    );
};
