import type {
    TCreateOnboardingWardDraftDTO,
    TCreateWardDTO,
    TOnboardingWardDraftResponse,
    TUpdateOnboardingWardDraftDTO,
} from '@dutying/api/ward';
import {createWardApi} from '@dutying/api/ward';
import {adminAxiosInstance} from '@/shared/api/client';

const organizationPath = (organizationId: string) => `/admin/commercial/organizations/${encodeURIComponent(organizationId)}`;
const organizationApi = (organizationId: string) => createWardApi(adminAxiosInstance, {basePath: organizationPath(organizationId)});
const organizationWardApi = (organizationId: string) =>
    createWardApi(adminAxiosInstance, {basePath: `${organizationPath(organizationId)}/wards`});

export const hospitalOnboardingApi = {
    createDraft: async (organizationId: string, payload: TCreateOnboardingWardDraftDTO) =>
        organizationApi(organizationId).createOnboardingWardDraft(payload),
    getCurrentDraft: async (organizationId: string): Promise<TOnboardingWardDraftResponse | null> =>
        organizationApi(organizationId).getCurrentOnboardingWardDraft(),
    saveDraft: async (organizationId: string, wardId: number, payload: TUpdateOnboardingWardDraftDTO) =>
        organizationWardApi(organizationId).updateOnboardingWardDraft(wardId, payload),
    completeDraft: async (organizationId: string, wardId: number, payload: TCreateWardDTO) =>
        organizationWardApi(organizationId).completeOnboardingWardDraft(wardId, payload),
};
