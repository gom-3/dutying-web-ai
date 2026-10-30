import {render, screen, cleanup, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import type {TConversationOperation} from '../../../../model/schedule-conversation-api';
import {AiConversationOperationStatus} from '../ai-conversation-operation-status';

afterEach(() => {
    cleanup();
    sessionStorage.clear();
});
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
const props = {attempt: 1, copy: (ko: string) => ko};
const messages = () => within(screen.getByRole('log')).getAllByText('듀팅 AI');

describe('append-only background conversation', () => {
    it('appends separate messages for observed phases, without replacing or duplicating earlier messages', async () => {
        await i18n.changeLanguage('ko');
        const {rerender} = render(<AiConversationOperationStatus {...props} operation={operation('QUEUED', 1000)} />);
        expect(messages()).toHaveLength(1);
        expect(screen.getByText('계산 순서를 기다리고 있어요')).toBeVisible();
        rerender(<AiConversationOperationStatus {...props} operation={operation('COMPUTING', 4000)} />);
        expect(messages()).toHaveLength(2);
        expect(screen.getByText('계산 순서를 기다리고 있어요')).toBeVisible();
        expect(screen.getByText('근무표를 채우기 시작했어요. 신청 근무와 고정 근무는 그대로 유지해요.')).toBeVisible();
        rerender(<AiConversationOperationStatus {...props} operation={operation('COMPUTING', 20000)} />);
        expect(messages()).toHaveLength(2);
        rerender(<AiConversationOperationStatus {...props} operation={operation('COMPUTING', 35000)} />);
        expect(messages()).toHaveLength(3);
        expect(screen.getByText('시간이 조금 더 필요해 계산을 이어가고 있어요. 창을 닫아도 계산은 계속돼요.')).toBeVisible();
        rerender(<AiConversationOperationStatus {...props} operation={operation('VALIDATING', 45000)} />);
        expect(messages()).toHaveLength(4);
        expect(screen.getByText('완성된 근무표의 조건을 확인하고 있어요')).toBeVisible();
        rerender(<AiConversationOperationStatus {...props} operation={operation('COMPUTING', 20000)} />);
        expect(messages()).toHaveLength(4);
    });
    it('keeps the observed conversation before the terminal result and restores it after remount', async () => {
        await i18n.changeLanguage('ko');
        const key = 'synthetic-progress:operation-1';
        const view = render(<AiConversationOperationStatus {...props} storageKey={key} operation={operation('COMPUTING', 1000)} />);
        view.rerender(<AiConversationOperationStatus {...props} storageKey={key} operation={operation('VALIDATING', 42000)} />);
        const completed = {...operation('VALIDATING', 45000), executionStatus: 'SUCCEEDED' as const, progress: null};
        view.rerender(
            <AiConversationOperationStatus {...props} storageKey={key} operation={completed}>
                <p>완료 결과</p>
            </AiConversationOperationStatus>,
        );
        expect(messages()).toHaveLength(2);
        expect(screen.getByText('완료 결과')).toBeVisible();
        expect(
            screen.getByRole('log').compareDocumentPosition(screen.getByText('완료 결과')) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        view.unmount();
        render(
            <AiConversationOperationStatus {...props} storageKey={key} operation={completed}>
                <p>완료 결과</p>
            </AiConversationOperationStatus>,
        );
        expect(messages()).toHaveLength(2);
    });
    it('does not invent missed phases or borrow another operation history', async () => {
        await i18n.changeLanguage('ko');
        sessionStorage.setItem('other-operation', JSON.stringify(['QUEUED', 'COMPUTING']));
        render(<AiConversationOperationStatus {...props} storageKey="this-operation" operation={operation('VALIDATING', 45000)} />);
        expect(messages()).toHaveLength(1);
        expect(screen.queryByText('계산 순서를 기다리고 있어요')).not.toBeInTheDocument();
    });
    it('appends cancellation once and ignores late running observations', async () => {
        await i18n.changeLanguage('ko');
        const view = render(<AiConversationOperationStatus {...props} operation={operation('COMPUTING', 1000)} />);
        const cancelled = {...operation('COMPUTING', 45000), executionStatus: 'CANCELLED' as const, progress: null};
        view.rerender(<AiConversationOperationStatus {...props} operation={cancelled} />);
        expect(messages()).toHaveLength(2);
        expect(screen.getByText('계산 요청을 취소했어요. 기존 근무표는 그대로예요.')).toBeVisible();
        view.rerender(<AiConversationOperationStatus {...props} operation={operation('VALIDATING', 45000)} />);
        expect(messages()).toHaveLength(2);
    });
});
