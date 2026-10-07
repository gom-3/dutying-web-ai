import {useState} from 'react';
import {conversationTurnText, operationAttempt, visibleConversationTurns} from '../../../model/conversation-presentation';
import {
    conversationEvents,
    type TConversation,
    type TConversationDetail,
    type TConversationOperation,
} from '../../../model/schedule-conversation-api';

type TProps = {
    conversation: TConversation;
    load: (id: number) => Promise<TConversationDetail>;
    onView: (operation: TConversationOperation, compare?: boolean) => void;
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
            className="rounded-xl border border-gray-6 bg-white px-3 py-2"
            onToggle={(event) => {
                if (event.currentTarget.open) void fetchHistory();
            }}
        >
            <summary className="cursor-pointer text-sm text-[#475467]">
                {copy('이전 대화 기록', 'Earlier conversation')} · {new Date(conversation.createdAt).toLocaleDateString()}
            </summary>
            <div className="mt-3 space-y-3">
                {loading && <p role="status">{copy('기록을 불러오고 있어요.', 'Loading history.')}</p>}
                {failed && (
                    <button type="button" onClick={() => void fetchHistory()}>
                        {copy('기록 다시 불러오기', 'Retry history')}
                    </button>
                )}
                {detail &&
                    conversationEvents({...detail, turns: visibleConversationTurns(detail)}).map((event) =>
                        event.kind === 'turn' ? (
                            event.turn.type === 'SEGMENT_START' ? (
                                <p key={event.id} className="border-t border-gray-6 pt-3 text-xs text-gray-4">
                                    {copy('새 요청 구간', 'New request section')}
                                </p>
                            ) : (
                                <p key={event.id} className="text-sm whitespace-pre-wrap">
                                    {conversationTurnText(detail, event.turn) ?? event.turn.semanticPlan?.summary}
                                </p>
                            )
                        ) : (
                            <div key={event.id} className="rounded-lg border border-gray-6 p-3 text-sm">
                                <p className="font-semibold">
                                    {event.operation.operationType === 'GENERATE'
                                        ? copy('자동완성', 'Autofill')
                                        : copy('조절', 'Adjustment')}{' '}
                                    {operationAttempt(detail, event.operation.operationId)}
                                    {copy('회차', ' attempt')} ·{' '}
                                    {event.operation.executionStatus === 'SUCCEEDED'
                                        ? copy('완료', 'Completed')
                                        : event.operation.executionStatus === 'FAILED'
                                          ? copy('실패', 'Failed')
                                          : copy('결과 확인 필요', 'Outcome needs checking')}
                                </p>
                                {event.operation.resultVersionId && (
                                    <div className="mt-2 flex gap-3">
                                        <button type="button" onClick={() => onView(event.operation)}>
                                            {copy('그때 표 보기', 'View this result')}
                                        </button>
                                        <button type="button" onClick={() => onView(event.operation, true)}>
                                            {copy('전후 비교', 'Compare')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ),
                    )}
            </div>
        </details>
    );
}
