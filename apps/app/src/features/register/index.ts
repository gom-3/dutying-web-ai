import {
    type TAddShiftTeamNurseDTO,
    type TCreateWardDTO,
    type TCreateWardSeedNurseDTO,
    type TCreateWardShiftTeamDTO,
    type TWardResponse,
} from '@dutying/api/ward';
import * as Sentry from '@sentry/react';
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
import {AccountAPI, AdminAPI, NurseAPI, WardAPI} from '@/shared/api';
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
type TNurseShiftTypesSeedTarget = TWardResponse['shiftTeams'][number]['nurses'][number]['nurseShiftTypes'];

const normalizeShiftTypeTime = (value: string | null | undefined) => value?.trim() ?? '';
const normalizeShiftTypeText = (value: string | null | undefined) => value?.trim().toLocaleUpperCase() ?? '';
const compactRequest = <T extends Record<string, unknown>>(request: T) =>
    Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)) as T;
const getShiftTeamSeedNurses = (shiftTeam: TCreateWardShiftTeamDTO): TCreateWardSeedNurseDTO[] =>
    shiftTeam.nurses?.length ? shiftTeam.nurses : shiftTeam.nurseNames.map((name) => ({name}));
const hasWardSeedData = (createWardDTO: TCreateWardDTO) =>
    createWardDTO.wardShiftTypes.length > 0 ||
    createWardDTO.shiftTeams.some(
        (shiftTeam) => shiftTeam.name?.trim() || getShiftTeamSeedNurses(shiftTeam).some((nurse) => nurse.name.trim()),
    );
