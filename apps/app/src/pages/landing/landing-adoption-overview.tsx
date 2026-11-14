import {type CSSProperties, useEffect, useState} from 'react';
import {Trans} from 'react-i18next';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {landingHospitals} from './landing-hospitals';
import {useLandingReducedMotion} from './use-landing-reduced-motion';
import './landing-adoption-overview.css';

const features = [
    {
        id: 'ai',
        icon: '/img/landing-ai-benefit-icon.webp',
    },
    {
        id: 'ward-management',
        icon: '/img/mobile-schedule-benefit-icon.webp',
    },
    {
        id: 'integration',
        icon: '/img/mobile-ward-benefit-icon.webp',
    },
    {
        id: 'excel',
        icon: '/img/landing-import-benefit-icon.webp',
    },
] as const;

export function LandingWorkflowSummary() {
    const {t} = useTypedTranslation();

    return (
        <section className="landing-workflow-summary" aria-labelledby="landing-summary-title">
            <div className="landing-workflow-summary__inner mx-auto max-w-[1440px] px-5 md:px-8">
                <div className="landing-workflow-summary__heading">
                    <h2 id="landing-summary-title">{t('page.landing.workflow.title')}</h2>
                </div>
                <ol className="landing-workflow-summary__grid" role="list">
                    {features.map(({id, icon}, index) => (
                        <li key={id}>
                            <a href={`#${id}`} className="landing-workflow-summary__link">
                                <span className="landing-workflow-summary__visual" aria-hidden="true">
                                    <img src={icon} alt="" width="160" height="160" loading="lazy" decoding="async" />
                                    <span className="landing-workflow-summary__number">0{index + 1}</span>
                                </span>
                                <span className="landing-workflow-summary__copy">
                                    <span className="landing-workflow-summary__problem">{t(`page.landing.workflow.${id}.problem`)}</span>
                                    <strong>{t(`page.landing.workflow.${id}.solution`)}</strong>
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

function NurseUsageMessage() {
    return <Trans i18nKey="page.landing.usage.total" components={{count: <strong className="landing-nurse-usage__count" />}} />;
}

export function LandingNurseUsage() {
    return (
        <div className="landing-usage-layout landing-nurse-usage">
            <p>
                <NurseUsageMessage />
            </p>
        </div>
    );
}

const hospitalPalette = [
    {color: '#5940a3', tint: '#eee8fc', hue: 0},
    {color: '#14634e', tint: '#e0f3e9', hue: -96},
    {color: '#244b96', tint: '#e3ecfd', hue: -42},
    {color: '#954622', tint: '#fbe9dd', hue: 119},
    {color: '#8b365b', tint: '#f8e4ee', hue: 73},
    {color: '#12636d', tint: '#ddf2f3', hue: -74},
    {color: '#765015', tint: '#f9efcf', hue: 137},
    {color: '#683689', tint: '#f1e4f7', hue: 22},
    {color: '#465f27', tint: '#ecf2db', hue: 186},
    {color: '#185883', tint: '#e1f0fa', hue: -57},
    {color: '#963e43', tint: '#f9e5e6', hue: 97},
    {color: '#3d4d9e', tint: '#e8ebff', hue: -32},
    {color: '#11645f', tint: '#dff3ef', hue: -84},
    {color: '#9b4b14', tint: '#fbecd8', hue: 125},
    {color: '#88396e', tint: '#f7e5f2', hue: 60},
] as const;
const hospitalCycle = landingHospitals.length * hospitalPalette.length;
// The first and last slots let the icons enter and leave the visible rail.
const hospitalIconOffsets = [-5, -4, -3, -2, -1, 0, 1] as const;

export function LandingHospitalRotation() {
    const [hospitalStep, setHospitalStep] = useState(0);
    const reducedMotion = useLandingReducedMotion();
    const name = landingHospitals[hospitalStep % landingHospitals.length];
    const {color} = hospitalPalette[hospitalStep % hospitalPalette.length];

    useEffect(() => {
        if (reducedMotion) return;

        const interval = window.setInterval(() => {
            setHospitalStep((current) => (current + 1) % hospitalCycle);
        }, 3800);

        return () => window.clearInterval(interval);
    }, [reducedMotion]);

    return (
        <section id="hospital-usage" className="landing-usage-layout landing-hospital-rotation" aria-label="듀팅 이용 현황">
            <dl className="landing-usage-metrics">
                <div>
                    <dt>듀팅 앱 누적 사용자</dt>
                    <dd>
                        <span aria-hidden="true">
                            1만<span className="landing-usage-metrics__plus">+</span>
                        </span>
                        <span className="sr-only">1만 명 이상</span>
                    </dd>
                </div>
                <div>
                    <dt>듀팅 웹 사용자가 근무하는 병원</dt>
                    <dd>
                        <span aria-hidden="true">
                            50<span className="landing-usage-metrics__plus">+</span>
                        </span>
                        <span className="sr-only">50개 이상</span>
                    </dd>
                </div>
            </dl>
            <div className="landing-hospital-rotation__surface">
                <div className="landing-hospital-rotation__rail" aria-hidden="true">
                    {hospitalIconOffsets.map((offset) => {
                        const iconStep = (hospitalStep + offset + hospitalCycle) % hospitalCycle;
                        const {tint, hue} = hospitalPalette[iconStep % hospitalPalette.length];

                        return (
                            <span
                                key={iconStep}
                                className="landing-hospital-rotation__icon"
                                data-active={offset === 0}
                                data-buffer={offset === -5 || offset === 1}
                                style={
                                    {
                                        '--hospital-icon-slot': offset + 4,
                                        '--hospital-icon-hue': `${hue}deg`,
                                        backgroundColor: tint,
                                    } as CSSProperties
                                }
                            >
                                <img src="/img/landing-hospital-3d-icon.webp" alt="" width="144" height="144" decoding="async" />
                            </span>
                        );
                    })}
                </div>
                <p className="landing-hospital-rotation__copy">
                    <strong key={name} style={{color}}>
                        {name}
                    </strong>{' '}
                    <span className="landing-hospital-rotation__caption--wide">간호사가 듀팅을 사용하고 있어요.</span>
                    <span className="landing-hospital-rotation__caption--compact">간호사 이용 중</span>
                </p>
            </div>
            <p className="landing-hospital-rotation__note">간호사 개인 이용 사례 포함</p>
        </section>
    );
}

type TAdoptionEvidence = {
    usage?: {nurseCount: number; adoptionCount: number; adoptionUnit: '병원' | '병동'; basis: string; measuredAt: string};
    story?: {quote: string; attribution: string};
    patent?: {name: string; number: string; status: '출원' | '등록'};
};

// Publish each item only after its details and any required permissions are verified.
const adoptionEvidence: TAdoptionEvidence = {};
const formatCount = new Intl.NumberFormat('ko-KR');

export function LandingAdoptionEvidence() {
    const {usage, story, patent} = adoptionEvidence;

    if (!usage && !story && !patent) return null;

    return (
        <section className="landing-overview-evidence" aria-labelledby="landing-evidence-title">
            <div className="mx-auto max-w-[1440px] px-5 md:px-8">
                <h2 id="landing-evidence-title">듀팅 도입 현황</h2>
                {usage && (
                    <>
                        <dl className="landing-overview-evidence__stats">
                            <div>
                                <dt>이용 간호사</dt>
                                <dd>{formatCount.format(usage.nurseCount)}명</dd>
                            </div>
                            <div>
                                <dt>도입 {usage.adoptionUnit}</dt>
                                <dd>{formatCount.format(usage.adoptionCount)}곳</dd>
                            </div>
                        </dl>
                        <p>
                            {usage.measuredAt} 기준 · {usage.basis}
                        </p>
                    </>
                )}
                {story && (
                    <figure>
                        <blockquote>“{story.quote}”</blockquote>
                        <figcaption>{story.attribution}</figcaption>
                    </figure>
                )}
                {patent && (
                    <p>
                        특허 {patent.status} · {patent.name} ({patent.number})
                    </p>
                )}
            </div>
        </section>
    );
}
