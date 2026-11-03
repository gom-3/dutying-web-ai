import axios from 'axios';
import type * as AxiosModule from 'axios';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {isLegacyRosterReturn, loadPersonalRosterSession, personalRosterLoginUrl} from '../session';
vi.mock('@/shared/api/client', () => ({default: {}}));
vi.mock('axios', async (load) => {
    const actual = await load<typeof AxiosModule>();

    return {...actual, default: {...actual.default, create: vi.fn()}};
});
beforeEach(() => vi.resetAllMocks());
describe('personal roster session isolation', () => {
    it('accepts only the same-origin exact recovery return path', () => {
        expect(isLegacyRosterReturn('/legacy-roster')).toBe(true);
        expect(isLegacyRosterReturn('https://evil.example/legacy-roster')).toBe(false);
        expect(isLegacyRosterReturn('/legacy-roster?token=bad')).toBe(false);
        expect(isLegacyRosterReturn('/make')).toBe(false);
        expect(personalRosterLoginUrl('kakao')).toContain('/oauth2/authorization/kakao?');
        expect(personalRosterLoginUrl('kakao')).not.toContain('/admin/');
    });
    it('refreshes once, keeps token out of URLs and resolves the account server-side', async () => {
        const post = vi.fn().mockResolvedValue({data: {accessToken: 'test-personal-token'}});
        const get = vi.fn().mockResolvedValue({data: {accountId: 913, status: 'INITIAL', name: '가상 계정'}});

        vi.mocked(axios.create)
            .mockReturnValueOnce({post} as unknown as ReturnType<typeof axios.create>)
            .mockReturnValueOnce({get} as unknown as ReturnType<typeof axios.create>);

        const [first, second] = await Promise.all([loadPersonalRosterSession(), loadPersonalRosterSession()]);

        expect(post).toHaveBeenCalledExactlyOnceWith('/token/refresh');
        expect(get).toHaveBeenCalledExactlyOnceWith('/accounts/me');
        expect(first.account.accountId).toBe(913);
        expect(second).toBe(first);
        expect(axios.create).toHaveBeenLastCalledWith(
            expect.objectContaining({withCredentials: false, headers: {Authorization: 'Bearer test-personal-token'}}),
        );
    });
});