const hasSameWardShiftTypes = (currentShiftTypes: TWardResponse['wardShiftTypes'], nextShiftTypes: TCreateWardDTO['wardShiftTypes']) => {
    if (currentShiftTypes.length !== nextShiftTypes.length) return false;

    return currentShiftTypes.every((currentShiftType, index) => {
        const nextShiftType = nextShiftTypes[index];

        if (!nextShiftType) return false;

        return (
            currentShiftType.name.trim() === nextShiftType.name.trim() &&
            normalizeShiftTypeText(currentShiftType.shortName) === normalizeShiftTypeText(nextShiftType.shortName) &&
            normalizeShiftTypeTime(currentShiftType.startTime) === normalizeShiftTypeTime(nextShiftType.startTime) &&
            normalizeShiftTypeTime(currentShiftType.endTime) === normalizeShiftTypeTime(nextShiftType.endTime) &&
            currentShiftType.color.trim() === nextShiftType.color.trim() &&
            currentShiftType.isDefault === nextShiftType.isDefault &&
            currentShiftType.isOff === nextShiftType.isOff &&
            currentShiftType.isCounted === nextShiftType.isCounted &&
            currentShiftType.classification === nextShiftType.classification
        );
    });
};
const toSeedNursePayload = (nurse: TCreateWardSeedNurseDTO): TAddShiftTeamNurseDTO => {
    const memo = nurse.memo?.trim() ?? '';
    const employmentDate = nurse.employmentDate?.trim() ?? '';
    const phoneNum = nurse.phoneNum?.trim();
    const isPreceptor = nurse.isPreceptor ?? memo === '프리셉터';
    const isPreceptee = nurse.isPreceptee ?? memo === '프리셉티';

    return compactRequest({
        name: nurse.name.trim(),
        phoneNum: phoneNum || undefined,
        isWorker: nurse.isWorker ?? true,
        isWardManager: false,
        memo,
        proficiency: nurse.level ?? undefined,
        isPreceptor,
        isPreceptee,
        workStartDate: employmentDate || undefined,
    });
};
const syncSeedNurseShiftTypes = async (
    nurseId: number,
    nurseShiftTypes: TNurseShiftTypesSeedTarget,
    seedNurse: TCreateWardSeedNurseDTO,
) => {
    if (!seedNurse.possibleShiftShortNames || nurseShiftTypes.length === 0) return;

    const possibleShiftShortNames = new Set(seedNurse.possibleShiftShortNames.map((shortName) => normalizeShiftTypeText(shortName)));

    await Promise.all(
        nurseShiftTypes.map((nurseShiftType) => {
            const isPossible = possibleShiftShortNames.has(normalizeShiftTypeText(nurseShiftType.shortName));

            if (nurseShiftType.isPossible === isPossible) {
                return Promise.resolve();
            }

            return NurseAPI.updateNurseShiftType(nurseId, nurseShiftType.nurseShiftTypeId, {isPossible});
        }),
    );
};
const reportWardSeedError = (error: unknown, context: Record<string, unknown>) => {
    Sentry.captureException(error, {
        tags: {feature: 'register-ward-seed'},
        extra: context,
    });
};
const syncWardShiftTypes = async (wardId: number, createdWard: TWardResponse | undefined, createWardDTO: TCreateWardDTO) => {
    if (createWardDTO.wardShiftTypes.length === 0) return;

    const currentWard = createdWard?.wardShiftTypes.length ? createdWard : await WardAPI.getWard(wardId).catch(() => createdWard);
    const currentShiftTypes = currentWard?.wardShiftTypes ?? [];

    if (hasSameWardShiftTypes(currentShiftTypes, createWardDTO.wardShiftTypes)) return;
    if (currentShiftTypes.length > 0) return;

    await Promise.all(createWardDTO.wardShiftTypes.map((shiftType) => WardAPI.createShiftType(wardId, shiftType)));
};
const syncShiftTeamsAndNurses = async (wardId: number, createWardDTO: TCreateWardDTO) => {
    const seedShiftTeams = createWardDTO.shiftTeams.filter(
        (shiftTeam) => shiftTeam.name?.trim() || getShiftTeamSeedNurses(shiftTeam).some((nurse) => nurse.name.trim()),
    );

    if (seedShiftTeams.length === 0) return undefined;

    const shiftTeams = [...(await WardAPI.getShiftTeams(wardId).catch(() => []))];
    const missingShiftTeamCount = Math.max(0, seedShiftTeams.length - shiftTeams.length);

    if (missingShiftTeamCount > 0) {
        const createdShiftTeams = await Promise.all(Array.from({length: missingShiftTeamCount}, () => WardAPI.createShiftTeam(wardId)));

        shiftTeams.push(...createdShiftTeams);
    }

    await Promise.all(
        seedShiftTeams.map(async (seedShiftTeam, index) => {
            const targetShiftTeam = shiftTeams[index];

            if (!targetShiftTeam) return;

            const seedShiftTeamName = seedShiftTeam.name?.trim();

            if (seedShiftTeamName && targetShiftTeam.name !== seedShiftTeamName) {
                const updatedShiftTeam = await WardAPI.updateShiftTeam(wardId, targetShiftTeam.shiftTeamId, {
                    name: seedShiftTeamName,
                }).catch(() => undefined);
                targetShiftTeam.name = updatedShiftTeam?.name ?? seedShiftTeamName;
            }

            for (const seedNurse of getShiftTeamSeedNurses(seedShiftTeam)) {
                if (!seedNurse.name.trim()) continue;

                const createdNurse = await WardAPI.addNurseIntoShiftTeam(
                    wardId,
                    targetShiftTeam.shiftTeamId,
                    toSeedNursePayload(seedNurse),
                );

                if (!targetShiftTeam.nurses.some((nurse) => nurse.nurseId === createdNurse.nurseId)) {
                    targetShiftTeam.nurses.push(createdNurse);
                    targetShiftTeam.nurseCnt = Math.max(targetShiftTeam.nurseCnt ?? 0, targetShiftTeam.nurses.length);
                }

                await syncSeedNurseShiftTypes(createdNurse.nurseId, createdNurse.nurseShiftTypes, seedNurse).catch(() => undefined);
            }
        }),
    );

    return shiftTeams;
};
const mergeWardWithShiftTeams = (ward: TWardResponse, shiftTeams: TWardResponse['shiftTeams'] | undefined): TWardResponse => {
    if (!shiftTeams) return ward;

    return {
        ...ward,
        shiftTeams,
        nurseCnt: shiftTeams.reduce((sum, shiftTeam) => sum + (shiftTeam.nurseCnt ?? shiftTeam.nurses.length), 0),
    };
};
const getShiftTeamNurseCount = (shiftTeams: TWardResponse['shiftTeams'] | undefined) =>
    shiftTeams?.reduce((sum, shiftTeam) => sum + (shiftTeam.nurseCnt ?? shiftTeam.nurses.length), 0) ?? 0;
