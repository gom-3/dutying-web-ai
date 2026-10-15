import {Undo2} from 'lucide-react';
import {useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAdjustApplyResult} from '../../../model/ai-adjust-conversation';
import {AssistantMessage} from './ai-adjust-review-conversation';

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
    onModify: () => void;
    onUndo: () => void;
};

const textActionClass =
    'inline-flex min-h-11 items-center gap-1.5 self-start bg-transparent py-2 text-left text-[13px] text-[#6B7684] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

/** Keep the result in history; only the latest applied result offers next actions. */
export function AiAdjustResult({result, active, disabled, modifyDisabled, canUndo, actions, onModify, onUndo}: TProps) {
    const {t} = useTypedTranslation();
    const issues = useRef<HTMLDetailsElement>(null);
    const [changesExpanded, setChangesExpanded] = useState(false);

    if (!result?.applied) return <AssistantMessage>{t(result ? 'aiAdjust.reviewCandidate' : 'aiAdjust.result')}</AssistantMessage>;

    const {response, changes} = result;
    const blocking = response.blockingViolations ?? [];
    const violations = response.validation?.violations ?? [];
    const hasProblems = blocking.length > 0 || !(response.approvable ?? response.validation?.summary.valid ?? true);
    const unmet = response.requestRuleResults?.filter((entry) => entry.violationCount > 0) ?? [];
    const unmetInstructions = response.unmetInstructions?.filter((message) => message.trim()) ?? [];
    const notices = response.adjustmentNotices?.filter((notice) => notice.message.trim()) ?? [];
    const problemMessages = [...new Set([...blocking, ...violations].map((entry) => entry.message).filter((message) => message?.trim()))];
    const hasUnmet = unmet.length > 0 || unmetInstructions.length > 0;
    const hasDetails = hasProblems || problemMessages.length > 0 || hasUnmet || notices.length > 0;

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <AssistantMessage>
                <div className="flex min-w-0 flex-col gap-2">
                    <p>{changes.length ? t('aiAdjust.completed', {count: changes.length}) : t('aiAdjust.noChange')}</p>
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
                    {hasDetails && (
                        <details ref={issues}>
                            <summary className={`${textActionClass} cursor-pointer`}>{t('aiAdjust.resultDetails')}</summary>
                            <div
                                tabIndex={-1}
                                className="space-y-3 text-[13px] focus-visible:text-main-1 focus-visible:underline focus-visible:outline-none"
                            >
                                {problemMessages.length > 0 && (
                                    <ul className="space-y-1">
                                        {problemMessages.map((message) => (
                                            <li key={message}>{message}</li>
                                        ))}
                                    </ul>
                                )}
                                {hasProblems && problemMessages.length === 0 && <p>{t('aiAdjust.checkSchedule')}</p>}
                                {hasUnmet && (
                                    <div>
                                        <p className="font-medium">{t('aiAdjust.unmet')}</p>
                                        <ul className="space-y-1">
                                            {unmet.map((entry) => (
                                                <li key={entry.requestId}>
                                                    {t('aiAdjust.remaining', {
                                                        label: entry.displayLabel?.trim()
                                                            ? entry.displayLabel
                                                            : t('aiAdjust.review.request'),
                                                        count: entry.violationCount,
                                                    })}
                                                </li>
                                            ))}
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
            </AssistantMessage>
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
            {active && (
                <div className="ml-auto flex max-w-full flex-col items-end gap-2">
                    {(hasProblems || actions) && (
                        <button
                            type="button"
                            disabled={disabled || (!hasProblems && !actions?.canConfirm)}
                            onClick={() => {
                                if (hasProblems && issues.current) {
                                    issues.current.open = true;
                                    issues.current.querySelector<HTMLElement>('[tabindex]')?.focus();
                                    issues.current.scrollIntoView?.({block: 'nearest'});
                                } else if (actions?.canConfirm) actions.onConfirm();
                            }}
                            className="min-h-11 max-w-full rounded-xl bg-main-1 px-4 py-3 text-left text-[13.5px] leading-5 font-medium text-white hover:bg-[#5931D9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:opacity-40"
                        >
                            {t(hasProblems ? 'aiAdjust.checkProblems' : 'aiAdjust.confirmSchedule')}
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={disabled || modifyDisabled}
                        onClick={onModify}
                        className="min-h-11 max-w-full rounded-xl bg-main-light px-4 py-3 text-left text-[13.5px] leading-5 font-medium text-[#5931B9] hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                    >
                        {t('aiAdjust.modifyMore')}
                    </button>
                </div>
            )}
        </div>
    );
}
