import type {TCreateWardDTO} from '@/shared/api/ward/type';
import {buildCreateWardPayload, buildMockCreateWardPayload, type TMockCreateWardPayload} from './adapter';
import type {TOnboardingWardDraft} from './model';

export type TOnboardingWardCreateSubmission = {
    mode: 'mock';
    wardCreatePayload: TCreateWardDTO;
    previewPayload: TMockCreateWardPayload;
    successMessage: string;
};

export type TOnboardingWardCreateExecutor = (draft: TOnboardingWardDraft) => Promise<TOnboardingWardCreateSubmission>;

export const mockOnboardingWardCreateExecutor: TOnboardingWardCreateExecutor = async (draft) => ({
    mode: 'mock',
    wardCreatePayload: buildCreateWardPayload(draft),
    previewPayload: buildMockCreateWardPayload(draft),
    successMessage: 'mock 병동 생성 payload를 만들었습니다.',
});

export const onboardingWardCreateExecutor = mockOnboardingWardCreateExecutor;
