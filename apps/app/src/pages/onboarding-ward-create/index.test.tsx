import type {TWardResponse} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {type ReactNode, useEffect, useState} from 'react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '@/i18n';
import type {AccessContext} from '@/features/commercial/api';
import type * as WizardModel from './model';
import {createInitialDraft} from './model/draft';
import {hospitalOnboardingApi} from './model/hospital-onboarding-api';
import type * as HospitalActions from './model/use-hospital-onboarding-actions';
import OnboardingWardCreatePage from './index';

const mocks = vi.hoisted(() => ({
    context: {enabled: true, scopes: []} as AccessContext,
    contextError: false,
    wizard: vi.fn(),
    hospitalActions: vi.fn(),
    refresh: vi.fn(),
    status: 'idle',
    restoreStatus: 'ready',
}));

vi.mock('@/features/commercial/api', () => ({
    useCommercialContext: () => ({data: mocks.context, isPending: false, isFetching: false, isError: mocks.contextError}),
}));
vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {accountMe: {status: 'LINKED', wardId: 9, serviceRegion: 'KR'}},
        actions: {handleGetAccountMe: mocks.refresh},
    }),
}));
vi.mock('@/shared/config/feature-flags', () => ({isOnboardingWardCreatePreviewAllowed: () => false}));
vi.mock('./model', async (original) => ({
    ...(await original<typeof WizardModel>()),
    useOnboardingWardWizard: (...args: unknown[]) => mocks.wizard(...args),
}));
vi.mock('./model/use-hospital-onboarding-actions', () => ({
    useHospitalOnboardingActions: (...args: unknown[]) => mocks.hospitalActions(...args),
}));
vi.mock('./ui/steps/ward-identity-step', () => ({default: () => <div>병동 기본 정보 입력</div>}));
vi.mock('./ui/onboarding-nurse-order-tutorial', () => ({default: () => null}));

function Location() {
    const location = useLocation();

    return <output aria-label="current route">{location.pathname + location.search}</output>;
}

function SimulatedAuthLayout({children, loadingOnRefresh}: {children: ReactNode; loadingOnRefresh: boolean}) {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (loadingOnRefresh) {
            mocks.refresh.mockImplementation(async () => {
                setLoading(true);
            });
        }
    }, [loadingOnRefresh]);

    return loading ? <div>Account refreshing</div> : children;
}

function mount(path = '/onboarding/ward-create?organizationId=hospital-1', loadingOnRefresh = false) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route
                        path="/onboarding/ward-create"
                        element={
                            <SimulatedAuthLayout loadingOnRefresh={loadingOnRefresh}>
                                <OnboardingWardCreatePage />
                            </SimulatedAuthLayout>
                        }
                    />
                    <Route path="*" element={<div>Destination</div>} />
                </Routes>
                <Location />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

function wizardState(status = mocks.status) {
    const draft = createInitialDraft();

    return {
        draft,
        activeTeamId: draft.teams[0].id,
        sortMode: 'manual',
        createdWard: status === 'success' ? {wardId: 42, code: 'ABC123'} : null,
        submissionStatus: status,
        draftCreationStatus: 'idle',
        draftRestoreStatus: mocks.restoreStatus,
        retryDraftRestore: vi.fn(),
        canGoNext: true,
        canComplete: true,
        currentStepValidation: {issues: []},
        completionValidationIssues: [],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    mocks.hospitalActions.mockReset();
    mocks.status = 'idle';
    mocks.restoreStatus = 'ready';
    mocks.contextError = false;
    mocks.context = {
        enabled: true,
        configurationReady: false,
        scopes: [{type: 'HOSPITAL', ref: 'hospital-1', scopeId: 'scope-1', name: '서울병원', role: 'OWNER'}],
    };
    mocks.wizard.mockImplementation(() => wizardState());
    window.sessionStorage.clear();
});

afterEach(cleanup);

