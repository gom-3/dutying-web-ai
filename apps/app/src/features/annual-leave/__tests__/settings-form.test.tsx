import type {TAnnualLeaveSettings} from '@dutying/api/ward';
import {beforeEach, expect, it, vi} from 'vitest';
import type {TWardShiftType} from '@/entities';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {annualLeaveDate, annualLeaveUnits} from '../model';
import {SettingsForm} from '../settings-section';
vi.mock('../queries', () => ({useRefreshAnnualLeave: () => async () => {}}));

const types = [1, 2].map(
    (id) => ({wardShiftTypeId: id, name: id === 1 ? '연차' : '반차', classification: 'ANNUAL_LEAVE'}) as TWardShiftType,
);
const future = '2099-01-01';
const settings: TAnnualLeaveSettings = {
    available: true,
    enabled: true,
    version: 4,
    startedOn: '2026-01-01',
    stoppedOn: null,
    reviewOn: null,
    unitRules: [
        {shiftTypeId: 1, days: 1, effectiveFrom: '2026-01-01'},
        {shiftTypeId: 2, days: 0.5, effectiveFrom: '2026-01-01'},
        {shiftTypeId: 2, days: 0.25, effectiveFrom: future},
    ],
};

beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage('ko');
});
it('edits applied rules immediately and preserves untouched scheduled rules', async () => {
    const save = vi.spyOn(WardAPI, 'updateAnnualLeaveSettings').mockResolvedValue(settings);

    render(<SettingsForm wardId={1} settings={settings} shiftTypes={types} onDone={vi.fn()} />);
    expect(screen.queryByLabelText('적용 시작일')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: '저장'})).toBeDisabled();

    const field = screen.getByRole('spinbutton', {name: '연차 차감 일수'});

    expect(field).toBeEnabled();
    await userEvent.clear(field);
    expect(screen.getByRole('button', {name: '저장'})).toBeDisabled();
    await userEvent.type(field, '0.5');
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1]).toMatchObject({
        version: 4,
        unitRules: [...settings.unitRules.filter((r) => r.shiftTypeId === 2), {shiftTypeId: 1, days: 0.5, effectiveFrom: null}],
    });
});
it('accepts zero and prevents invalid precision or out of range values', async () => {
    render(<SettingsForm wardId={1} settings={settings} shiftTypes={types} onDone={vi.fn()} />);

    const field = screen.getByRole('spinbutton', {name: '연차 차감 일수'});

    for (const value of ['-1', '11', '0.0001']) {
        await userEvent.clear(field);
        await userEvent.type(field, value);
        expect(screen.getByRole('button', {name: '저장'})).toBeDisabled();
    }

    await userEvent.clear(field);
    await userEvent.type(field, '0');
    expect(screen.getByRole('button', {name: '저장'})).toBeEnabled();
    expect(annualLeaveUnits(types[0], annualLeaveDate(), [{shiftTypeId: 1, days: 0, effectiveFrom: null}])).toBe(0);
    expect(annualLeaveUnits(types[0], '2020-01-01', [{shiftTypeId: 1, days: 0.5, effectiveFrom: null}])).toBe(0.5);
});

it('shows other leave by its existing name and classification with zero default, allowing explicit deductions', async () => {
    const save = vi.spyOn(WardAPI, 'updateAnnualLeaveSettings').mockResolvedValue(settings);
    const other = {...types[0], wardShiftTypeId: 3, name: '오전 반차', classification: 'OTHER_LEAVE' as const, isOff: true};

    render(<SettingsForm wardId={1} settings={settings} shiftTypes={[...types, other]} onDone={vi.fn()} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    expect(screen.queryByRole('spinbutton', {name: '오전 반차 차감 일수'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', {name: '+ 근무유형 추가'}));
    await userEvent.click(screen.getByRole('option', {name: /오전 반차/}));

    const field = screen.getByRole('spinbutton', {name: '오전 반차 차감 일수'});

    expect(field).toHaveValue(0);
    await userEvent.clear(field);
    await userEvent.type(field, '0.5');
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][1].unitRules).toContainEqual({shiftTypeId: 3, days: 0.5, effectiveFrom: null});
    expect(annualLeaveUnits(other, annualLeaveDate())).toBe(0);
    expect(annualLeaveUnits(other, annualLeaveDate(), save.mock.calls[0][1].unitRules)).toBe(0.5);
});

it('keeps saved optional types visible and removes only their deduction rule', async () => {
    const other = {...types[0], wardShiftTypeId: 3, name: '오전 반차', classification: 'OTHER_LEAVE' as const, isOff: true};
    const configured = {...settings, unitRules: [...settings.unitRules, {shiftTypeId: 3, days: 0.5, effectiveFrom: null}]};
    const save = vi.spyOn(WardAPI, 'updateAnnualLeaveSettings').mockResolvedValue(settings);

    render(<SettingsForm wardId={1} settings={configured} shiftTypes={[...types, other]} onDone={vi.fn()} />);
    expect(screen.getByRole('spinbutton', {name: '오전 반차 차감 일수'})).toHaveValue(0.5);
    await userEvent.click(screen.getByRole('button', {name: '오전 반차 삭제'}));
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][1].unitRules).toEqual(settings.unitRules);
});
