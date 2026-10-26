import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef, type Ref} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TWardShiftType} from '@/entities';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import i18n from '@/i18n';
import {AiActiveConditions, type TActiveConditionsHandle} from '../ai-active-conditions';

const api = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));

vi.mock('@/shared/api/client', () => ({adminAxiosInstance: api}));
vi.mock('../../constraints', async () => {
    const {useEffect} = await import('react');

    return {
        Constraints: ({onEditorStateChange}: {onEditorStateChange?: (state: object) => void}) => {
            useEffect(() => {
                onEditorStateChange?.({dirty: false, saving: false, ready: true, count: 0});
            }, [onEditorStateChange]);

            return <p>근무 조건 편집기</p>;
        },
    };
});

const policy = {nurseId: 1, year: 2026, month: 11, offDays: 9, annualDaysByWardShiftTypeId: {'3': 2}, version: 3};
const restTargets = {
    nurses: [
        {nurseId: 1, name: '김간호'},
        {nurseId: 2, name: '이간호'},
    ],
    shiftTypes: [{wardShiftTypeId: 3, name: '연차', classification: 'ANNUAL_LEAVE', isActive: true, isOff: true}] as TWardShiftType[],
};
const applied = vi.fn();
const saved = vi.fn();
const busy = vi.fn();

function mount(ref?: Ref<TActiveConditionsHandle>) {
    return render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <AiActiveConditions
                ref={ref}
                wardId={4}
                teamId={7}
                year={2026}
                month={11}
                wardRules={[]}
                aiConditions={[]}
                restTargets={restTargets}
                onWardRulesApplied={applied}
                onRestTargetsApplied={saved}
                onBusyChange={busy}
            />
        </QueryClientProvider>,
    );
}

async function openRest() {
    await userEvent.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));
    await userEvent.click(screen.getByRole('button', {name: '개인별 휴무'}));

    return screen.findByRole('spinbutton', {name: 'OFF'});
}

beforeEach(async () => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({data: policy});
    api.put.mockImplementation(async (_url, body) => ({data: {...policy, ...body, version: 4}}));
    applied.mockResolvedValue(undefined);
    await i18n.changeLanguage('ko');
});

describe('rest targets in the conversation conditions flow', () => {
    it('opens only when needed, saves separate targets, refreshes conditions and returns to the same conversation without editing cells', async () => {
        const doc = structuredClone(useShiftEditorStore.getState().doc);

        mount();
        expect(api.get).not.toHaveBeenCalled();

        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});
        const off = await openRest();

        expect(off).toHaveValue(9);
        expect(screen.getByRole('spinbutton', {name: '연차'})).toHaveValue(2);
        expect(screen.getByText('2026년 11월')).toBeVisible();
        expect(document.querySelector('input[type="month"]')).not.toBeInTheDocument();
        await userEvent.clear(off);
        await userEvent.type(off, '8');
        await userEvent.clear(screen.getByRole('spinbutton', {name: '연차'}));
        await userEvent.type(screen.getByRole('spinbutton', {name: '연차'}), '1');
        expect(screen.getByText('OFF·연차 목표 합계 9일')).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(api.put).toHaveBeenCalledExactlyOnceWith('/nurses/1/monthly-rest-policy/2026/11', {
            offDays: 8,
            annualDaysByWardShiftTypeId: {'3': 1},
            version: 3,
        });
        expect(applied).toHaveBeenCalledOnce();
        expect(saved).toHaveBeenCalledOnce();
        expect(useShiftEditorStore.getState().doc).toEqual(doc);
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('opens the affected nurse from a structured conflict', async () => {
        const ref = createRef<TActiveConditionsHandle>();

        mount(ref);
        act(() => ref.current?.openRestTargets(2));
        await screen.findByRole('spinbutton', {name: 'OFF'});
        expect(screen.getByRole('combobox', {name: '간호사'})).toHaveValue('2');
        expect(api.get).toHaveBeenCalledExactlyOnceWith('/nurses/2/monthly-rest-policy/2026/11');
        expect(api.put).not.toHaveBeenCalled();
    });

    it('protects unsaved input when changing nurse, switching sections or returning to chat', async () => {
        mount();

        const off = await openRest();

        await userEvent.clear(off);
        await userEvent.type(off, '8');
        expect(screen.getByRole('combobox', {name: '간호사'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '근무 조건'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '대화로 돌아가기'}));
        expect(screen.getByRole('alertdialog')).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '계속 수정하기'}));
        expect(off).toHaveValue(8);
        expect(api.put).not.toHaveBeenCalled();
    });

    it('keeps zero distinct from inheritance and does not save invalid totals', async () => {
        mount();

        const off = await openRest();

        await userEvent.clear(off);
        await userEvent.type(off, '30');
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('합계가 월 일수를 넘지');
        expect(off).toHaveValue(30);
        expect(api.put).not.toHaveBeenCalled();
        await userEvent.clear(off);
        await userEvent.type(off, '0');
        await userEvent.clear(screen.getByRole('spinbutton', {name: '연차'}));
        await userEvent.type(screen.getByRole('spinbutton', {name: '연차'}), '0');
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(api.put.mock.calls[0][1]).toMatchObject({offDays: 0, annualDaysByWardShiftTypeId: {'3': 0}});
        await openRest();
        await userEvent.click(screen.getByRole('button', {name: '기존 설정 사용'}));
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        await waitFor(() => expect(saved).toHaveBeenCalledTimes(2));
        expect(api.put.mock.calls[1][1]).toMatchObject({offDays: null, annualDaysByWardShiftTypeId: {}});
    });

    it('blocks close and duplicate saves while saving, then preserves input after a save failure', async () => {
        let fail!: (error: Error) => void;

        api.put.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    fail = reject;
                }),
        );
        mount();

        const off = await openRest();

        await userEvent.clear(off);
        await userEvent.type(off, '8');
        await userEvent.dblClick(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        expect(api.put).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', {name: '대화로 돌아가기'})).toBeDisabled();
        expect(busy).toHaveBeenLastCalledWith(true);
        await userEvent.keyboard('{Escape}');
        expect(screen.getByRole('dialog', {name: '개인별 휴무'})).toBeVisible();
        await act(async () => fail(new Error('offline')));
        expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요');
        expect(off).toHaveValue(8);
        expect(saved).not.toHaveBeenCalled();
    });

    it('keeps edited values after a version conflict and uses the refreshed version for an explicit retry', async () => {
        api.put.mockRejectedValueOnce({response: {status: 409}});
        api.get.mockResolvedValueOnce({data: policy}).mockResolvedValue({data: {...policy, offDays: 10, version: 4}});
        mount();

        const off = await openRest();

        await userEvent.clear(off);
        await userEvent.type(off, '8');
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('다른 곳에서 설정이 바뀌었어요');
        expect(off).toHaveValue(8);
        expect(saved).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(api.put.mock.calls[1][1]).toMatchObject({offDays: 8, version: 4});
    });

    it('retries only the refresh after a successful write instead of overwriting again', async () => {
        applied.mockRejectedValueOnce(new Error('offline'));
        mount();

        const off = await openRest();

        await userEvent.clear(off);
        await userEvent.type(off, '8');
        await userEvent.click(screen.getByRole('button', {name: '목표 저장하고 대화로'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('목표는 저장했지만');
        expect(saved).not.toHaveBeenCalled();
        expect(screen.getByRole('combobox', {name: '간호사'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '조건 다시 확인'}));
        await waitFor(() => expect(saved).toHaveBeenCalledOnce());
        expect(api.put).toHaveBeenCalledOnce();
        expect(applied).toHaveBeenCalledTimes(2);
    });
});
