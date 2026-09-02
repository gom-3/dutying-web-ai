import {type ReactNode} from 'react';
import {Helmet} from 'react-helmet';
import {Link} from 'react-router-dom';
import ROUTE from '@/shared/constant/path';
import {ChannelTalkLink} from '@/shared/ui/channel-talk-link';

const EFFECTIVE_DATE = '2026년 8월 27일';

function LegalShell({title, description, children}: {title: string; description: string; children: ReactNode}) {
    return (
        <>
            <Helmet>
                <title>{title} | 듀팅</title>
                <meta name="description" content={description} />
            </Helmet>
            <main className="min-h-screen bg-[#FAF8FB] px-5 py-8 font-apple text-[#241B35] sm:py-12">
                <nav
                    className="mx-auto mb-7 flex w-full max-w-[860px] flex-wrap gap-x-5 gap-y-2 text-[14px] font-bold text-[#6F6680]"
                    aria-label="법적 문서"
                >
                    <Link className="hover:text-main-1" to={ROUTE.ROOT}>
                        듀팅 홈
                    </Link>
                    <Link className="hover:text-main-1" to={ROUTE.TERMS}>
                        이용약관
                    </Link>
                    <Link className="hover:text-main-1" to={ROUTE.PRIVACY}>
                        개인정보 처리방침
                    </Link>
                </nav>
                <article className="mx-auto w-full max-w-[860px] rounded-[20px] bg-white px-6 py-9 sm:px-[52px] sm:py-14">
                    <p className="mb-2.5 text-[14px] font-extrabold text-main-1">Dutying</p>
                    {children}
                </article>
            </main>
        </>
    );
}

function LegalTitle({children}: {children: ReactNode}) {
    return (
        <>
            <h1 className="m-0 text-[32px] leading-[1.25] font-bold tracking-normal break-keep text-[#241B35] sm:text-[40px]">
                {children}
            </h1>
            <p className="mt-4 mb-10 text-[15px] text-[#777487]">시행일: {EFFECTIVE_DATE}</p>
        </>
    );
}

function LegalSection({title, children}: {title: string; children: ReactNode}) {
    return (
        <section className="mt-8 first:mt-0">
            <h2 className="mb-3 text-[20px] leading-[1.45] font-bold tracking-normal break-keep text-[#241B35]">{title}</h2>
            <div className="space-y-3 text-[16px] leading-[1.8] font-medium break-keep text-[#4D465C]">{children}</div>
        </section>
    );
}

