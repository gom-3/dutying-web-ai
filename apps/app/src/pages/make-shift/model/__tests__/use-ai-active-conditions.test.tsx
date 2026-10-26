import type {TScheduleMonthRequestRes, TShiftConstraintRulesResponse} from '@dutying/api/ward';
import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useAiActiveConditions} from '../use-ai-active-conditions';

const api = vi.hoisted(() => ({rules: vi.fn(), requests: vi.fn(), update: vi.fn()}));

vi.mock('@/shared/api/ward', () => ({
    default: {getShiftConstraintRules: api.rules, getScheduleMonthRequests: api.requests, updateScheduleMonthRequest: api.update},
}));

const scope = {wardId: 1, teamId: 10, year: 2026, month: 11, enabled: true};
const request: TScheduleMonthRequestRes = {
    id: 17,
    kind: 'RULE',
    lifetime: 'MONTH',
    status: 'ACTIVE',
    origin: 'TEXT',
    displayLabel: '야간 3회',
};
const rules: TShiftConstraintRulesResponse = {
    schemaVersion: 1,
    wardId: 1,
    shiftTeamId: 10,
    rules: [
        {
            shiftConstraintRuleId: 17,
            templateCode: 'NIGHT_LIMIT',
            category: 'WORK',
            severity: 'HARD',
            sortOrder: 0,
            params: {},
            selected: true,
            displayText: '야간 4일 연속 금지',
        },
        {
            shiftConstraintRuleId: 18,
            templateCode: 'OFF_LIMIT',
            category: 'WORK',
            severity: 'SOFT',
            sortOrder: 1,
            params: {},
            selected: false,
            displayText: '선택하지 않은 규칙',
        },
    ],
};

beforeEach(() => {
    api.rules.mockReset().mockResolvedValue(rules);
    api.requests.mockReset().mockResolvedValue({year: 2026, month: 11, requests: [request, {...request, id: 18, status: 'DISABLED'}]});
    api.update.mockReset().mockResolvedValue({...request, status: 'DISABLED'});
});

