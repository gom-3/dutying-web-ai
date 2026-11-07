import {useId} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    examples: string[];
    draft: string;
    compact: boolean;
    disabled: boolean;
    onPick: (sentence: string) => void;
};

export function AiConversationRequestExamples({examples, draft, compact, disabled, onPick}: TProps) {
    const {t} = useTypedTranslation();
    const headingId = useId();
    const draftLength = draft.trim().length;

    return (
        <section aria-labelledby={headingId} className="ai-conversation-request-examples flex min-w-0 flex-col gap-[4px]">
            <h3 id={headingId} className="mb-[2px] px-[12px] text-[12px] leading-[18px] font-medium text-main-1">
                {t('aiAdjust.examples')}
            </h3>
            {examples.slice(0, compact ? 2 : 3).map((sentence) => (
                <button
                    key={sentence}
                    type="button"
                    disabled={disabled || draftLength + (draftLength ? 1 : 0) + sentence.length > 500}
                    onClick={() => onPick(sentence)}
                    className="forced-colors:focus-visible:outline-auto flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg bg-[#F7F8FA] px-[12px] py-[8px] text-left text-[13px] leading-[20px] text-[#596579] transition-colors hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                    <span className="min-w-0 [overflow-wrap:anywhere] break-keep">{sentence}</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-[18px] shrink-0">
                        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            ))}
        </section>
    );
}