const hydrateWardWithShiftTeams = async (wardId: number, fallbackWard: TWardResponse | undefined) => {
    const [ward, shiftTeams] = await Promise.all([
        WardAPI.getWard(wardId).catch(() => fallbackWard),
        WardAPI.getShiftTeams(wardId).catch(() => undefined),
    ]);

    if (!ward) return fallbackWard;

    return mergeWardWithShiftTeams(ward, shiftTeams);
};
const seedCreatedWard = async (wardId: number | undefined, createdWard: TWardResponse | undefined, createWardDTO: TCreateWardDTO) => {
    if (!wardId || !hasWardSeedData(createWardDTO)) return createdWard;

    await syncWardShiftTypes(wardId, createdWard, createWardDTO).catch((error) => {
        reportWardSeedError(error, {wardId, step: 'shift-types'});
    });

    const seededShiftTeams = await syncShiftTeamsAndNurses(wardId, createWardDTO).catch((error) => {
        reportWardSeedError(error, {wardId, step: 'shift-teams-and-nurses'});

        return undefined;
    });
    const hydratedWard = await hydrateWardWithShiftTeams(wardId, createdWard);

    if (hydratedWard && getShiftTeamNurseCount(seededShiftTeams) > getShiftTeamNurseCount(hydratedWard.shiftTeams)) {
        return mergeWardWithShiftTeams(hydratedWard, seededShiftTeams);
    }

    return hydratedWard;
};
const getActiveMembershipWardId = (memberships?: {wardId?: number | null; status?: string}[]) =>
    memberships?.find((membership) => membership.status === 'ACTIVE')?.wardId ?? memberships?.[0]?.wardId;

const getWardIdFromAdminWorkspaceResponse = (response: Awaited<ReturnType<typeof AdminAPI.createWorkspace>>) => {
    if ('wardId' in response) {
        const membershipWardId = 'memberships' in response ? getActiveMembershipWardId(response.memberships) : undefined;

        return response.wardId ?? membershipWardId ?? undefined;
    }

    if ('ward' in response && response.ward?.wardId) return response.ward.wardId;

    if ('account' in response && response.account) {
        return (
            response.account.wardId ?? getActiveMembershipWardId(response.account.memberships) ?? response.membership?.wardId ?? undefined
        );
    }

    if ('membership' in response) return response.membership?.wardId ?? undefined;

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
const shouldCreateAdminWorkspace = (account: TAccount | null) => getIsWorkspaceSetupPending(account);
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
                    const seededWard = await seedCreatedWard(linkedWardId, existingWard, createWardDTO);

                    initTutorial();
                    cacheCreatedWard(seededWard);

                    if (options?.navigateOnLinked !== false) {
                        navigate(ROUTE.MAKE);
                    }

                    return seededWard;
                }

                if (!shouldCreateAdminWorkspace(accountMe)) {
                    const createdWard = await WardAPI.createWard(createWardDTO);
                    const hydratedWard = await hydrateWardWithShiftTeams(createdWard.wardId, createdWard);

                    initTutorial();

                    if (accountMe) {
                        applyAccountMe({
                            ...accountMe,
                            wardId: createdWard.wardId,
                            status: 'LINKED',
                        });
                    }

                    cacheCreatedWard(hydratedWard);

                    if (options?.navigateOnLinked !== false) {
                        navigate(ROUTE.MAKE);
                    }

                    if (!accountMe) {
                        void handleGetAccountMe().catch(() => undefined);
                    }

                    return hydratedWard;
                }

                const accountProfile = accountMe as TAdminProfileSource | null;
                const createdWorkspace = await AdminAPI.createWorkspace({
                    hospitalName: createWardDTO.hospitalName,
                    wardName: createWardDTO.name,
                    adminName: accountProfile?.name ?? null,
                    phoneNum: accountProfile?.phoneNum ?? null,
                    profileImgUrl: accountProfile?.profileImgUrl ?? null,
                    wardShiftTypes: createWardDTO.wardShiftTypes,
                    shiftTeams: createWardDTO.shiftTeams,
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

                cacheCreatedWard(createdWard);

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
            joinWardByCode,
            enterWard,
            cancelWaiting,
        },
    };
};

export default useRegister;
