import {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import useAuth from '@/features/auth/useAuth';
import {AppstoreIcon, Logo, PlaystoreIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import {events, sendEvent} from 'analytics';
import {WebFooter} from './web-footer';
import WebHeader from './web-header';

function WebLanding() {
    const {
        state: {accountMe},
        actions: {demoTry},
    } = useAuth();
    const navigate = useNavigate();
    const [focus, setFocus] = useState<'mobile' | 'web' | 'top'>('top');
    const webSectionRef = useRef<HTMLDivElement>(null);
    const mobileSectionRef = useRef<HTMLDivElement>(null);
    const handleScroll = useCallback(() => {
        const webSectionTop = webSectionRef.current?.getBoundingClientRect().top;
        const mobileSectionTop = mobileSectionRef.current?.getBoundingClientRect().top;

        console.log(mobileSectionTop, webSectionTop);

        if (webSectionTop && mobileSectionTop) {
            if (webSectionTop < 100) {
                setFocus('web');
            } else if (mobileSectionTop < 100) {
                setFocus('mobile');
            } else {
                setFocus('top');
            }
        }
    }, []);
    const handleClickWebAnchor = () => {
        webSectionRef.current?.scrollIntoView({behavior: 'smooth'});
        sendEvent(events.landingPage.header.web);
    };
    const handleClickMobileAnchor = () => {
        mobileSectionRef.current?.scrollIntoView({behavior: 'smooth'});
        sendEvent(events.landingPage.header.mobile);
    };

    useEffect(() => {
        document.addEventListener('scroll', handleScroll);

        return () => document.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    return (
        <div className="flex w-screen flex-col">
            <WebHeader focus={focus} handleClickMobileAnchor={handleClickMobileAnchor} handleClickWebAnchor={handleClickWebAnchor} />
            {/* 웹 메인 */}
            <div className='relative h-real-screen min-h-[660px] w-screen bg-[url("/img/landing_1.webp")] bg-cover bg-center bg-no-repeat py-0'>
                <div className="relative top-1/2 container mx-auto h-fit -translate-y-1/2">
                    <h1 className="font-line text-[4rem] leading-[5.4375rem] font-bold text-white">
                        근무표,
                        <br />
                        이제 더 간편하게!
                    </h1>

                    <div className="mt-[2.1875rem] flex items-center gap-[8px]">
                        <div className="flex h-[1.875rem] w-[3.875rem] items-center justify-center rounded-[5px] bg-main-4 px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                            App
                        </div>
                        <p className="font-apple text-[14px] font-medium text-white">
                            일정 관리의 모든 여정이 더 편리해지는 경험을 제공합니다.
                        </p>
                    </div>

                    <div className="mt-[.5625rem] flex items-center gap-[8px]">
                        <div className="flex h-[1.875rem] w-[3.875rem] items-center justify-center rounded-[5px] bg-main-4 px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                            Web
                        </div>
                        <p className="font-apple text-[14px] font-medium text-white">
                            근무표를 더 쉽고 빠르게 작성할 수 있도록 도와드립니다.
                        </p>
                    </div>

                    <div className="mt-[5.1875rem] flex items-center gap-[8px]">
                        <div className="flex h-[1.875rem] w-[3.875rem] items-center justify-center rounded-[5px] bg-main-4 px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                            App
                        </div>
                        <p className="font-apple text-[14px] font-medium text-sub-2">근무 일정 관리 (일반 간호사 용)</p>
                    </div>

                    <div className="mt-[.75rem] flex h-[3.75rem] gap-[3.125rem]">
                        <a
                            href="https://abr.ge/bv13wa"
                            target="_blank"
                            className="flex w-[15.3125rem] cursor-pointer items-center justify-center gap-[9px] rounded-[.9375rem] bg-white font-apple text-[1.5rem] font-semibold shadow-shadow-3"
                            rel="noreferrer"
                        >
                            <PlaystoreIcon className="w-7" />
                            Google Play
                        </a>
                        <a
                            href="https://abr.ge/bv13wa"
                            target="_blank"
                            className="flex w-[15.3125rem] cursor-pointer items-center justify-center gap-[9px] rounded-[.9375rem] bg-white font-apple text-[1.5rem] font-semibold shadow-shadow-3"
                            rel="noreferrer"
                        >
                            <AppstoreIcon className="w-[1.9375rem]" />
                            App Store
                        </a>
                    </div>

                    <div className="mt-[2.8125rem] flex items-center gap-[8px]">
                        <div className="flex h-[1.875rem] w-[3.875rem] items-center justify-center rounded-[5px] bg-main-4 px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                            Web
                        </div>
                        <p className="font-apple text-[14px] font-medium text-sub-2">근무표 작성 (수간호사 용)</p>
                    </div>

                    <div className="mt-[.75rem] mb-20 flex h-[3.75rem] shrink-0 gap-[3.125rem]">
                        {accountMe?.status === 'DEMO' ? (
                            <div
                                className="flex w-[15.3125rem] cursor-pointer items-center justify-center rounded-[.9375rem] bg-white font-apple text-[1.5rem] font-semibold shadow-shadow-3"
                                onClick={() => navigate(ROUTE.MAKE)}
                            >
                                데모 테스트 마저 하기
                            </div>
                        ) : (
                            <>
                                {!accountMe && (
                                    <div
                                        className="flex w-[15.3125rem] cursor-pointer items-center justify-center rounded-[.9375rem] bg-white font-apple text-[1.5rem] font-semibold shadow-shadow-3"
                                        onClick={() => {
                                            demoTry();
                                            sendEvent(events.landingPage.demoStart);
                                        }}
                                    >
                                        근무표 작성 체험하기
                                    </div>
                                )}
                                <div
                                    className="flex w-[15.3125rem] cursor-pointer items-center justify-center gap-[9px] rounded-[.9375rem] bg-white font-apple text-[1.5rem] font-semibold shadow-shadow-3"
                                    onClick={() => {
                                        navigate(ROUTE.MAKE);
                                        sendEvent(events.landingPage.makeDuty);
                                    }}
                                >
                                    <Logo className="w-[1.6875rem]" />
                                    근무표 만들기
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 모바일 앱 기능 소개 섹션 */}
            <div
                id="mobile"
                ref={mobileSectionRef}
                className='h-real-screen w-screen bg-[url("/img/landing_4.webp")] bg-cover bg-center bg-no-repeat'
            >
                <div className="container mx-auto mt-[8.875rem] flex items-start">
                    <div className="w-[28.125rem]">
                        <div className="flex items-center gap-[8px]">
                            <div className="flex h-[1.875rem] items-center rounded-[5px] bg-white px-[.5rem] font-poppins text-[1.25rem] text-main-2">
                                App
                            </div>
                            <p className="font-apple text-[1.5rem] font-medium text-main-1">홈</p>
                        </div>

                        <h1 className="mt-[.75rem] font-line text-[3.25rem] leading-[142%] font-bold text-white">
                            근무관리부터
                            <br />
                            개인 일정까지 한번에
                        </h1>

                        <p className="mt-[2.625rem] font-apple text-[1.75rem] leading-normal font-medium text-[#FDFCFEB2]">
                            매월 근무 등록하고
                            <br />
                            개인 일정을 유형별로 관리해보세요.
                        </p>
                    </div>
                </div>
            </div>

            <div className='h-real-screen w-screen bg-[url("/img/landing_5.webp")] bg-cover bg-center bg-no-repeat'>
                <div className="container mx-auto mt-[8.875rem] flex justify-end">
                    <div className="w-[28.125rem]">
                        <div className="flex items-center gap-[8px]">
                            <div className="flex h-[1.875rem] items-center rounded-[5px] bg-main-4 px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                                App
                            </div>
                            <p className="font-apple text-[1.5rem] font-medium text-main-1">소셜 (친구 · 모임)</p>
                        </div>

                        <h1 className="mt-[.75rem] font-line text-[3.25rem] leading-[142%] font-bold text-text-1">
                            동료의 근무 일정을
                            <br />
                            한눈에
                        </h1>

                        <p className="mt-[2.625rem] font-apple text-[1.75rem] leading-normal font-medium text-sub-2">
                            동료와 친구를 맺어
                            <br />
                            일정을 편하게 조율해보세요.
                        </p>
                    </div>
                </div>
            </div>

            {/* 웹 기능 소개 섹션 */}
            <div
                id="web"
                ref={webSectionRef}
                className='h-real-screen w-screen bg-[url("/img/landing_2.webp")] bg-cover bg-center bg-no-repeat'
            >
                <div className="container mx-auto mt-[8.875rem] flex justify-end">
                    <div className="w-[28.125rem]">
                        <div className="flex items-center gap-[8px]">
                            <div className="flex h-[1.875rem] items-center rounded-[5px] bg-main-4 px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                                Web
                            </div>
                            <p className="font-apple text-[1.5rem] font-medium text-main-1">근무표 만들기</p>
                        </div>

                        <h1 className="mt-[.75rem] font-line text-[3.25rem] leading-[142%] font-bold text-text-1">
                            복잡한 근무표 작성을 <br /> 간편하게 자동으로!
                        </h1>

                        <p className="mt-[2.625rem] font-apple text-[1.75rem] leading-normal font-medium text-sub-2">
                            직접 편집한 제약 조건들에 딱 맞는
                            <br />
                            근무표를 작성해드릴게요.
                        </p>
                    </div>
                </div>
            </div>

            <div className='h-real-screen w-screen bg-[url("/img/landing_3.webp")] bg-cover bg-center bg-no-repeat'>
                <div className="container mx-auto mt-[8.875rem] flex items-start">
                    <div className="w-[28.125rem]">
                        <div className="flex items-center gap-[8px]">
                            <div className="flex h-[1.875rem] items-center rounded-[5px] bg-white px-[.5rem] font-poppins text-[1.25rem] text-main-1">
                                Web
                            </div>
                            <p className="font-apple text-[1.5rem] font-medium text-main-1">근무표 만들기</p>
                        </div>

                        <h1 className="mt-[.75rem] font-line text-[3.25rem] leading-[142%] font-bold text-text-1">
                            더 꼼꼼하게,
                            <br />
                            하지만 더 편리하게
                        </h1>

                        <p className="mt-[2.625rem] font-apple text-[1.75rem] leading-normal font-medium text-sub-2">
                            근무표 작성을 돕기 위한
                            <br />
                            여러 보조 기능들이 마련되어 있습니다.
                        </p>
                    </div>
                </div>
            </div>

            <WebFooter />
        </div>
    );
}

export default WebLanding;
