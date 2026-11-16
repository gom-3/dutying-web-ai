import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {AxiosAdapter} from 'axios';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import type {TAccount} from '../../src/entities/account';
import useAuthStore from '../../src/features/auth/model/store';
import i18n from '../../src/i18n';
import RegisterNurse from '../../src/pages/register/ui/register-nurse';
import RegisterShell from '../../src/pages/register/ui/register-shell';
import axiosInstance, {adminAxiosInstance} from '../../src/shared/api/client';
import {getDefaultServiceRegionForLanguage, normalizePreferredLanguage} from '../../src/shared/i18n/locale';
import '../../src/index.css';

const language = new URLSearchParams(location.search).get('lng') ?? 'ja';

await i18n.changeLanguage(language);

let account = {
    accountId: 990001,
    name: '',
    phoneNum: '',
    status: 'WORKSPACE_SETUP_PENDING',
    wardId: null,
    nurseId: null,
    preferredLanguage: normalizePreferredLanguage(language),
    serviceRegion: getDefaultServiceRegionForLanguage(language),
} as unknown as TAccount;
const submissions: unknown[] = [];

// Real UI and submit hooks with in-memory session/API fixtures only.
// This entry point never reads or writes a saved login or sends API requests.
useAuthStore.persist.setOptions({storage: {getItem: () => null, setItem: () => {}, removeItem: () => {}}});
useAuthStore.setState({accountId: account.accountId, accountMe: account, accountMeStatus: 'success', accessToken: null, _loaded: true});

const adapter: AxiosAdapter = async (config) => {
    if (!['/admin/accounts/me', '/admin/accounts/me/v2'].includes(config.url ?? '') || !['get', 'patch'].includes(config.method ?? '')) {
        throw new Error(`Unexpected preview request: ${config.method} ${config.url}`);
    }

    if (config.method === 'patch') {
        const profile = JSON.parse(config.data as string);

        submissions.push(profile);
        account = {...account, ...profile};
    }

    return {data: account, status: 200, statusText: 'OK', config, headers: {}};
};

axiosInstance.defaults.adapter = adapter;
adminAxiosInstance.defaults.adapter = adapter;
Object.assign(window, {onboardingReview: {submissions}});

createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter>
            <RegisterShell>
                <RegisterNurse />
            </RegisterShell>
        </MemoryRouter>
    </QueryClientProvider>,
);
