import {
    type TCreateOnboardingWardDraftDTO,
    type TCreateWardDTO,
    type TOnboardingWardDraftResponse,
    type TUpdateOnboardingWardDraftDTO,
    type TWardResponse,
} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback} from 'react';
import {useNavigate} from 'react-router';
import {type TAccount} from '@/entities/account';
import {accountQueryOptions} from '@/entities/account/model/queries';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {toAccountCompatibleAdminMe} from '@/features/auth/model/admin-account';
import useLoadingUseCase from '@/features/loading';
import useTutorialUseCase from '@/features/tutorial';
import {AccountAPI, AdminAPI, WardAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import {showActionErrorFeedback} from '@/shared/util/feedback';

type TChangeAccountStatusOptions = {
    navigateOnLinked?: boolean;
};

type TCreateWardOptions = {
    navigateOnLinked?: boolean;
};

const getIsWorkspaceSetupPending = (account: TAccount | null) => (account?.status as string | undefined) === 'WORKSPACE_SETUP_PENDING';
const getLinkedWardId = (account: TAccount | null) => (account?.status === 'LINKED' ? (account.wardId ?? undefined) : undefined);
const useRegister = () => {
    const {
        state: {accountMe, accountId},
        actions: {handleGetAccountMe, applyAccountMe},
    } = useAuth();
    const {initTutorial} = useTutorialUseCase();
    const {setLoading} = useLoadingUseCase();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const cacheCreatedWard = useCallback(
        (ward: TWardResponse | undefined) => {
            if (!ward?.wardId) return;

            queryClient.setQueryData(wardQueryKeys.id(ward.wardId), ward);
            queryClient.setQueryData(wardQueryKeys.shiftTeams(ward.wardId), ward.shiftTeams);
            void queryClient.invalidateQueries({queryKey: wardQueryKeys.id(ward.wardId)});
            void queryClient.invalidateQueries({queryKey: wardQueryKeys.shiftTeams(ward.wardId)});
        },
        [queryClient],
    );
    const changeAccountStatus = useCallback(
        async ({accountId, status, options}: {accountId: number; status: TAccount['status']; options?: TChangeAccountStatusOptions}) => {
            try {
                const updatedAccount = await AccountAPI.editAccountStatus(accountId, status);

                applyAccountMe(updatedAccount);
                void handleGetAccountMe().catch(() => undefined);

                if (updatedAccount.status === 'LINKED' && options?.navigateOnLinked !== false) {
                    navigate(ROUTE.MAKE);
                }

                return updatedAccount;
            } catch (error) {
                showActionErrorFeedback(error, '계정 상태를 변경하지 못했어요.');
                throw new Error('Failed to change account status.');
            }
        },
        [applyAccountMe, handleGetAccountMe, navigate],
    );
    const createWard = useCallback(
        async (createWardDTO: TCreateWardDTO, options?: TCreateWardOptions) => {
            setLoading(true);

            try {
                const linkedWardId = getLinkedWardId(accountMe);

                if (linkedWardId) {
                    const existingWard = await WardAPI.getWard(linkedWardId).catch(() => undefined);

                    initTutorial();
                    cacheCreatedWard(existingWard);

                    if (options?.navigateOnLinked !== false) {
                        navigate(ROUTE.MAKE);
                    }

                    return existingWard;
                }

                const createdWard = await WardAPI.createWard(createWardDTO);

                initTutorial();

                if (accountMe) {
                    applyAccountMe({
                        ...accountMe,
                        wardId: createdWard.wardId,
                        status: 'LINKED',
                    });
                }

                cacheCreatedWard(createdWard);

                if (options?.navigateOnLinked !== false) {
                    navigate(ROUTE.MAKE);
                }

                if (!accountMe) {
                    void handleGetAccountMe().catch(() => undefined);
                }

                return createdWard;
            } finally {
                setLoading(false);
            }
        },
        [accountMe, applyAccountMe, cacheCreatedWard, handleGetAccountMe, initTutorial, navigate, setLoading],
    );
    const createOnboardingWardDraft = useCallback(
        async (draftDTO: TCreateOnboardingWardDraftDTO) => {
            setLoading(true);

            try {
                const draftWard = await WardAPI.createOnboardingWardDraft(draftDTO);

                cacheCreatedWard(draftWard);

                return draftWard;
            } finally {
                setLoading(false);
            }
        },
        [cacheCreatedWard, setLoading],
    );
    const getOnboardingWardDraft = useCallback(async (): Promise<TOnboardingWardDraftResponse | null> => {
        const draft = await WardAPI.getCurrentOnboardingWardDraft();

        cacheCreatedWard(draft?.ward);

        return draft;
    }, [cacheCreatedWard]);
    const saveOnboardingWardDraft = useCallback(
        async (wardId: number, draftDTO: TUpdateOnboardingWardDraftDTO): Promise<TOnboardingWardDraftResponse> => {
            const draft = await WardAPI.updateOnboardingWardDraft(wardId, draftDTO);

            cacheCreatedWard(draft.ward);

            return draft;
        },
        [cacheCreatedWard],
    );
    const completeOnboardingWardDraft = useCallback(
        async (wardId: number, createWardDTO: TCreateWardDTO, options?: TCreateWardOptions) => {
            setLoading(true);

            try {
                const linkedWardId = getLinkedWardId(accountMe);

                if (linkedWardId) {
                    const existingWard = await WardAPI.getWard(linkedWardId).catch(() => undefined);

                    initTutorial();
                    cacheCreatedWard(existingWard);

                    if (options?.navigateOnLinked !== false) {
                        navigate(ROUTE.MAKE);
                    }

                    return existingWard;
                }

                const createdWard = await WardAPI.completeOnboardingWardDraft(wardId, createWardDTO);

                initTutorial();

                if (accountMe) {
                    applyAccountMe({
                        ...accountMe,
                        wardId: createdWard.wardId,
                        status: 'LINKED',
                    });
                }

                cacheCreatedWard(createdWard);

                if (options?.navigateOnLinked !== false) {
                    navigate(ROUTE.MAKE);
                }

                if (!accountMe) {
                    void handleGetAccountMe().catch(() => undefined);
                }

                return createdWard;
            } finally {
                setLoading(false);
            }
        },
        [accountMe, applyAccountMe, cacheCreatedWard, handleGetAccountMe, initTutorial, navigate, setLoading],
    );
    const joinWardByCode = useCallback(
        async ({code}: {code: string}) => {
            setLoading(true);

            try {
                const result = await AdminAPI.joinWardByCode({code});
                const nextAccount = result.account;

                if (nextAccount) {
                    applyAccountMe(toAccountCompatibleAdminMe(nextAccount));
                } else {
                    void handleGetAccountMe().catch(() => undefined);
                }

                navigate(ROUTE.MAKE);

                return result;
            } finally {
                setLoading(false);
            }
        },
        [applyAccountMe, handleGetAccountMe, navigate, setLoading],
    );
    const enterWard = useCallback(
        async (wardId: number) => {
            setLoading(true);

            try {
                await WardAPI.addMeToWaitingNurses(wardId);

                if (!accountId) return;

                await changeAccountStatus({accountId, status: 'WARD_ENTRY_PENDING'});
                navigate(ROUTE.REGISTER);
            } finally {
                setLoading(false);
            }
        },
        [accountId, changeAccountStatus, navigate, setLoading],
    );
    const cancelWaiting = useCallback(
        async (wardId: number, nurseId: number) => {
            await WardAPI.deleteWaitingNurses(wardId, nurseId);

            if (!accountId) return;

            await changeAccountStatus({accountId, status: 'WARD_SELECT_PENDING'});
            navigate(ROUTE.REGISTER);
        },
        [accountId, changeAccountStatus, navigate],
    );
    const {data: accountWaitingWard} = useQuery({
        ...accountQueryOptions.waiting(),
        enabled: accountMe?.status === 'WARD_ENTRY_PENDING',
    });
    const registerAccountProfile = async (accountProfileDTO: {
        name: string;
        phoneNum: string;
        profileImg: {profileImgUrl?: string; defaultProfileImgId?: number};
    }) => {
        if (!accountId || !accountMe) return;

        setLoading(true);

        try {
            if (accountMe.status === 'WARD_SELECT_PENDING' || getIsWorkspaceSetupPending(accountMe)) {
                if (getIsWorkspaceSetupPending(accountMe)) {
                    const updatedAccount = await AdminAPI.updateMe({
                        name: accountProfileDTO.name,
                        phoneNum: accountProfileDTO.phoneNum,
                        ...accountProfileDTO.profileImg,
                    });

                    applyAccountMe(updatedAccount as TAccount);
                    void handleGetAccountMe().catch(() => undefined);

                    return;
                }

                await AccountAPI.editAccount({
                    accountId,
                    name: accountProfileDTO.name,
                    phoneNum: accountProfileDTO.phoneNum,
                    ...accountProfileDTO.profileImg,
                });
                await handleGetAccountMe();

                return;
            }

            if (accountMe.status === 'NURSE_INFO_PENDING' || accountMe.status === 'INITIAL') {
                // 모바일에서 계정 초기 등록을 이미 마친 경우 계정 정보를 수정한다.
                await AccountAPI.editAccount({
                    accountId,
                    name: accountProfileDTO.name,
                    phoneNum: accountProfileDTO.phoneNum,
                    ...accountProfileDTO.profileImg,
                });
            }

            await changeAccountStatus({accountId, status: 'WARD_SELECT_PENDING'});
        } finally {
            setLoading(false);
        }
    };

    return {
        state: {accountMe, accountWaitingWard},
        actions: {
            registerAccountProfile,
            createWard,
            createOnboardingWardDraft,
            getOnboardingWardDraft,
            saveOnboardingWardDraft,
            completeOnboardingWardDraft,
            joinWardByCode,
            enterWard,
            cancelWaiting,
        },
    };
};

export default useRegister;
