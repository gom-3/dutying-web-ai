import {useCallback} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useNavigate} from 'react-router';
import {accountQueryOptions} from '@/entities/account/model/queries';
import useLoading from '@/features/ui/useLoading';
import useTutorial from '@/features/ui/useTutorial';
import {AccountAPI, NurseAPI, WardAPI} from '@/shared/api';
import {type CreateNurseDTO} from '@/shared/api/nurse/type';
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
    const changeAccountStatus = useCallback(
        async ({accountId, status}: {accountId: number; status: Account['status']}) => {
            const updatedAccount = await AccountAPI.editAccountStatus(accountId, status);

            handleGetAccountMe();

            if (updatedAccount.status === 'LINKED') {
                navigate(ROUTE.MAKE);
            }
        },
        [handleGetAccountMe, navigate],
    );
    const createWard = useCallback(
        async (createWardDTO: CreateWardDTO) => {
            setLoading(true);

            try {
                await WardAPI.createWard(createWardDTO);
                initTutorial();

                if (accountMe) {
                    await changeAccountStatus({accountId: accountMe.accountId, status: 'LINKED'});
                }
            } finally {
                setLoading(false);
            }
        },
        [accountMe, changeAccountStatus, initTutorial, setLoading],
    );
    const enterWard = useCallback(
        async (wardId: number) => {
            setLoading(true);

            try {
                await WardAPI.addMeToWatingNurses(wardId);

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
            await WardAPI.deleteWatingNurses(wardId, nurseId);

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
    const registerAccountAndNurse = async (
        createNurseDTO: CreateNurseDTO & {profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}},
    ) => {
        if (!accountId || !accountMe) return;

        setLoading(true);

        try {
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
            await changeAccountStatus({accountId, status: 'WARD_SELECT_PENDING'});
        } finally {
            setLoading(false);
        }
    };

    return {
        state: {accountMe, accountWaitingWard},
        actions: {
            registerAccountAndNurse,
            createWrad: createWard,
            enterWard,
            cancelWaiting,
        },
    };
};

export default useRegister;
