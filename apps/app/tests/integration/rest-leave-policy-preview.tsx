import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {AxiosAdapter} from 'axios';
import {createRoot} from 'react-dom/client';
import {Toaster} from 'react-hot-toast';
import i18n from '@/i18n';
import {
    DEFAULT_REST_LEAVE_POLICY,
    restLeavePolicyQueryKey,
    type TRestLeavePolicyResponse,
} from '@/pages/ward-settings/model/rest-leave-policy';
import type {TWardSettingsShiftType} from '@/pages/ward-settings/model/ward-settings-hook';
import {RestLeavePolicySection} from '@/pages/ward-settings/ui/rest-leave-policy-section';
import client from '@/shared/api/client';
import '@/index.css';

// Synthetic local fixture. All policy requests terminate in this adapter and never reach a server.
const params = new URLSearchParams(location.search);
const language = params.get('lang') ?? 'ko';
const requestedWidth = Number(params.get('width'));
const previewWidth = Number.isFinite(requestedWidth) && requestedWidth > 0 ? Math.max(320, Math.min(1800, requestedWidth)) : 1008;
let policy: TRestLeavePolicyResponse = {
    ...DEFAULT_REST_LEAVE_POLICY,
    wardId: 1000001,
    persisted: true,
    version: 1,
    enabled: true,
    targetMode: 'weekly',
    weeklyOffDays: 2,
    includeHolidays: true,
    holidayCountry: 'KR',
    holidayRegion: null,
};
const shiftTypes: TWardSettingsShiftType[] = [
    {wardShiftTypeId: 1, name: '일반 휴무', shortName: 'O', color: '#7F8A9C', classification: 'OFF'},
    {wardShiftTypeId: 2, name: '연차', shortName: 'A', color: '#6A9D8F', classification: 'ANNUAL_LEAVE'},
    {wardShiftTypeId: 3, name: '기타 휴무', shortName: 'L', color: '#9B8ABE', classification: 'OTHER_LEAVE'},
].map((shiftType) => ({
    ...shiftType,
    startTime: '',
    endTime: '',
    isDefault: false,
    isOff: true,
    isCounted: true,
})) as TWardSettingsShiftType[];

const adapter: AxiosAdapter = async (config) => {
    if (config.url !== `/wards/${policy.wardId}/rest-leave-policy`) throw new Error(`Unexpected preview request: ${config.url}`);

    if (config.method?.toLowerCase() === 'put') {
        const draft = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        policy = {...policy, ...draft, wardId: policy.wardId, persisted: true, version: policy.version + 1};
    }

    return {data: {...policy}, status: 200, statusText: 'OK', headers: {}, config};
};
client.defaults.adapter = adapter;
const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
queryClient.setQueryData(restLeavePolicyQueryKey(policy.wardId), {...policy});

function Preview() {
    return (
        <main className="mx-auto min-h-screen max-w-full bg-[#F6F7F9] px-6 py-8 text-sub-1" style={{width: previewWidth}}>
            <div className="mx-auto w-full max-w-[960px]">
                <p className="font-apple text-xs font-medium text-gray-3">로컬 UI 미리보기 · 예시 병동</p>
                <h1 className="mt-2 mb-6 font-apple text-2xl font-semibold">{i18n.t('page.wardSettings.tabs.restLeavePolicy')}</h1>
                <RestLeavePolicySection wardId={policy.wardId} shiftTypes={shiftTypes} />
            </div>
            <Toaster />
        </main>
    );
}

void i18n.changeLanguage(language).then(() => {
    document.documentElement.lang = language;
    createRoot(document.getElementById('root')!).render(
        <QueryClientProvider client={queryClient}>
            <Preview />
        </QueryClientProvider>,
    );
});
