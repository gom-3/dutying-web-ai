import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {AccessContext, Entitlement, Organization, Policy, Scope} from '@/features/commercial/api';
import WorkspacePage from './index';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    legacyGet: vi.fn(),
    legacyDelete: vi.fn(),
    post: vi.fn(),
    refresh: vi.fn(),
    refetch: vi.fn(),
    context: {enabled: true, scopes: []} as AccessContext,
}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialGet: mocks.get,
    legacyGet: mocks.legacyGet,
    legacyDelete: mocks.legacyDelete,
    commercialPost: mocks.post,
    useCommercialContext: () => ({data: mocks.context, refetch: mocks.refetch, isPending: false, isError: false}),
}));
vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {accountMe: {name: '김간호', wardId: 11, memberships: [{wardId: 11, status: 'ACTIVE', role: 'OWNER'}]}},
        actions: {handleGetAccountMe: mocks.refresh},
    }),
}));
vi.mock('@/features/auth/model/store', () => ({
    default: (selector: (state: object) => unknown) =>
        selector({
            accountId: 7,
            wardId: 11,
            accessToken: 'e30.' + btoa(JSON.stringify({principalType: 'WARD_ADMIN', wardAdminAccountId: 7})) + '.fixture',
            accountMe: {wardId: 11, memberships: [{wardId: 11, status: 'ACTIVE', role: 'OWNER'}]},
        }),
}));
vi.mock('@/pages/subscription-info', () => ({
    fetchPublicOffer: vi.fn().mockResolvedValue({ready: false}),
    RefundConditions: () => null,
    SubscriptionConditions: () => null,
}));

const scope: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 'hospital-scope', name: '서울병원', role: 'OWNER', status: 'DRAFT'};
const entitlement = {
    billingScopeId: 'hospital-scope',
    plan: 'HOSPITAL',
    adminSeats: {active: 2, reserved: 0, limit: 5},
    capacity: {used: 20, purchased: 50},
    usage: [],
    policy: {},
    allowedActions: [],
    canManageBilling: true,
} as unknown as Entitlement;
const organization: Organization = {
    organization: {
        id: 'h1',
        name: '서울병원',
        status: 'DRAFT',
        adoptionStage: 'QUOTED',
        requestedCapacity: 50,
        setupStaff: 20,
        quoteSnapshot: JSON.stringify({
            capacity: 50,
            setupStaff: 20,
            startsAt: '2026-10-01T00:00:00Z',
            endsAt: '2027-10-01T00:00:00Z',
            paymentMode: 'PREPAID',
            termsRef: 'hospital-contract-v1',
        }),
        contractHash: 'contract',
    },
    role: 'OWNER',
    entitlement,
    contractEstimate: {monthlyGross: 49000, setupGross: 249000} as Organization['contractEstimate'],
    wards: [
        {id: 'link1', wardId: 11, name: '중환자실', status: 'ACTIVE', version: 1, staff: 20, canOpenWard: true},
        {id: 'link2', wardId: 12, name: '응급실', status: 'ACTIVE', version: 2, staff: 15, canOpenWard: false},
    ],
};
const wardScope: Scope = {type: 'WARD', ref: '11', scopeId: 'ward-scope', name: '중환자실', role: 'OWNER', status: 'ACTIVE'};
const completePolicy = (plan: string, overrides: Partial<Policy> = {}): Policy => ({
    plan,
    baseGross: plan === 'FREE' ? 0 : 19900,
    includedStaff: plan === 'FREE' ? 30 : 50,
    extraStaffGross: plan === 'FREE' ? 0 : 990,
    generate: 30,
    adjust: 10,
    adminSeats: 10,
    generatePackSize: 10,
    generatePackGross: 2900,
    adjustPackSize: 5,
    adjustPackGross: 4900,
    validityDays: 365,
    setupBase: 249000,
    setupExtra: 2000,
    features: {REQUEST_CREATE: plan !== 'FREE', BOARD_CREATE: plan !== 'FREE', HOSPITAL_OVERVIEW: plan === 'HOSPITAL'},
    ...overrides,
});
const wardEntitlement = (overrides: Partial<Entitlement> = {}): Entitlement => ({
    ...entitlement,
    billingScopeId: wardScope.scopeId,
    plan: 'FREE',
    entitlementSource: 'FREE',
    capacity: {used: 20, purchased: 30, overLimit: false},
    policy: completePolicy('FREE'),
    checkoutEnabled: false,
    ...overrides,
});

