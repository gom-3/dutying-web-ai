import {ChevronDown} from 'lucide-react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    groups: {title: string; sentences: string[]}[];
    draft: string;
    disabled?: boolean;
    onPick: (sentence: string) => void;
};

export function AiConversationRequestHelp({groups, draft, disabled = false, onPick}: TProps) {
    const {t} = useTypedTranslation();

    return (
        <details className="ai-adjust-examples group min-w-0 rounded-lg border border-gray-6">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-[13px] font-medium text-[#475467] hover:bg-main-light focus-visible:outline-2 focus-visible:outline-main-1 [&::-webkit-details-marker]:hidden">
                {t('aiConversationSidebar.requestHelp')}
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
            </summary>
            <section aria-label={t('aiAdjust.examples')} className="max-h-72 space-y-4 overflow-y-auto overscroll-contain px-3 pb-3">
                <p className="text-xs leading-5 text-[#667085]">{t('aiConversationSidebar.requestHelpHint')}</p>
                {groups.map((group) => (
                    <div key={group.title} className="space-y-2">
                        <h3 className="text-[13px] font-medium text-[#475467]">{group.title}</h3>
                        {[...new Set(group.sentences)].map((sentence) => (
                            <button
                                key={sentence}
                                type="button"
                                disabled={disabled || (draft.trim() ? draft.trim().length + 1 : 0) + sentence.length > 500}
                                onClick={() => onPick(sentence)}
                                className="flex min-h-11 w-full items-center rounded-lg bg-gray-7 px-3 py-2 text-left text-[13px] leading-5 break-keep text-[#475467] hover:bg-main-light hover:text-main-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1 disabled:opacity-50"
                            >
                                {sentence}
                            </button>
                        ))}
                    </div>
                ))}
                <p className="text-xs leading-5 text-[#667085]">{t('aiConversationSidebar.requestHelpLimits')}</p>
            </section>
        </details>
    );
}
