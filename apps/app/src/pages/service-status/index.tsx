import {RotateCcw} from 'lucide-react';
import {Helmet} from 'react-helmet';
import Button from '@/shared/ui/form-controls/Button';

const PENGUIN_IMAGE_SRC = '/img/empty-schedule-nurse.png';
const serviceStatusCopy = {
    maintenance: {
        badge: '서비스 점검',
        title: '지금은 점검 중이에요',
        description: '더 안정적으로 이용할 수 있도록 서비스를 점검하고 있어요.\n점검이 끝나면 다시 이용할 수 있어요.',
        helperText: '기다리게 해서 죄송해요.\n최대한 빨리 마칠게요.',
        dateLabel: '점검 시간',
        dateText: '추후 안내 예정',
        buttonText: '다시 확인하기',
    },
    renewal: {
        badge: '리뉴얼 준비 중',
        title: '곧 새로운 경험이 찾아와요',
        description: '완성도 높은 듀티 작성과 간호인력 관리를 위해\n서비스를 새롭게 만들고 있어요.',
        helperText: '기대해도 좋은 기능들도 함께 준비 중이에요.\n곧 더 좋은 모습으로 돌아올게요.',
        dateLabel: '오픈 예정',
        dateText: '8월 30일',
        buttonText: '다시 확인하기',
    },
} as const;

type TServiceStatusType = keyof typeof serviceStatusCopy;

type TServiceStatusPageProps = {
    type: TServiceStatusType;
};

function ServiceStatusPage({type}: TServiceStatusPageProps) {
    const copy = serviceStatusCopy[type];

    return (
        <>
            <Helmet title={`${copy.title} | 듀팅`} />
            <main className="flex min-h-real-screen w-full items-center justify-center overflow-y-auto bg-[#F8F9FC] px-5 py-8 font-apple text-sub-1 sm:px-8">
                <section
                    className="mx-auto flex w-full max-w-[680px] flex-col items-center text-center"
                    aria-labelledby={`${type}-status-title`}
                >
                    <p className="rounded-[8px] bg-main-light px-3.5 py-2 text-[14px] leading-none font-semibold text-main-1">
                        {copy.badge}
                    </p>
                    <img
                        src={PENGUIN_IMAGE_SRC}
                        alt="간호사 펭귄 캐릭터"
                        decoding="async"
                        className="mt-7 h-[188px] w-auto object-contain drop-shadow-[0_18px_34px_rgba(36,36,40,0.16)] select-none sm:h-[240px]"
                    />
                    <h1
                        id={`${type}-status-title`}
                        className="mt-8 text-[28px] leading-[1.32] font-bold tracking-normal break-keep text-sub-1 sm:text-[36px]"
                    >
                        {copy.title}
                    </h1>
                    <p
                        className={`mt-5 max-w-[520px] text-[16px] leading-7 font-semibold break-keep whitespace-pre-line sm:text-[18px] sm:leading-8 ${
                            type === 'renewal' ? 'text-main-1' : 'text-sub-2'
                        }`}
                    >
                        {copy.description}
                    </p>
                    <p className="mt-4 max-w-[520px] text-[15px] leading-7 break-keep whitespace-pre-line text-gray-3 sm:text-[16px]">
                        {copy.helperText}
                    </p>
                    <dl className="mt-7 grid w-full max-w-[360px] grid-cols-[auto_1fr] items-center gap-x-4 rounded-[8px] border border-sub-4.5 bg-white px-5 py-4 text-left">
                        <dt className="text-[14px] font-semibold whitespace-nowrap text-gray-3">{copy.dateLabel}</dt>
                        <dd className="text-right text-[16px] font-bold text-sub-1">{copy.dateText}</dd>
                    </dl>
                    <Button
                        type="button"
                        size="md"
                        className="mt-8 h-12 rounded-[14px] px-6 text-[15px] font-semibold"
                        onClick={() => window.location.reload()}
                    >
                        <RotateCcw className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                        {copy.buttonText}
                    </Button>
                </section>
            </main>
        </>
    );
}

export function MaintenancePage() {
    return <ServiceStatusPage type="maintenance" />;
}

export function RenewalPage() {
    return <ServiceStatusPage type="renewal" />;
}
