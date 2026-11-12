import {createRoot} from 'react-dom/client';
import {focusManager, QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router';
import i18n from '../../src/i18n';
import useAuthStore from '../../src/features/auth/model/store';
import {commercialQueryKey, type Entitlement, type Scope} from '../../src/features/commercial/api';
import {HospitalBilling} from '../../src/pages/workspace/hospital-billing';
import {HospitalWorkspaceShell} from '../../src/pages/workspace/hospital-workspace-shell';
import '../../src/index.css';

const params = new URLSearchParams(location.search);
const state = params.get('state');
void i18n.changeLanguage(params.get('lang') ?? 'ko');
focusManager.setEventListener(() => () => {});
const client = new QueryClient({defaultOptions: {queries: {staleTime: Infinity, retry: false}}});
const scope: Scope = {
    type: 'HOSPITAL',
    ref: 'preview-hospital',
    scopeId: 'preview-scope',
    name: '테스트병원',
    role: state === 'manager' ? 'MANAGER' : 'OWNER',
};
const accountId = useAuthStore.getState().accountId;
const entitlement = {
    configurationReady: state !== 'unconfigured',
    canManageBilling: true,
    capacity: {used: 40, purchased: 100, overLimit: false},
    scope: {periodStart: '2026-11-11T00:00:00', periodEnd: '2026-12-11T00:00:00'},
    usage: [
        {meter: 'FULL_GENERATE', remaining: 48, used: 10, reserved: 2, enforced: true},
        {meter: 'PARTIAL_ADJUST', remaining: 17, used: 3, reserved: 0, enforced: true},
    ],
} as Entitlement;
client.setQueryData(commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'overview'), {
    organization: {
        id: scope.ref,
        name: scope.name,
        adoptionStage: state === 'setup' ? 'READY' : 'QUOTED',
        contractHash: 'preview-contract',
        contractAcceptedAt: state === 'setup' || state === 'accepted' ? '2026-11-11T00:00:00' : undefined,
        quoteSnapshot:
            state === 'empty'
                ? undefined
                : JSON.stringify({
                      capacity: 100,
                      setupStaff: 40,
                      startsAt: '2026-11-11T00:00:00',
                      endsAt: '2027-11-11T00:00:00',
                      termsRef: params.has('long')
                          ? '테스트병원 간호부 통합 근무표 운영 및 AI 편성 서비스 도입 계약서 HOSPITAL-2026-001'
                          : '예시 계약서 H-2026-001',
                      paymentMode: 'PREPAID',
                  }),
    },
    contractEstimate: {monthlyGross: 149000, setupGross: 249000},
});
client.setQueryData(commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'billing'), {
    invoices:
        state === 'invoices'
            ? [
                  {
                      id: 'preview-invoice',
                      gross: 149000,
                      allocated: 100000,
                      refundedGross: 0,
                      status: 'PARTIAL',
                      periodStart: '2026-11-11T00:00:00',
                      periodEnd: '2026-12-11T00:00:00',
                      dueAt: '2026-11-18T00:00:00',
                  },
              ]
            : [],
    orders: [],
});

// Keep the actual contract component while preventing financial writes in this fixture.
document.addEventListener(
    'click',
    (event) => {
        if ((event.target as HTMLElement).closest('.hospital-billing-acceptance button')) {
            event.preventDefault();
            event.stopPropagation();
            alert('로컬 예시 화면입니다. 동의 버튼의 위치를 확인할 수 있습니다.');
        }
    },
    true,
);

createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workspace/HOSPITAL/preview-hospital/billing']}>
            <HospitalWorkspaceShell
                scope={scope}
                scopes={[scope]}
                tab="billing"
                accountId={accountId}
                accountName="테스트 관리자"
                busy={false}
                onSwitch={() => {}}
            >
                <p className="contract-preview-notice">
                    {i18n.language.startsWith('ko')
                        ? '로컬 예시 · 계약 금액과 인원은 화면 확인용 샘플입니다.'
                        : 'Local preview · Sample fees and staff counts.'}
                </p>
                <HospitalBilling scope={scope} e={entitlement} />
            </HospitalWorkspaceShell>
        </MemoryRouter>
    </QueryClientProvider>,
);
