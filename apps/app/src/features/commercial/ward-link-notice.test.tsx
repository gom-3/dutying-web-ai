import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from './api';
import type {AccessContext} from './api';
import {WardLinkNotice} from './ward-link-notice';
import {getOwnedWardLinkScope, useWardHospitalLinks, wardLinkNeedsReview, type THospitalWardLink} from './ward-links';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    context: {enabled: true, configurationReady: false, scopes: []} as AccessContext,
    auth: {
        accessToken: 'admin-token' as string | null,
        accountId: 7 as number | null,
        wardId: 12,
        accountMe: {wardId: 12, memberships: [{wardId: 12, role: 'OWNER', status: 'ACTIVE'}]} as unknown,
    },
}));

vi.mock('./api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    useCommercialContext: () => ({data: mocks.context}),
}));
vi.mock('@/features/auth/model/store', () => ({
    default: (selector: (state: typeof mocks.auth) => unknown) => selector(mocks.auth),
}));
vi.mock('@/features/auth/model/admin-token', () => ({isWardAdminAccessToken: (token: string | null) => token === 'admin-token'}));
vi.mock('react-i18next', () => ({useTranslation: () => ({i18n: {language: 'ko'}})}));

const requested: THospitalWardLink = {id: 'link1', wardId: 12, status: 'REQUESTED', version: 3, hospitalName: '서울병원'};

function SharedQueryProbe() {
    const query = useWardHospitalLinks('12');

    return <output aria-label="shared query rows">{query.data?.length ?? 0}</output>;
}

function mount(withProbe = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const ui = () => (
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <WardLinkNotice />
                {withProbe ? <SharedQueryProbe /> : null}
            </MemoryRouter>
        </QueryClientProvider>
    );

    return {...render(ui()), client, ui};
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.context = {enabled: true, configurationReady: false, scopes: []};
    mocks.auth = {
        accessToken: 'admin-token',
        accountId: 7,
        wardId: 12,
        accountMe: {wardId: 12, memberships: [{wardId: 12, role: 'OWNER', status: 'ACTIVE'}]},
    };
    mocks.get.mockResolvedValue([requested]);
});

describe('ward connection owner scope', () => {
    it('allows link review from an exact active membership before billing policies are configured', () => {
        expect(getOwnedWardLinkScope(mocks.context, mocks.auth.accountMe, 12)).toEqual({
            type: 'WARD',
            ref: '12',
            scopeId: 'ward-link-12',
            name: '',
            role: 'OWNER',
            status: 'ACTIVE',
        });
    });

    it('does not reuse another ward owner role or an inactive membership', () => {
        expect(
            getOwnedWardLinkScope(
                mocks.context,
                {
                    wardId: 12,
                    role: 'OWNER',
                    memberships: [
                        {wardId: 12, role: 'EDITOR', status: 'ACTIVE'},
                        {wardId: 13, role: 'OWNER', status: 'ACTIVE'},
                    ],
                },
                12,
            ),
        ).toBeUndefined();
        expect(getOwnedWardLinkScope(mocks.context, {memberships: [{wardId: 12, role: 'OWNER', status: 'REMOVED'}]}, 12)).toBeUndefined();
    });

    it('keeps memberships authoritative over stale commercial scopes and legacy top-level roles', () => {
        const context: AccessContext = {
            enabled: true,
            scopes: [{type: 'WARD', ref: '12', scopeId: 's12', name: '중환자실', role: 'OWNER'}],
        };

        expect(getOwnedWardLinkScope(context, {memberships: []}, 12)).toBeUndefined();
        expect(getOwnedWardLinkScope(context, {wardId: 12, role: 'EDITOR'}, 12)).toBeUndefined();
        expect(getOwnedWardLinkScope(context, undefined, 12)).toBe(context.scopes[0]);
    });

    it('supports the older account shape only when its own ward matches', () => {
        expect(getOwnedWardLinkScope(mocks.context, {wardId: 12, role: 'OWNER'}, 12)?.ref).toBe('12');
        expect(getOwnedWardLinkScope(mocks.context, {wardId: 13, role: 'OWNER'}, 12)).toBeUndefined();
        expect(getOwnedWardLinkScope({...mocks.context, enabled: false}, mocks.auth.accountMe, 12)).toBeUndefined();
    });

    it('does not call shared information a completed connection or repeat an accepted contract', () => {
        expect(wardLinkNeedsReview({...requested, status: 'SHARED'})).toBe(false);
        expect(wardLinkNeedsReview({...requested, status: 'ACTIVE'})).toBe(false);
        expect(wardLinkNeedsReview({...requested, status: 'DETACH_PENDING'})).toBe(false);
        expect(wardLinkNeedsReview({...requested, status: 'MANAGED_DETACH_PENDING'})).toBe(false);
        expect(wardLinkNeedsReview({...requested, status: 'QUOTED', wardConsent: true})).toBe(false);
        expect(wardLinkNeedsReview({...requested, status: 'QUOTED', wardConsentedBy: 7})).toBe(false);
        expect(wardLinkNeedsReview({...requested, status: 'QUOTED', wardConsent: false})).toBe(true);
    });
});

