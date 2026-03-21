import {act} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {renderHook} from '@/shared/util/test-utils';
import useConnectionManageController from './useConnectionManageController';

const waitingNurse = {
    waitingNurseId: 1,
    nurseId: 11,
    name: '박신청',
    gender: '여',
    phoneNum: '01012345678',
    employmentDate: '2024-01-01',
    profileImgUrl: '',
};

describe('useConnectionManageController', () => {
    it('ignores stale submit completion after the flow is reset', async () => {
        let resolveConnect: ((value: boolean | undefined) => void) | null = null;

        const connectWaitingNurses = vi.fn(
            () =>
                new Promise<boolean | undefined>((resolve) => {
                    resolveConnect = resolve;
                }),
        );
        const approveWaitingNurses = vi.fn();
        const {result} = renderHook(() =>
            useConnectionManageController({
                open: true,
                approveWaitingNurses,
                connectWaitingNurses,
            }),
        );

        act(() => {
            result.current.actions.handleSelectWaitingNurse(waitingNurse);
            result.current.actions.setToLinkNurseId(99);
        });

        let submitPromise: Promise<void> | undefined;

        act(() => {
            submitPromise = result.current.actions.handleCompleteSelection();
        });

        expect(result.current.state.submitStatus).toBe('loading');

        act(() => {
            result.current.actions.initialize();
        });

        await act(async () => {
            resolveConnect?.(true);
            await submitPromise;
        });

        expect(result.current.state.step).toBe(0);
        expect(result.current.state.submitStatus).toBe('idle');
    });
});
