import * as Dialog from '@radix-ui/react-dialog';
import {History} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AssistantMessage} from './ai-adjust-review-conversation';
import {AiConversationOutcomeIcon} from './ai-conversation-outcome-icon';
import {AiScheduleResultDetailsDialog} from './ai-schedule-result-details-dialog';

/** Both conversation transports present a captured result through the same card. */
export function AiScheduleResultCard({
    title,
    summary,
    attempt,
    outcome = 'neutral',
    outcomeLabel,
    changedCount,
    changedPeople,
    compact = false,
    historical = false,
    dismissDetails = false,
    changeSummary,
    description,
    preview,
    headerAction,
    children,
    actions,
    secondaryActions,
}: {
    title: string;
    summary?: string;
    attempt?: number;
    outcome?: 'success' | 'review' | 'neutral';
    outcomeLabel?: string;
    changedCount?: number;
    changedPeople?: number;
    compact?: boolean;
    historical?: boolean;
    dismissDetails?: boolean;
    changeSummary?: ReactNode;
    description?: ReactNode;
    preview?: ReactNode;
    headerAction?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    secondaryActions?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const detailsMode = historical ? 'history' : 'current';
    const [openedDetails, setOpenedDetails] = useState<typeof detailsMode | null>(null);

    // Close the comparison when its context changes or the reapply confirmation opens.
    if (openedDetails !== null && (!compact || dismissDetails || openedDetails !== detailsMode)) setOpenedDetails(null);

    const detailsTitle = t(historical ? 'aiConversationSidebar.authoring.previousChanges' : 'aiAutofillUi.conversationResult.detailsTitle');
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const changeLabel =
        typeof changedCount === 'number' && changedCount > 0
            ? typeof changedPeople === 'number'
                ? t('aiAutofillUi.conversationResult.changeSummary', {people: changedPeople, count: changedCount})
                : t('aiAdjust.snapshot.changed', {count: changedCount})
            : undefined;
    const outcomeIcon = historical ? (
        <History aria-hidden className="size-[18px] shrink-0 text-[#667085]" />
    ) : outcome !== 'neutral' ? (
        <AiConversationOutcomeIcon
            status={outcome}
            label={outcomeLabel ?? t(outcome === 'success' ? 'aiAdjust.snapshot.success' : 'aiAdjust.snapshot.review')}
        />
    ) : null;
    const resultBody = (
        <>
            {description && <div className="text-[13px] leading-5 break-keep text-[#667085]">{description}</div>}
            {preview}
            {changeSummary && (
                <div className="mt-3">
                    {compact && (
                        <h3 className="mb-2 text-sm font-semibold text-sub-1">
                            {t(historical ? 'aiAutofillUi.scheduleSnapshotViewer.compare' : 'aiAutofillUi.conversationResult.details')}
                        </h3>
                    )}
                    {changeSummary}
                </div>
            )}
            {children}
        </>
    );

    return (
        <AssistantMessage fullWidth>
            <section aria-label={t('aiAdjust.snapshot.result')} className={compact ? '-my-1 min-w-0' : 'min-w-0'}>
                <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span
                        className={`flex min-w-0 gap-2 ${summary ? 'flex-[1_1_9rem] items-start [&>svg]:mt-px' : compact ? 'items-center [&>svg]:mt-0' : 'items-start'}`}
                    >
                        {outcomeIcon}
                        <span className="block min-w-0">
                            <span
                                className={
                                    compact
                                        ? 'block text-sm leading-5 font-semibold break-keep'
                                        : 'block text-base leading-6 font-semibold break-keep'
                                }
                            >
                                <span>{title}</span>{' '}
                                {attempt && outcome !== 'success' ? (
                                    <span className="whitespace-nowrap">{t('aiAdjust.snapshot.attempt', {count: attempt})}</span>
                                ) : null}
                            </span>
                            {!compact && changeLabel && (
                                <span
                                    aria-label={t('aiAdjust.snapshot.changedLabel', {count: changedCount!})}
                                    className="mt-0.5 block text-xs leading-5 break-keep text-[#667085]"
                                >
                                    {changeLabel}
                                </span>
                            )}
                            {summary && <span className="mt-0.5 block text-xs leading-4 break-keep text-[#596579]">{summary}</span>}
                        </span>
                    </span>
                    {headerAction}
                    {compact && (
                        <Dialog.Root
                            open={openedDetails === detailsMode}
                            onOpenChange={(open) => setOpenedDetails(open ? detailsMode : null)}
                        >
                            <Dialog.Trigger asChild>
                                <button
                                    type="button"
                                    className="group forced-colors:focus-visible:outline-auto inline-flex min-h-11 shrink-0 items-center gap-1 py-1 text-[13px] leading-5 font-medium text-main-1 transition-colors hover:text-main-1-hover focus-visible:text-[#4524A8] focus-visible:outline-none motion-reduce:transition-none"
                                >
                                    <span className="group-hover:underline group-focus-visible:underline">
                                        {historical ? detailsTitle : t('aiAutofillUi.conversationResult.viewDetails')}
                                    </span>
                                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-3 shrink-0">
                                        <path d="m7 4 6 6-6 6-1.5-1.5L10 10 5.5 5.5 7 4Z" />
                                    </svg>
                                </button>
                            </Dialog.Trigger>
                            <Dialog.Portal container={portalContainer}>
                                <Dialog.Overlay className="fixed inset-0 z-[1450] bg-black/35" />
                                <div className="pointer-events-none fixed inset-x-4 top-4 z-[1451] flex h-[calc(100dvh-32px)] items-center justify-center">
                                    <AiScheduleResultDetailsDialog
                                        title={detailsTitle}
                                        description={changeLabel ?? title}
                                        dismissDetails={dismissDetails}
                                        actions={secondaryActions}
                                    >
                                        {resultBody}
                                    </AiScheduleResultDetailsDialog>
                                </div>
                            </Dialog.Portal>
                        </Dialog.Root>
                    )}
                </header>
                {!compact && (
                    <>
                        {resultBody}
                        {secondaryActions}
                    </>
                )}
                {actions && <div className="mt-3">{actions}</div>}
            </section>
        </AssistantMessage>
    );
}
