import i18n from '@/i18n';
import {aiConversationFailure} from './ai-conversation-failure';
import {aiExecutionFailure} from './ai-execution-failure';
import {apiAiScheduleProvider} from './ai-schedule-api-provider';
import {type TAiScheduleProvider, type TAiScheduleRequest, type TAiScheduleResult} from './ai-schedule-contract';
import {mockAiScheduleProvider} from './ai-schedule-mock';

type TProviderName = 'mock' | 'api';

function getProviderName(): TProviderName {
    return (import.meta.env.VITE_AI_SCHEDULE_PROVIDER ?? 'api').toLowerCase() === 'mock' ? 'mock' : 'api';
}

function getAiScheduleProvider(): TAiScheduleProvider {
    return getProviderName() === 'api' ? apiAiScheduleProvider : mockAiScheduleProvider;
}

/**
 * 서버가 사람 단위 게이트로 막은 경우. 잠시 후 다시 시도해도 달라지지 않으므로
 * "실패했어요"가 아니라 "아직 열리지 않았어요"로 말해야 한다.
 */
function isAdjustNotAllowed(error: unknown): boolean {
    const apiError = error as {code?: number; serverCode?: string} | null;

    if (!apiError) return false;

    return apiError.serverCode === 'SCHEDULE_AUTOFILL_ADJUST_NOT_ALLOWED';
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;

    return i18n.t('page.makeShift.aiRefill.requestFailed');
}

function firstUnmetInstruction(response: Awaited<ReturnType<TAiScheduleProvider['generate']>>): string | null {
    const message = response.unmetInstructions?.find((instruction) => instruction.trim().length > 0)?.trim();

    return message ?? null;
}

function isAdjustNoChange(request: TAiScheduleRequest, response: Awaited<ReturnType<TAiScheduleProvider['generate']>>): boolean {
    if (!request.adjust) return false;

    return response.engineResult?.solver?.reason === 'ADJUST_NO_CHANGE' || response.engineResult?.status === 'ACCEPTED';
}

export async function requestAiSchedule(request: TAiScheduleRequest): Promise<TAiScheduleResult> {
    try {
        const response = await getAiScheduleProvider().generate(request);

        if (request.adjust && response.operationType !== 'ADJUST') {
            return {ok: false, message: i18n.t('aiAdjust.unexpectedOperation')};
        }

        const failure = aiExecutionFailure(response);

        if (failure) return {ok: false, message: failure.message, failure};

        if (response.changedCells.length === 0 && isAdjustNoChange(request, response)) {
            return {ok: true, response, validation: response.validation, noChange: true};
        }

        if (response.changedCells.length === 0 && !request.adjust) {
            const message = firstUnmetInstruction(response);

            if (message) return {ok: false, message};
        }

        return {ok: true, response, validation: response.validation};
    } catch (error) {
        if (request.signal?.aborted) return {ok: false, message: '', canceled: true};

        const failure = aiConversationFailure(error, toErrorMessage(error));
        const apiError = error as {code?: number; serverCode?: string};

        return {
            ok: false,
            message: failure.message,
            failure,
            ...(isAdjustNotAllowed(error) ? {notAllowed: true} : {}),
            ...(apiError?.code === 409 && !failure.blocked && !apiError.serverCode?.startsWith('AI_') ? {conflict: true} : {}),
        };
    }
}
