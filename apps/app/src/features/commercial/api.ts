import {adminAxiosInstance} from '@/shared/api/client';

export type TCommercialPlanCode = 'FREE' | 'PLUS' | 'HOSPITAL';

export type TCommercialPlan = {
    planCode: TCommercialPlanCode;
    displayName: string;
    monthlyPrice: number;
    includedStaff: number;
    fullGenerateLimit: number;
    partialAdjustLimit: number;
};

export type TCommercialUsage = {
    scopeType: 'WARD' | 'HOSPITAL';
    scopeRef: number;
    planCode: TCommercialPlanCode;
    status: 'ACTIVE' | 'INACTIVE';
    capacity: number;
    includedStaff: number;
    fullGenerateLimit: number;
    partialAdjustLimit: number;
    fullGenerateUsed: number;
    partialAdjustUsed: number;
    usageMonth: string;
};

const ROOT = '/admin/commercial';

export const commercialQueryKeys = {
    plans: ['commercial', 'plans'] as const,
    usage: (wardId: number) => ['commercial', 'wards', wardId, 'usage'] as const,
};

export const CommercialAPI = {
    getPlans: async () => (await adminAxiosInstance.get<TCommercialPlan[]>(`${ROOT}/plans`, {suppressErrorToast: true})).data,
    getWardUsage: async (wardId: number) =>
        (await adminAxiosInstance.get<TCommercialUsage>(`${ROOT}/wards/${wardId}/usage`, {suppressErrorToast: true})).data,
    applyDevelopmentPlan: async (wardId: number, planCode: TCommercialPlanCode) =>
        (await adminAxiosInstance.put<TCommercialUsage>(`${ROOT}/wards/${wardId}/plan`, {planCode}, {suppressErrorToast: true})).data,
};
