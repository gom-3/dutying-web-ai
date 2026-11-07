import {render, screen, cleanup} from '@testing-library/react';
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

describe('transient background progress', () => {
    it('updates one transient assistant bubble through the observed phases', async () => {
        await i18n.changeLanguage('ko');

        const {rerender} = render(<AiConversationOperationStatus attempt={1} operation={operation('QUEUED', 1000)} />);
        const status = screen.getByRole('status');
        const bubble = status.closest('[data-conversation-bubble="assistant"]');
        const fixedShifts = '신청·고정 근무는 유지해요.';

        expect(bubble).toBeVisible();
        expect(status).toHaveTextContent('계산 차례를 기다려요');
        expect(status).not.toHaveTextContent(fixedShifts);
        rerender(<AiConversationOperationStatus attempt={1} operation={operation('COMPUTING', 4000)} />);
        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getByRole('status', {name: '근무표를 채우고 있어요'})).toHaveTextContent(fixedShifts);
        expect(screen.getByRole('status').closest('[data-conversation-bubble="assistant"]')).toBe(bubble);
        expect(screen.getAllByText('듀팅 AI')).toHaveLength(1);
        rerender(<AiConversationOperationStatus attempt={1} operation={operation('COMPUTING', 35000)} />);
        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getByRole('status', {name: '계산이 조금 더 걸려요'})).toHaveTextContent('창을 닫아도 계속돼요.');
        rerender(<AiConversationOperationStatus attempt={1} operation={operation('VALIDATING', 45000)} />);
        expect(screen.getByRole('status', {name: '근무 조건 확인 중…'})).not.toHaveTextContent(fixedShifts);
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
    });

    it.each(['SUCCEEDED', 'FAILED'] as const)(
        'removes progress on %s and does not restore old messages after remount',
        async (executionStatus) => {
            await i18n.changeLanguage('ko');
            sessionStorage.setItem('dutying.operation-progress:old', JSON.stringify(['QUEUED', 'COMPUTING']));

            const view = render(<AiConversationOperationStatus attempt={1} operation={operation('COMPUTING', 1000)} />);
            const completed = {...operation('VALIDATING', 45000), executionStatus, progress: null};

            view.rerender(
                <AiConversationOperationStatus attempt={1} operation={completed}>
                    <p>계산 결과</p>
                </AiConversationOperationStatus>,
            );
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(screen.getByText('계산 결과')).toBeVisible();
            view.unmount();
            render(
                <AiConversationOperationStatus attempt={1} operation={completed}>
                    <p>계산 결과</p>
                </AiConversationOperationStatus>,
            );
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(screen.queryByText('듀팅 AI')).not.toBeInTheDocument();
        },
    );

    it('shows cancellation without keeping calculation progress', async () => {
        await i18n.changeLanguage('ko');

        const view = render(<AiConversationOperationStatus attempt={1} operation={operation('COMPUTING', 1000)} />);

        view.rerender(
            <AiConversationOperationStatus
                attempt={1}
                operation={{...operation('COMPUTING', 45000), executionStatus: 'CANCELLED', progress: null}}
            />,
        );
        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getByRole('status')).toHaveTextContent('계산을 취소했어요. 근무표는 그대로예요.');
        expect(screen.queryByText(i18n.t('aiAutofillUi.conversationOperationStatus.fillingYourSchedule'))).not.toBeInTheDocument();
    });
});