describe('active AI conditions', () => {
    it('keeps source identifiers separate and includes only selected ward rules and active requests', async () => {
        const {result} = renderHook(() => useAiActiveConditions(scope));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.wardRules).toEqual([{id: 'rule:17', label: '야간 4일 연속 금지'}]);
        expect(result.current.requests).toEqual([request]);
        expect(api.rules).toHaveBeenCalledWith(1, 10, 2026, 11);
        expect(api.requests).toHaveBeenCalledWith(1, 10, 2026, 11);
        expect(api.update).not.toHaveBeenCalled();
    });

    it('disables the exact AI request without mutating ward rules or calculating a schedule', async () => {
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const {result} = renderHook(() => useAiActiveConditions({...scope, onChanged}));

        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => result.current.removeRequest(17));
        expect(api.update).toHaveBeenCalledExactlyOnceWith(1, 10, 17, {status: 'DISABLED'});
        expect(result.current.requests).toEqual([]);
        expect(result.current.wardRules).toEqual([{id: 'rule:17', label: '야간 4일 연속 금지'}]);
        expect(onChanged).toHaveBeenCalledOnce();
        expect(result.current.removingId).toBeNull();
    });

    it('retains the successful source when the other source fails, then retries both reads', async () => {
        api.rules.mockRejectedValueOnce(new Error('offline'));

        const {result} = renderHook(() => useAiActiveConditions(scope));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(true);
        expect(result.current.wardRules).toEqual([]);
        expect(result.current.requests).toEqual([request]);
        await act(async () => result.current.reload());
        expect(result.current.error).toBe(false);
        expect(result.current.wardRules).toEqual([{id: 'rule:17', label: '야간 4일 연속 금지'}]);
        expect(api.update).not.toHaveBeenCalled();
    });

    it('retains a request and rejects the deletion when the update fails', async () => {
        api.update.mockRejectedValueOnce(new Error('offline'));

        const onChanged = vi.fn();
        const {result} = renderHook(() => useAiActiveConditions({...scope, onChanged}));

        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => {
            await expect(result.current.removeRequest(17)).rejects.toThrow('offline');
        });
        expect(result.current.requests).toEqual([request]);
        expect(onChanged).not.toHaveBeenCalled();
        expect(result.current.removingId).toBeNull();
    });

    it('refreshes both sources and the conversation after applying ward rules without disabling AI requests', async () => {
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const {result} = renderHook(() => useAiActiveConditions({...scope, onChanged}));

        await waitFor(() => expect(result.current.loading).toBe(false));
        api.rules.mockResolvedValueOnce({...rules, rules: []});
        await act(async () => result.current.refreshAfterRuleChange());
        expect(result.current.wardRules).toEqual([]);
        expect(result.current.requests).toEqual([request]);
        expect(onChanged).toHaveBeenCalledOnce();
        expect(api.update).not.toHaveBeenCalled();
    });

    it.each(['rules', 'requests', 'conversation'] as const)(
        'allows retrying a post-apply %s refresh failure without a mutation',
        async (source) => {
            const onChanged = vi.fn().mockResolvedValue(undefined);
            const {result} = renderHook(() => useAiActiveConditions({...scope, onChanged}));

            await waitFor(() => expect(result.current.loading).toBe(false));

            if (source === 'conversation') onChanged.mockRejectedValueOnce(new Error('offline'));
            else api[source].mockRejectedValueOnce(new Error('offline'));

            await act(async () => {
                await expect(result.current.refreshAfterRuleChange()).rejects.toThrow();
            });
            await act(async () => result.current.refreshAfterRuleChange());
            expect(result.current.error).toBe(false);
            expect(result.current.requests).toEqual([request]);
            expect(onChanged).toHaveBeenCalledTimes(2);
            expect(api.update).not.toHaveBeenCalled();
        },
    );

    it('keeps a successful deletion hidden when a read-only refresh fails and can recover later', async () => {
        const onChanged = vi.fn().mockRejectedValueOnce(new Error('conversation refresh unavailable'));
        const {result} = renderHook(() => useAiActiveConditions({...scope, onChanged}));

        await waitFor(() => expect(result.current.loading).toBe(false));
        api.requests.mockRejectedValueOnce(new Error('offline'));
        await act(async () => result.current.removeRequest(17));
        expect(result.current.requests).toEqual([]);
        expect(result.current.error).toBe(true);
        await act(async () => result.current.reload());
        expect(result.current.requests).toEqual([]);
        expect(result.current.error).toBe(false);
        expect(api.update).toHaveBeenCalledOnce();
    });

    it('deduplicates repeated removal while its update is pending', async () => {
        let finish!: (value: TScheduleMonthRequestRes) => void;

        api.update.mockImplementationOnce(
            () =>
                new Promise<TScheduleMonthRequestRes>((resolve) => {
                    finish = resolve;
                }),
        );

        const {result} = renderHook(() => useAiActiveConditions(scope));

        await waitFor(() => expect(result.current.loading).toBe(false));

        let first!: Promise<void>;
        let second!: Promise<void>;

        act(() => {
            first = result.current.removeRequest(17);
            second = result.current.removeRequest(17);
        });
        expect(api.update).toHaveBeenCalledOnce();
        expect(result.current.removingId).toBe(17);
        await act(async () => {
            finish({...request, status: 'DISABLED'});
            await Promise.all([first, second]);
        });
        expect(result.current.requests).toEqual([]);
    });

    it('ignores a late read from another month and makes no calls when disabled', async () => {
        let finish!: (value: {requests: TScheduleMonthRequestRes[]}) => void;

        api.requests.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );

        const {result, rerender} = renderHook((props) => useAiActiveConditions(props), {initialProps: scope});

        await waitFor(() => expect(api.requests).toHaveBeenCalledOnce());
        api.requests.mockResolvedValueOnce({requests: [{...request, id: 27, displayLabel: '12월 조건'}]});
        rerender({...scope, month: 12});
        await waitFor(() => expect(result.current.requests[0]?.id).toBe(27));
        await act(async () => finish({requests: [request]}));
        expect(result.current.requests[0]?.id).toBe(27);
        rerender({...scope, enabled: false});
        expect(result.current.requests).toEqual([]);
        expect(result.current.wardRules).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(api.requests).toHaveBeenCalledTimes(2);
    });

    it.each(['scope change', 'unmount'] as const)('does not refresh a new scope after a late deletion: %s', async (change) => {
        let finish!: (value: TScheduleMonthRequestRes) => void;

        api.update.mockImplementationOnce(
            () =>
                new Promise<TScheduleMonthRequestRes>((resolve) => {
                    finish = resolve;
                }),
        );

        const onChanged = vi.fn();
        const {result, rerender, unmount} = renderHook((props) => useAiActiveConditions({...props, onChanged}), {initialProps: scope});

        await waitFor(() => expect(result.current.loading).toBe(false));

        let removal!: Promise<void>;

        act(() => {
            removal = result.current.removeRequest(17);
        });

        if (change === 'scope change') {
            api.requests.mockResolvedValueOnce({requests: [{...request, id: 27}]});
            rerender({...scope, month: 12});
            await waitFor(() => expect(result.current.requests[0]?.id).toBe(27));
        } else unmount();

        await act(async () => {
            finish({...request, status: 'DISABLED'});
            await removal;
        });
        expect(onChanged).not.toHaveBeenCalled();

        if (change === 'scope change') expect(result.current.requests[0]?.id).toBe(27);
    });
});
