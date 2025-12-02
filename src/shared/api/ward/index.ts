import {type WaitingNurse} from '@/shared/types/nurse';
import {type Ward, type WardConstraint} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type IWardAPI, type CreateWardDTO, type EditWardDTO} from './type';

class WardAPI implements IWardAPI {
    getWard = async (wardId: number) => (await axiosInstance.get<Ward>(`/wards/${wardId}`)).data;
    createWard = async (createWardDTO: CreateWardDTO) => (await axiosInstance.post<Ward>(`/wards`, createWardDTO)).data;
    editWard = async (wardId: number, ward: EditWardDTO) => (await axiosInstance.patch<Ward>(`/wards/${wardId}`, ward)).data;
    getWardConstraint = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.get<WardConstraint>(`/wards/${wardId}/shift-teams/${shiftTeamId}/constraint`)).data;
    updateWardConstraint = async (wardId: number, shiftTeamId: number, constraint: WardConstraint) =>
        (await axiosInstance.patch<WardConstraint>(`/wards/${wardId}/shift-teams/${shiftTeamId}/constraint`, constraint)).data;
    getWardByCode = async (code: string) => (await axiosInstance.get<Ward>(`/wards/search?code=${code}`)).data;
    getWatingNurses = async (wardId: number) =>
        (await axiosInstance.get<{nurses: WaitingNurse[]}>(`/wards/${wardId}/waiting-nurses/v2`)).data.nurses;
    addMeToWatingNurses = async (wardId: number) => (await axiosInstance.post(`/wards/${wardId}/waiting-nurses`)).data;
    connectWatingNurses = async (wardId: number, waitingNurseId: number, targetNurseId: number) =>
        (await axiosInstance.post(`/wards/${wardId}/waiting-nurses/${waitingNurseId}/connect?targetNurseId=${targetNurseId}`)).data;
    approveWatingNurses = async (wardId: number, waitingNurseId: number, shiftTeamId: number) =>
        (await axiosInstance.post(`/wards/${wardId}/waiting-nurses/${waitingNurseId}/approve?shiftTeamId=${shiftTeamId}`)).data;
    deleteWatingNurses = async (wardId: number, nurseId: number) =>
        (await axiosInstance.delete(`/wards/${wardId}/waiting-nurses?nurseId=${nurseId}`)).data;
    quitWard = async (wardId: number) => (await axiosInstance.delete(`/wards/${wardId}/quit`)).data;
}

export default new WardAPI();
