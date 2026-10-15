import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {requestCapacityKo} from '@/shared/locales/request-capacity';
import {DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS} from '../../model/ward-settings-hook';
import {RequestCapacitySettings} from '../request-capacity-settings';
import {RequestReceptionSettings} from '../request-reception-settings';

const api = vi.hoisted(() => ({
    getShiftTeams: vi.fn(),
    getShiftTypes: vi.fn(),
    getReqShiftCapacitySettings: vi.fn(),
    updateReqShiftCapacitySettings: vi.fn(),
}));

vi.mock('@/shared/api', () => ({WardAPI: api}));
vi.mock('@/features/auth', () => ({default: () => ({state: {wardId: 1}})}));
vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values: Record<string, string | number> = {}) => {
            const value = requestCapacityKo[key.split('.')[1] as keyof typeof requestCapacityKo] ?? key;

            return value.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(values[token] ?? ''));
        },
    }),
}));
vi.mock('react-hot-toast', () => ({default: {success: vi.fn()}}));

const saved = {
    shiftTeamId: 11,
    enabled: false,
    revision: 0,
    rules: [],
    groups: [
        {groupId: 21, divisionNum: 1, name: 'A그룹'},
        {groupId: 22, divisionNum: 2, name: 'B그룹'},
    ],
    usage: [],
    overflows: [],
};

function mount(settingsSurface = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
        <QueryClientProvider client={client}>
            {settingsSurface ? (
                <RequestReceptionSettings
                    settings={DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS}
                    status="success"
                    onSave={async () => true}
                    onRetry={() => undefined}
                />
            ) : (
                <RequestCapacitySettings />
            )}
        </QueryClientProvider>,
    );

    return userEvent.setup();
}

