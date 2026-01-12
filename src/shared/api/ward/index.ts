import qs from 'qs';
import {type WaitingNurse, type Nurse} from '@/shared/types/nurse';
import {type DutyRequest} from '@/shared/types/request';
import {type RequestShift, type Shift} from '@/shared/types/shift';
import {type TWard, type TWardConstraint, type TShiftTeam, type TWardShiftType} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type UpdateNurseDTO} from '../nurse/type';
import {
    type IWardAPI,
    type CreateWardDTO,
    type EditWardDTO,
    type WardShiftsDTO,
    type UpdateShiftTeamDTO,
    type CreateShiftTypeDTO,
} from './type';

class WardAPI implements IWardAPI {
    // Ward APIs
    getWard = async (wardId: number) => (await axiosInstance.get<TWard>(`/wards/${wardId}`)).data;
    createWard = async (createWardDTO: CreateWardDTO) => (await axiosInstance.post<TWard>(`/wards`, createWardDTO)).data;
    editWard = async (wardId: number, ward: EditWardDTO) => (await axiosInstance.patch<TWard>(`/wards/${wardId}`, ward)).data;
    getWardConstraint = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.get<TWardConstraint>(`/wards/${wardId}/shift-teams/${shiftTeamId}/constraint`)).data;
    updateWardConstraint = async (wardId: number, shiftTeamId: number, constraint: TWardConstraint) =>
        (await axiosInstance.patch<TWardConstraint>(`/wards/${wardId}/shift-teams/${shiftTeamId}/constraint`, constraint)).data;
    getWardByCode = async (code: string) => (await axiosInstance.get<TWard>(`/wards/search?code=${code}`)).data;
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

    // Shift APIs
    getReqShift = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (await axiosInstance.get<RequestShift>(`/wards/${wardId}/shift-teams/${shiftTeamId}/req-duty?${qs.stringify({year, month})}`)).data;
    getShift = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (await axiosInstance.get<Shift>(`/wards/${wardId}/shift-teams/${shiftTeamId}/duty?${qs.stringify({year, month})}`)).data;
    getRequestList = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (
            await axiosInstance.get<DutyRequest[]>(
                `/wards/${wardId}/shift-teams/${shiftTeamId}/req-duty/req-list?${qs.stringify({
                    year,
                    month,
                })}`,
            )
        ).data;
    updateShift = async (wardId: number, year: number, month: number, day: number, shiftNurseId: number, wardShiftTypeId: number | null) =>
        (
            await axiosInstance.patch<null>(`/wards/${wardId}/shifts`, {
                shiftNurseId,
                date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                wardShiftTypeId,
            })
        ).data;
    updateShifts = async (wardId: number, wardShifts: WardShiftsDTO) =>
        (
            await axiosInstance.patch(`/wards/${wardId}/shifts/list`, {
                wardShifts,
            })
        ).data;
    updateReqShift = async (
        wardId: number,
        year: number,
        month: number,
        day: number,
        shiftNurseId: number,
        wardShiftTypeId: number | null,
    ) =>
        (
            await axiosInstance.patch(`/wards/${wardId}/req-shifts`, {
                shiftNurseId,
                date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                wardShiftTypeId,
            })
        ).data;
    acceptRequestShift = async (wardId: number, reqShiftId: number, isAccepted: boolean | null) =>
        (
            await axiosInstance.patch(`/wards/${wardId}/req-shifts/${reqShiftId}/accept`, {
                isAccepted,
            })
        ).data;
    postShift = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (
            await axiosInstance.post(
                `/wards/${wardId}/shift-teams/${shiftTeamId}/post?year=${year}&month=${month.toString().padStart(2, '0')}`,
            )
        ).data;

    // ShiftTeam APIs
    getShiftTeamNurses = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.get<{nurses: Nurse[]}>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses`)).data.nurses;
    addNurseIntoShiftTeam = async (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: UpdateNurseDTO) =>
        (await axiosInstance.post<Nurse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses`, addShiftTeamNurseDTO)).data;
    removeNurseFromShiftTeam = async (wardId: number, shiftTeamId: number, nurseId: number) =>
        (await axiosInstance.delete<Nurse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses/${nurseId}`)).data;
    getShiftTeams = async (wardId: number) =>
        (await axiosInstance.get<{shiftTeams: TShiftTeam[]}>(`/wards/${wardId}/shift-teams`)).data.shiftTeams;
    createShiftTeam = async (wardId: number) => (await axiosInstance.post<TShiftTeam>(`/wards/${wardId}/shift-teams`)).data;
    buildShiftTeam = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (await axiosInstance.post<TShiftTeam>(`/wards/${wardId}/shift-teams/${shiftTeamId}?${qs.stringify({year, month})}`)).data;
    deleteShiftTeam = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.delete<TShiftTeam>(`/wards/${wardId}/shift-teams/${shiftTeamId}`)).data;
    updateShiftTeam = async (wardId: number, shiftTeamId: number, updateShiftTeamDTO: UpdateShiftTeamDTO) =>
        (await axiosInstance.patch<TShiftTeam>(`/wards/${wardId}/shift-teams/${shiftTeamId}`, updateShiftTeamDTO)).data;

    // ShiftType APIs
    getShiftTypes = async (wardId: number) => (await axiosInstance.get<TWardShiftType[]>(`/wards/${wardId}/shift-types`)).data;
    createShiftType = async (wardId: number, createShiftTypeDTO: CreateShiftTypeDTO) =>
        (await axiosInstance.post<TWardShiftType>(`/wards/${wardId}/shift-types`, createShiftTypeDTO)).data;
    deleteShiftType = async (wardId: number, shiftTypeId: number) =>
        (await axiosInstance.delete(`/wards/${wardId}/shift-types/${shiftTypeId}`)).data;
    updateShiftType = async (wardId: number, shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) =>
        (await axiosInstance.put<TWardShiftType>(`/wards/${wardId}/shift-types/${shiftTypeId}`, createShiftTypeDTO)).data;
}

export default new WardAPI();
