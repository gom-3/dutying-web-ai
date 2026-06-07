import axiosInstance, {adminAxiosInstance} from '../client';
import type {
    TAdminMeResponse,
    TCreateAdminWorkspaceDTO,
    TCreateAdminWorkspaceResponse,
    TJoinAdminWardByCodeDTO,
    TJoinAdminWardByCodeResponse,
    TUpdateAdminProfileDTO,
} from './type';

class AdminAPI {
    getMe = async () => (await adminAxiosInstance.get<TAdminMeResponse>('/admin/accounts/me')).data;

    updateMe = async (profile: TUpdateAdminProfileDTO) =>
        (await adminAxiosInstance.patch<TAdminMeResponse>('/admin/accounts/me', profile)).data;

    deleteMe = async () => (await adminAxiosInstance.delete<void>('/admin/accounts/me')).data;

    quitWard = async (wardId: number) => (await adminAxiosInstance.delete<void>(`/admin/wards/${wardId}/quit`)).data;

    createWorkspace = async (workspace: TCreateAdminWorkspaceDTO) =>
        (await axiosInstance.post<TCreateAdminWorkspaceResponse>('/accounts/me/admin-workspace', workspace)).data;

    joinWardByCode = async (payload: TJoinAdminWardByCodeDTO) =>
        (await adminAxiosInstance.post<TJoinAdminWardByCodeResponse>('/admin/wards/join-by-code', payload)).data;
}

export default new AdminAPI();
export type * from './type';
