import type {TConversationDetail, TConversationOperation, TConversationTurn, TSemanticPlan} from './schedule-conversation-api';

/** Storage events are not dialogue. A confirmation replaces the proposal of the same plan. */
export function visibleConversationTurns(detail: TConversationDetail): TConversationTurn[] {
    const latestPlan = new Map<string, number>();

    for (const turn of detail.turns) {
        if (turn.semanticPlan)
            latestPlan.set(turn.semanticPlan.planId, Math.max(latestPlan.get(turn.semanticPlan.planId) ?? -1, turn.sequence));
    }

    return detail.turns.filter(
        (turn) =>
            (turn.actor !== 'SYSTEM' || turn.type === 'SEGMENT_START') &&
            (!turn.semanticPlan || turn.sequence === latestPlan.get(turn.semanticPlan.planId)),
    );
}

/** Previous segments remain visible; only the latest one supplies active UI state. */
export function currentConversationTurns(detail: TConversationDetail): TConversationTurn[] {
    const start = Math.max(0, ...detail.turns.filter((turn) => turn.type === 'SEGMENT_START').map((turn) => turn.sequence));

    return visibleConversationTurns(detail).filter((turn) => turn.sequence > start);
}

export function operationAttempt(detail: TConversationDetail, operationId: string): number {
    const operation = detail.operations.find((entry) => entry.operationId === operationId);

    return operation
        ? detail.operations.filter((entry) => entry.operationType === operation.operationType && entry.sequence <= operation.sequence)
              .length
        : 0;
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
    const proposal = turn.semanticPlan
        ? (detail.turns
              .filter((entry) => entry.semanticPlan?.planId === turn.semanticPlan?.planId)
              .sort((a, b) => a.sequence - b.sequence)[0] ?? turn)
        : turn;

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
