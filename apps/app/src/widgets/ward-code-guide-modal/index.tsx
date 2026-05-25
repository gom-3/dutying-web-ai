import {cn} from '@dutying/utils/style';
import {CalendarCheck2, ClipboardCheck, Info, MessageCircle, X} from 'lucide-react';
import {type ComponentType, type SVGProps, useId, useState} from 'react';
import wardCodeMegaphoneImage from '@/shared/assets/images/ward-code-megaphone.webp';

const WardCodeMegaphoneImage = ({className}: SVGProps<SVGSVGElement>) => (
    <img
        src={wardCodeMegaphoneImage}
        alt=""
        aria-hidden="true"
        width={20}
        height={20}
        decoding="async"
        className={cn('rounded-[5px] object-cover', className)}
    />
);
const wardCodeShareBenefits = [
    {
        icon: ClipboardCheck,
        title: '간호사가 앱에서 바로 신청해요',
        description: '원티드와 휴일 신청을 듀팅 앱에서 보내면 수간호사는 한 화면에서 확인해요.',
    },
    {
        icon: CalendarCheck2,
        title: '확정 근무표를 바로 공유해요',
        description: '근무표를 게시하면 연결된 간호사가 앱에서 바로 확인할 수 있어요.',
    },
    {
        icon: MessageCircle,
        title: '병동채팅으로 빠르게 맞춰요',
        description: '근무 변경, 긴급 공지, 당일 조율을 병동 구성원과 바로 이야기해요.',
    },
    {
        icon: WardCodeMegaphoneImage,
        title: '게시판 공지 확인까지 챙겨요',
        description: '공지, 인수인계, 안내 글을 올리고 확인 여부와 댓글 흐름을 볼 수 있어요.',
    },
] satisfies {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    title: string;
    description: string;
}[];

type TWardCodeGuideModalProps = {
    open: boolean;
    wardCode: string;
    wardTitle: string;
    onClose: () => void;
};

const WardCodeGuideModal = ({open, wardCode, wardTitle, onClose}: TWardCodeGuideModalProps) => {
    const [showParticipationGuide, setShowParticipationGuide] = useState(false);
    const titleId = useId();
    const descriptionId = useId();

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#17171C]/45 px-6 py-10 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="w-full max-w-[38rem] rounded-[28px] bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2
                            id={titleId}
                            className="flex items-start gap-2.5 font-apple text-[28px] leading-[36px] font-bold text-[#191F28]"
                        >
                            <img
                                src={wardCodeMegaphoneImage}
                                alt=""
                                aria-hidden="true"
                                width={31}
                                height={31}
                                decoding="async"
                                className="mt-1 size-[31px] shrink-0 rounded-[8px] object-cover"
                            />
                            소속 간호사에게 병동코드를 알려주세요
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label="병동코드 안내 닫기"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#8B95A1] transition-colors hover:bg-[#F2F4F6] hover:text-[#4E5968]"
                        onClick={onClose}
                    >
                        <X className="size-5" aria-hidden="true" />
                    </button>
                </div>
                <p id={descriptionId} className="mt-3 max-w-[34rem] font-apple text-[16px] leading-7 text-[#4E5968]">
                    간호사가 듀팅 앱에서 이 코드를 입력하면 {wardTitle}에 바로 연결돼요.
                    <br />
                    신청근무 제출부터 근무표 확인, 채팅, 공지까지 한곳에서 이어져요.
                </p>
                <div className="mt-5">
                    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F9FAFB] px-4 py-4">
                        <div className="min-w-0">
                            <p className="font-apple text-[13px] font-bold text-[#8B95A1]">{wardTitle} 병동코드</p>
                            <p className="mt-2 truncate font-poppins text-[30px] leading-none font-bold text-[#7B4DFF]">{wardCode}</p>
                        </div>
                        <button
                            type="button"
                            aria-label="듀팅 병동코드 입력 방법 보기"
                            aria-expanded={showParticipationGuide}
                            className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-[#7B4DFF] transition-colors hover:text-[#6A3EEB] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                            onBlur={() => setShowParticipationGuide(false)}
                            onClick={() => setShowParticipationGuide((prev) => !prev)}
                            onMouseEnter={() => setShowParticipationGuide(true)}
                            onMouseLeave={() => setShowParticipationGuide(false)}
                        >
                            <Info className="size-4.5" aria-hidden="true" />
                            {showParticipationGuide ? (
                                <span className="absolute top-11 right-0 z-10 w-[18rem] rounded-[14px] bg-[#191F28] px-4 py-3 text-left font-apple text-[13px] leading-5 font-medium text-white shadow-[0_12px_30px_rgba(15,23,42,0.24)]">
                                    듀팅 앱에서 병동 참여를 누르고 듀팅 병동코드를 입력하면 돼요.
                                </span>
                            ) : null}
                        </button>
                    </div>
                </div>
                <div className="mt-5 grid gap-2.5">
                    {wardCodeShareBenefits.map((benefit) => {
                        const Icon = benefit.icon;

                        return (
                            <div key={benefit.title} className="flex gap-3 rounded-[18px] bg-[#F9FAFB] px-4 py-3.5">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#E5E8EB] bg-white text-[#7B4DFF]">
                                    <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-apple text-[15px] leading-5 font-bold text-[#333D4B]">{benefit.title}</p>
                                    <p className="mt-1 font-apple text-[13px] leading-5 text-[#6B7684]">{benefit.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WardCodeGuideModal;
