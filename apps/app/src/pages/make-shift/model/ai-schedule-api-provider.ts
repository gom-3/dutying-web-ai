import WardAPI from '@/shared/api/ward';
import {buildAutofillDTO} from '@/features/shift-editor/model/schedule-authoring';
import type {TAiScheduleProvider} from './ai-schedule-contract';

export const apiAiScheduleProvider: TAiScheduleProvider = {
    generate: async ({wardId, shiftTeamId, year, month, doc, originalShift, draftRevision, rulesHash, prompt, signal}) => {
        const dto = buildAutofillDTO({
            year,
            month,
            draftRevision,
            rulesHash,
            doc,
            originalShift,
            prompt,
        });

        return WardAPI.autofillSchedule(wardId, shiftTeamId, dto, {signal});
    },
};
