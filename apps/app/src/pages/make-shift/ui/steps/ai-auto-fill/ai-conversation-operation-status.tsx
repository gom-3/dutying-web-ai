import {type ReactNode, useEffect, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {conversationOperationFailure} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AssistantMessage} from './ai-adjust-review-conversation';

export function isConversationOperationPending(operation: TConversationOperation) {
    return !conversationOperationFailure(operation) && ['RUNNING', 'RESULT_READY', 'UNKNOWN'].includes(operation.executionStatus);
}

export function conversationOperationStatusKey(operation: TConversationOperation, attempt = 1) {
    return operation.executionStatus === 'CANCELLED'
        ? 'cancelled'
        : operation.progress?.phase === 'QUEUED'
          ? 'queued'
          : operation.progress?.phase === 'VALIDATING'
            ? 'verifying'
            : operation.executionStatus === 'UNKNOWN'
              ? 'checkingTheResult'
              : operation.executionStatus === 'RESULT_READY'
                ? 'finishingYourSchedule'
                : operation.operationType === 'ADJUST'
                  ? 'adjustingYourSchedule'
                  : attempt > 1
                    ? 'refillingYourSchedule'
                    : 'fillingYourSchedule';
}

const progressEvents = ['QUEUED', 'COMPUTING', 'LONG_RUNNING', 'VALIDATING', 'RESULT_READY', 'UNKNOWN', 'CANCELLED'] as const;

type TProgressEvent = (typeof progressEvents)[number];

function readProgress(storageKey?: string): TProgressEvent[] {
    if (!storageKey) return [];

    try {
        const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');

        return Array.isArray(value)
            ? [...new Set(value.filter((event): event is TProgressEvent => progressEvents.includes(event)))].slice(0, 7)
            : [];
    } catch {
        return [];
    }
}

function recordObservedProgress(previous: TProgressEvent[], operation: TConversationOperation): TProgressEvent[] {
    if (conversationOperationFailure(operation)) return previous;

    const observed: TProgressEvent | undefined =
        operation.executionStatus === 'CANCELLED'
            ? 'CANCELLED'
            : operation.executionStatus === 'UNKNOWN'
              ? 'UNKNOWN'
              : operation.executionStatus === 'RESULT_READY'
                ? 'RESULT_READY'
                : operation.executionStatus === 'RUNNING'
                  ? (operation.progress?.phase ?? 'COMPUTING')
                  : undefined;

    if (!observed || previous.includes('CANCELLED')) return previous;

    if (observed === 'VALIDATING' && previous.includes('RESULT_READY')) return previous;

    // Do not replay an earlier phase when overlapping polls arrive out of order.
    if (['QUEUED', 'COMPUTING'].includes(observed) && previous.some((event) => ['VALIDATING', 'RESULT_READY', 'CANCELLED'].includes(event)))
        return previous;

    const additions: TProgressEvent[] = [observed];

    if (observed === 'COMPUTING' && (operation.progress?.elapsedMs ?? 0) >= 30000) additions.push('LONG_RUNNING');

    const next = [...new Set([...previous, ...additions])];

    return next.length === previous.length ? previous : next;
}

/** Each observed phase adds a distinct assistant message; prior messages survive completion and remount. */
export function AiConversationOperationStatus({
    operation,
    storageKey,
    children,
}: {
    operation: TConversationOperation;
    attempt: number;
    copy: (ko: string, en: string) => string;
    storageKey?: string;
    children?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const [events, setEvents] = useState(() => recordObservedProgress(readProgress(storageKey), operation));

    useEffect(() => {
        setEvents((previous) => recordObservedProgress(previous, operation));
    }, [operation]);
    useEffect(() => {
        if (!storageKey || events.length === 0) return;

        try {
            sessionStorage.setItem(storageKey, JSON.stringify(events));
        } catch {
            /* Storage failure must not block calculation. */
        }
    }, [events, storageKey]);

    const message = (event: TProgressEvent) => {
        switch (event) {
            case 'COMPUTING':
                return t(
                    operation.operationType === 'ADJUST'
                        ? 'aiAutofillUi.executionPresentation.startedAdjusting'
                        : 'aiAutofillUi.executionPresentation.startedGenerating',
                );
            case 'LONG_RUNNING':
                return `${t('aiAutofillUi.conversationOperationStatus.continuing')} ${t('aiAutofillUi.executionPresentation.keepsCalculatingWhenClosed')}`;
            case 'QUEUED':
                return t('aiAutofillUi.conversationOperationStatus.queued');
            case 'VALIDATING':
                return t('aiAutofillUi.conversationOperationStatus.verifying');
            case 'RESULT_READY':
                return t('aiAutofillUi.conversationOperationStatus.finishingYourSchedule');
            case 'UNKNOWN':
                return t('aiAutofillUi.conversationOperationStatus.checkingTheResult');
            case 'CANCELLED':
                return t('aiAutofillUi.conversationOperationStatus.cancelled');
        }
    };

    return (
        <div className="space-y-4">
            {events.length > 0 && (
                <div
                    role="log"
                    aria-label={t('aiAutofillUi.executionPresentation.progressConversation')}
                    aria-live="polite"
                    aria-relevant="additions"
                    className="space-y-4"
                >
                    {events.map((event, index) => (
                        <AssistantMessage key={event} plain>
                            <p className="flex items-start gap-2">
                                {message(event)}
                                {index === events.length - 1 &&
                                    isConversationOperationPending(operation) &&
                                    operation.executionStatus !== 'UNKNOWN' && (
                                        <span aria-hidden="true" className="ai-conversation-operation-dots flex shrink-0 gap-1.5 pt-3">
                                            {[0, 1, 2].map((dot) => (
                                                <span key={dot} className="ai-adjust-review-dot size-1 rounded-full bg-main-1" />
                                            ))}
                                        </span>
                                    )}
                            </p>
                        </AssistantMessage>
                    ))}
                </div>
            )}
            {children}
        </div>
    );
}
