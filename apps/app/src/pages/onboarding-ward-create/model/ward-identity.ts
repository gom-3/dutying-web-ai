import {WARD_NAME_MAX_LENGTH} from '@/shared/lib/ward-name';
import type {TOnboardingWardDraft} from './draft';

export const buildOnboardingWardIdentityPayload = (
    draft: Pick<TOnboardingWardDraft, 'wardName' | 'hospitalName' | 'hospitalId' | 'rotationMode'>,
    fallbackWardName: string,
) => {
    const hospitalName = draft.hospitalName.trim();
    const wardName = draft.wardName.trim();

    return {
        // Preserve the full hospital name without exceeding the ward-name limit
        // when the optional ward name is omitted.
        name: wardName || (hospitalName.length <= WARD_NAME_MAX_LENGTH ? hospitalName : '') || fallbackWardName,
        ...(typeof draft.hospitalId === 'number' ? {hospitalId: draft.hospitalId} : {}),
        hospitalName: hospitalName || wardName || fallbackWardName,
        rotationMode: draft.rotationMode,
    };
};