function LegalList({items}: {items: string[]}) {
    return (
        <ul className="m-0 list-disc space-y-1.5 pl-5">
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}

export function PrivacyPolicyPage() {
    return (
        <LegalShell
            title="개인정보 처리방침"
            description="듀팅 개인정보 처리방침입니다. 수집하는 개인정보, Google 계정 정보 사용 목적, 보관 기간과 삭제 요청 방법을 안내합니다."
        >
            <LegalTitle>개인정보 처리방침</LegalTitle>
            <LegalSection title="1. 개인정보 처리 목적">
                <p>
                    듀팅은 간호사와 병동 관리자가 근무표를 만들고, 공유하고, 개인 일정을 관리할 수 있도록 서비스를 제공합니다. 개인정보는
                    회원가입 및 로그인, 계정 식별, 근무표 및 일정 관리, 알림 제공, 고객 지원, 서비스 보안과 안정적인 운영을 위해 처리합니다.
                </p>
            </LegalSection>
            <LegalSection title="2. 수집하는 개인정보">
                <LegalList
                    items={[
                        '계정 정보: 이메일 주소, 이름, 소셜 로그인 제공자, 제공자 계정 식별자',
                        '선택 정보: 전화번호, 프로필 이미지, 병동 및 근무 관련 입력 정보',
                        '서비스 이용 정보: 접속 기록, 기기 정보, 앱 버전, 푸시 토큰, 고객 문의 내용',
                    ]}
                />
            </LegalSection>
            <LegalSection title="3. Google 사용자 데이터 처리">
                <p>
                    듀팅은 Google 계정 로그인을 제공하기 위해 사용자의 Google 계정 정보를 제공받을 수 있습니다. 제공받는 정보는 Google 계정
                    고유 식별자, 이메일 주소, 이름, 프로필 정보이며, 사용자가 동의한 경우 전화번호가 포함될 수 있습니다.
                </p>
                <p>
                    Google 사용자 데이터는 회원가입, 로그인, 사용자 계정 식별, 중복 가입 방지, 고객 지원 및 보안 목적의 계정 확인에만
                    사용됩니다. 듀팅은 Google 사용자 데이터를 광고 목적으로 사용하지 않으며 제3자에게 판매하지 않습니다.
                </p>
            </LegalSection>
            <LegalSection title="4. 개인정보 보관 및 파기">
                <p>
                    개인정보는 서비스 제공에 필요한 기간 동안 보관하며, 회원 탈퇴 또는 삭제 요청이 있으면 관련 법령과 내부 보안 정책에 따라
                    필요한 기간을 제외하고 지체 없이 파기합니다. 부정 이용 방지, 분쟁 대응, 법령상 의무 이행을 위해 필요한 정보는 정해진
                    기간 동안 별도로 보관할 수 있습니다.
                </p>
            </LegalSection>
            <LegalSection title="5. 개인정보 제3자 제공 및 처리 위탁">
                <p>
                    듀팅은 법령상 의무가 있거나 사용자의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 서비스 운영을
                    위해 클라우드 인프라, 데이터 저장, 알림 발송, 이메일 발송, 고객 지원 도구 등 외부 서비스를 사용할 수 있으며, 필요한
                    범위에서만 개인정보 처리를 위탁합니다.
                </p>
            </LegalSection>
            <LegalSection title="6. 개인정보 보호 조치">
                <p>
                    듀팅은 개인정보 보호를 위해 접근 권한 관리, 전송 구간 암호화, 인증 토큰 보호, 로그 내 민감정보 최소화, 운영 환경 접근
                    통제 등 기술적·관리적 보호 조치를 적용합니다.
                </p>
            </LegalSection>
            <LegalSection title="7. 이용자의 권리와 삭제 요청">
                <p>
                    이용자는 자신의 개인정보에 대한 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 개인정보 삭제나 계정 탈퇴는 앱 내 기능
                    또는 고객지원 채널을 통해 요청할 수 있습니다.
                </p>
            </LegalSection>
            <LegalSection title="8. 문의">
                <p>
                    개인정보 처리와 관련한 문의는 듀팅 고객지원 채널을 통해 접수할 수 있습니다.{' '}
                    <ChannelTalkLink className="font-extrabold text-main-1 underline-offset-4 hover:underline">
                        고객지원 문의하기
                    </ChannelTalkLink>
                </p>
            </LegalSection>
        </LegalShell>
    );
}

export function TermsOfServicePage() {
    return (
        <LegalShell
            title="이용약관"
            description="듀팅 이용약관입니다. 서비스 이용 조건, 계정 관리, 이용자의 의무와 서비스 운영 기준을 안내합니다."
        >
            <LegalTitle>이용약관</LegalTitle>
            <LegalSection title="1. 목적">
                <p>
                    본 약관은 듀팅이 제공하는 간호사 근무표 작성, 일정 관리, 병동 및 팀 단위 협업, 알림 및 커뮤니티 관련 서비스의 이용
                    조건과 절차, 회사와 이용자의 권리, 의무 및 책임 사항을 정하는 것을 목적으로 합니다.
                </p>
            </LegalSection>
            <LegalSection title="2. 서비스의 제공">
                <p>
                    듀팅은 사용자가 근무표를 작성하고, 근무 및 개인 일정을 확인하며, 병동 구성원과 필요한 정보를 공유할 수 있도록 웹 및
                    모바일 서비스를 제공합니다. 서비스의 세부 기능은 운영상 필요에 따라 변경, 추가 또는 중단될 수 있습니다.
                </p>
            </LegalSection>
            <LegalSection title="3. 계정 및 로그인">
                <p>
                    이용자는 이메일 또는 소셜 로그인 등 듀팅이 제공하는 인증 방식을 통해 계정을 만들고 서비스를 이용할 수 있습니다. Google
                    로그인을 사용하는 경우 듀팅은 로그인과 계정 식별에 필요한 Google 계정 정보를 사용할 수 있으며, 자세한 내용은{' '}
                    <Link className="font-extrabold text-main-1 underline-offset-4 hover:underline" to={ROUTE.PRIVACY}>
                        개인정보 처리방침
                    </Link>
                    에서 확인할 수 있습니다.
                </p>
            </LegalSection>
            <LegalSection title="4. 이용자의 의무">
                <LegalList
                    items={[
                        '이용자는 본인의 계정 정보를 안전하게 관리해야 합니다.',
                        '타인의 계정을 무단으로 사용하거나, 허위 정보를 입력하거나, 서비스 운영을 방해해서는 안 됩니다.',
                        '법령, 본 약관, 서비스 내 안내사항을 위반하는 방식으로 서비스를 이용해서는 안 됩니다.',
                    ]}
                />
            </LegalSection>
            <LegalSection title="5. 서비스 이용 제한">
                <p>
                    듀팅은 이용자가 법령 또는 본 약관을 위반하거나, 서비스의 안정적인 운영을 방해하거나, 다른 이용자에게 피해를 주는 경우
                    서비스 이용을 제한할 수 있습니다.
                </p>
            </LegalSection>
            <LegalSection title="6. 서비스 변경 및 중단">
                <p>
                    듀팅은 안정적인 서비스 제공을 위해 정기 또는 임시 점검을 실시할 수 있으며, 천재지변, 장애, 보안 사고, 외부 서비스 장애
                    등 불가피한 사유가 있는 경우 서비스의 전부 또는 일부를 일시적으로 중단할 수 있습니다.
                </p>
            </LegalSection>
            <LegalSection title="7. 책임의 제한">
                <p>
                    듀팅은 서비스의 안정성과 정확성을 높이기 위해 노력하지만, 이용자가 입력한 정보의 정확성, 병원 또는 병동의 내부 운영
                    판단, 이용자의 서비스 활용 결과에 대해 법령상 허용되는 범위 내에서 책임을 제한합니다.
                </p>
            </LegalSection>
            <LegalSection title="8. 약관의 변경">
                <p>
                    듀팅은 관련 법령, 서비스 정책 또는 운영상 필요에 따라 본 약관을 변경할 수 있습니다. 중요한 변경이 있는 경우 서비스 내
                    공지 또는 적절한 방법으로 사전에 안내합니다.
                </p>
            </LegalSection>
            <LegalSection title="9. 문의">
                <p>
                    서비스 이용과 약관에 관한 문의는 듀팅 고객지원 채널을 통해 접수할 수 있습니다.{' '}
                    <ChannelTalkLink className="font-extrabold text-main-1 underline-offset-4 hover:underline">
                        고객지원 문의하기
                    </ChannelTalkLink>
                </p>
            </LegalSection>
        </LegalShell>
    );
}
