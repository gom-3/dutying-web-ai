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

        if (response.changedCells.length === 0) {
            // 조절에서 바뀐 칸이 없는 것은 "이미 그 방향으로 최적"이라는 뜻이지 실패가 아니다.
            // 실패로 처리하면 사용자는 칩을 누를 때마다 빨간 토스트를 보게 된다.
            if (isAdjustNoChange(request, response)) {
                return {ok: true, response, validation: response.validation, noChange: true};
            }

            const message = firstUnmetInstruction(response);

            if (message) return {ok: false, message};
        }

        return {ok: true, response, validation: response.validation};
    } catch (error) {
        if (request.signal?.aborted) return {ok: false, message: '', canceled: true};

        if (isAdjustNotAllowed(error)) return {ok: false, message: '', notAllowed: true};

        return {ok: false, message: toErrorMessage(error)};
    }
}
