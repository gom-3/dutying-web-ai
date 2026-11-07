import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {ReactNode} from 'react';
import toast from 'react-hot-toast';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {DEFAULT_REST_LEAVE_POLICY, type TRestLeavePolicyResponse, useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import {RestLeavePolicySection} from '@/pages/ward-settings/ui/rest-leave-policy-section';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {useScheduleDisplay} from '../../../../model/use-schedule-display';
import {ScheduleDisplayMenu} from '../schedule-display-menu';

const {get, put} = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));

vi.mock('@/shared/api/client', () => ({default: {get, put}}));
vi.mock('react-hot-toast', () => ({default: {error: vi.fn(), success: vi.fn()}}));

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

let sharedPolicy: TRestLeavePolicyResponse;

function Fixture({wardId = 1, withEditor = false}: {wardId?: number; withEditor?: boolean}) {
    const display = useScheduleDisplay(wardId);
    const restPolicy = useRestLeavePolicy(wardId);

    return (
        <>
            <ScheduleDisplayMenu display={display} restPolicy={restPolicy} settings={<button type="button">이번 달 목표 OFF</button>} />
            <output>{String(display.showAnnualLeave)}</output>
            {withEditor && <RestLeavePolicySection wardId={wardId} shiftTypes={[]} />}
        </>
    );
}

const displayButton = () => screen.getByRole('button', {name: '표시 설정'});
const targetOff = () => screen.getByRole('menuitemcheckbox', {name: '목표 OFF'});

beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('ko');
    sharedPolicy = {...DEFAULT_REST_LEAVE_POLICY, wardId: 1, persisted: true, version: 1, holidayCountry: 'KR'};
    get.mockImplementation(async () => ({data: sharedPolicy}));
    put.mockImplementation(async (_url: string, body: TRestLeavePolicyResponse) => {
        sharedPolicy = {...body, wardId: 1, persisted: true, version: body.version + 1};

        return {data: sharedPolicy};
    });
});
afterEach(() => queryClient.clear());

describe('schedule display settings', () => {
    it('keeps the legacy annual leave preference local and supports keyboard toggles and ward switching', async () => {
        localStorage.setItem('annual-leave-display:1', 'true');

        const view = render(<Fixture />, {wrapper});

        await userEvent.click(displayButton());
        expect(screen.getByRole('menuitemcheckbox', {name: '연차'})).toHaveAttribute('aria-checked', 'true');
        await userEvent.keyboard('{ArrowDown}{Enter}');
        expect(JSON.parse(localStorage.getItem('schedule-display:1')!)).toEqual({annualLeave: false});
        await userEvent.keyboard('{Enter}{Escape}');
        expect(displayButton()).toHaveFocus();
        view.rerender(<Fixture wardId={2} />);
        expect(screen.getByRole('status')).toHaveTextContent('false');
        view.rerender(<Fixture wardId={1} />);
        expect(screen.getByRole('status')).toHaveTextContent('true');
        expect(put).not.toHaveBeenCalled();
    });

    it('defaults an unconfigured ward to on, ignores the old local OFF flag, and saves both switch directions', async () => {
        sharedPolicy = {...sharedPolicy, enabled: false, persisted: false, version: 0, holidayCountry: null};
        localStorage.setItem('schedule-display:1', JSON.stringify({rest: false, annualLeave: true}));
        render(<Fixture />, {wrapper});

        await userEvent.click(displayButton());
        await waitFor(() => expect(targetOff()).toHaveAttribute('aria-checked', 'true'));
        expect(targetOff()).toHaveAccessibleDescription('병동 전체에 적용');
        expect(screen.getByRole('button', {name: '이번 달 목표 OFF'})).toBeVisible();
        expect(put).not.toHaveBeenCalled();

        await userEvent.click(targetOff());
        await waitFor(() => expect(targetOff()).toHaveAttribute('aria-checked', 'false'));
        expect(screen.queryByRole('button', {name: '이번 달 목표 OFF'})).not.toBeInTheDocument();
        expect(put).toHaveBeenNthCalledWith(
            1,
            '/wards/1/rest-leave-policy',
            expect.objectContaining({enabled: false, version: 0, weeklyOffDays: 2, holidayCountry: null}),
            expect.anything(),
        );

        await userEvent.click(targetOff());
        await waitFor(() => expect(targetOff()).toHaveAttribute('aria-checked', 'true'));
        expect(put).toHaveBeenNthCalledWith(
            2,
            '/wards/1/rest-leave-policy',
            expect.objectContaining({enabled: true, version: 1, weeklyOffDays: 2, holidayCountry: 'KR'}),
            expect.anything(),
        );
        expect(screen.getByRole('menuitemcheckbox', {name: '연차'})).toHaveAttribute('aria-checked', 'true');
    });

    it('shares acknowledged changes with the ward settings editor in both directions', async () => {
        sharedPolicy = {...sharedPolicy, enabled: false, holidayCountry: 'GB', holidayRegion: 'SCT'};
        render(<Fixture withEditor />, {wrapper});

        const editorSwitch = await screen.findByRole('switch', {name: '휴무일 계산 사용'});

        expect(editorSwitch).not.toBeChecked();
        await userEvent.click(displayButton());
        expect(targetOff()).toHaveAttribute('aria-checked', 'false');
        await userEvent.click(targetOff());
        await waitFor(() => expect(editorSwitch).toBeChecked());
        expect(put).toHaveBeenCalledWith(
            '/wards/1/rest-leave-policy',
            expect.objectContaining({enabled: true, holidayCountry: 'GB', holidayRegion: 'SCT', version: 1}),
            expect.anything(),
        );

        await userEvent.click(editorSwitch);
        await userEvent.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        await userEvent.click(displayButton());
        expect(targetOff()).toHaveAttribute('aria-checked', 'false');
    });

    it('keeps the last saved value on a failed update and blocks duplicate requests during saving', async () => {
        let rejectSave!: (error: Error) => void;

        put.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectSave = reject)));
        render(<Fixture />, {wrapper});

        await userEvent.click(displayButton());
        await waitFor(() => expect(targetOff()).toHaveAttribute('aria-checked', 'true'));
        await userEvent.click(targetOff());
        await waitFor(() => expect(targetOff()).toHaveAttribute('aria-disabled', 'true'));
        await userEvent.keyboard('{Enter}');
        expect(put).toHaveBeenCalledTimes(1);
        expect(targetOff()).toHaveAttribute('aria-checked', 'true');

        await act(async () => rejectSave(new Error('Save failed')));
        await waitFor(() => expect(targetOff()).not.toHaveAttribute('aria-disabled'));
        expect(targetOff()).toHaveAttribute('aria-checked', 'true');
        expect(toast.error).toHaveBeenCalledWith('목표 OFF를 저장하지 못했어요. 다시 시도해 주세요.');
    });
});
