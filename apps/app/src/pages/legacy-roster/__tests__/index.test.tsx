import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@/i18n';
import {loadPersonalRosterSession} from '@/features/legacy-roster/session';
import LegacyRosterPage from '..';
vi.mock('@/features/legacy-roster/session', () => ({
    loadPersonalRosterSession: vi.fn(),
    personalRosterLoginUrl: (provider: string) => `/oauth2/authorization/${provider}?nextPageUrl=%2Flegacy-roster`,
}));
vi.mock('@/features/legacy-roster/LegacyRosterImport', () => ({
    LegacyRosterImport: ({accountId}: {accountId: number}) => <div>개인 계정 {accountId}의 근무표</div>,
}));
beforeEach(() => vi.resetAllMocks());
describe('personal roster web entry', () => {
    it('provides personal social sign-in when no app session is available', async () => {
        vi.mocked(loadPersonalRosterSession).mockRejectedValue(new Error('no session'));
        render(<LegacyRosterPage />);
        await screen.findByText('본인 개인 계정으로 다시 로그인해 주세요.');
        expect(screen.getByRole('link', {name: '카카오 개인 계정으로 로그인'})).toHaveAttribute(
            'href',
            '/oauth2/authorization/kakao?nextPageUrl=%2Flegacy-roster',
        );
    });
    it('opens the importer only for the server-authenticated personal account', async () => {
        vi.mocked(loadPersonalRosterSession).mockResolvedValue({
            account: {accountId: 913, name: '가상 계정', status: 'INITIAL'},
            api: {} as Awaited<ReturnType<typeof loadPersonalRosterSession>>['api'],
        });
        render(<LegacyRosterPage />);
        await screen.findByText('개인 계정 913의 근무표');
    });
});
