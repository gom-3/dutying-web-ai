import {Carousel} from 'react-responsive-carousel';
import {useNavigate} from 'react-router';
import {AppleIcon, BackCircle, FullLogo, KakaoIcon, LogoSymbolFill, NextCircle} from '@/shared/assets/svg';
import {createOAuthAuthorizationUrl, siteConfig} from '@/shared/config/site';
import ROUTE from '@/shared/constant/path';
import 'react-responsive-carousel/lib/styles/carousel.min.css'; // requires a loader
import './index.css';

const LoginPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex w-screen">
            <div className="hidden h-screen w-[calc(100vh/1080*1140)] min-w-0 shrink xl:block">
                <Carousel
                    autoPlay
                    infiniteLoop
                    dynamicHeight
                    stopOnHover
                    showArrows
                    interval={3000}
                    showIndicators={false}
                    showThumbs={false}
                    statusFormatter={(current, total) => `${current} / ${total}`}
                    renderArrowPrev={(click) => (
                        <BackCircle
                            className="absolute top-[50%] left-20 z-10 h-13 w-13 translate-y-[-50%] cursor-pointer"
                            onClick={click}
                        />
                    )}
                    renderArrowNext={(click) => (
                        <NextCircle
                            className="absolute top-[50%] right-20 z-10 h-13 w-13 translate-y-[-50%] cursor-pointer"
                            onClick={click}
                        />
                    )}
                >
                    <div className='h-screen w-full min-w-px bg-[url("/img/login_1.webp")] bg-cover bg-center'></div>
                    <div className='h-screen w-full min-w-px bg-[url("/img/login_2.webp")] bg-cover bg-center'></div>
                    <div className='h-screen w-full min-w-px bg-[url("/img/login_3.webp")] bg-cover bg-center'></div>
                </Carousel>
            </div>
            <div className="z-10 flex h-screen min-w-195 flex-1 shrink-0 flex-col items-center justify-between bg-white px-26.25 pt-35 pb-25">
                <div className="flex cursor-pointer" onClick={() => navigate(ROUTE.ROOT)}>
                    <LogoSymbolFill className="mr-[2.3438rem] h-12.5 w-[2.9688rem]" />
                    <FullLogo className="h-12.5 w-45.25" />
                </div>
                <div className="flex flex-col">
                    <h1 className="font-apple text-[2rem] font-semibold text-text-1">로그인</h1>
                    <a
                        href={createOAuthAuthorizationUrl('kakao')}
                        className="mt-10.5 flex h-25 w-142.5 items-center justify-center rounded-[1.25rem] bg-[#FEE500] shadow-banner"
                    >
                        <KakaoIcon className="mr-12.5 h-8.5 w-9" />
                        <div className="font-apple text-[2rem] text-sub-1">카카오 계정으로 시작하기</div>
                    </a>
                    <a
                        href={createOAuthAuthorizationUrl('apple')}
                        className="mt-6 flex h-25 w-142.5 items-center justify-center rounded-[1.25rem] bg-[#231F20] shadow-banner"
                    >
                        <AppleIcon className="mr-12.5 h-8.5 w-9" />
                        <div className="font-apple text-[2rem] text-white">Apple 계정으로 시작하기</div>
                    </a>
                </div>
                <div className="flex font-apple text-[1rem] text-sub-3">
                    버튼을 누르면
                    <a href={siteConfig.legal.terms} className="ml-[.5rem] underline underline-offset-[.1875rem]">
                        서비스 약관,
                    </a>
                    <a href={siteConfig.legal.terms} className="ml-[.5rem] underline underline-offset-[.1875rem]">
                        개인정보 취급 방침
                    </a>
                    에 동의하신 것으로 간주합니다.
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
