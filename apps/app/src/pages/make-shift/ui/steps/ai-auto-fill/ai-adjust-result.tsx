import {Undo2} from 'lucide-react';
import {useRef, useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAdjustApplyResult} from '../../../model/ai-adjust-conversation';
import {useScheduleJourneyDisplay} from '../../../model/use-schedule-journey-display';
import {AiConversationEntry} from './ai-conversation-entry';
import {AiConversationResultDetails} from './ai-conversation-result-details';
import {AiScheduleResultCard} from './ai-schedule-result-card';

export type TAdjustResultActions = {
    canConfirm: boolean;
    onConfirm: () => void;
    disabled?: boolean;
};

type TProps = {
    result?: TAdjustApplyResult;
    active: boolean;
    disabled: boolean;
    modifyDisabled: boolean;
    canUndo: boolean;
    actions?: TAdjustResultActions;
    attempt?: number;
    preview?: ReactNode;
    onModify: () => void;
    onEditSchedule?: () => void;
    onUndo: () => void;
};

const textActionClass =
    'inline-flex min-h-11 items-center gap-1.5 self-start bg-transparent py-2 text-left text-[13px] text-[#6B7684] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

/** Keep the result in history; only the latest applied result offers next actions. */
export function AiAdjustResult({
    result,
    active,
    disabled,
    modifyDisabled,
    canUndo,
    actions,
    attempt,
    preview,
    onModify,
    onEditSchedule,
    onUndo,
}: TProps) {
    const {t} = useTypedTranslation();
    const issues = useRef<HTMLDivElement>(null);
    const displayRef = useScheduleJourneyDisplay(result?.response?.observation);
    const [changesExpanded, setChangesExpanded] = useState(false);

    if (!result?.applied)
        return (
            <AiScheduleResultCard
                title={t(result ? 'aiAdjust.reviewCandidate' : 'aiAdjust.result')}
                attempt={attempt}
                outcome="review"
                preview={preview}
            />
        );

    const {response, changes} = result;
    const blocking = response.blockingViolations ?? [];
    const hasProblems = blocking.length > 0 || !(response.approvable ?? response.validation?.summary.valid ?? true);
    const unmet = response.requestRuleResults?.filter((entry) => entry.violationCount > 0) ?? [];
    const unmetInstructions = response.unmetInstructions?.filter((message) => message.trim()) ?? [];
    const notices = response.adjustmentNotices?.filter((notice) => notice.message.trim()) ?? [];
    const hasUnmet = unmet.length > 0 || unmetInstructions.length > 0;
    const hasSupplementalDetails = unmetInstructions.length > 0 || notices.length > 0;
    const title = changes.length
        ? t('aiAutofillUi.conversationResult.yourAdjustedScheduleIsReady')
        : t('aiAutofillUi.conversationResult.noShiftsChangedThisTime');

    return (
        <div ref={displayRef} className="flex min-w-0 flex-col gap-3">
            <AiScheduleResultCard
                title={title}
                attempt={attempt}
                outcome={hasProblems ? 'review' : 'success'}
                outcomeLabel={t(hasProblems ? 'aiAdjust.snapshot.review' : 'aiAdjust.snapshot.success')}
                changedCount={changes.length}
                preview={preview}
                actions={
                    active && (
                        <div className="grid gap-2">
                            {hasProblems && (
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        if (issues.current) {
                                            issues.current.querySelectorAll('details').forEach((detail) => {
                                                detail.open = true;
                                            });
                                            issues.current.focus();
                                            issues.current.scrollIntoView?.({block: 'nearest'});
                                        }
                                    }}
                                    className="min-h-[44px] rounded-[10px] bg-white px-4 py-3 text-[13.5px] font-medium text-[#475467] hover:bg-main-light focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                                >
                                    {t('aiAdjust.checkProblems')}
                                </button>
                            )}
                            {onEditSchedule ? (
                                <AiConversationEntry
                                    choice={null}
                                    attached
                                    hideIntro
                                    disabled={disabled}
                                    modifyDisabled={modifyDisabled}
                                    onChoose={(choice) => (choice === 'edit' ? onEditSchedule() : onModify())}
                                />
                            ) : (
                                <button
                                    type="button"
                                    disabled={disabled || modifyDisabled}
                                    onClick={onModify}
                                    className="min-h-[44px] rounded-[10px] bg-white px-4 py-3 text-[13.5px] font-medium text-[#475467] hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                                >
                                    {t('aiAdjust.modifyMore')}
                                </button>
                            )}
                            {result.undoRevision !== undefined && (
                                <button
                                    type="button"
                                    disabled={disabled || !canUndo}
                                    onClick={onUndo}
                                    title={t('aiAdjust.undoNote')}
                                    className={textActionClass}
                                >
                                    <Undo2 aria-hidden="true" className="size-4 shrink-0" />
                                    {t('aiAdjust.undo')}
                                </button>
                            )}
                        </div>
                    )
                }
            >
                <div className="flex min-w-0 flex-col gap-2">
                    {hasProblems && <p className="text-[13px]">{t('aiAdjust.notApprovable')}</p>}
                    {!hasProblems && hasUnmet && <p className="text-[13px]">{t('aiAdjust.someUnmet')}</p>}
                    {changes.length > 0 && (
                        <details onToggle={(event) => setChangesExpanded(event.currentTarget.open)}>
                            <summary className={`${textActionClass} cursor-pointer`}>
                                {t(changesExpanded ? 'aiAdjust.collapseChanges' : 'aiAdjust.changeDetails')}
                            </summary>
                            <ul className="space-y-2 text-[13px]">
                                {changes.map((change, index) => (
                                    <li key={index} className="break-keep">
                                        <p>
                                            {change.name} · {change.date.slice(5).replace('-', '/')}
                                        </p>
                                        <p>
                                            {change.before ?? '—'} → {change.after ?? '—'}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                    <div
                        ref={issues}
                        tabIndex={-1}
                        className="min-w-0 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none"
                    >
                        <AiConversationResultDetails result={response} />
                        {hasSupplementalDetails && (
                            <details>
                                <summary className={`${textActionClass} cursor-pointer`}>{t('aiAdjust.resultDetails')}</summary>
                                <div className="space-y-3 text-[13px]">
                                    {unmetInstructions.length > 0 && (
                                        <div>
                                            <p className="font-medium">{t('aiAdjust.unmet')}</p>
                                            <ul className="space-y-1">
                                                {unmetInstructions.map((message, index) => (
                                                    <li key={index}>{message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {notices.length > 0 && (
                                        <ul className="space-y-1">
                                            {notices.map((notice, index) => (
                                                <li key={index}>{notice.message}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            </AiScheduleResultCard>
            {active && !hasProblems && actions && (
                <button
                    type="button"
                    disabled={disabled || !actions.canConfirm}
                    onClick={() => {
                        if (actions.canConfirm) actions.onConfirm();
                    }}
                    className="min-h-[44px] w-full rounded-[10px] bg-main-1 px-4 py-3 text-center text-[14px] leading-5 font-medium text-white hover:bg-[#5931D9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:opacity-40"
                >
                    {t('aiAdjust.confirmSchedule')}
                </button>
            )}
        </div>
    );
}
