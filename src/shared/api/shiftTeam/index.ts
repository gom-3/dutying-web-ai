import qs from 'qs';
import {type Nurse} from '@/shared/types/nurse';
import {type ShiftTeam} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type UpdateNurseDTO} from '../nurse/type';
import {type IShiftTeamAPI, type UpdateShiftTeamDTO} from './type';

class ShiftTeamAPI implements IShiftTeamAPI {
    getShiftTeamNurses = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.get<{nurses: Nurse[]}>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses`)).data.nurses;
    addNurseIntoShiftTeam = async (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: UpdateNurseDTO) =>
        (await axiosInstance.post<Nurse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses`, addShiftTeamNurseDTO)).data;
    removeNurseFromShiftTeam = async (wardId: number, shiftTeamId: number, nurseId: number) =>
        (await axiosInstance.delete<Nurse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses/${nurseId}`)).data;
    getShiftTeams = async (wardId: number) =>
        (await axiosInstance.get<{shiftTeams: ShiftTeam[]}>(`/wards/${wardId}/shift-teams`)).data.shiftTeams;
    createShiftTeam = async (wardId: number) => (await axiosInstance.post<ShiftTeam>(`/wards/${wardId}/shift-teams`)).data;
    buildShiftTeam = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (await axiosInstance.post<ShiftTeam>(`/wards/${wardId}/shift-teams/${shiftTeamId}?${qs.stringify({year, month})}`)).data;
    deleteShiftTeam = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.delete<ShiftTeam>(`/wards/${wardId}/shift-teams/${shiftTeamId}`)).data;
    updateShiftTeam = async (wardId: number, shiftTeamId: number, updateShiftTeamDTO: UpdateShiftTeamDTO) =>
        (await axiosInstance.patch<ShiftTeam>(`/wards/${wardId}/shift-teams/${shiftTeamId}`, updateShiftTeamDTO)).data;
}

export default new ShiftTeamAPI();
