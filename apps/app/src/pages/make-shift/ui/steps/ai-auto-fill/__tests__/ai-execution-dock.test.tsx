import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@/shared/util/test-utils';
import type {TConversationOperation} from '../../../../model/schedule-conversation-api';
import {AiExecutionDock} from '../ai-execution-dock';

afterEach(cleanup);

const operation: TConversationOperation = {
    operationId: 'job-1',
    sequence: 1,
    operationType: 'GENERATE',
    fillPolicy: 'EMPTY_ONLY',
    sourceVersionId: 'v1',
    resultVersionId: null,
    interpretationId: null,
    baseRevision: 0,
    executionStatus: 'RUNNING',
    applyStatus: 'NOT_APPLIED',
    failureReason: null,
    result: null,
    createdAt: '',
    progress: {phase: 'COMPUTING', elapsedMs: 45000},
};

describe('ongoing autofill entry', () => {
    it('keeps an unacknowledged request reachable without offering unsupported cancellation', () => {
        const onOpen = vi.fn();
        render(<AiExecutionDock execution={null} onOpen={onOpen} isAdjusting />);
        expect(screen.getByRole('region', {name: '근무표 수정 작업'})).toBeVisible();
        expect(screen.getByRole('status')).toHaveTextContent('계산 요청을 보내고 있어요');
        fireEvent.click(screen.getByRole('button', {name: '진행 상황 보기'}));
        expect(onOpen).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', {name: '계산 요청 취소'})).not.toBeInTheDocument();
    });
    it('reopens the same task independently of cancellation', () => {
        const onOpen = vi.fn();
        const cancel = vi.fn();

        render(<AiExecutionDock execution={{operation, cancel, cancelling: false}} onOpen={onOpen} />);
        expect(screen.getByText('45초 경과')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: '진행 상황 보기'}));
        expect(onOpen).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '계산 요청 취소'}));
        expect(cancel).toHaveBeenCalledOnce();
    });
    it.each(['SUCCEEDED', 'FAILED'] as const)('names an existing-schedule update consistently: %s', (executionStatus) => {
        render(
            <AiExecutionDock
                execution={{
                    operation: {...operation, operationType: 'ADJUST', executionStatus, progress: null},
                    cancel: null,
                    cancelling: false,
                }}
                onOpen={vi.fn()}
            />,
        );
        expect(screen.getByRole('region', {name: '근무표 수정 작업'})).toBeVisible();
        expect(screen.getByRole('status')).toHaveTextContent(
            executionStatus === 'SUCCEEDED' ? '근무표 수정 결과가 준비됐어요' : '근무표를 수정하지 못했어요.',
        );
        expect(screen.getByRole('status')).not.toHaveTextContent('자동채우기');
    });
    it.each([
        ['SUCCEEDED', 'APPLIED', '자동채우기 결과가 준비됐어요'],
        ['SUCCEEDED', 'NOT_APPLIED_SOURCE_CHANGED', '계산이 끝났어요. 수정한 근무표는 유지했어요.'],
        ['CANCELLED', 'NOT_APPLIED', '계산 요청을 취소했어요. 기존 근무표는 그대로예요.'],
        ['FAILED', 'NOT_APPLIED', '자동채우기를 마치지 못했어요. 결과를 확인해 주세요.'],
    ] as const)('keeps %s results reachable after closing the loader', (executionStatus, applyStatus, label) => {
        render(
            <AiExecutionDock
                execution={{operation: {...operation, executionStatus, applyStatus, progress: null}, cancel: null, cancelling: false}}
                onOpen={vi.fn()}
            />,
        );
        expect(screen.getByRole('status')).toHaveTextContent(label);
        expect(screen.getByRole('button', {name: '결과 확인'})).toBeEnabled();
        expect(screen.queryByRole('button', {name: '계산 요청 취소'})).not.toBeInTheDocument();
    });
});