beforeEach(() => {
    vi.resetAllMocks();
    api.getShiftTeams.mockResolvedValue([{shiftTeamId: 11, name: '1팀'}]);
    api.getShiftTypes.mockResolvedValue([
        {wardShiftTypeId: 1, name: '휴무', shortName: 'OFF', classification: 'OFF', isActive: true},
        {wardShiftTypeId: 2, name: '데이', shortName: 'D', classification: 'DAY', isActive: true},
    ]);
    api.getReqShiftCapacitySettings.mockResolvedValue(saved);
    api.updateReqShiftCapacitySettings.mockImplementation(async (_, teamId, body) => ({
        ...saved,
        ...body,
        shiftTeamId: teamId,
        revision: body.revision + 1,
    }));
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('request capacity settings', () => {
    it('saves independent team and group limits using stable group IDs', async () => {
        const user = mount();

        await user.click(await screen.findByRole('switch', {name: '인원 제한 사용'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'}), '3');
        await user.click(screen.getByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'}), '1');
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: true,
                revision: 0,
                rules: [
                    {wardShiftTypeId: 1, groupId: null, maxPerDay: 3},
                    {wardShiftTypeId: 1, groupId: 21, maxPerDay: 1},
                ],
            }),
        );
    });

    it('shows existing applicants above the proposed limit before saving', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            usage: [{date: '2026-11-15', wardShiftTypeId: 1, groupId: null, requestedCount: 3}],
        });

        const user = mount();

        await user.click(await screen.findByRole('switch', {name: '인원 제한 사용'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'}), '2');
        expect(screen.getByText('2026-11-15 · OFF · 근무팀: 현재 3명 / 설정 2명')).toBeInTheDocument();
        expect(api.updateReqShiftCapacitySettings).not.toHaveBeenCalled();
    });

    it('opens existing group settings and makes the combined team limit explicit', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [
                {wardShiftTypeId: 1, groupId: null, maxPerDay: 3},
                {wardShiftTypeId: 1, groupId: 21, maxPerDay: 1},
            ],
        });

        mount();

        const toggle = await screen.findByRole('button', {name: 'OFF 그룹별 인원 설정'});

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(3);
        expect(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'})).toHaveValue(1);
        expect(screen.getByRole('spinbutton', {name: 'OFF B그룹 그룹 하루 최대 인원'})).toHaveValue(null);
    });

    it('clears a group limit without adding or deleting group rows', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [
                {wardShiftTypeId: 1, groupId: null, maxPerDay: 3},
                {wardShiftTypeId: 1, groupId: 21, maxPerDay: 1},
            ],
        });

        const user = mount();

        await screen.findByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'});
        await user.clear(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: true,
                revision: 0,
                rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
            }),
        );
    });

    it('keeps entered limits visible after a save failure', async () => {
        api.updateReqShiftCapacitySettings.mockRejectedValue(new Error('network'));

        const user = mount();

        await user.click(await screen.findByRole('switch', {name: '인원 제한 사용'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'}), '3');
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('인원 제한을 저장하지 못했어요');
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(3);
    });

    it('does not disguise a failed load as limits being disabled', async () => {
        api.getReqShiftCapacitySettings.mockRejectedValue(new Error('unavailable'));
        mount();
        expect(await screen.findByText('신청 인원 제한을 불러오지 못했어요.')).toBeInTheDocument();
        expect(screen.queryByRole('switch', {name: '인원 제한 사용'})).not.toBeInTheDocument();
    });

    it('rejects an enabled setting with no actual limits', async () => {
        const user = mount();

        await user.click(await screen.findByRole('switch', {name: '인원 제한 사용'}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('제한을 하나 이상 설정');
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveFocus();
        expect(api.updateReqShiftCapacitySettings).not.toHaveBeenCalled();
    });

    it('can turn limits off even if an unfinished group input is invalid', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount();

        await screen.findByRole('switch', {name: '인원 제한 사용'});
        await user.click(screen.getByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'}), '-1');
        await user.click(screen.getByRole('switch', {name: '인원 제한 사용'}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: false,
                revision: 0,
                rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
            }),
        );
    });

    it('preserves input and requires reload after another administrator changes settings', async () => {
        api.updateReqShiftCapacitySettings.mockRejectedValue({
            isAxiosError: true,
            response: {data: {code: 'REQ_SHIFT_CAPACITY_SETTINGS_CONFLICT'}},
        });

        const user = mount();

        await user.click(await screen.findByRole('switch', {name: '인원 제한 사용'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'}), '3');
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('다른 관리자가 설정을 바꿨어요');
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(3);
        expect(screen.getByRole('button', {name: '저장하기'})).toBeDisabled();
        expect(api.getReqShiftCapacitySettings).toHaveBeenCalledTimes(1);
    });
    it('saves group-only limits when the team limit is removed', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount();

        await user.click(await screen.findByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'}), '1');
        await user.clear(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'}));
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(null);
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: true,
                revision: 0,
                rules: [{wardShiftTypeId: 1, groupId: 21, maxPerDay: 1}],
            }),
        );
    });

    it('explicitly clears group limits while keeping the team limit', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [
                {wardShiftTypeId: 1, groupId: null, maxPerDay: 3},
                {wardShiftTypeId: 1, groupId: 21, maxPerDay: 1},
            ],
        });

        const user = mount();

        await user.click(await screen.findByRole('button', {name: 'OFF 그룹 제한 해제'}));
        expect(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'})).toHaveValue(null);
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: true,
                revision: 0,
                rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
            }),
        );
    });

    it('restores saved inputs when edits are canceled', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount();
        const input = await screen.findByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'});

        await user.clear(input);
        await user.type(input, '4');
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(4);
        await user.click(screen.getByRole('button', {name: '취소'}));
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(3);
        expect(api.updateReqShiftCapacitySettings).not.toHaveBeenCalled();
    });

    it('adds another shift without transferring the OFF limit to it', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount();

        await user.click(await screen.findByRole('combobox', {name: '다른 근무 추가'}));
        await user.click(screen.getByRole('option', {name: 'D · 데이'}));
        expect(screen.getByRole('spinbutton', {name: 'D 팀 전체 하루 최대 인원'})).toHaveValue(null);
        expect(screen.getByRole('spinbutton', {name: 'D 팀 전체 하루 최대 인원'})).toHaveFocus();
        await user.type(screen.getByRole('spinbutton', {name: 'D 팀 전체 하루 최대 인원'}), '2');
        await user.click(screen.getByRole('button', {name: 'OFF 삭제'}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: true,
                revision: 0,
                rules: [{wardShiftTypeId: 2, groupId: null, maxPerDay: 2}],
            }),
        );
    });

    it('retains capacity edits while switching to the reception period and back', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount(true);

        await user.click(screen.getByRole('tab', {name: '신청 인원'}));

        const input = await screen.findByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'});

        await user.clear(input);
        await user.type(input, '4');
        await user.click(screen.getByRole('tab', {name: '접수 기간'}));
        expect(screen.queryByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('tab', {name: '신청 인원'}));
        expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(4);
        await user.keyboard('{ArrowLeft}');
        expect(screen.getByRole('tab', {name: '접수 기간'})).toHaveAttribute('aria-selected', 'true');
        expect(api.updateReqShiftCapacitySettings).not.toHaveBeenCalled();
    });
    it('keeps group limits when their settings are collapsed', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount();

        await user.click(await screen.findByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'}), '1');
        await user.click(screen.getByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        expect(screen.queryByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'})).not.toBeInTheDocument();
        expect(screen.getByText('A그룹 1명')).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        await waitFor(() =>
            expect(api.updateReqShiftCapacitySettings).toHaveBeenCalledWith(1, 11, {
                enabled: true,
                revision: 0,
                rules: [
                    {wardShiftTypeId: 1, groupId: null, maxPerDay: 3},
                    {wardShiftTypeId: 1, groupId: 21, maxPerDay: 1},
                ],
            }),
        );
    });

    it('reveals a collapsed invalid group field before focusing it', async () => {
        api.getReqShiftCapacitySettings.mockResolvedValue({
            ...saved,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: 3}],
        });

        const user = mount();

        await user.click(await screen.findByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        await user.type(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'}), '-1');
        await user.click(screen.getByRole('button', {name: 'OFF 그룹별 인원 설정'}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));
        expect(screen.getByRole('spinbutton', {name: 'OFF A그룹 그룹 하루 최대 인원'})).toHaveFocus();
        expect(api.updateReqShiftCapacitySettings).not.toHaveBeenCalled();
    });
    it('confirms unsaved edits and loads the selected team independently', async () => {
        api.getShiftTeams.mockResolvedValue([
            {shiftTeamId: 11, name: '1팀'},
            {shiftTeamId: 12, name: '2팀'},
        ]);
        api.getReqShiftCapacitySettings.mockImplementation(async (_, teamId) => ({
            ...saved,
            shiftTeamId: teamId,
            enabled: true,
            rules: [{wardShiftTypeId: 1, groupId: null, maxPerDay: teamId === 11 ? 3 : 1}],
        }));

        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const user = mount();
        const input = await screen.findByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'});

        await user.clear(input);
        await user.type(input, '4');
        await user.click(screen.getByRole('combobox', {name: '근무팀'}));
        await user.click(screen.getByRole('option', {name: '2팀'}));
        expect(screen.getByRole('combobox', {name: '근무팀'})).toHaveTextContent('1팀');
        expect(input).toHaveValue(4);
        confirm.mockReturnValue(true);
        await user.click(screen.getByRole('combobox', {name: '근무팀'}));
        await user.click(screen.getByRole('option', {name: '2팀'}));
        await waitFor(() => expect(screen.getByRole('spinbutton', {name: 'OFF 팀 전체 하루 최대 인원'})).toHaveValue(1));
        expect(screen.getByRole('combobox', {name: '근무팀'})).toHaveTextContent('2팀');
        expect(confirm).toHaveBeenCalledTimes(2);
        expect(api.updateReqShiftCapacitySettings).not.toHaveBeenCalled();
    });
    it('shows optional explanations only in the info tooltip on hover and tap', async () => {
        const user = mount();
        const help = await screen.findByRole('button', {name: '신청 인원 제한 도움말'});

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(screen.queryByText('매일 같은 인원 적용')).not.toBeInTheDocument();
        await user.hover(help);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('모든 날짜에 같은 정원');
        await user.unhover(help);
        await user.keyboard('{Escape}');
        await user.click(help);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('앱에서 추가 신청을 받지 않아요');
    });
});
