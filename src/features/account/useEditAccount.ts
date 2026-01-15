import {useQueryClient} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth/useAuth';
import useLoadingUseCase from '@/features/ui/useLoading';
import useEditWard from '@/features/ward/useEditWard';
import {AccountAPI, NurseAPI, WardAPI} from '@/shared/api';
import {type Nurse} from '@/shared/types/nurse';

const useEditAccount = () => {
    const {
        state: {accountMe},
        actions: {handleGetAccountMe, handleLogout},
    } = useAuth();
    const {
        queryKey: {getWardQueryKey},
    } = useEditWard();
    const {setLoading} = useLoadingUseCase();
    const queryClient = useQueryClient();
    const handleEditProfile = async (nurse: Nurse, profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}) => {
        if (!accountMe) return;

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
        } catch (e) {
            console.error(e);
            toast.error('프로필 업데이트에 실패했습니다..');
        } finally {
            setLoading(false);
        }
    };
    const quitWard = async () => {
        if (!accountMe?.wardId) return;

        if (!confirm('정말 병동을 나가시겠습니까?')) return;

        try {
            setLoading(true);
            await WardAPI.quitWard(accountMe.wardId);
            await AccountAPI.editAccountStatus(accountMe.accountId, 'WARD_SELECT_PENDING');
            await handleGetAccountMe();
        } catch (e) {
            console.error(e);
            toast.error('병동 나가기에 실패했습니다..');
        } finally {
            setLoading(false);
        }
    };
    const deleteAccount = async () => {
        if (!accountMe) return;

        if (!confirm('정말 탈퇴하시겠습니까?')) return;

        try {
            setLoading(true);
            AccountAPI.deleteAccount(accountMe.accountId);
            handleLogout();
        } catch (e) {
            console.error(e);
            toast.error('계정 삭제에 실패했습니다..');
        } finally {
            setLoading(false);
        }
    };

    return {quitWard, handleEditProfile, deleteAccount};
};

export default useEditAccount;
