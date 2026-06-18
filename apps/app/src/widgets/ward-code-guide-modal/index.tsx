import {cn} from '@dutying/utils/style';
import {Copy, Info, X} from 'lucide-react';
import {type ComponentType, type SVGProps, useId, useState} from 'react';
import toast from 'react-hot-toast';
import wardCodeAppApplyImage from '@/shared/assets/images/ward-code-app-apply.png';
import wardCodeChatImage from '@/shared/assets/images/ward-code-chat.png';
import wardCodeMegaphoneImage from '@/shared/assets/images/ward-code-megaphone.webp';
import wardCodeScheduleShareImage from '@/shared/assets/images/ward-code-schedule-share.png';
import {useTypedTranslation, type TI18nKey} from '@/shared/hook/use-typed-translation';

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
const WardCodeAppApplyImage = ({className}: SVGProps<SVGSVGElement>) => (
    <img
        src={wardCodeAppApplyImage}
        alt=""
        aria-hidden="true"
        width={128}
        height={160}
        decoding="async"
        className={cn('max-w-none shrink-0 object-contain', className)}
    />
);
const WardCodeScheduleShareImage = ({className}: SVGProps<SVGSVGElement>) => (
    <img
        src={wardCodeScheduleShareImage}
        alt=""
        aria-hidden="true"
        width={159}
        height={160}
        decoding="async"
        className={cn('max-w-none shrink-0 object-contain', className)}
    />
);
const WardCodeChatImage = ({className}: SVGProps<SVGSVGElement>) => (
    <img
        src={wardCodeChatImage}
        alt=""
        aria-hidden="true"
        width={156}
        height={160}
        decoding="async"
        className={cn('max-w-none shrink-0 object-contain', className)}
    />
);
const wardCodeShareBenefits = [
    {
        icon: WardCodeAppApplyImage,
        iconClassName: 'size-10',
        titleKey: 'widget.wardCodeGuide.benefits.appApply.title',
        descriptionKey: 'widget.wardCodeGuide.benefits.appApply.description',
    },
    {
        icon: WardCodeScheduleShareImage,
        iconClassName: 'size-[33px]',
        titleKey: 'widget.wardCodeGuide.benefits.scheduleShare.title',
        descriptionKey: 'widget.wardCodeGuide.benefits.scheduleShare.description',
    },
    {
        icon: WardCodeChatImage,
        iconClassName: 'size-[33px]',
        titleKey: 'widget.wardCodeGuide.benefits.chat.title',
        descriptionKey: 'widget.wardCodeGuide.benefits.chat.description',
    },
    {
        icon: WardCodeMegaphoneImage,
        iconClassName: 'size-[33px]',
        titleKey: 'widget.wardCodeGuide.benefits.board.title',
        descriptionKey: 'widget.wardCodeGuide.benefits.board.description',
    },
] satisfies {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    iconClassName?: string;
    titleKey: TI18nKey;
    descriptionKey: TI18nKey;
}[];

type TWardCodeGuideModalProps = {
    open: boolean;
    wardCode: string;
    wardTitle: string;
    onClose: () => void;
};

const copyTextToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);

        return;
    } catch {
        const textarea = document.createElement('textarea');

        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const copied = document.execCommand('copy');

            if (!copied) throw new Error('copy command failed');
        } finally {
            document.body.removeChild(textarea);
        }
    }
};
const WardCodeGuideModal = ({open, wardCode, wardTitle, onClose}: TWardCodeGuideModalProps) => {
    const {t} = useTypedTranslation();
    const [showParticipationGuide, setShowParticipationGuide] = useState(false);
    const titleId = useId();
    const descriptionId = useId();
    const title = t('widget.wardCodeGuide.title');
    const dialogLabel = title.replace(/\s+/g, ' ').trim();
    const copyableWardCode = wardCode.trim();
    const canCopyWardCode = copyableWardCode.length > 0 && copyableWardCode !== '-';
    const handleCopyWardCode = async () => {
        if (!canCopyWardCode) return;

        try {
            await copyTextToClipboard(copyableWardCode);
            toast.success(t('widget.wardCodeGuide.toast.copySuccess'));
        } catch {
            toast.error(t('widget.wardCodeGuide.toast.copyFailed'));
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#17171C]/45 px-6 py-10 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={dialogLabel}
                aria-describedby={descriptionId}
                className="w-full max-w-[38rem] rounded-[28px] bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id={titleId} className="font-apple text-[28px] leading-[36px] font-bold whitespace-pre-line text-[#191F28]">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label={t('widget.wardCodeGuide.closeAria')}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#8B95A1] transition-colors hover:bg-[#F2F4F6] hover:text-[#4E5968]"
                        onClick={onClose}
                    >
                        <X className="size-5" aria-hidden="true" />
                    </button>
                </div>
                <p id={descriptionId} className="mt-3 max-w-[34rem] font-apple text-[16px] leading-7 whitespace-pre-line text-[#4E5968]">
                    {t('widget.wardCodeGuide.description')}
                </p>
                <div className="mt-5">
                    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F9FAFB] px-4 py-4">
                        <div className="min-w-0">
                            <p className="font-apple text-[13px] font-bold text-[#8B95A1]">
                                {t('widget.wardCodeGuide.wardCodeLabel', {wardTitle})}
                            </p>
                            <div className="mt-2 flex min-w-0 items-center gap-2">
                                <p className="truncate font-poppins text-[30px] leading-none font-bold text-[#7B4DFF]">{wardCode}</p>
                                <button
                                    type="button"
                                    aria-label={t('widget.wardCodeGuide.copyAria')}
                                    disabled={!canCopyWardCode}
                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[#8B95A1] transition-colors hover:bg-[#F2F4F6] hover:text-[#7B4DFF] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={handleCopyWardCode}
                                >
                                    <Copy className="size-4" strokeWidth={2.2} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-label={t('widget.wardCodeGuide.participationGuideAria')}
                            aria-expanded={showParticipationGuide}
                            className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-[#7B4DFF] transition-colors hover:text-[#6A3EEB] focus-visible:ring-2 focus-visible:ring-main-3 focus-visible:ring-offset-2 focus-visible:outline-none"
                            onBlur={() => setShowParticipationGuide(false)}
                            onClick={() => setShowParticipationGuide((prev) => !prev)}
                            onMouseEnter={() => setShowParticipationGuide(true)}
                            onMouseLeave={() => setShowParticipationGuide(false)}
                        >
                            <Info className="size-4.5" aria-hidden="true" />
                            {showParticipationGuide ? (
                                <span className="absolute top-11 right-0 z-10 w-[18rem] rounded-[14px] bg-[#191F28] px-4 py-3 text-left font-apple text-[13px] leading-5 font-medium whitespace-pre-line text-white shadow-[0_12px_30px_rgba(15,23,42,0.24)]">
                                    {t('widget.wardCodeGuide.participationGuide')}
                                </span>
                            ) : null}
                        </button>
                    </div>
                </div>
                <div className="mt-5 divide-y divide-[#EEF1F4]">
                    {wardCodeShareBenefits.map((benefit) => {
                        const Icon = benefit.icon;

                        return (
                            <div key={benefit.titleKey} className="flex gap-3 px-4 py-4.5">
                                <div className="flex size-10 shrink-0 items-center justify-center text-[#7B4DFF]">
                                    <Icon className={benefit.iconClassName ?? 'size-6'} strokeWidth={2.2} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-apple text-[15px] leading-5 font-bold whitespace-pre-line text-[#333D4B]">
                                        {t(benefit.titleKey)}
                                    </p>
                                    <p className="mt-1 font-apple text-[13px] leading-5 whitespace-pre-line text-[#6B7684]">
                                        {t(benefit.descriptionKey)}
                                    </p>
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
