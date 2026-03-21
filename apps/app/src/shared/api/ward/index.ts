import {createWardApi} from '@dutying/api/ward';
import axiosInstance from '../client';
import {type IWardAPI, type TGenerateAiAutofillScheduleDTO} from './type';

const wardApi = createWardApi(axiosInstance);
const WardAPI: IWardAPI = {
    ...wardApi,
    generateAiAutofillSchedule: async (wardId: number, shiftTeamId: number, payload: TGenerateAiAutofillScheduleDTO) =>
        (await axiosInstance.post(`/wards/${wardId}/shift-teams/${shiftTeamId}/duty/ai-autofill`, payload)).data,
};

export default WardAPI;
