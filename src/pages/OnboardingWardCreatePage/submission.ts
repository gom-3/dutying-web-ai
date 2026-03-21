import type {TCreateWardDTO} from '@/shared/api/ward/type';
import {buildCreateWardPayload, buildMockCreateWardPayload, type TMockCreateWardPayload} from './adapter';
import type {TOnboardingWardDraft} from './model';

export type TOnboardingWardCreateSubmission = {
    mode: 'created';
    wardCreatePayload: TCreateWardDTO;
    previewPayload: TMockCreateWardPayload;
    successMessage: string;
};

export type TOnboardingWardCreateAction = (
    createWardDTO: TCreateWardDTO,
    options?: {
        navigateOnLinked?: boolean;
    },
) => Promise<unknown>;

export type TOnboardingWardCreateExecutor = (draft: TOnboardingWardDraft) => Promise<TOnboardingWardCreateSubmission>;

export const createOnboardingWardCreateExecutor =
    (createWard: TOnboardingWardCreateAction): TOnboardingWardCreateExecutor =>
    async (draft) => {
        const wardCreatePayload = buildCreateWardPayload(draft);

        await createWard(wardCreatePayload, {navigateOnLinked: false});

        return {
            mode: 'created',
            wardCreatePayload,
            previewPayload: buildMockCreateWardPayload(draft),
            successMessage: '병동 생성을 완료했어요.',
        };
    };
