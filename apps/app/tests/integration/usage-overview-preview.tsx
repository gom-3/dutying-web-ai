import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import i18n from '../../src/i18n';
import type {Entitlement, Scope} from '../../src/features/commercial/api';
import {UsageOverview} from '../../src/pages/workspace/usage-overview';
import '../../src/index.css';
import '../../src/pages/workspace/workspace.css';
import '../../src/pages/ward-billing/ward-billing.css';

// Synthetic data only. This preview never reads or changes a real subscription.
const params = new URLSearchParams(location.search);
void i18n.changeLanguage(params.get('lang') ?? 'ko');
if (params.get('textScale') === '200') document.documentElement.style.fontSize = '200%';
const ko = i18n.language.startsWith('ko');
const scope: Scope = {type: 'WARD', ref: 'preview', scopeId: 'preview-scope', name: '예시 병동', role: 'OWNER'};

function Preview() {
    const [state, setState] = useState(params.get('state') ?? 'unlimited');
    const limited = state !== 'unlimited';
    const empty = state === 'empty';
    const over = state === 'over';
    const hospital = state === 'hospital';
    const selectedScope = hospital ? {...scope, type: 'HOSPITAL' as const} : scope;
    const entitlement = {
        plan: hospital ? 'HOSPITAL' : state === 'plus' ? 'PLUS' : 'FREE',
        entitlementSource: 'FREE',
        canManageBilling: !hospital,
        capacity: {used: over ? 35 : 11, purchased: 30, overLimit: over},
        adminSeats: {active: 1, reserved: limited ? 1 : 0, limit: 3},
        restrictionStates: {ADMIN_SEATS: limited},
        promotion: null,
        usage:
            state === 'missing'
                ? []
                : [
                      {
                          meter: 'AI_FILL',
                          enforced: limited,
                          granted: 3,
                          used: empty ? 2 : limited ? 1 : 0,
                          reserved: limited ? 1 : 0,
                          remaining: empty ? 0 : limited ? 1 : 3,
                          lots: [
                              {id: 'base', source: 'FREE', available: empty ? 0 : limited ? 1 : 3, expiresAt: null},
                              ...(state === 'plus'
                                  ? [{id: 'pack', source: 'PURCHASE', available: 10, expiresAt: '2027-11-14T15:00:00Z'}]
                                  : []),
                          ],
                      },
                  ],
    } as Entitlement;

    if (state === 'plus') {
        entitlement.usage[0] = {...entitlement.usage[0], remaining: 11, granted: 13};
    }

    return (
        <MemoryRouter>
            <main className="ward-billing-page workspace-app">
                <div className="usage-preview-controls">
                    <span>{ko ? '로컬 UI 미리보기 · 예시 데이터' : 'Local UI preview · Sample data'}</span>
                    <label>
                        {ko ? '화면 상태' : 'State'}
                        <select value={state} onChange={(event) => setState(event.target.value)}>
                            <option value="unlimited">{ko ? '횟수 제한 해제' : 'Limit disabled'}</option>
                            <option value="limited">{ko ? '기본 제공 횟수' : 'Limited allowance'}</option>
                            <option value="plus">{ko ? 'Plus · 추가 구매' : 'Plus · Purchased uses'}</option>
                            <option value="empty">{ko ? '횟수 소진' : 'No available uses'}</option>
                            <option value="over">{ko ? '편성 인원 초과' : 'Staff over capacity'}</option>
                            <option value="hospital">{ko ? '병원 · 일반 관리자' : 'Hospital administrator'}</option>
                            <option value="missing">{ko ? '사용량 없음' : 'Usage unavailable'}</option>
                        </select>
                    </label>
                </div>
                <header className="ward-billing-page__header">
                    <p>{ko ? '예시 병동' : 'Sample ward'}</p>
                    <h1>{ko ? '요금제·결제' : 'Plans & billing'}</h1>
                </header>
                <UsageOverview scope={selectedScope} e={entitlement} billingPath={hospital ? undefined : '/billing/preview/subscription'} />
            </main>
        </MemoryRouter>
    );
}

createRoot(document.getElementById('root')!).render(<Preview />);
