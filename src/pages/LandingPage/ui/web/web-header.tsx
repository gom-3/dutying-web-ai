import {useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import useAuth from '@/features/auth/useAuth';
import {LogoWithSymbol} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import {cn} from '@/shared/util/style';

interface IWebHeaderProps {
    focus: 'mobile' | 'web' | 'top';
    handleClickMobileAnchor: () => void;
    handleClickWebAnchor: () => void;
}

const WebHeader = ({focus, handleClickMobileAnchor, handleClickWebAnchor}: IWebHeaderProps) => {
    const {
        state: {isAuth, accountMe},
        actions: {handleLogout},
    } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="fixed top-0 z-10 h-[4.5rem] w-full bg-white">
            <div className="container mx-auto flex size-full items-center">
                <LogoWithSymbol className="w-[8.4375rem] shrink-0" />
                <div className="flex w-full items-center">
                    <div className="mr-[3.75rem] ml-auto flex h-10 items-center gap-[2.8125rem] border-r-[.0625rem] border-sub-4 pr-[3.75rem]">
                        <p
                            className={cn(
                                'cursor-pointer font-apple text-[1.125rem] font-medium underline',
                                focus === 'mobile' ? 'text-main-1' : 'text-sub-2.5',
                            )}
                            onClick={handleClickMobileAnchor}
                        >
                            모바일 앱 주요 기능
                        </p>
                        <p
                            className={`cursor-pointer font-apple text-[1.125rem] font-medium underline ${
                                focus === 'web' ? 'text-main-1' : 'text-sub-2.5'
                            }`}
                            onClick={handleClickWebAnchor}
                        >
                            웹 주요 기능
                        </p>
                    </div>
                    <div className="flex h-10 items-center gap-[2.8125rem]">
                        <a
                            href="https://abr.ge/bv13wa"
                            target="_blank"
                            className="cursor-pointer font-apple text-[1.125rem] font-medium text-sub-2.5 underline"
                            onClick={() => {
                                sendEvent(events.landingPage.header.download);
                            }}
                            rel="noreferrer"
                        >
                            다운로드
                        </a>
                        <a
                            href="http://ye620.channel.io"
                            target="_blank"
                            className="font-apple text-[1.125rem] font-medium text-sub-2.5"
                            onClick={() => {
                                sendEvent(events.landingPage.header.ask);
                            }}
                            rel="noreferrer"
                        >
                            문의하기
                        </a>
                        {isAuth ? (
                            <button
                                onClick={() => handleLogout()}
                                className="cursor-pointer rounded-[1.875rem] border-[.0625rem] border-sub-2.5 px-4 py-[.25rem] font-apple text-[1.125rem] font-medium text-sub-2.5"
                            >
                                {accountMe?.status === 'DEMO' ? '데모 종료하기' : '로그아웃'}
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate(ROUTE.LOGIN)}
                                className="cursor-pointer rounded-[1.875rem] border-[.0625rem] border-sub-2.5 bg-main-1 px-4 py-[.25rem] font-apple text-[1.125rem] font-medium text-white"
                            >
                                로그인
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebHeader;
