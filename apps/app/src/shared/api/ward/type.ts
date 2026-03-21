import type {IWardAPI as IBaseWardAPI} from '@dutying/api/ward';
import type {TAiScheduleResponse} from '@/shared/types/ai-schedule';

export type * from '@dutying/api/ward';

export type TGenerateAiAutofillScheduleDTO = {
    year: number;
    month: number;
    schedule: Record<string, string[]>;
};

export interface IWardAPI extends IBaseWardAPI {
    generateAiAutofillSchedule: (
        wardId: number,
        shiftTeamId: number,
        payload: TGenerateAiAutofillScheduleDTO,
    ) => Promise<TAiScheduleResponse>;
}
