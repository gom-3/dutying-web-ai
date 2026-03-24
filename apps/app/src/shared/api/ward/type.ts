import type {IWardAPI as IBaseWardAPI, TAiScheduleResponse, TGenerateAiAutofillScheduleDTO} from '@dutying/api/ward';

export type * from '@dutying/api/ward';

export interface IWardAPI extends IBaseWardAPI {
    generateAiAutofillSchedule: (
        wardId: number,
        shiftTeamId: number,
        payload: TGenerateAiAutofillScheduleDTO,
    ) => Promise<TAiScheduleResponse>;
}
