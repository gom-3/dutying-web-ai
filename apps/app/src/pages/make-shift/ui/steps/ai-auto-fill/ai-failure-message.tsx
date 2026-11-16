import type {TScheduleObservation} from '@dutying/api/ward';
import {Children, type ReactNode} from 'react';
import i18n from '@/i18n';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useScheduleJourneyDisplay} from '../../../model/use-schedule-journey-display';
import {failureMessagePoints, localizeStoredFailureMessage} from '../../../model/failure-message-points';
import {AssistantMessage} from './ai-adjust-review-conversation';
import {AiConversationOutcomeIcon} from './ai-conversation-outcome-icon';
import {AiInterruptedRequestNotice, isInterruptedRequestNotice} from './ai-interrupted-request-notice';

export function AiFailureMessage({
    message,
    children,
    title,
    headerAction,
    announce = true,
    observation,
}: {
    message: string;
    children?: ReactNode;
    title?: string;
    headerAction?: ReactNode;
    announce?: boolean;
    observation?: TScheduleObservation;
}) {
    const {t} = useTypedTranslation();
    const displayRef = useScheduleJourneyDisplay<HTMLElement>(observation);
    const defaultTitle = t('aiAdjust.failure.title');
    const resolvedTitle = title ?? defaultTitle;
    const points = [...new Set(failureMessagePoints(localizeStoredFailureMessage(message)))].filter(
        (point) => point !== resolvedTitle && point !== defaultTitle,
    );
    const content = Children.toArray(children);
    const wrapping = i18n.resolvedLanguage?.startsWith('ja') ? 'break-normal' : 'break-keep';

    if (!title && isInterruptedRequestNotice(message)) {
        return (
            <AssistantMessage>
                <AiInterruptedRequestNotice />
                {headerAction}
                {!!content.length && <div className="mt-3">{content}</div>}
            </AssistantMessage>
        );
    }

    return (
        <AssistantMessage tone={announce ? 'error' : 'default'} fullWidth>
            <section ref={displayRef} aria-label={resolvedTitle} className="min-w-0">
                <div className="relative min-w-0">
                    <div role={announce ? 'alert' : undefined} className="min-w-0">
                        <div className={`flex items-start gap-2 ${headerAction ? 'min-h-[44px] pr-[52px]' : ''}`}>
                            <AiConversationOutcomeIcon
                                status={announce ? 'failure' : 'history'}
                                label={announce ? resolvedTitle : undefined}
                            />
                            <p className={`text-sm leading-6 font-semibold ${wrapping} text-[#333D4B]`}>{resolvedTitle}</p>
                        </div>
                        {points.length === 1 && <p className={`mt-1 text-[13px] leading-5 ${wrapping} text-[#475467]`}>{points[0]}</p>}
                        {points.length > 1 && (
                            <ul className={`mt-1 list-disc space-y-1 pl-5 text-[13px] leading-5 ${wrapping} text-[#475467]`}>
                                {points.map((point, index) => (
                                    <li key={index}>{point}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {headerAction && <div className="absolute top-0 right-0">{headerAction}</div>}
                </div>
                {!!content.length && <div className="mt-3 min-w-0">{content}</div>}
            </section>
        </AssistantMessage>
    );
}