describe('hospital ward setup entry', () => {
    it('keeps an existing ward owner in the hospital setup flow and explains automatic affiliation', () => {
        mount();

        expect(screen.getByText('서울병원에 새 병동 추가')).toBeInTheDocument();
        expect(screen.getByText(/설정을 마치면 이 병원에 자동으로 연결됩니다/)).toBeInTheDocument();
        expect(screen.getByLabelText('current route')).toHaveTextContent('/onboarding/ward-create?organizationId=hospital-1');
        expect(mocks.hospitalActions).toHaveBeenCalledWith('hospital-1');
        expect(mocks.wizard).toHaveBeenCalledWith(expect.objectContaining({initialHospitalName: '서울병원'}));
    });

    it('returns to the source hospital from the first setup step', async () => {
        mount();

        await userEvent.click(screen.getByRole('button', {name: '병원 관리로 돌아가기'}));

        expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/hospital-1/overview');
    });

    it('returns a completed ward to the hospital invitation step without opening a schedule', async () => {
        mocks.status = 'success';
        mount();

        await waitFor(() =>
            expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/hospital-1/overview?createdWardId=42'),
        );
        expect(window.sessionStorage.getItem('dutying:onboardingWardCreatedGuide')).toBeNull();
    });

    it('navigates before account loading unmounts the completed wizard', async () => {
        const actualActions = await vi.importActual<typeof HospitalActions>('./model/use-hospital-onboarding-actions');
        const complete = vi.spyOn(hospitalOnboardingApi, 'completeDraft').mockResolvedValue({
            wardId: 42,
            code: 'ABC123',
            shiftTeams: [],
        } as unknown as TWardResponse);

        mocks.hospitalActions.mockImplementation(actualActions.useHospitalOnboardingActions);
        mocks.wizard.mockImplementation(function useCompletionState(options: Parameters<typeof WizardModel.useOnboardingWardWizard>[0]) {
            const [status, setStatus] = useState('idle');

            useEffect(() => {
                void options!
                    .actions!.completeOnboardingWardDraft(42, {
                        name: '중환자실',
                        hospitalName: '서울병원',
                        wardShiftTypes: [],
                        shiftTeams: [],
                    })
                    .then(() => setStatus('success'));
            }, [options?.actions]);

            return wizardState(status);
        });
        mount('/onboarding/ward-create?organizationId=hospital-1', true);

        await waitFor(() =>
            expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/hospital-1/overview?createdWardId=42'),
        );
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(screen.getByText('Destination')).toBeInTheDocument();
        complete.mockRestore();
    });

    it('keeps the completed destination when the subsequent account refresh fails', async () => {
        mocks.status = 'success';
        mocks.refresh.mockRejectedValueOnce(new Error('network'));
        mount();

        await waitFor(() =>
            expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/hospital-1/overview?createdWardId=42'),
        );
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it.each(['MANAGER', 'EDITOR'] as const)('blocks the %s role before opening a draft', (role) => {
        mocks.context.scopes[0].role = role;
        mount();

        expect(screen.getByRole('heading', {name: '병원 최고 관리자만 병동을 만들 수 있어요'})).toBeInTheDocument();
        expect(mocks.wizard).not.toHaveBeenCalled();
        expect(mocks.hospitalActions).not.toHaveBeenCalled();
    });

    it('does not let an unrelated hospital URL reuse the account current ward draft', () => {
        mount('/onboarding/ward-create?organizationId=other-hospital');

        expect(screen.getByRole('heading', {name: '병원 최고 관리자만 병동을 만들 수 있어요'})).toBeInTheDocument();
        expect(mocks.wizard).not.toHaveBeenCalled();
    });

    it('shows a recovery screen instead of editable empty fields when saved setup cannot be loaded', () => {
        mocks.restoreStatus = 'error';
        mount();

        expect(screen.getByRole('heading', {name: '병동 설정을 불러오지 못했어요'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '다시 불러오기'})).toBeInTheDocument();
        expect(screen.queryByText('병동 기본 정보 입력')).not.toBeInTheDocument();
    });

    it('preserves the normal linked-account guard outside hospital creation', async () => {
        mount('/onboarding/ward-create');

        await waitFor(() => expect(screen.getByLabelText('current route')).not.toHaveTextContent('/onboarding/ward-create'));
        expect(screen.queryByText(/새 병동 추가/)).not.toBeInTheDocument();
    });
});
