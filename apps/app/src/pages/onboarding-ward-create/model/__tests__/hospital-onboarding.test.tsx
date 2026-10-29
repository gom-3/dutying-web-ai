import type {TCreateWardDTO, TWardResponse} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, renderHook} from '@testing-library/react';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {adminAxiosInstance} from '@/shared/api/client';
import type * as ApiClient from '@/shared/api/client';
import {hospitalOnboardingApi} from '../hospital-onboarding-api';
import {useHospitalOnboardingActions} from '../use-hospital-onboarding-actions';

vi.mock('@/shared/api/client', async (original) => ({
    ...(await original<typeof ApiClient>()),
    adminAxiosInstance: {get: vi.fn(), post: vi.fn(), patch: vi.fn()},
}));
vi.mock('@/shared/api/ward', () => ({AdminWardAPI: {previewOnboardingScheduleInput: vi.fn()}}));

const ward = {
    wardId: 42,
    name: '중환자실',
    hospitalName: '서울병원',
    code: 'ABC123',
    shiftTeams: [],
    wardShiftTypes: [],
} as unknown as TWardResponse;
const payload: TCreateWardDTO = {name: '중환자실', hospitalName: '서울병원', wardShiftTypes: [], shiftTeams: []};
const base = '/admin/commercial/organizations/hospital-1';

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAxiosInstance.post).mockResolvedValue({data: ward});
});

describe('hospital onboarding scope', () => {
    it('creates, restores, saves and completes through the same hospital scope', async () => {
        const draftPayload = {draft: {wardName: '중환자실'}};
        const draft = {ward, draftPayload};

        vi.mocked(adminAxiosInstance.get).mockResolvedValue({data: draft});
        vi.mocked(adminAxiosInstance.patch).mockResolvedValue({data: draft});

        await hospitalOnboardingApi.createDraft('hospital-1', {name: payload.name, hospitalName: payload.hospitalName, draftPayload});
        expect(await hospitalOnboardingApi.getCurrentDraft('hospital-1')).toEqual(draft);
        await hospitalOnboardingApi.saveDraft('hospital-1', 42, {draftPayload});
        await hospitalOnboardingApi.completeDraft('hospital-1', 42, payload);

        expect(adminAxiosInstance.post).toHaveBeenNthCalledWith(1, `${base}/onboarding/drafts`, {
            name: payload.name,
            hospitalName: payload.hospitalName,
            draftPayload,
        });
        expect(adminAxiosInstance.get).toHaveBeenCalledWith(`${base}/onboarding/drafts/current`);
        expect(adminAxiosInstance.patch).toHaveBeenCalledWith(`${base}/wards/42/onboarding/draft`, {draftPayload});
        expect(adminAxiosInstance.post).toHaveBeenNthCalledWith(2, `${base}/wards/42/onboarding/complete`, payload);
    });

    it('treats an empty current draft response as a new hospital ward flow', async () => {
        vi.mocked(adminAxiosInstance.get).mockResolvedValue({data: ''});

        expect(await hospitalOnboardingApi.getCurrentDraft('hospital-1')).toBeNull();
    });

    it('preserves the shared ward payload rules for off shifts when completing hospital setup', async () => {
        await hospitalOnboardingApi.completeDraft('hospital-1', 42, {
            ...payload,
            wardShiftTypes: [
                {
                    name: '오프',
                    shortName: 'O',
                    color: '#465B7A',
                    isOff: true,
                    isDefault: true,
                    isCounted: false,
                    classification: 'OTHER_WORK',
                    rotationSystem: 'THREE',
                    paidMinutes: 480,
                    startTime: '09:00',
                    endTime: '18:00',
                },
            ],
        });

        expect(adminAxiosInstance.post).toHaveBeenCalledWith(
            `${base}/wards/42/onboarding/complete`,
            expect.objectContaining({
                wardShiftTypes: [
                    expect.objectContaining({
                        classification: 'OTHER_LEAVE',
                        rotationSystem: 'NONE',
                        paidMinutes: null,
                        startTime: null,
                        endTime: null,
                    }),
                ],
            }),
        );
    });

    it('finishes a new ward even when the account already has another ward', async () => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        const {result} = renderHook(() => useHospitalOnboardingActions('hospital-1'), {wrapper});

        await act(async () => {
            expect(await result.current!.completeOnboardingWardDraft(42, payload, {navigateOnLinked: false})).toEqual(ward);
        });

        expect(adminAxiosInstance.post).toHaveBeenCalledWith(`${base}/wards/42/onboarding/complete`, payload);
        expect(invalidate).toHaveBeenCalledWith({queryKey: ['commercial']});
    });

    it('leaves independent ward onboarding on the original actions', () => {
        const client = new QueryClient();
        const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        const {result} = renderHook(() => useHospitalOnboardingActions(undefined), {wrapper});

        expect(result.current).toBeUndefined();
        expect(adminAxiosInstance.post).not.toHaveBeenCalled();
    });
});
