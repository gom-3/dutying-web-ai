import {X} from 'lucide-react';
import headerIcon from '@/shared/assets/images/ai-adjust/header.svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

export function AiConversationHeader({
    onNewRequest,
    onClose,
    disabled = false,
}: {
    onNewRequest: () => void;
    onClose: () => void;
    disabled?: boolean;
}) {
    const {t} = useTypedTranslation();

    return (
        <header className="flex min-h-24 shrink-0 flex-wrap items-center gap-2 px-[25px] py-4">
            <img src={headerIcon} alt="" width={28} height={28} className="shrink-0" />
            <h2 className="min-w-[96px] flex-1 text-[16px] leading-6 font-semibold text-[#242B36]">{t('aiAdjust.title')}</h2>
            <button
                type="button"
                onClick={onNewRequest}
                disabled={disabled}
                aria-label={t('aiAdjust.chat.restart')}
                className="ml-auto min-h-11 shrink-0 rounded-lg px-2 text-[13px] text-[#475467] hover:bg-main-light hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
            >
                {t('aiAdjust.chat.restartShort')}
            </button>
            <button
                type="button"
                onClick={onClose}
                aria-label={t('aiAdjust.close')}
                className="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-lg text-[#667085] hover:bg-main-light hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
            >
                <X aria-hidden="true" className="size-[18px]" />
            </button>
        </header>
    );
}
