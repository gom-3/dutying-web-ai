import {useEffect, useRef} from 'react';
import './landing-lockscreen.css';

// The bundled iPhone tutorial is currently available in Korean.
export function LandingLockscreenSection() {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        // The guide returns through a full document navigation. In development,
        // the anchor target appears only after the landing's lazy module loads.
        if (window.location.hash === '#lockscreen') {
            sectionRef.current?.scrollIntoView({block: 'start', behavior: 'instant'});
        }
    }, []);

    return (
        <>
            <link rel="stylesheet" href="/help/lockscreen/iphone-preview.css" precedence="default" />
            <section ref={sectionRef} id="lockscreen" className="landing-lockscreen" aria-labelledby="lockscreen-title" lang="ko">
                <div className="landing-lockscreen__inner">
                    <div className="landing-lockscreen__copy">
                        <p className="landing-lockscreen__eyebrow">아이폰 잠금화면</p>
                        <h2 id="lockscreen-title">
                            잠금화면에서
                            <br />
                            <span>내 근무표를 한눈에.</span>
                        </h2>
                        <p className="landing-lockscreen__description">근무 · 일정 · 할 일, 한 화면에.</p>
                        <div className="landing-lockscreen__actions">
                            <a className="landing-lockscreen__primary" href="/help/lockscreen/">
                                잠금화면 설정하기
                            </a>
                        </div>
                        <p className="landing-lockscreen__requirement">iOS 18 이상</p>
                    </div>
                    <figure className="landing-lockscreen__visual">
                        <div className="dutying-iphone">
                            <span className="dutying-iphone__side dutying-iphone__side--left" aria-hidden="true" />
                            <span className="dutying-iphone__side dutying-iphone__side--right" aria-hidden="true" />
                            <div className="dutying-iphone__body">
                                <div className="dutying-iphone__screen">
                                    <img
                                        src="/help/lockscreen/assets/lockscreen-iphone.webp"
                                        alt="듀팅 근무표와 오늘 일정이 표시된 아이폰 잠금화면"
                                        width="1206"
                                        height="2622"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <span className="dutying-iphone__island" aria-hidden="true" />
                                </div>
                            </div>
                        </div>
                    </figure>
                </div>
            </section>
        </>
    );
}
