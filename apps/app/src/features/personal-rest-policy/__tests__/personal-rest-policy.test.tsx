import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render as baseRender, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TWardShiftType} from '@/entities';
import {PersonalRestPolicy} from '..';

const render = (ui: React.ReactNode) =>
    baseRender(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{ui}</QueryClientProvider>);
const get = vi.fn();
const put = vi.fn();

vi.mock('@/shared/api/client', () => ({
    adminAxiosInstance: {get: (...args: unknown[]) => get(...args), put: (...args: unknown[]) => put(...args)},
}));

const policy = {nurseId: 1, year: 2026, month: 11, offDays: null, annualDaysByWardShiftTypeId: {}, version: null};
const annual = {
    wardShiftTypeId: 3,
    name: '연차',
    shortName: 'V',
    classification: 'ANNUAL_LEAVE',
    isOff: true,
    isActive: true,
} as TWardShiftType;

beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({data: policy});
    put.mockResolvedValue({data: {...policy, offDays: 9, annualDaysByWardShiftTypeId: {'3': 2}, version: 0}});
});
describe('personal monthly rest targets', () => {
    it('saves separate OFF and annual targets without any schedule mutation request', async () => {
        render(<PersonalRestPolicy nurseId={1} nurseName="합성" shiftTypes={[annual]} year={2026} month={11} />);

        const details = screen.getByText(/합성 ·/).closest('details')!;

        details.open = true;
        fireEvent(details, new Event('toggle'));

        const off = await screen.findByLabelText('일반 OFF 목표');

        fireEvent.change(off, {target: {value: '9'}});
        fireEvent.change(screen.getByLabelText('연차 · 연차 배정 일수'), {target: {value: '2'}});
        fireEvent.click(screen.getByText('이번 달 목표 저장'));
        await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
        expect(put).toHaveBeenCalledWith('/nurses/1/monthly-rest-policy/2026/11', {
            offDays: 9,
            annualDaysByWardShiftTypeId: {'3': 2},
            version: null,
        });
        expect(await screen.findByRole('status')).toHaveTextContent('생성 가능 여부는 아직 검증하지 않았어요');
    });
    it('requires an OFF target when specifying annual leave and keeps inputs after validation', async () => {
        render(<PersonalRestPolicy nurseId={1} nurseName="합성" shiftTypes={[annual]} year={2026} month={11} />);

        const details = screen.getByText(/합성 ·/).closest('details')!;

        details.open = true;
        fireEvent(details, new Event('toggle'));

        const leave = await screen.findByLabelText('연차 · 연차 배정 일수');

        fireEvent.change(leave, {target: {value: '2'}});
        fireEvent.click(screen.getByText('이번 달 목표 저장'));
        expect(await screen.findByRole('alert')).toHaveTextContent('OFF 목표도 입력');
        expect(leave).toHaveValue(2);
        expect(put).not.toHaveBeenCalled();
    });
});
