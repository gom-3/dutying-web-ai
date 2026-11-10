import type {TConversationDetail, TConversationOperation, TConversationTurn, TSemanticPlan} from './schedule-conversation-api';

const serverCopyKeys = new Map([
    ['대상 간호사를 확인하지 못했어요. 표에 있는 이름을 알려 주세요', 'aiChatServerCopy.checkPeople'],
    ['대상 간호사를 이 근무팀에서 찾지 못했어요', 'aiChatServerCopy.checkPeople'],
    ['의도와 규칙의 변환을 확인했어요. 실행 계획은 아직 생성하지 않았어요', 'aiChatServerCopy.conditionsChecked'],
    ['요청에 아직 처리할 수 없는 조건이 있어요', 'aiChatServerCopy.unsupported'],
    ['누구에게 적용할까요? 현재 근무표 전체인지, 특정 그룹인지, 간호사 이름을 알려 주세요', 'aiChatServerCopy.choosePeople'],
    ['요청의 대상·기간·조건을 더 확인해야 해요', 'aiChatServerCopy.clarify'],
    ['어느 간호사에게 적용할지 이름을 다시 확인해 주세요', 'aiChatServerCopy.checkPeople'],
    [
        '가능한 근무 종류를 바꾸려면 간호사 설정에서 수정해 주세요. 이번 달에 실제로 배정하려는 요청이라면 근무와 날짜 또는 횟수를 알려 주세요',
        'aiChatServerCopy.shiftEligibility',
    ],
    ['이번 달의 어느 날짜에 적용할지 확인해 주세요', 'aiChatServerCopy.checkDates'],
    ['어느 근무에 적용할지 근무 코드를 확인해 주세요', 'aiChatServerCopy.checkShifts'],
    ['횟수와 최소·최대·정확히 중 어느 조건인지 확인해 주세요', 'aiChatServerCopy.checkCount'],
    ['각자 횟수인지 그룹 합계인지 확인해 주세요', 'aiChatServerCopy.checkAggregation'],
    ['반드시 지킬 조건인지, 가능하면 맞출 조건인지 확인해 주세요', 'aiChatServerCopy.checkPriority'],
    ['확인한 조건으로 계산할 준비가 됐어요', 'aiChatServerCopy.ready'],
    ['대상·기간·조건을 확인한 뒤 진행해 주세요', 'aiChatServerCopy.review'],
    ['고정된 배치와 요청이 충돌해요. 해당 배치를 확인해 주세요', 'aiChatServerCopy.locked'],
    ['표 또는 요청이 바뀌어 다시 확인해야 해요', 'aiChatServerCopy.expired'],
    ['조건을 삭제했어요. 새 요청을 입력해 주세요', 'aiChatServerCopy.removed'],
    ['바꾸고 싶은 내용을 확인하지 못했어요. 근무표는 변경되지 않았어요. 요청 내용을 확인해 주세요', 'aiChatServerCopy.noChangesFound'],
    [
        '이번 실행에만 적용할 요청과 이번 근무표에서 계속 유지할 조건을 함께 확인했어요. 기존에 저장한 조건도 계속 적용돼요',
        'aiChatServerCopy.runAndRoster',
    ],
    [
        '이 조건은 이번 근무표의 활성 요청으로 유지돼요. 다음 달이나 팀의 상시 설정으로 저장하려면 조건 설정을 이용해 주세요. 기존에 저장한 조건도 계속 적용돼요',
        'aiChatServerCopy.rosterOnly',
    ],
    [
        '이번 요청은 이번 실행에만 적용돼요. 이후 자동완성에서도 유지할 새 조건은 조건 설정에서 저장해 주세요. 기존에 저장한 조건은 계속 적용돼요',
        'aiChatServerCopy.runOnly',
    ],
    ['선택한 조건만 적용하고 나머지 조건은 이번 실행에서 제외합니다', 'aiChatServerCopy.selectedConditions'],
]);

/** Older responses and saved conversations can contain fixed Korean server copy. */
export function localizeConversationServerCopy<T extends string | null | undefined>(
    text: T,
    t: (key: string, options?: {names: string}) => string,
): T | string {
    const message = text?.trim().replace(/\.$/, '');
    const key = message && serverCopyKeys.get(message);
    const names = message?.match(
        /^말씀하신 간호사가 ([가-힣]{3,4}(?: \/ [가-힣]{3,4}){0,2}) 선생님인가요\? 이름을 확인해 주시면 앞서 요청한 내용을 이어서 확인할게요$/,
    )?.[1];

    if (names) return t('aiChatServerCopy.confirmSpelling', {names});
    return key ? t(key) : text;
}

/** Storage events are not dialogue. Confirmations and explicit refreshes replace their source cards. */
export function visibleConversationTurns(detail: TConversationDetail): TConversationTurn[] {
    const latestPlan = new Map<string, number>();
    const refreshedPlans = new Set<string>();

    for (const turn of detail.turns) {
        if (turn.semanticPlan) {
            latestPlan.set(turn.semanticPlan.planId, Math.max(latestPlan.get(turn.semanticPlan.planId) ?? -1, turn.sequence));

            if (turn.semanticPlan.refreshedFromPlanId && turn.semanticPlan.refreshedFromPlanId !== turn.semanticPlan.planId)
                refreshedPlans.add(turn.semanticPlan.refreshedFromPlanId);
        }
    }

    return detail.turns.filter(
        (turn) =>
            (turn.actor !== 'SYSTEM' || turn.type === 'SEGMENT_START') &&
            (!turn.semanticPlan ||
                (!refreshedPlans.has(turn.semanticPlan.planId) && turn.sequence === latestPlan.get(turn.semanticPlan.planId))),
    );
}

