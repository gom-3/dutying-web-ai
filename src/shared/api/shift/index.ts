import qs from 'qs';
import {type DutyRequest} from '@/shared/types/request';
import {type RequestShift, type Shift} from '@/shared/types/shift';
import axiosInstance from '../client';
import {type IShiftAPI, type WardShiftsDTO} from './type';

class ShiftAPI implements IShiftAPI {
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
}

export default new ShiftAPI();
