import {ArrowLeftRight} from 'lucide-react';
import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AssistantMessage} from './ai-adjust-review-conversation';
import {AiConversationOutcomeIcon} from './ai-conversation-outcome-icon';

/** Both conversation transports present a captured result through the same card. */
export function AiScheduleResultCard({
    title,
    attempt,
    outcome = 'neutral',
    outcomeLabel,
    changedCount,
    changeSummary,
    description,
    preview,
    headerAction,
    children,
    actions,
}: {
    title: string;
    attempt?: number;
    outcome?: 'success' | 'review' | 'neutral';
    outcomeLabel?: string;
    changedCount?: number;
    changeSummary?: ReactNode;
    description?: ReactNode;
    preview?: ReactNode;
    headerAction?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
}) {
    const {t} = useTypedTranslation();

    return (
        <AssistantMessage fullWidth>
            <section aria-label={t('aiAdjust.snapshot.result')} className="min-w-0">
                <header className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2 pt-1">
                        {outcome !== 'neutral' && (
                            <AiConversationOutcomeIcon
                                status={outcome}
                                label={outcomeLabel ?? t(outcome === 'success' ? 'aiAdjust.snapshot.success' : 'aiAdjust.snapshot.review')}
                            />
                        )}
                        <p className="text-base leading-6 font-semibold break-keep text-[#333D4B]">
                            <span>{title}</span>{' '}
                            {attempt && outcome !== 'success' ? (
                                <span className="whitespace-nowrap">{t('aiAdjust.snapshot.attempt', {count: attempt})}</span>
                            ) : null}
                        </p>
                    </div>
                    {headerAction}
                </header>
                {description && <div className="mt-2 text-[13px] leading-5 break-keep text-[#667085]">{description}</div>}
                {preview}
                {typeof changedCount === 'number' && changedCount > 0 && (
                    <p
                        aria-label={t('aiAdjust.snapshot.changedLabel', {count: changedCount})}
                        title={t('aiAdjust.snapshot.changedLabel', {count: changedCount})}
                        className="mt-3 flex items-center gap-1.5 text-[13px] leading-5 font-medium text-[#667085]"
                    >
                        <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0" />
                        <span>{t('aiAdjust.snapshot.changed', {count: changedCount})}</span>
                    </p>
                )}
                {changeSummary && <div className="mt-3">{changeSummary}</div>}
                {children}
                {actions && <div className="mt-3">{actions}</div>}
            </section>
        </AssistantMessage>
    );
}
