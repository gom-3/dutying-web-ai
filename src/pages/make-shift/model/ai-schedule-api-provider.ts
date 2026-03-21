import axiosInstance from '@/shared/api/client';
import type {TAiScheduleResponse} from '@/shared/types/ai-schedule';
import type {TAiScheduleProvider} from './ai-schedule-contract';

type TAiScheduleApiPayload = {
    year: number;
    month: number;
    schedule: Record<string, string[]>;
};

export const apiAiScheduleProvider: TAiScheduleProvider = {
    generate: async ({wardId, shiftTeamId, year, month, doc}) => {
        const schedule = Object.fromEntries(doc.rows.map((row) => [row.workerId, row.cells.map((cell) => cell ?? '')]));
        const payload: TAiScheduleApiPayload = {
            year,
            month,
            schedule,
        };

        return (await axiosInstance.post<TAiScheduleResponse>(`/wards/${wardId}/shift-teams/${shiftTeamId}/duty/ai-autofill`, payload))
            .data;
    },
};
