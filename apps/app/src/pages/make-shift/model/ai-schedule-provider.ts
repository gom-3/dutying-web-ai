import {apiAiScheduleProvider} from './ai-schedule-api-provider';
import {type TAiScheduleProvider, type TAiScheduleRequest, type TAiScheduleResult} from './ai-schedule-contract';
import {mockAiScheduleProvider} from './ai-schedule-mock';
import i18n from '@/i18n';

type TProviderName = 'mock' | 'api';

function getProviderName(): TProviderName {
    return (import.meta.env.VITE_AI_SCHEDULE_PROVIDER ?? 'api').toLowerCase() === 'mock' ? 'mock' : 'api';
}

function getAiScheduleProvider(): TAiScheduleProvider {
    return getProviderName() === 'api' ? apiAiScheduleProvider : mockAiScheduleProvider;
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;

    return i18n.t('page.makeShift.aiRefill.requestFailed');
}

function firstUnmetInstruction(response: Awaited<ReturnType<TAiScheduleProvider['generate']>>): string | null {
    const message = response.unmetInstructions?.find((instruction) => instruction.trim().length > 0)?.trim();

    return message ?? null;
}

export async function requestAiSchedule(request: TAiScheduleRequest): Promise<TAiScheduleResult> {
    try {
        const response = await getAiScheduleProvider().generate(request);

        if (response.changedCells.length === 0) {
            const message = firstUnmetInstruction(response);

            if (message) return {ok: false, message};
        }

        return {ok: true, response, validation: response.validation};
    } catch (error) {
        if (request.signal?.aborted) return {ok: false, message: '', canceled: true};

        return {ok: false, message: toErrorMessage(error)};
    }
}
