import axiosInstance from '../client';
import {type INurseAPI, type TNurseResponse, type TCreateNurseDTO, type TUpdateNurseDTO, type TUpdateNurseShiftTypeRequest} from './type';

class NurseAPI implements INurseAPI {
    createAccountNurse = async (accountId: number, createNurse: TCreateNurseDTO) =>
        (
            await axiosInstance.post<TNurseResponse>(`/nurses?accountId=${accountId}`, {
                ...createNurse,
                phoneNum: createNurse.phoneNum.replace(/-+/g, ''),
                employmentDate: createNurse.employmentDate.replace(/-/g, ''),
            })
        ).data;
    getNurse = async (nurseId: number) => (await axiosInstance.get<TNurseResponse>(`/nurses/${nurseId}`)).data;
    updateNurse = async (nurseId: number, updatedNurse: TUpdateNurseDTO) =>
        (await axiosInstance.patch<TNurseResponse>(`/nurses/${nurseId}`, updatedNurse)).data;
    updateNurseStatus = async (nurseId: number, status: string) =>
        (await axiosInstance.patch<TNurseResponse>(`/nurses/${nurseId}`, {status})).data;
    connectNurse = async (nurseId: number) => (await axiosInstance.post(`/nurses/${nurseId}/connect`)).data;
    unConnectNurse = async (nurseId: number) => (await axiosInstance.delete(`/nurses/${nurseId}/connect`)).data;
    updateNurseOrder = async (
        nurseId: number,
        shiftTeamId: number,
        nextShiftTeamId: number,
        divisionNum: number,
        prevPriority: number,
        nextPriority: number,
        patchYearMonth: string,
    ) =>
        (
            await axiosInstance.patch(`/nurses/${nurseId}/priority`, {
                shiftTeamId,
                nextShiftTeamId,
                divisionNum,
                prevPriority,
                nextPriority,
                patchYearMonth,
            })
        ).data;
    updateShiftTeamDivision = async (shiftTeamId: number, prevPriority: number, changeValue: number, patchYearMonth: string) =>
        (
            await axiosInstance.patch(`/nurses/division`, {
                shiftTeamId,
                prevPriority,
                changeValue,
                patchYearMonth,
            })
        ).data;
    updateNurseShiftType = async (nurseId: number, nurseShiftTypeId: number, change: TUpdateNurseShiftTypeRequest) =>
        (await axiosInstance.patch(`/nurses/${nurseId}/shift-types/${nurseShiftTypeId}`, change)).data;
    updateNurseCarry = async (shiftNurseId: number, value: number) =>
        (
            await axiosInstance.patch<null>(`/shift-nurses/${shiftNurseId}/carried`, {
                value,
            })
        ).data;
}

export default new NurseAPI();
