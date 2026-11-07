import i18n from '@/i18n';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

/** Browser history stores translated text, including notices saved before this redesign. */
export function isInterruptedRequestNotice(message: string) {
    return ['ko', 'en', 'ja'].some((language) => {
        const t = i18n.getFixedT(language);

        return [t('aiAdjust.preparation.interruptedHistory'), t('aiAdjust.preparation.interruptedHistoryLegacy')].includes(message);
    });
}

export function AiInterruptedRequestNotice() {
    const {t} = useTypedTranslation();
    const [title, description] = t('aiAdjust.preparation.interruptedHistory').split('\n');

    return (
        <div className="flex min-w-0 items-start gap-2">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-[#7652C5]">
                <path fillRule="evenodd" d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 5h2v2H9V5Zm0 4h2v6H9V9Z" clipRule="evenodd" />
            </svg>
            <div className="min-w-0 [overflow-wrap:anywhere] break-keep">
                <p className="text-[14px] leading-[22px] font-medium text-[#333D4B]">{title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[#596579]">{description}</p>
            </div>
        </div>
    );
}
