import type {ReactNode} from 'react';
import {AssistantMessage} from './ai-adjust-review-conversation';

export function AiFailureMessage({message, children}: {message: string; children?: ReactNode}) {
    return (
        <AssistantMessage>
            <div role="alert" className="space-y-3">
                <p className="break-keep whitespace-pre-line">{message}</p>
                {children}
            </div>
        </AssistantMessage>
    );
}
