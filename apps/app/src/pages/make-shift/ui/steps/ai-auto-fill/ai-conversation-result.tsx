import type {MouseEventHandler, ReactNode} from 'react';
import {isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AiConversationFeedbackButton} from './ai-conversation-feedback-button';
import {AiScheduleResultCard} from './ai-schedule-result-card';

export function AiConversationResult({
    operation,
    attempt,
    feedbackDisabled,
    preview,
    children,
    actions,
    onReport,
    copy,
}: {
    operation: TConversationOperation;
    attempt: number;
    feedbackDisabled: boolean;
    preview?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    onReport: MouseEventHandler<HTMLButtonElement>;
    copy: (ko: string, en: string) => string;
}) {
    const review = operation.result && isGenerateReviewDraft(operation.result);
    const applied = operation.applyStatus === 'APPLIED';
    const succeeded = operation.executionStatus === 'SUCCEEDED' && applied && !review;
    const changedCount = operation.result?.changedCells.length;
    const title = review
        ? copy('근무표 초안을 만들었어요!', 'Your schedule draft is ready!')
        : !applied
          ? copy('새 근무표를 준비했어요.', 'Your schedule result is ready.')
          : operation.operationType === 'GENERATE'
            ? copy('근무표를 채웠어요!', 'Your schedule is ready!')
            : changedCount === 0
              ? copy('이번에는 바뀐 근무가 없어요.', 'No shifts changed this time.')
              : copy('근무표를 조정했어요!', 'Your adjusted schedule is ready!');
    const scope = applied
        ? null
        : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
          ? copy(
                '작성 중인 표가 바뀌어 자동으로 반영하지 않았어요. 결과를 확인하고 이어서 작성할 수 있어요.',
                'Your draft changed, so this result was not applied. Review it before continuing.',
            )
          : copy(
                '현재 근무표에는 아직 반영되지 않았어요. 결과를 확인하고 이어서 작성할 수 있어요.',
                'This result has not been applied to the current schedule. Review it before continuing.',
            );

    return (
        <AiScheduleResultCard
            title={title}
            attempt={attempt}
            outcome={review ? 'review' : succeeded ? 'success' : 'neutral'}
            outcomeLabel={
                review
                    ? copy('확인 필요한 근무표', 'Schedule needs review')
                    : operation.operationType === 'GENERATE'
                      ? copy('자동채우기 성공', 'Autofill succeeded')
                      : copy('근무표 수정 성공', 'Adjustment succeeded')
            }
            changedCount={changedCount}
            description={
                review
                    ? copy(
                          '표시된 규칙을 확인하고 필요한 근무를 수정해 주세요.',
                          'Review the highlighted rules and adjust shifts where needed.',
                      )
                    : scope
            }
            preview={preview}
            headerAction={
                <AiConversationFeedbackButton
                    label={copy('이 결과에 의견 보내기', 'Send feedback on this result')}
                    disabled={feedbackDisabled}
                    onClick={onReport}
                />
            }
            actions={actions}
        >
            {children}
        </AiScheduleResultCard>
    );
}
