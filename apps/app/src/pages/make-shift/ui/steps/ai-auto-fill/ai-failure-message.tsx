import {Children, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AssistantMessage} from './ai-adjust-review-conversation';
import {AiConversationOutcomeIcon} from './ai-conversation-outcome-icon';

export function AiFailureMessage({
    message,
    children,
    title,
    headerAction,
}: {
    message: string;
    children?: ReactNode;
    title?: string;
    headerAction?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const resolvedTitle = title ?? t('aiAdjust.failure.title');
    const content = Children.toArray(children);

    return (
        <AssistantMessage tone="error" fullWidth>
            <section aria-label={resolvedTitle} className="min-w-0">
                <div className="relative min-w-0">
                    <div role="alert" className="min-w-0">
                        <div className={`flex items-start gap-2 ${headerAction ? 'min-h-[44px] pr-[52px]' : ''}`}>
                            <AiConversationOutcomeIcon status="failure" label={resolvedTitle} />
                            <p className="text-base leading-6 font-semibold break-keep text-[#333D4B]">{resolvedTitle}</p>
                        </div>
                        <p className="mt-2 text-[14px] leading-6 break-keep whitespace-pre-line text-[#667085]">{message}</p>
                    </div>
                    {headerAction && <div className="absolute top-0 right-0">{headerAction}</div>}
                </div>
                {!!content.length && <div className="mt-4 min-w-0">{content}</div>}
            </section>
        </AssistantMessage>
    );
}
