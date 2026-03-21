import qs from 'qs';
import axiosInstance from '../client';
import {type TNurseResponse, type TUpdateNurseDTO} from '../nurse/type';
import {
    type TDutyRequestResponse,
    type IWardAPI,
    type TGenerateAiAutofillScheduleDTO,
    type TRequestShiftResponse,
    type TCreateWardDTO,
    type TEditWardDTO,
    type TShiftResponse,
    type TShiftTeamResponse,
    type TWaitingNurseResponse,
    type TWardShiftsDTO,
    type TWardConstraintDTO,
    type TWardConstraintResponse,
    type TWardResponse,
    type TWardShiftTypeResponse,
    type TUpdateShiftTeamDTO,
    type TCreateShiftTypeDTO,
} from './type';

class WardAPI implements IWardAPI {
    // Ward APIs
    getWard = async (wardId: number) => (await axiosInstance.get<TWardResponse>(`/wards/${wardId}`)).data;
    createWard = async (createWardDTO: TCreateWardDTO) => (await axiosInstance.post<TWardResponse>(`/wards`, createWardDTO)).data;
    editWard = async (wardId: number, ward: TEditWardDTO) => (await axiosInstance.patch<TWardResponse>(`/wards/${wardId}`, ward)).data;
    getWardConstraint = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.get<TWardConstraintResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/constraint`)).data;
    updateWardConstraint = async (wardId: number, shiftTeamId: number, constraint: TWardConstraintDTO) =>
        (await axiosInstance.patch<TWardConstraintResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/constraint`, constraint)).data;
    getWardByCode = async (code: string) => (await axiosInstance.get<TWardResponse>(`/wards/search?code=${code}`)).data;
    getWatingNurses = async (wardId: number) =>
        (await axiosInstance.get<{nurses: TWaitingNurseResponse[]}>(`/wards/${wardId}/waiting-nurses/v2`)).data.nurses;
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
        (
            await axiosInstance.get<TRequestShiftResponse>(
                `/wards/${wardId}/shift-teams/${shiftTeamId}/req-duty?${qs.stringify({year, month})}`,
            )
        ).data;
    getShift = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (await axiosInstance.get<TShiftResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/duty?${qs.stringify({year, month})}`)).data;
    getRequestList = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (
            await axiosInstance.get<TDutyRequestResponse[]>(
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
    updateShifts = async (wardId: number, wardShifts: TWardShiftsDTO) =>
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
    generateAiAutofillSchedule = async (wardId: number, shiftTeamId: number, payload: TGenerateAiAutofillScheduleDTO) =>
        (await axiosInstance.post(`/wards/${wardId}/shift-teams/${shiftTeamId}/duty/ai-autofill`, payload)).data;
    postShift = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (
            await axiosInstance.post(
                `/wards/${wardId}/shift-teams/${shiftTeamId}/post?year=${year}&month=${month.toString().padStart(2, '0')}`,
            )
        ).data;

    // ShiftTeam APIs
    getShiftTeamNurses = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.get<{nurses: TShiftTeamResponse['nurses']}>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses`)).data.nurses;
    addNurseIntoShiftTeam = async (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: TUpdateNurseDTO) =>
        (await axiosInstance.post<TNurseResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses`, addShiftTeamNurseDTO)).data;
    removeNurseFromShiftTeam = async (wardId: number, shiftTeamId: number, nurseId: number) =>
        (await axiosInstance.delete<TNurseResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/nurses/${nurseId}`)).data;
    getShiftTeams = async (wardId: number) =>
        (await axiosInstance.get<{shiftTeams: TShiftTeamResponse[]}>(`/wards/${wardId}/shift-teams`)).data.shiftTeams;
    createShiftTeam = async (wardId: number) => (await axiosInstance.post<TShiftTeamResponse>(`/wards/${wardId}/shift-teams`)).data;
    buildShiftTeam = async (wardId: number, shiftTeamId: number, year: number, month: number) =>
        (await axiosInstance.post<TShiftTeamResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}?${qs.stringify({year, month})}`)).data;
    deleteShiftTeam = async (wardId: number, shiftTeamId: number) =>
        (await axiosInstance.delete<TShiftTeamResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}`)).data;
    updateShiftTeam = async (wardId: number, shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) =>
        (await axiosInstance.patch<TShiftTeamResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}`, updateShiftTeamDTO)).data;

    // ShiftType APIs
    getShiftTypes = async (wardId: number) => (await axiosInstance.get<TWardShiftTypeResponse[]>(`/wards/${wardId}/shift-types`)).data;
    createShiftType = async (wardId: number, createShiftTypeDTO: TCreateShiftTypeDTO) =>
        (await axiosInstance.post<TWardShiftTypeResponse>(`/wards/${wardId}/shift-types`, createShiftTypeDTO)).data;
    deleteShiftType = async (wardId: number, shiftTypeId: number) =>
        (await axiosInstance.delete(`/wards/${wardId}/shift-types/${shiftTypeId}`)).data;
    updateShiftType = async (wardId: number, shiftTypeId: number, createShiftTypeDTO: TCreateShiftTypeDTO) =>
        (await axiosInstance.put<TWardShiftTypeResponse>(`/wards/${wardId}/shift-types/${shiftTypeId}`, createShiftTypeDTO)).data;
}

export default new WardAPI();
