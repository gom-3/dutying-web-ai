import {type TCreateWardDTO, type TWardResponse} from '@dutying/api/ward';
import {useQuery} from '@tanstack/react-query';
import {useCallback} from 'react';
import {useNavigate} from 'react-router';
import {type TAccount} from '@/entities/account';
import {accountQueryOptions} from '@/entities/account/model/queries';
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

type TAdminProfileSource = {
    name?: string | null;
    phoneNum?: string | null;
    profileImgUrl?: string | null;
};

const getWardIdFromAdminWorkspaceResponse = (response: Awaited<ReturnType<typeof AdminAPI.createWorkspace>>) => {
    if ('wardId' in response) return response.wardId ?? undefined;

    if ('ward' in response) return response.ward?.wardId;

    return undefined;
};
const isWardResponse = (response: Awaited<ReturnType<typeof AdminAPI.createWorkspace>>): response is TWardResponse =>
    'wardId' in response && 'code' in response && 'hospitalName' in response && 'nurseCnt' in response;
const getWardFromAdminWorkspaceResponse = (response: Awaited<ReturnType<typeof AdminAPI.createWorkspace>>): TWardResponse | undefined => {
    if ('ward' in response) return response.ward;

    if ('wardId' in response && !('status' in response)) return response as TWardResponse;

    if (isWardResponse(response)) return response;

    return undefined;
};
const getAccountFromAdminWorkspaceResponse = (response: Awaited<ReturnType<typeof AdminAPI.createWorkspace>>) => {
    if ('account' in response && response.account) return response.account;

    if ('adminAccountId' in response) return response;

    return null;
};
const getIsWorkspaceSetupPending = (account: TAccount | null) => (account?.status as string | undefined) === 'WORKSPACE_SETUP_PENDING';
const useRegister = () => {
    const {
        state: {accountMe, accountId},
        actions: {handleGetAccountMe, applyAccountMe},
    } = useAuth();
    const {initTutorial} = useTutorialUseCase();
    const {setLoading} = useLoadingUseCase();
    const navigate = useNavigate();
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
                const accountProfile = accountMe as TAdminProfileSource | null;
                const createdWorkspace = await AdminAPI.createWorkspace({
                    hospitalName: createWardDTO.hospitalName,
                    wardName: createWardDTO.name,
                    adminName: accountProfile?.name ?? null,
                    phoneNum: accountProfile?.phoneNum ?? null,
                    profileImgUrl: accountProfile?.profileImgUrl ?? null,
                });
                const createdWard = getWardFromAdminWorkspaceResponse(createdWorkspace);
                const createdWardId = getWardIdFromAdminWorkspaceResponse(createdWorkspace);
                const createdAccount = getAccountFromAdminWorkspaceResponse(createdWorkspace);

                initTutorial();

                if (createdAccount) {
                    applyAccountMe(toAccountCompatibleAdminMe(createdAccount, createdWardId));
                } else if (accountMe) {
                    applyAccountMe({
                        ...accountMe,
                        wardId: createdWardId ?? accountMe.wardId,
                        status: 'LINKED',
                    });
                }

                if (options?.navigateOnLinked !== false) {
                    navigate(ROUTE.MAKE);
                }

                if (!createdAccount && !accountMe) {
                    void handleGetAccountMe().catch(() => undefined);
                }

                return createdWard;
            } finally {
                setLoading(false);
            }
        },
        [accountMe, applyAccountMe, handleGetAccountMe, initTutorial, navigate, setLoading],
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
            joinWardByCode,
            enterWard,
            cancelWaiting,
        },
    };
};

export default useRegister;
