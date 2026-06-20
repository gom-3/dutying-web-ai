import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import ConnectionManageCompleteStep from '../complete-step';

const defaultProps = {
    submitStatus: 'success' as const,
    connectMode: 'add' as const,
    waitingNurseName: '종문',
    targetLabel: 'A팀',
    onRestart: vi.fn(),
    onBack: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
};

describe('ConnectionManageCompleteStep', () => {
    it('hides the other requests action when no waiting requests remain', () => {
        render(<ConnectionManageCompleteStep {...defaultProps} hasOtherWaitingRequests={false} />);

        expect(screen.getAllByRole('button', {name: '닫기'})).toHaveLength(2);
        expect(screen.queryByRole('button', {name: '다른 요청 보기'})).not.toBeInTheDocument();
    });

    it('shows the other requests action when another waiting request remains', () => {
        render(<ConnectionManageCompleteStep {...defaultProps} hasOtherWaitingRequests />);

        expect(screen.getByRole('button', {name: '다른 요청 보기'})).toBeInTheDocument();
    });
});