/** A segment starts a fresh dialogue, including when older model work finishes late. */
export function currentConversationTurns(detail: TConversationDetail): TConversationTurn[] {
    const start = detail.turns.filter((turn) => turn.type === 'SEGMENT_START').sort((a, b) => b.sequence - a.sequence)[0];

    return visibleConversationTurns(detail).filter(
        (turn) => turn.sequence > (start?.sequence ?? 0) && (!start || turn.baseRevision >= start.baseRevision),
    );
}

export function operationAttempt(detail: TConversationDetail, operationId: string): number {
    const operation = detail.operations.find((entry) => entry.operationId === operationId);

    if (!operation) return 0;

    const segmentStart = Math.max(
        0,
        ...detail.turns.filter((turn) => turn.type === 'SEGMENT_START' && turn.sequence < operation.sequence).map((turn) => turn.sequence),
    );

    return detail.operations.filter(
        (entry) => entry.operationType === operation.operationType && entry.sequence > segmentStart && entry.sequence <= operation.sequence,
    ).length;
}

/** Place the boundary before the next request, after all prior result messages. */
export function precedingCompletedOperation(detail: TConversationDetail, turn: TConversationTurn): TConversationOperation | undefined {
    if (turn.actor !== 'USER') return;

    const previous = detail.operations.filter((operation) => operation.sequence < turn.sequence).sort((a, b) => b.sequence - a.sequence)[0];

    if (!previous || !['SUCCEEDED', 'FAILED'].includes(previous.executionStatus)) return;

    return detail.turns.some(
        (entry) =>
            entry.sequence > previous.sequence &&
            entry.sequence < turn.sequence &&
            (entry.actor === 'USER' || entry.type === 'SEGMENT_START'),
    )
        ? undefined
        : previous;
}

/** Recover the original message, including conditions not represented by a ready artifact. */
export function requestTextForTurn(detail: TConversationDetail, turn: TConversationTurn): string {
    const proposals = new Map<string, TConversationTurn>();
    const refreshedFrom = new Map<string, string>();

    for (const entry of [...detail.turns, turn]) {
        if (!entry.semanticPlan) continue;

        const {planId, refreshedFromPlanId} = entry.semanticPlan;
        const proposal = proposals.get(planId);

        if (!proposal || entry.sequence < proposal.sequence) proposals.set(planId, entry);

        if (refreshedFromPlanId) refreshedFrom.set(planId, refreshedFromPlanId);
    }

    let proposal = turn;
    let planId = turn.semanticPlan?.planId;

    const visited = new Set<string>();

    while (planId && !visited.has(planId)) {
        visited.add(planId);
        proposal = proposals.get(planId) ?? proposal;
        planId = refreshedFrom.get(planId);
    }

    return (
        [...detail.turns]
            .sort((a, b) => b.sequence - a.sequence)
            .find((entry) => entry.actor === 'USER' && entry.sequence < proposal.sequence && entry.text)?.text ?? ''
    );
}

export function semanticRecovery(plan: TSemanticPlan): 'retry' | 'edit' {
    // A failed or invalid model response is not evidence that the same request will succeed.
    return plan.reasonCodes.includes('MODEL_TIMEOUT') ? 'retry' : 'edit';
}

export function clarificationQuestion(pending?: string, summary?: string): string | undefined {
    // Saved plans can contain the server's generic summary instead of a question.
    const genericSummary = '요청의 대상·기간·조건을 더 확인해야 해요';

    return [pending?.trim(), summary?.trim()].find((message) => message && message.replace(/\.$/, '') !== genericSummary);
}

/** The model receives the retained plan; the dialogue shows only the new reply. */
export function conversationTurnText(detail: TConversationDetail, turn: TConversationTurn): string | null {
    if (turn.actor !== 'USER' || !turn.text) return turn.text;

    const marker = ['\n추가 답변: ', '\n추가 요청: '].sort((a, b) => turn.text!.lastIndexOf(b) - turn.text!.lastIndexOf(a))[0];
    const split = turn.text.lastIndexOf(marker);

    if (split < 0) return turn.text;

    const previous = [...detail.turns]
        .sort((a, b) => b.sequence - a.sequence)
        .find((entry) => entry.sequence < turn.sequence && entry.semanticPlan);

    if (!previous || requestTextForTurn(detail, previous) !== turn.text.slice(0, split)) return turn.text;

    return turn.text.slice(split + marker.length);
}

/** Only an unsubmitted request in the same segment may be recovered from a local error. */
export function unexecutedRequestForRecovery(detail: TConversationDetail, failureSequence: number): TConversationTurn | undefined {
    const segmentStart = Math.max(0, ...detail.turns.filter((turn) => turn.type === 'SEGMENT_START').map((turn) => turn.sequence));

    if (failureSequence <= segmentStart || detail.turns.some((turn) => turn.actor === 'USER' && turn.sequence > failureSequence)) return;

    const request = [...detail.turns]
        .filter(
            (turn) =>
                turn.sequence > segmentStart &&
                turn.sequence <= failureSequence &&
                ((turn.actor === 'USER' && Boolean(turn.text)) || Boolean(turn.semanticPlan ?? turn.interpretation)),
        )
        .sort((a, b) => b.sequence - a.sequence)[0];

    if (
        !request ||
        detail.operations.some(
            (operation) =>
                operation.sequence > request.sequence ||
                (request.interpretationId != null && operation.interpretationId === request.interpretationId),
        )
    )
        return;

    return request;
}
