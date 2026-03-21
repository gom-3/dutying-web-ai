import {createWardApi} from '@dutying/api/ward';
import type {TAiScheduleResponse} from '@/shared/types/ai-schedule';
import axiosInstance from '../client';
import {type IWardAPI, type TGenerateAiAutofillScheduleDTO} from './type';

const wardApi = createWardApi(axiosInstance);
const WardAPI: IWardAPI = {
    ...wardApi,
    generateAiAutofillSchedule: async (
        wardId: number,
        shiftTeamId: number,
        payload: TGenerateAiAutofillScheduleDTO,
    ): Promise<TAiScheduleResponse> =>
        (await axiosInstance.post<TAiScheduleResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/duty/ai-autofill`, payload)).data,
};

export default WardAPI;
