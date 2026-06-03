import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router';
import {type TNurse} from '@/entities/nurse';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useEditWard from '@/features/edit-ward';
import useLoadingUseCase from '@/features/loading';
import {AccountAPI, AdminAPI, NurseAPI, WardAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';

const useEditAccount = () => {
    const {
        state: {accountMe, accessToken},
        actions: {handleGetAccountMe, handleLogout},
    } = useAuth();
    const {
        queryKey: {getWardQueryKey},
    } = useEditWard();
    const {setLoading} = useLoadingUseCase();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const handleEditProfile = async (nurse: TNurse, profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}) => {
        if (!accountMe) return false;

        try {
            setLoading(true);
            await NurseAPI.updateNurse(nurse.nurseId, nurse);
            await AccountAPI.editAccount({
                accountId: accountMe.accountId,
                name: nurse.name,
                ...profileImg,
            });

            await queryClient.invalidateQueries({queryKey: getWardQueryKey});
            await handleGetAccountMe();

            return true;
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'edit-profile'},
                extra: {nurseId: nurse.nurseId, accountId: accountMe.accountId},
            });

            toast.error('프로필을 업데이트하지 못했어요.');

            return false;
        } finally {
            setLoading(false);
        }
    };
    const handleEditAccountBasic = async (name: string, profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}) => {
        if (!accountMe) return false;

        try {
            setLoading(true);
            await AccountAPI.editAccount({
                accountId: accountMe.accountId,
                name,
                ...profileImg,
            });
            await handleGetAccountMe();

            return true;
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'edit-account-basic'},
                extra: {accountId: accountMe.accountId},
            });
            toast.error('계정 정보를 업데이트하지 못했어요.');

            return false;
        } finally {
            setLoading(false);
        }
    };
    const quitWard = async () => {
        if (!accountMe?.wardId) return;

        if (!confirm('병동을 나갈까요?')) return;

        try {
            setLoading(true);
            await WardAPI.quitWard(accountMe.wardId);
            await AccountAPI.editAccountStatus(accountMe.accountId, 'WARD_SELECT_PENDING');
            await handleGetAccountMe();
            navigate(ROUTE.REGISTER, {replace: true, state: {fromQuitWard: true}});
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'quit-ward'},
                extra: {wardId: accountMe.wardId, accountId: accountMe.accountId},
            });
            toast.error('병동을 나가지 못했어요.');
        } finally {
            setLoading(false);
        }
    };
    const deleteAccount = async () => {
        if (!accountMe) return;

        try {
            setLoading(true);

            if (isWardAdminAccessToken(accessToken)) {
                await AdminAPI.deleteMe();
            } else {
                await AccountAPI.deleteAccount(accountMe.accountId);
            }

            await handleLogout();
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'delete-account'},
                extra: {accountId: accountMe.accountId},
            });
            toast.error('계정을 삭제하지 못했어요.');
        } finally {
            setLoading(false);
        }
    };

    return {quitWard, handleEditProfile, handleEditAccountBasic, deleteAccount};
};

export default useEditAccount;
