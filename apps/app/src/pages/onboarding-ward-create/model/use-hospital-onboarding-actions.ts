import type {TCreateWardDTO, TWardResponse} from '@dutying/api/ward';
import {useQueryClient} from '@tanstack/react-query';
import {useMemo} from 'react';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import {AdminWardAPI} from '@/shared/api/ward';
import {hospitalOnboardingApi} from './hospital-onboarding-api';
import type {TOnboardingWardWizardActions} from './use-onboarding-ward-wizard';

export function useHospitalOnboardingActions(organizationId: string | undefined) {
    const queryClient = useQueryClient();

    return useMemo<TOnboardingWardWizardActions | undefined>(() => {
        if (!organizationId) return undefined;

        const cacheWard = (ward: TWardResponse) => {
            queryClient.setQueryData(wardQueryKeys.id(ward.wardId), ward);
            queryClient.setQueryData(wardQueryKeys.shiftTeams(ward.wardId), ward.shiftTeams);

            return ward;
        };
        const completeDraft = async (wardId: number, payload: TCreateWardDTO) => {
            const ward = cacheWard(await hospitalOnboardingApi.completeDraft(organizationId, wardId, payload));

            await queryClient.cancelQueries({queryKey: ['commercial']});
            await queryClient.invalidateQueries({queryKey: ['commercial']});

            return ward;
        };

        return {
            createWard: async (payload) => {
                const draft = await hospitalOnboardingApi.createDraft(organizationId, {
                    name: payload.name,
                    hospitalName: payload.hospitalName,
                    ...(payload.hospitalId ? {hospitalId: payload.hospitalId} : {}),
                    rotationMode: payload.rotationMode,
                });

                return completeDraft(draft.wardId, payload);
            },
            createOnboardingWardDraft: async (payload) => cacheWard(await hospitalOnboardingApi.createDraft(organizationId, payload)),
            getOnboardingWardDraft: () => hospitalOnboardingApi.getCurrentDraft(organizationId),
            saveOnboardingWardDraft: (wardId, payload) => hospitalOnboardingApi.saveDraft(organizationId, wardId, payload),
            previewOnboardingScheduleInput: (payload) => AdminWardAPI.previewOnboardingScheduleInput(payload),
            completeOnboardingWardDraft: completeDraft,
        };
    }, [organizationId, queryClient]);
}
