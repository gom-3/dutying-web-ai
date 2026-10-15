import {CircleAlert} from 'lucide-react';
import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AssistantMessage} from './ai-adjust-review-conversation';

export function AiFailureMessage({message, children, title}: {message: string; children?: ReactNode; title?: string}) {
    const {t} = useTypedTranslation();

    return (
        <AssistantMessage tone="error">
            <div role="alert" className="flex items-start gap-2.5">
                <CircleAlert aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-[#D92D20]" />
                <div className="min-w-0 space-y-2">
                    <p className="font-semibold">{title ?? t('aiAdjust.failure.title')}</p>
                    <p className="break-keep whitespace-pre-line">{message}</p>
                    {children}
                </div>
            </div>
        </AssistantMessage>
    );
}