function mockWardBilling(e: Entitlement, catalog: unknown) {
    mocks.context = {enabled: true, scopes: [wardScope]};
    mocks.get.mockImplementation((path: string) =>
        path === '/plans' ? Promise.resolve(catalog) : Promise.resolve(path.includes('/entitlements') ? e : null),
    );
    // Hold the response so these request assertions do not fabricate a payment quote.
    mocks.post.mockReturnValue(new Promise(() => {}));
}

function Location() {
    const location = useLocation();

    return <output aria-label="current route">{location.pathname + location.search}</output>;
}

function mount(path = '/workspace/HOSPITAL/h1/overview') {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const element = () => (
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <WorkspacePage />
                <Location />
            </MemoryRouter>
        </QueryClientProvider>
    );

    return {...render(element()), refreshRender: element};
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.context = {enabled: true, scopes: [scope]};
    mocks.post.mockResolvedValue({});
    mocks.legacyGet.mockResolvedValue({members: [], invitations: []});
    mocks.legacyDelete.mockResolvedValue(undefined);
    mocks.refresh.mockResolvedValue(undefined);
    mocks.refetch.mockResolvedValue({});
    mocks.get.mockImplementation((path: string) =>
        Promise.resolve(path.includes('/entitlements') ? entitlement : path === '/organizations/h1' ? organization : []),
    );
});

