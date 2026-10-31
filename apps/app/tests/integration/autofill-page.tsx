/** Local synthetic account only. Mounts the real production parent, editor, toolbar, conversation and overlay. */
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Toaster} from 'react-hot-toast';
import useAuthStore from '@/features/auth/model/store';
import {useMakeShiftStore} from '@/pages/make-shift/model/make-shift-store';
import {AiAutofill} from '@/pages/make-shift/ui/steps/ai-auto-fill';
import client from '@/shared/api/client';
import WardAPI from '@/shared/api/ward';
import i18n from '@/i18n';
import '@/index.css';

void i18n.changeLanguage('ko');
const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
function Page() {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        void (async () => {
            const {data: setup} = await client.get('/__conversation-test/setup');
            const {data: login} = await client.post('/auth/admin/password/login', {email: setup.email, password: setup.password});
            useAuthStore.getState().beginLogin(login.accessToken);
            useAuthStore.setState({accountId: login.account.adminAccountId, wardId: setup.wardId});
            const teams = await WardAPI.getShiftTeams(setup.wardId);
            useMakeShiftStore.setState({wardId: setup.wardId, currentShiftTeamId: setup.teamId, year: setup.year, month: setup.month, shiftTeams: teams, shiftTeamsStatus: 'success', isHydrated: true, phase: 'stepping', currentStep: 4, maxReachedStep: 4});
            setReady(true);
        })().catch((e) => setError(e.message));
    }, []);
    if (!ready) return <p role="status">{error || '로컬 합성 계정으로 실제 페이지를 여는 중'}</p>;
    return <main className="min-h-dvh bg-white p-6"><p className="mb-4 text-xs text-gray-3">로컬 합성 병동 · 운영 데이터 미사용</p><h1 className="mb-4 text-xl font-semibold">2026년 10월 근무표</h1><AiAutofill /><Toaster /></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/make']}><Page /></MemoryRouter></QueryClientProvider>);