describe('ward connection discovery', () => {
    it('shows a direct review action for the current owner even when billing is not ready', async () => {
        mount();

        expect(await screen.findByLabelText('병원 연결 요청 안내')).toBeInTheDocument();
        expect(screen.getByText('서울병원에서 이 병동의 연결을 요청했습니다. 공유 범위를 확인해 주세요.')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '요청 확인하기'})).toHaveAttribute('href', '/workspace/WARD/12/links');
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/wards/12/links');
    });

    it('uses one cached list request for discovery and a second consumer', async () => {
        mount(true);

        await screen.findByLabelText('병원 연결 요청 안내');
        await waitFor(() => expect(screen.getByLabelText('shared query rows')).toHaveTextContent('1'));
        expect(mocks.get).toHaveBeenCalledTimes(1);
        expect(mocks.get.mock.calls.every(([path]) => path === '/wards/12/links')).toBe(true);
    });

    it('stays quiet for shared, active, declined, and already-consented connections', async () => {
        mocks.get.mockResolvedValue([
            {...requested, status: 'SHARED'},
            {...requested, id: 'link2', status: 'ACTIVE'},
            {...requested, id: 'link3', status: 'CANCELED'},
            {...requested, id: 'link4', status: 'QUOTED', wardConsent: true},
            {...requested, id: 'link5', status: 'DETACH_PENDING'},
            {...requested, id: 'link6', status: 'MANAGED_DETACH_PENDING'},
        ]);
        mount(true);

        await waitFor(() => expect(screen.getByLabelText('shared query rows')).toHaveTextContent('6'));
        expect(screen.queryByLabelText('병원 연결 요청 안내')).not.toBeInTheDocument();
    });

    it('explains contract review separately from information sharing', async () => {
        mocks.get.mockResolvedValue([{...requested, status: 'QUOTED', wardConsent: false}]);
        mount();

        expect(await screen.findByText('병원 연결을 위한 계약 동의가 필요합니다. 연결 조건을 확인해 주세요.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('does not fetch for ward editors, unauthenticated users, or disabled hospital management', () => {
        mocks.auth.accountMe = {wardId: 12, memberships: [{wardId: 12, role: 'EDITOR', status: 'ACTIVE'}]};

        const view = mount();

        expect(mocks.get).not.toHaveBeenCalled();
        expect(screen.queryByLabelText('병원 연결 요청 안내')).not.toBeInTheDocument();

        mocks.auth.accountMe = {wardId: 12, memberships: [{wardId: 12, role: 'OWNER', status: 'ACTIVE'}]};
        mocks.auth.accessToken = null;
        view.rerender(view.ui());
        expect(mocks.get).not.toHaveBeenCalled();

        mocks.auth.accessToken = 'admin-token';
        mocks.context = {enabled: false, scopes: []};
        view.rerender(view.ui());
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('hides cached owner requests immediately when current membership changes', async () => {
        const view = mount();

        await screen.findByLabelText('병원 연결 요청 안내');

        mocks.auth.accountMe = {wardId: 12, memberships: [{wardId: 12, role: 'EDITOR', status: 'ACTIVE'}]};
        view.rerender(view.ui());
        expect(screen.queryByLabelText('병원 연결 요청 안내')).not.toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });
});
