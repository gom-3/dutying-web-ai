import {fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import type {useAnnualLeaveSchedule} from '../queries';
import {AnnualLeaveSchedulePanel} from '../schedule-panel';
import {AnnualLeaveCalculationNotes} from '../ui';

function state() {
    return {
        overview: {data: {settings: {enabled: false}, people: []}, refetch: vi.fn()},
        preview: {refetch: vi.fn()},
        counts: new Map([[20, 1.5]]),
        names: new Map([[20, '김간호']]),
        request: {cells: [{nurseId: 20}]},
        managed: false,
        pending: false,
    } as unknown as ReturnType<typeof useAnnualLeaveSchedule>;
}

beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ko');
});
describe('optional schedule annual leave summary', () => {
    it('shows usage without requiring opening days and persists only the display preference', async () => {
        render(
            <MemoryRouter>
                <AnnualLeaveSchedulePanel wardId={1} state={state()} />
            </MemoryRouter>,
        );
        expect(screen.queryByText('김간호')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('checkbox', {name: '연차 사용량 표시'}));
        expect(screen.getByText('김간호')).toBeInTheDocument();
        expect(screen.getByText('1.5일')).toBeInTheDocument();
        expect(screen.queryByText('예정 반영 후')).not.toBeInTheDocument();
        expect(localStorage.getItem('annual-leave-display:1')).toBe('true');
        await userEvent.click(screen.getByRole('checkbox'));
        expect(screen.queryByText('김간호')).not.toBeInTheDocument();
    });
    it('keeps unknown opening days distinct from zero', async () => {
        const data = state();

        data.managed = true;
        data.data = {people: [{nurseId: 20, monthDays: 1.5, remainingDays: null, checks: ['NOT_ENTERED']}]} as typeof data.data;
        render(
            <MemoryRouter>
                <AnnualLeaveSchedulePanel wardId={1} state={data} />
            </MemoryRouter>,
        );
        await userEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByText('미입력')).toBeInTheDocument();
        expect(screen.queryByText('잔여 연차를 입력해 주세요')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '연차 계산 안내'}));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('잔여 연차를 입력해 주세요');
    });
    it('shows a concrete calculation issue without optional review reminders beside the total', async () => {
        const data = state();

        data.managed = true;
        data.data = {
            people: [
                {nurseId: 20, monthDays: 1.5, remainingDays: 8.5, checks: ['VALIDITY_UNKNOWN', 'REVIEW_REQUIRED', 'MISSING_SCHEDULE']},
            ],
        } as typeof data.data;
        render(
            <MemoryRouter>
                <AnnualLeaveSchedulePanel wardId={1} state={data} />
            </MemoryRouter>,
        );
        await userEvent.click(screen.getByRole('checkbox'));
        expect(screen.queryByText('근무표가 없는 날짜 있음')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '연차 계산 안내'}));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('사용한 연차가 빠져 있을 수 있어요');
        expect(screen.queryByText('확인 필요')).not.toBeInTheDocument();
        expect(screen.queryByText(/다음 확인일/)).not.toBeInTheDocument();
        expect(screen.getByText('8.5일')).toBeInTheDocument();
    });

    it('opens on hover or keyboard focus and keeps clicked help open until dismissed', async () => {
        const user = userEvent.setup();

        render(<AnnualLeaveCalculationNotes checks={['MISSING_SCHEDULE']} />);

        const trigger = screen.getByRole('button', {name: '연차 계산 안내'});

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        await user.hover(trigger);
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.unhover(trigger);
        fireEvent.pointerMove(document.body, {clientX: 1000, clientY: 1000});
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        await user.tab();
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        await user.click(trigger);
        await user.unhover(trigger);
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.click(document.body);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    });

    it('marks the whole balance summary as private', () => {
        const {container} = render(
            <MemoryRouter>
                <AnnualLeaveSchedulePanel wardId={1} state={state()} />
            </MemoryRouter>,
        );

        expect(container.querySelector('[data-private-annual-leave]')).toBeInTheDocument();
    });
});
