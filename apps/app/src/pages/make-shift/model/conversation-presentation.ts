import type {TConversationDetail, TConversationOperation, TConversationTurn, TSemanticPlan} from './schedule-conversation-api';

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
    return plan.state === 'FAILED' ||
        plan.reasonCodes.some((code) =>
            ['EXTRACTION_FAILED', 'INVALID_SOURCE_SPAN', 'INVALID_INTERPRETATION_RESPONSE', 'SCHEMA_INVALID', 'MODEL_TIMEOUT'].includes(
                code,
            ),
        )
        ? 'retry'
        : 'edit';
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
