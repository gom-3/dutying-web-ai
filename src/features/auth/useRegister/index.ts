import {useMutation, useQuery} from '@tanstack/react-query';
import {useNavigate} from 'react-router';
import useLoading from '@/features/ui/useLoading';
import useTutorial from '@/features/ui/useTutorial';
import {AccountAPI, NurseAPI, WardAPI} from '@/shared/api';
import {type TCreateNurseDTO} from '@/shared/api/nurse/type';
import {type CreateWardDTO} from '@/shared/api/ward/type';
import ROUTE from '@/shared/constant/path';
import {type Account} from '@/shared/types/account';
import useAuth from '../useAuth';

const useRegister = () => {
    const {
        state: {accountMe, accountId},
        actions: {handleGetAccountMe},
    } = useAuth();
    const {
        actions: {initTutorial},
    } = useTutorial();
    const {setLoading} = useLoading();
    const navigate = useNavigate();
    const {mutate: changeAccountStatusMutate} = useMutation({
        mutationFn: ({accountId, status}: {accountId: number; status: Account['status']}) =>
            AccountAPI.editAccountStatus(accountId, status),
        onSuccess: ({status}) => {
            handleGetAccountMe();

            if (status === 'LINKED') navigate(ROUTE.MAKE);
        },
    });
    const {mutate: createWardMutate} = useMutation({
        mutationFn: (createWardDTO: CreateWardDTO) => WardAPI.createWard(createWardDTO),
        onMutate: () => {
            setLoading(true);
        },
        onSettled: () => {
            setLoading(false);
        },
        onSuccess: () => {
            initTutorial();

            if (accountMe) {
                changeAccountStatusMutate({accountId: accountMe.accountId, status: 'LINKED'});
            }
        },
    });
    const {mutate: enterWardMutate} = useMutation({
        mutationFn: (wardId: number) => WardAPI.addMeToWatingNurses(wardId),
        onMutate: () => {
            setLoading(true);
        },
        onSettled: () => {
            setLoading(false);
        },
        onSuccess: () => {
            if (!accountId) return;

            changeAccountStatusMutate({accountId, status: 'WARD_ENTRY_PENDING'});
            navigate(ROUTE.REGISTER);
        },
    });
    const {mutate: cancelWaitingMutate} = useMutation({
        mutationFn: ({wardId, nurseId}: {wardId: number; nurseId: number}) => WardAPI.deleteWatingNurses(wardId, nurseId),
        onSuccess: () => {
            if (!accountId) return;

            changeAccountStatusMutate({accountId, status: 'WARD_SELECT_PENDING'});
            navigate(ROUTE.REGISTER);
        },
    });
    const {data: accountWaitingWard} = useQuery({
        queryKey: ['accountWaitingWard'],
        queryFn: () => AccountAPI.getAccountMeWaiting(),
        enabled: accountMe?.status === 'WARD_ENTRY_PENDING',
    });
    const registerAccountAndNurse = async (
        createNurseDTO: TCreateNurseDTO & {profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}},
    ) => {
        if (!accountId || !accountMe) return;

        setLoading(true);

        if (accountMe.status === 'NURSE_INFO_PENDING') {
            // 모바일에서 계정 초기 등록을 이미 마친 경우 계정 정보를 수정한다.
            await AccountAPI.editAccount({
                accountId,
                name: createNurseDTO.name,
                ...createNurseDTO.profileImg,
            });
        } else if (accountMe.status === 'INITIAL') {
            await AccountAPI.initAccount({accountId, name: createNurseDTO.name, ...createNurseDTO.profileImg});
        }

        await NurseAPI.createAccountNurse(accountId, createNurseDTO);
        changeAccountStatusMutate({accountId, status: 'WARD_SELECT_PENDING'});
        setLoading(false);
    };

    return {
        state: {accountMe, accountWaitingWard},
        actions: {
            registerAccountAndNurse,
            createWrad: createWardMutate,
            enterWard: enterWardMutate,
            cancelWaiting: (wardId: number, nurseId: number) => cancelWaitingMutate({wardId, nurseId}),
        },
    };
};

export default useRegister;
