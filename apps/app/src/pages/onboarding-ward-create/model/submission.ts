import type {TCreateWardDTO, TWardResponse} from '@dutying/api/ward';
import {buildCreateWardPayload} from './adapter';
import type {TOnboardingWardDraft} from './draft';

export type TOnboardingWardCreateSubmission = {
    mode: 'created';
    successMessage: string;
    ward?: TWardResponse;
};

export type TOnboardingWardCreateAction = (
    createWardDTO: TCreateWardDTO,
    options?: {
        navigateOnLinked?: boolean;
    },
) => Promise<TWardResponse | void>;

export type TOnboardingWardCompleteDraftAction = (
    wardId: number,
    createWardDTO: TCreateWardDTO,
    options?: {
        navigateOnLinked?: boolean;
    },
) => Promise<TWardResponse | void>;

export type TOnboardingWardCreateExecutor = (draft: TOnboardingWardDraft) => Promise<TOnboardingWardCreateSubmission>;

export const createOnboardingWardCreateExecutor =
    (
        createWard: TOnboardingWardCreateAction,
        completeOnboardingWardDraft?: TOnboardingWardCompleteDraftAction,
        draftWardId?: number | null,
    ): TOnboardingWardCreateExecutor =>
    async (draft) => {
        const wardCreatePayload = buildCreateWardPayload(draft);
        const ward =
            draftWardId && completeOnboardingWardDraft
                ? await completeOnboardingWardDraft(draftWardId, wardCreatePayload, {navigateOnLinked: false})
                : await createWard(wardCreatePayload, {navigateOnLinked: false});

        return {
            mode: 'created',
            successMessage: '병동 생성을 완료했어요.',
            ward: ward ?? undefined,
        };
    };
