import type {TAnnualLeaveDay, TAnnualLeavePerson} from '@dutying/api/ward';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import type {useAnnualLeaveSchedule} from '../queries';
import {useAnnualLeaveScheduleColumns} from '../schedule-columns';

type TState = ReturnType<typeof useAnnualLeaveSchedule>;

const person: TAnnualLeavePerson = {
    nurseId: 20,
    name: '김간호',
    currentDays: 13,
    remainingDays: 12,
    plannedDays: 1,
    monthDays: 1,
    usedDays: 2,
    openingDays: 15,
    checks: [],
    shiftTeamId: 1,
    active: true,
    version: 1,
    startedOn: '2026-09-01',
    balanceBasis: 'PAST_ONLY',
    reconciledOn: null,
    reviewOn: null,
};
const day = (date: string, days = 0.5): TAnnualLeaveDay => ({
    nurseId: 20,
    date,
    days,
    shiftTypeId: 1,
    source: 'SCHEDULE',
    entryId: null,
    referenceShiftTypeId: null,
    needsReview: false,
    partialWork: false,
});

function state(): TState {
    return {
        overview: {data: {today: '2026-09-28', settings: {enabled: true}, people: [person], days: []}, refetch: vi.fn()},
        preview: {refetch: vi.fn()},
        data: {people: [{...person, currentDays: 12, remainingDays: 8.5, plannedDays: 3.5, monthDays: 0.5}]},
        counts: new Map([[20, 0.5]]),
        assignments: [day('2026-10-08')],
        names: new Map([[20, person.name]]),
        managed: true,
        pending: false,
        range: {from: '2026-10-01', to: '2026-10-31'},
    } as unknown as TState;
}

function Fixture({data, visible = true}: {data: TState; visible?: boolean}) {
    const {columns} = useAnnualLeaveScheduleColumns(data, visible);

    return (
        <>
            {columns?.header}
            {columns?.renderRow(20)}
        </>
    );
}

function mount(data = state(), visible = true) {
    return render(
        <MemoryRouter>
            <Fixture data={data} visible={visible} />
        </MemoryRouter>,
    );
}

beforeEach(async () => {
    await i18n.changeLanguage('ko');
});
describe('annual leave schedule columns', () => {
    it('shows only the server-calculated month-end balance', async () => {
        const {container} = mount();

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(container.querySelectorAll('[data-private-annual-leave]')).toHaveLength(2);
        await userEvent.click(screen.getByLabelText('김간호 잔여 연차 8.5일'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('김간호 잔여 연차 8.5일')).not.toHaveAttribute('title');
    });
    it('hides stale values while recalculating', () => {
        const data = state();

        data.pending = true;
        mount(data);
        expect(screen.getByLabelText(/계산 중/)).toHaveTextContent('…');
    });
    it('does not show cached balances as valid after the current balance request fails', () => {
        const data = state();

        data.overview.isError = true;
        mount(data);
        expect(screen.getByLabelText('김간호 잔여 연차 —')).toHaveTextContent('—');
        expect(screen.queryByText('13')).not.toBeInTheDocument();
    });
    it('keeps unregistered leave distinct from zero', async () => {
        const data = state();

        data.overview.data!.people = [{...person, currentDays: null, openingDays: null}];
        data.data!.people = [{...person, remainingDays: null}];
        mount(data);
        await userEvent.click(screen.getByLabelText('김간호 잔여 연차 —'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it.each([0, -1.5])('shows a verified current balance of %s accurately', (currentDays) => {
        const data = state();

        data.data!.people = [{...person, remainingDays: currentDays}];
        mount(data);

        const button = screen.getByLabelText(`김간호 잔여 연차 ${currentDays}일`);

        expect(button).toHaveTextContent(String(currentDays));
        expect(button).toHaveClass(currentDays < 0 ? 'text-red' : 'text-main-1');
    });
    it('supports counting without management and hides both columns when switched off', () => {
        const data = state();

        data.managed = false;
        data.overview.data!.people = [{...person, currentDays: null}];
        data.data = undefined;

        const view = mount(data);

        expect(screen.getByLabelText('김간호 잔여 연차 —')).toBeVisible();
        view.rerender(
            <MemoryRouter>
                <Fixture data={data} visible={false} />
            </MemoryRouter>,
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