describe('ward membership resignation', () => {
    it('does not offer a membership resignation for an inherited hospital ward', async () => {
        mocks.context = {enabled: true, scopes: [{...wardScope, role: 'EDITOR', accessSource: 'HOSPITAL'}]};
        mocks.get.mockResolvedValue(wardEntitlement());
        mount('/workspace/WARD/11/members');
        expect(await screen.findByRole('heading', {name: '관리자와 초대'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이 범위에서 나가기'})).not.toBeInTheDocument();
        expect(mocks.legacyDelete).not.toHaveBeenCalled();
    });

    it.each(['MEMBERSHIP', undefined, null] as const)('preserves membership resignation for source %s', async (accessSource) => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

        mocks.context = {enabled: true, scopes: [{...wardScope, role: 'EDITOR', accessSource}]};
        mocks.get.mockResolvedValue(wardEntitlement());
        mount('/workspace/WARD/11/members');
        await userEvent.click(await screen.findByRole('button', {name: '이 범위에서 나가기'}));
        await waitFor(() => expect(mocks.legacyDelete).toHaveBeenCalledExactlyOnceWith('/admin/wards/11/quit'));
        confirm.mockRestore();
    });
});

describe('hospital management workspace', () => {
    it.each(['usage', 'support'])('keeps old hospital %s links on the simplified service page', async (oldTab) => {
        mount(`/workspace/HOSPITAL/h1/${oldTab}`);
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/h1/billing'));
        expect(screen.getByRole('heading', {level: 1, name: '이용·계약'})).toBeInTheDocument();
        expect(
            within(screen.getByRole('navigation', {name: '병원 관리 메뉴'}))
                .getAllByRole('link')
                .map((link) => link.textContent),
        ).toEqual(['병동 관리', '관리자 관리', '이용·계약']);
        expect(screen.queryByRole('button', {name: '정확한 금액 확인'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '지원 시간'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '환불·정산 문의'})).not.toBeInTheDocument();
        expect(mocks.get.mock.calls.some(([path]) => path === '/plans' || String(path).endsWith('/support'))).toBe(false);
    });

    it('redirects an old invitation link to notifications without losing the pending invitation', async () => {
        mocks.context.invitations = [
            {
                type: 'HOSPITAL',
                name: '분당병원',
                invitation: {id: 'inv-1', role: 'MANAGER', status: 'PENDING', expiresAt: '2099-01-01T00:00:00Z', version: 1},
            },
        ];
        mount('/workspace/invitations');
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/notices'));
        expect(await screen.findByRole('button', {name: '수락하고 참여'})).toBeInTheDocument();
        expect(screen.getByText('분당병원')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
        ['invitations', '알림'],
        ['notices', '알림'],
        ['receipts', '내 결제 내역'],
        ['plans', '요금제 안내'],
    ])('opens the personal %s page without requiring a hospital or ward selection', async (path, title) => {
        mount(`/workspace/${path}`);
        expect(screen.getByRole('heading', {level: 1, name: title})).toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: '관리 범위 바꾸기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '내 관리 공간'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '내 계정'})).toBeInTheDocument();
        expect(screen.getByRole('navigation', {name: '병원 관리 메뉴'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '병동 관리'})).toHaveAttribute('href', '/workspace/HOSPITAL/h1/overview');

        if (path === 'invitations') {
            expect(screen.queryByRole('button', {name: '인증번호 받기'})).not.toBeInTheDocument();
        }

        await waitFor(() => expect(mocks.get.mock.calls.some(([request]) => String(request).includes('/entitlements'))).toBe(false));
    });

    it('lets hospital managers read usage in the combined page without loading billing data', async () => {
        mocks.context.scopes = [{...scope, role: 'MANAGER'}];
        mount('/workspace/HOSPITAL/h1/billing');
        await screen.findByRole('heading', {level: 1, name: '이용·계약'});
        expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/h1/billing');
        expect(screen.getByRole('link', {name: '이용·계약'})).toBeInTheDocument();
        expect(mocks.get.mock.calls.some(([request]) => String(request).startsWith('/billing-scopes/'))).toBe(false);
    });

    it('offers hospital creation through the existing ward setup and retains existing ward connection', async () => {
        mount();
        expect(await screen.findByRole('link', {name: '새 병동 만들기'})).toHaveAttribute(
            'href',
            '/onboarding/ward-create?organizationId=h1',
        );
        await userEvent.click(screen.getByText('기존 병동 연결'));
        await userEvent.type(screen.getByLabelText('연결할 병동 코드'), 'WARD11');
        await userEvent.click(screen.getByRole('button', {name: '병동에 연결 요청 보내기'}));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/ward-links', {wardCode: 'WARD11'}));
        expect(screen.getByText(/연결 요청을 보냈습니다/)).toBeInTheDocument();
    });
    it('opens a hospital-created ward and keeps it operational while its billing terms are being quoted', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.includes('/entitlements')
                    ? entitlement
                    : {
                          ...organization,
                          wards: [
                              {
                                  ...organization.wards[0],
                                  status: 'QUOTED',
                                  operationallyConnected: true,
                                  canManageStaff: true,
                                  wardCode: 'WARD11',
                              },
                          ],
                      },
            ),
        );
        mount('/workspace/HOSPITAL/h1/overview?createdWardId=11');
        expect(await screen.findByRole('heading', {name: '중환자실 세팅이 완료됐어요'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '병동 근무표 열기'})).toBeInTheDocument();
        expect(screen.getByLabelText('초대할 담당자 이메일')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));
        expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/h1/overview');
        expect(screen.getByLabelText('current route')).not.toHaveTextContent('createdWardId');
        expect(screen.queryByLabelText('초대할 담당자 이메일')).not.toBeInTheDocument();
    });
    it('does not expose staff controls through a forged completion parameter', async () => {
        mount('/workspace/HOSPITAL/h1/overview?createdWardId=12');
        await screen.findByRole('heading', {name: '연결 병동'});
        expect(screen.queryByLabelText('초대할 담당자 이메일')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '코드 복사'})).not.toBeInTheDocument();
    });
    it('allows ward link review without billing policies or ward entitlements', async () => {
        mocks.context = {enabled: true, configurationReady: false, scopes: []};
        mocks.get.mockResolvedValue([
            {id: 'link-1', organizationId: 'h1', hospitalName: '서울병원', wardId: 11, status: 'REQUESTED', version: 1, canDecline: true},
        ]);
        mount('/workspace/WARD/11/links');

        expect(await screen.findByRole('article', {name: '서울병원'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '동의하고 연결 진행'})).toBeDisabled();
        expect(mocks.get).toHaveBeenCalledWith('/wards/11/links');
        expect(mocks.get.mock.calls.some(([path]) => path.includes('/entitlements'))).toBe(false);
        expect(screen.queryByRole('link', {name: '결제·증설'})).not.toBeInTheDocument();
    });
    it('keeps management available without presenting billing controls before policies are configured', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.includes('/entitlements')
                    ? {...entitlement, configurationReady: false, checkoutEnabled: false, canManageBilling: false}
                    : organization,
            ),
        );
        mount('/workspace/HOSPITAL/h1/billing');
        expect(
            await screen.findByText('이용 조건을 설정 중입니다. 설정이 완료되면 계약과 청구 내역을 확인할 수 있습니다.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '병동 관리'})).toHaveAttribute('href', '/workspace/HOSPITAL/h1/overview');
        expect(screen.queryByRole('button', {name: '계약 조건에 동의'})).not.toBeInTheDocument();
        expect(mocks.get.mock.calls.some(([path]) => path.includes('/billing-scopes/'))).toBe(false);
    });

    it('redirects the deprecated adoption route and opens the assigned hospital without creating one', async () => {
        mount('/workspace/adoption');
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/h1/overview'));
        expect(mocks.post).toHaveBeenCalledWith('/scopes/HOSPITAL/h1/select');
        expect(mocks.post.mock.calls.some(([path]) => path === '/organizations')).toBe(false);
        expect(screen.queryByRole('button', {name: '병원 관리 공간 만들고 문의하기'})).not.toBeInTheDocument();
    });
    it('puts the hospital action before ward actions on the start screen', () => {
        mount('/workspace');

        const hospital = screen.getByRole('button', {name: '서울병원 병원 열기'});
        const createWard = screen.getByRole('link', {name: '새 병동 만들기'});
        const enterWard = screen.getByRole('link', {name: '초대 코드로 병동 참여'});

        expect(hospital.compareDocumentPosition(createWard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(createWard.compareDocumentPosition(enterWard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole('heading', {level: 1, name: '병원·병동 선택'})).toBeInTheDocument();
        expect(screen.getByRole('navigation', {name: '병원 관리 메뉴'})).toBeInTheDocument();
        expect(screen.queryByRole('navigation', {name: '관리 메뉴'})).not.toBeInTheDocument();
    });
    it('preserves the ward start actions when hospital management is unavailable', async () => {
        mocks.context = {enabled: false, scopes: []};
        mount('/workspace');

        expect(screen.queryByRole('button', {name: '병원으로 들어가기'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('link', {name: '새 병동 만들기'}));
        expect(screen.getByLabelText('current route')).toHaveTextContent('/onboarding/ward-create');
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('keeps ward code entry on the existing route for ward-only accounts', async () => {
        mocks.context = {enabled: true, scopes: []};
        mount('/workspace');

        await userEvent.click(screen.getByRole('link', {name: '초대 코드로 병동 참여'}));
        expect(screen.getByLabelText('current route')).toHaveTextContent('/enter-ward');
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('preserves labeled ward and scheduling actions when rows reflow on mobile', async () => {
        mount();

        const table = await screen.findByRole('table', {name: '연결 병동 운영 현황'});
        const wardCell = within(table).getByRole('cell', {name: '중환자실'});
        const staffHeader = within(table).getByRole('columnheader', {name: '활성 편성 인원'});

        expect(wardCell).toHaveAttribute('data-label', '병동');
        expect(within(table).getByRole('cell', {name: '20'})).toHaveAttribute('headers', staffHeader.id);
        expect(within(table).getByRole('button', {name: '병동 근무표 열기'})).toHaveAccessibleDescription('중환자실');
    });
    it('shows operations first and keeps contract acceptance in the billing menu', async () => {
        mount();
        expect(await screen.findByRole('heading', {name: '병원 운영 현황'})).toBeInTheDocument();
        expect(screen.getByText('35')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '연결 병동'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '이용·계약'})).toHaveAttribute('href', '/workspace/HOSPITAL/h1/billing');
        expect(screen.queryByRole('heading', {name: '병원 도입 현황'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이 계약 조건에 동의'})).not.toBeInTheDocument();
        expect(
            within(screen.getByRole('heading', {name: '연결 병동'}).closest('section')!).queryByRole('button', {name: '병원 연결 해제'}),
        ).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: '병원 연결 해제'}).every((button) => !button.closest('details')?.open)).toBe(true);
        expect(screen.getByText('담당 권한 없음')).toBeInTheDocument();
    });
    it('preserves owner contract acceptance and reveals setup review after server confirmation', async () => {
        let accepted = false;

        mocks.post.mockImplementation(async () => {
            accepted = true;

            return {};
        });
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.includes('/entitlements')
                    ? entitlement
                    : path === '/organizations/h1'
                      ? {
                            ...organization,
                            organization: {
                                ...organization.organization,
                                adoptionStage: 'READY',
                                contractAcceptedAt: accepted ? '2026-10-23T00:00:00Z' : undefined,
                            },
                        }
                      : path === '/billing-scopes/hospital-scope'
                        ? {scope: {version: 1, cancelAtPeriodEnd: false}, invoices: [], orders: [], requests: []}
                        : [],
            ),
        );
        mount('/workspace/HOSPITAL/h1/billing');

        const accept = await screen.findByRole('button', {name: '계약 조건에 동의'});

        expect(screen.queryByRole('button', {name: '초기 세팅 확인 완료'})).not.toBeInTheDocument();
        await userEvent.click(accept);
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/organizations/h1/accept/CONTRACT', {contractHash: 'contract'}));
        expect(await screen.findByRole('button', {name: '초기 세팅 확인 완료'})).toBeInTheDocument();
    });
    it('does not reveal contract controls on a manager’s direct billing URL', async () => {
        mocks.context.scopes = [{...scope, role: 'MANAGER'}];
        mount('/workspace/HOSPITAL/h1/billing');
        await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/scopes/HOSPITAL/h1/entitlements'));
        expect(screen.queryByRole('button', {name: '계약 조건에 동의'})).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalledWith('/billing-scopes/hospital-scope');
    });
    it('selects the authorized ward before entering scheduling and hides inaccessible ward actions', async () => {
        mount();

        const open = await screen.findAllByRole('button', {name: '병동 근무표 열기'});

        expect(open).toHaveLength(1);
        await userEvent.click(open[0]);
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/scopes/WARD/11/select'));
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/home'));
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
    it('shows managers the summary without contract or ward-link administration', async () => {
        mocks.context.scopes = [{...scope, role: 'MANAGER'}];
        mount();
        await screen.findByRole('heading', {name: '병원 운영 현황'});
        expect(screen.getByRole('link', {name: '이용·계약'})).toBeInTheDocument();
        expect(screen.queryByText('병동 연결 관리')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '병원 연결 해제'})).not.toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '병원 운영 현황'}).closest('section')).toHaveTextContent('병원 관리자');
    });
    it('keeps effective ward access for a legacy pending disconnection', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.includes('/entitlements')
                    ? entitlement
                    : {
                          ...organization,
                          wards: [{...organization.wards[0], status: 'DETACH_PENDING'}],
                      },
            ),
        );
        mount();
        expect(await screen.findByRole('button', {name: '병동 근무표 열기'})).toBeInTheDocument();
    });
    it('does not open a detached ward from the hospital even if an independent ward membership survives', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path.includes('/entitlements')
                    ? entitlement
                    : {
                          ...organization,
                          wards: [{...organization.wards[0], status: 'DETACHED'}],
                      },
            ),
        );
        mount();
        await screen.findByRole('heading', {name: '연결 병동'});
        expect(screen.queryByRole('button', {name: '병동 근무표 열기'})).not.toBeInTheDocument();
    });
    it('replaces a revoked hospital workspace with a no-access state', async () => {
        const view = mount();

        await screen.findByRole('heading', {name: '병원 운영 현황'});
        mocks.context = {enabled: true, scopes: []};
        view.rerender(view.refreshRender());
        expect(await screen.findByRole('heading', {name: '연결된 병원이 없습니다'})).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '병원 운영 현황'})).not.toBeInTheDocument();
    });
});

