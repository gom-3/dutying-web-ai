import {render, screen, cleanup} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {isExecutionFinished} from '../../../../model/conversation-pending-execution';
import type {TConversationOperation} from '../../../../model/schedule-conversation-api';
import {AiConversationOperationStatus} from '../ai-conversation-operation-status';

afterEach(cleanup);
const operation = (phase: 'QUEUED' | 'COMPUTING' | 'VALIDATING', elapsedMs: number): TConversationOperation => ({
    operationId: 'background-1',
    sequence: 1,
    operationType: 'GENERATE',
    fillPolicy: 'EMPTY_ONLY',
    sourceVersionId: 'v1',
    resultVersionId: null,
    interpretationId: null,
    baseRevision: 0,
    executionStatus: 'RUNNING',
    applyStatus: 'PENDING',
    failureReason: null,
    result: null,
    createdAt: '',
    progress: {phase, elapsedMs},
});

describe('background calculation status', () => {
    it('shows ongoing calculation after thirty seconds and does not claim completion', async () => {
        await i18n.changeLanguage('ko');
        const op = operation('COMPUTING', 35000);
        render(<AiConversationOperationStatus operation={op} attempt={1} copy={(ko) => ko} />);
        expect(screen.getByText('35초 경과')).toBeInTheDocument();
        expect(screen.getByText('시간이 조금 더 필요해 계산을 이어가고 있어요.')).toBeInTheDocument();
        expect(screen.getByText('화면을 닫았다가 다시 열어도 결과를 확인할 수 있어요.')).toBeInTheDocument();
        expect(isExecutionFinished(op)).toBe(false);
    });
    it('distinguishes queueing, final validation and cancellation', async () => {
        await i18n.changeLanguage('ko');
        const {rerender} = render(<AiConversationOperationStatus operation={operation('QUEUED', 1000)} attempt={1} copy={(ko) => ko} />);
        expect(screen.getByRole('status')).toHaveAccessibleName('계산 순서를 기다리고 있어요');
        rerender(<AiConversationOperationStatus operation={operation('VALIDATING', 45000)} attempt={1} copy={(ko) => ko} />);
        expect(screen.getByRole('status')).toHaveAccessibleName('완성된 근무표의 조건을 확인하고 있어요');
        const cancelled = {...operation('COMPUTING', 45000), executionStatus: 'CANCELLED' as const, progress: null};
        rerender(<AiConversationOperationStatus operation={cancelled} attempt={1} copy={(ko) => ko} />);
        expect(screen.getByRole('status')).toHaveAccessibleName('계산 요청을 취소했어요. 기존 근무표는 그대로예요.');
        expect(isExecutionFinished(cancelled)).toBe(true);
    });
});
