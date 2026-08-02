import type {TUpdateAccountPreferencesRequest} from '@dutying/api';
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
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

const useEditAccount = () => {
    const {t} = useTypedTranslation();
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
    const isWardAdmin = isWardAdminAccessToken(accessToken);
    const handleEditProfile = async (nurse: TNurse, profileImg: {profileImgUrl?: string; defaultProfileImgId?: number}) => {
        if (!accountMe) return false;

        try {
            setLoading(true);

            if (isWardAdmin) {
                await AdminAPI.updateMe({
                    name: nurse.name,
                    phoneNum: nurse.phoneNum,
                    ...profileImg,
                });
            } else {
                await NurseAPI.updateNurse(nurse.nurseId, nurse);
                await AccountAPI.editAccount({
                    accountId: accountMe.accountId,
                    name: nurse.name,
                    ...profileImg,
                });
            }

            await queryClient.invalidateQueries({queryKey: getWardQueryKey});
            await handleGetAccountMe();

            return true;
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'edit-profile'},
                extra: {nurseId: nurse.nurseId, accountId: accountMe.accountId},
            });

            toast.error(t('feature.account.edit.profileFailed'));

            return false;
        } finally {
            setLoading(false);
        }
    };
    const handleEditAccountBasic = async (
        name: string,
        profileImg: {profileImgUrl?: string; defaultProfileImgId?: number},
        phoneNum?: string | null,
    ) => {
        if (!accountMe) return false;

        try {
            setLoading(true);

            if (isWardAdmin) {
                await AdminAPI.updateMe({
                    name,
                    phoneNum,
                    ...profileImg,
                });
            } else {
                await AccountAPI.editAccount({
                    accountId: accountMe.accountId,
                    name,
                    phoneNum,
                    ...profileImg,
                });
            }

            await handleGetAccountMe();

            return true;
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'edit-account-basic'},
                extra: {accountId: accountMe.accountId},
            });
            toast.error(t('feature.account.edit.basicFailed'));

            return false;
        } finally {
            setLoading(false);
        }
    };
    const updateAccountPreferences = async (dto: TUpdateAccountPreferencesRequest) => {
        if (!accountMe) return false;

        try {
            setLoading(true);

            await AccountAPI.updatePreferences(dto);
            await handleGetAccountMe();

            return true;
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'update-account-preferences'},
                extra: {accountId: accountMe.accountId, ...dto},
            });

            return false;
        } finally {
            setLoading(false);
        }
    };
    const updateBirthDate = async (birthDate: string | null) => {
        if (!accountMe || isWardAdmin) return false;

        try {
            setLoading(true);

            await AccountAPI.updateBirthDate(birthDate);
            await handleGetAccountMe();

            return true;
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'update-birth-date'},
                extra: {accountId: accountMe.accountId, birthDate},
            });
            toast.error(t('feature.account.edit.birthDateFailed'));

            return false;
        } finally {
            setLoading(false);
        }
    };
    const quitWard = async () => {
        if (!accountMe?.wardId) return;

        if (!confirm(t('feature.account.edit.quitWardConfirm'))) return;

        try {
            setLoading(true);

            if (isWardAdmin) {
                await AdminAPI.quitWard(accountMe.wardId);
            } else {
                await WardAPI.quitWard(accountMe.wardId);
                await AccountAPI.editAccountStatus(accountMe.accountId, 'WARD_SELECT_PENDING');
            }

            await handleGetAccountMe();
            navigate(ROUTE.REGISTER, {replace: true, state: {fromQuitWard: true}});
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'quit-ward'},
                extra: {wardId: accountMe.wardId, accountId: accountMe.accountId},
            });
            toast.error(t('feature.account.edit.quitWardFailed'));
        } finally {
            setLoading(false);
        }
    };
    const deleteAccount = async () => {
        if (!accountMe) return;

        try {
            setLoading(true);

            if (isWardAdmin) {
                await AdminAPI.deleteMe();
            } else {
                await AccountAPI.deleteAccount(accountMe.accountId);
            }

            queryClient.clear();
            await handleLogout(ROUTE.ROOT);
        } catch (e) {
            Sentry.captureException(e, {
                tags: {feature: 'account', action: 'delete-account'},
                extra: {accountId: accountMe.accountId},
            });
            toast.error(t('feature.account.edit.deleteAccountFailed'));
        } finally {
            setLoading(false);
        }
    };

    return {quitWard, handleEditProfile, handleEditAccountBasic, updateBirthDate, updateAccountPreferences, deleteAccount};
};

export default useEditAccount;