describe('ward billing policy readiness', () => {
    it.each([
        ['missing', null],
        ['unpublished', completePolicy('PLUS')],
    ])('prevents subscription quotes for a %s policy', async (_state, config) => {
        mockWardBilling(wardEntitlement(), [{id: 'PLUS', plan: 'PLUS', config, configured: false}]);
        mount('/workspace/WARD/11/billing');

        expect(await screen.findByText('요금제 설정 중')).toBeInTheDocument();
        expect(screen.getByText('요금제 설정이 완료되면 견적을 확인할 수 있습니다.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '정확한 금액 확인'})).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('requires the published subscription policy even when the account is using a Plus event', async () => {
        mockWardBilling(wardEntitlement({plan: 'PLUS', entitlementSource: 'EVENT', policy: completePolicy('PLUS')}), []);
        mount('/workspace/WARD/11/billing');

        expect(await screen.findByText('요금제 설정 중')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '정확한 금액 확인'})).toBeDisabled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('uses the administrator’s included staff as the initial subscription capacity and minimum', async () => {
        mockWardBilling(wardEntitlement(), [{id: 'plus-policy', config: completePolicy('PLUS', {includedStaff: 80}), configured: true}]);
        mount('/workspace/WARD/11/billing');

        const input = await screen.findByRole('spinbutton', {name: '변경 후 총 편성 인원'});

        await waitFor(() => expect(input).toHaveValue(80));
        expect(input).toHaveAttribute('min', '80');
        await userEvent.click(screen.getByRole('button', {name: '정확한 금액 확인'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', {
                purpose: 'SUBSCRIPTION',
                plan: 'PLUS',
                capacity: 80,
                setupStaff: 0,
                fullPacks: 0,
                partialPacks: 0,
            }),
        );
    });

    it('keeps an edited capacity when the published policy finishes loading', async () => {
        let resolveCatalog!: (value: unknown) => void;

        const pendingCatalog = new Promise((resolve) => {
            resolveCatalog = resolve;
        });

        mockWardBilling(wardEntitlement(), pendingCatalog);
        mount('/workspace/WARD/11/billing');

        const input = await screen.findByRole('spinbutton', {name: '변경 후 총 편성 인원'});

        expect(screen.getByRole('button', {name: '정확한 금액 확인'})).toBeDisabled();
        await userEvent.clear(input);
        await userEvent.type(input, '120');
        resolveCatalog([{id: 'plus-policy', config: completePolicy('PLUS', {includedStaff: 80}), configured: true}]);
        await waitFor(() => expect(screen.getByRole('button', {name: '정확한 금액 확인'})).toBeEnabled());
        expect(input).toHaveValue(120);
        expect(input).toHaveAttribute('min', '80');
        await userEvent.click(screen.getByRole('button', {name: '정확한 금액 확인'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/billing-scopes/ward-scope/quotes', expect.objectContaining({capacity: 120})),
        );
    });

    it('keeps existing paid add-ons available while the current catalogue is loading', async () => {
        mockWardBilling(
            wardEntitlement({
                plan: 'PLUS',
                entitlementSource: 'SUBSCRIPTION',
                policy: completePolicy('PLUS'),
                capacity: {used: 20, purchased: 50, overLimit: false},
            }),
            new Promise(() => {}),
        );
        mount('/workspace/WARD/11/billing');

        const fullPacks = await screen.findByRole('spinbutton', {name: /전체 생성.*묶음/});

        expect(screen.getByRole('button', {name: '정확한 금액 확인'})).toBeEnabled();
        expect(screen.queryByText('요금제 설정 중')).not.toBeInTheDocument();
        await userEvent.clear(fullPacks);
        await userEvent.type(fullPacks, '1');
        await userEvent.click(screen.getByRole('button', {name: '정확한 금액 확인'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith(
                '/billing-scopes/ward-scope/quotes',
                expect.objectContaining({purpose: 'USAGE_PACK', capacity: 50, fullPacks: 1}),
            ),
        );
    });

    it('uses the existing paid contract instead of a newer catalogue policy for capacity changes', async () => {
        mockWardBilling(
            wardEntitlement({
                plan: 'PLUS',
                entitlementSource: 'SUBSCRIPTION',
                policy: completePolicy('PLUS', {includedStaff: 40}),
                capacity: {used: 20, purchased: 50, overLimit: false},
            }),
            [{id: 'new-plus-policy', config: completePolicy('PLUS', {includedStaff: 80}), configured: true}],
        );
        mount('/workspace/WARD/11/billing');
        await userEvent.selectOptions(await screen.findByRole('combobox', {name: '이용할 상품'}), 'CAPACITY');

        const input = screen.getByRole('spinbutton', {name: '변경 후 총 편성 인원'});

        expect(input).toHaveValue(50);
        expect(input).toHaveAttribute('min', '40');
        await userEvent.click(screen.getByRole('button', {name: '정확한 금액 확인'}));
        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith(
                '/billing-scopes/ward-scope/quotes',
                expect.objectContaining({purpose: 'CAPACITY', capacity: 50}),
            ),
        );
    });
});
