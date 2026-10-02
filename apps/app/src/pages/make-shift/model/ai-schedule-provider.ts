import i18n from '@/i18n';
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
    if (response.engineResult?.solver?.reason === 'time_limit_no_solution') {
        return '기존 조건과 요청을 함께 계산했지만 시간 안에 적용 가능한 조절안을 찾지 못했어요. 표는 바뀌지 않았습니다. 요청을 나누거나 조건을 줄여 다시 시도해 주세요.';
    }

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

        if (request.adjust && response.engineResult?.solver?.reason === 'time_limit_no_solution' && !response.goalCandidate) {
            return {ok: false, message: firstUnmetInstruction(response)!};
        }

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

        if (isAdjustNotAllowed(error)) return {ok: false, message: '', notAllowed: true};

        return {ok: false, message: toErrorMessage(error), ...((error as {code?: number})?.code === 409 ? {conflict: true} : {})};
    }
}
