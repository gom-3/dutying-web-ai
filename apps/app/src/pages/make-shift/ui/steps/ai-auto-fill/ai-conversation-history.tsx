import {useState} from 'react';
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
export function AiConversationHistory({conversation, load, onView, copy}: TProps) {
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
                {copy('이전 대화 기록', 'Earlier conversation')} · {new Date(conversation.createdAt).toLocaleDateString()}
            </summary>
            <div className="mt-3 space-y-3">
                {loading && <AiConversationLoading label={copy('이전 대화 불러오는 중', 'Loading earlier conversation')} />}
                {failed && (
                    <button type="button" onClick={() => void fetchHistory()}>
                        {copy('기록 다시 불러오기', 'Retry history')}
                    </button>
                )}
                {detail &&
                    conversationEvents({...detail, turns: visibleConversationTurns(detail)}).map((event) => {
                        if (event.kind === 'turn') {
                            return event.turn.type === 'SEGMENT_START' ? (
                                <p key={event.id} className="pt-3 text-xs text-gray-4">
                                    {copy('새 요청 구간', 'New request section')}
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
                                    {copy('근무표 살펴보기', 'Explore schedule')}
                                </button>
                            </div>
                        );

                        return failure ? (
                            <AiExecutionFailure
                                key={event.id}
                                operationType={event.operation.operationType}
                                failure={failure}
                                attemptLabel={copy(
                                    `${operationAttempt(detail, event.operation.operationId)}회차`,
                                    `Run ${operationAttempt(detail, event.operation.operationId)}`,
                                )}
                            >
                                {viewAction}
                            </AiExecutionFailure>
                        ) : (
                            <div key={event.id} className="rounded-lg bg-white p-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <p className="min-w-0 font-semibold">
                                        {event.operation.operationType === 'GENERATE'
                                            ? copy('자동채우기', 'Autofill')
                                            : copy('수정', 'Adjustment')}{' '}
                                        {operationAttempt(detail, event.operation.operationId)}
                                        {copy('회차', ' attempt')} ·{' '}
                                        {event.operation.executionStatus === 'SUCCEEDED'
                                            ? copy('완료', 'Completed')
                                            : event.operation.executionStatus === 'FAILED'
                                              ? copy('실패', 'Failed')
                                              : copy('결과 확인 필요', 'Outcome needs checking')}
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
