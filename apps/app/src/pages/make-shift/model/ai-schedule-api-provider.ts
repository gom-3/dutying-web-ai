import {WardAPI} from '@/shared/api';
import type {TGenerateAiAutofillScheduleDTO} from '@dutying/api/ward';
import type {TAiScheduleProvider} from './ai-schedule-contract';

export const apiAiScheduleProvider: TAiScheduleProvider = {
    generate: async ({wardId, shiftTeamId, year, month, doc}) => {
        const schedule = Object.fromEntries(doc.rows.map((row) => [row.workerId, row.cells.map((cell) => cell ?? '')]));
        const payload: TGenerateAiAutofillScheduleDTO = {
            year,
            month,
            schedule,
        };

        return WardAPI.generateAiAutofillSchedule(wardId, shiftTeamId, payload);
    },
};
