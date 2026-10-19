import {conversationOperationFailure} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';

export function isConversationOperationPending(operation: TConversationOperation) {
    return !conversationOperationFailure(operation) && ['RUNNING', 'RESULT_READY', 'UNKNOWN'].includes(operation.executionStatus);
}

export function AiConversationOperationStatus({
    operation,
    attempt,
    copy,
}: {
    operation: TConversationOperation;
    attempt: number;
    copy: (ko: string, en: string) => string;
}) {
    const title =
        operation.executionStatus === 'UNKNOWN'
            ? copy('결과를 확인하고 있어요', 'Checking the result')
            : operation.executionStatus === 'RESULT_READY'
              ? copy('근무표를 마무리하고 있어요', 'Finishing your schedule')
              : operation.operationType === 'ADJUST'
                ? copy('요청에 맞게 조정하고 있어요', 'Adjusting your schedule')
                : attempt > 1
                  ? copy('근무표를 다시 채우고 있어요', 'Refilling your schedule')
                  : copy('근무표를 채우고 있어요', 'Filling your schedule');
    const active = operation.executionStatus === 'RUNNING' || operation.executionStatus === 'RESULT_READY';

    return (
        <div role="status" aria-label={title} aria-atomic="true" className="min-w-0">
            <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-[14.5px] leading-6 font-semibold break-keep text-[#333D4B]">
                    {title} <span className="whitespace-nowrap">{copy(`(${attempt}회차)`, `(Run ${attempt})`)}</span>
                </p>
                {active && (
                    <span aria-hidden="true" className="ai-conversation-operation-dots flex shrink-0 items-center gap-1.5 py-2">
                        {[0, 1, 2].map((dot) => (
                            <span key={dot} className="ai-adjust-review-dot size-1 rounded-full bg-main-1" />
                        ))}
                    </span>
                )}
            </div>
            {operation.executionStatus === 'RUNNING' && (
                <p className="mt-1 text-[13px] leading-5 break-keep text-[#667085]">
                    {copy('신청·고정근무는 그대로 유지해요.', 'Requested and fixed shifts stay in place.')}
                </p>
            )}
        </div>
    );
}
