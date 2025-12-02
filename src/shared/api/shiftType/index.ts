import {type WardShiftType} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type IShiftTypeAPI, type CreateShiftTypeDTO} from './type';

class ShiftTypeAPI implements IShiftTypeAPI {
    getShiftTypes = async (wardId: number) => (await axiosInstance.get<WardShiftType[]>(`/wards/${wardId}/shift-types`)).data;
    createShiftType = async (wardId: number, createShiftTypeDTO: CreateShiftTypeDTO) =>
        (await axiosInstance.post<WardShiftType>(`/wards/${wardId}/shift-types`, createShiftTypeDTO)).data;
    deleteShiftType = async (wardId: number, shiftTypeId: number) =>
        (await axiosInstance.delete(`/wards/${wardId}/shift-types/${shiftTypeId}`)).data;
    updateShiftType = async (wardId: number, shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) =>
        (await axiosInstance.put<WardShiftType>(`/wards/${wardId}/shift-types/${shiftTypeId}`, createShiftTypeDTO)).data;
}

export default new ShiftTypeAPI();
