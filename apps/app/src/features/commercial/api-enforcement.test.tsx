import {renderHook} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {useWardEntitlement} from './api';

const {query} = vi.hoisted(() => ({query: vi.fn()}));

vi.mock('@tanstack/react-query', () => ({useQuery: query}));
vi.mock('@/features/auth/model/store', () => ({
    default: (selector: (state: object) => unknown) => selector({wardId: 12, accountId: 1, accessToken: 'test-token'}),
}));
vi.mock('@/features/auth/model/admin-token', () => ({isWardAdminAccessToken: () => true}));
vi.mock('@/shared/api/client', () => ({adminAxiosInstance: {get: vi.fn()}}));

beforeEach(() => {
    query.mockReset();
});

it('hides cached limits immediately when enforcement is turned off while billing stays enabled', () => {
    let enforcementEnabled = true;

    const cached = {plan: 'FREE', capacity: {overLimit: true}};

    query.mockImplementation((options: {queryKey: unknown[]}) =>
        options.queryKey.includes('context') ? {data: {enabled: true, enforcementEnabled, scopes: []}} : {data: cached},
    );

    const {result, rerender} = renderHook(() => useWardEntitlement());

    expect(result.current.data).toBe(cached);
    expect(query.mock.calls[1][0].enabled).toBe(true);
    enforcementEnabled = false;
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(query.mock.calls[3][0].enabled).toBe(false);
});
