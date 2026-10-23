import {useState} from 'react';
import i18n from '@/i18n';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {conversationOperationFailure} from '../../../model/ai-execution-failure';
import {conversationTurnText, operationAttempt, visibleConversationTurns} from '../../../model/conversation-presentation';
import {
    conversationEvents,
    type TConversation,
    type TConversationDetail,
    type TConversationOperation,
} from '../../../model/schedule-conversation-api';
import {AiConversationLoading} from './ai-conversation-loading';
import {AiExecutionFailure} from './ai-execution-failure';

type TProps = {
    conversation: TConversation;
    load: (id: number) => Promise<TConversationDetail>;
    onView: (operation: TConversationOperation) => void;
    copy: (ko: string, en: string) => string;
};

/** Earlier split conversations are retained, but never become an executable current plan. */
export function AiConversationHistory({conversation, load, onView}: TProps) {
    const {t} = useTypedTranslation();
    const [detail, setDetail] = useState<TConversationDetail>();
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const fetchHistory = async () => {
        if (loading || detail) return;

        setLoading(true);
        setFailed(false);

        try {
            setDetail(await load(conversation.conversationId));
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <details
            className="rounded-xl bg-[#F7F8FA] px-3 py-2"
            onToggle={(event) => {
                if (event.currentTarget.open) void fetchHistory();
            }}
        >
            <summary className="cursor-pointer text-sm text-[#475467]">
                {t('aiAutofillUi.conversationHistory.earlierConversation')} ·{' '}
                {new Date(conversation.createdAt).toLocaleDateString(i18n.language)}
            </summary>
            <div className="mt-3 space-y-3">
                {loading && <AiConversationLoading label={t('aiAutofillUi.conversationHistory.loadingEarlierConversation')} />}
                {failed && (
                    <button type="button" onClick={() => void fetchHistory()}>
                        {t('aiAutofillUi.conversationHistory.retryHistory')}
                    </button>
                )}
                {detail &&
                    conversationEvents({...detail, turns: visibleConversationTurns(detail)}).map((event) => {
                        if (event.kind === 'turn') {
                            return event.turn.type === 'SEGMENT_START' ? (
                                <p key={event.id} className="pt-3 text-xs text-gray-4">
                                    {t('aiAutofillUi.conversationHistory.newRequestSection')}
                                </p>
                            ) : (
                                <p key={event.id} className="text-sm whitespace-pre-wrap">
                                    {conversationTurnText(detail, event.turn) ?? event.turn.semanticPlan?.summary}
                                </p>
                            );
                        }

                        const failure = conversationOperationFailure(event.operation);
                        const viewAction = event.operation.resultVersionId && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    className="min-h-[44px] rounded-[10px] bg-[#EDE7FF] px-4 py-2 text-[13px] font-medium text-[#5931B9] transition-colors hover:bg-[#E3DAFF] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none motion-reduce:transition-none"
                                    onClick={() => onView(event.operation)}
                                >
                                    {t('aiAutofillUi.conversationHistory.exploreSchedule')}
                                </button>
                            </div>
                        );

                        return failure ? (
                            <AiExecutionFailure
                                key={event.id}
                                operationType={event.operation.operationType}
                                failure={failure}
                                attemptLabel={t('aiAutofillUi.conversationHistory.attemptLabel', {
                                    attempt: operationAttempt(detail, event.operation.operationId),
                                })}
                            >
                                {viewAction}
                            </AiExecutionFailure>
                        ) : (
                            <div key={event.id} className="rounded-lg bg-white p-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <p className="min-w-0 font-semibold">
                                        {event.operation.operationType === 'GENERATE'
                                            ? t('aiAutofillUi.conversationHistory.autofill')
                                            : t('aiAutofillUi.conversationHistory.adjustment')}{' '}
                                        {operationAttempt(detail, event.operation.operationId)}
                                        {t('aiAutofillUi.conversationHistory.attempt')} ·{' '}
                                        {event.operation.executionStatus === 'SUCCEEDED'
                                            ? t('aiAutofillUi.conversationHistory.completed')
                                            : event.operation.executionStatus === 'FAILED'
                                              ? t('aiAutofillUi.conversationHistory.failed')
                                              : t('aiAutofillUi.conversationHistory.outcomeNeedsChecking')}
                                    </p>
                                </div>
                                {viewAction}
                            </div>
                        );
                    })}
            </div>
        </details>
    );
}
