import type {TConversationDetail, TConversationTurn, TSemanticPlan} from './schedule-conversation-api';

/** Storage events are not dialogue. A confirmation replaces the proposal of the same plan. */
export function visibleConversationTurns(detail: TConversationDetail): TConversationTurn[] {
    const latestPlan = new Map<string, number>();

    for (const turn of detail.turns) {
        if (turn.semanticPlan)
            latestPlan.set(turn.semanticPlan.planId, Math.max(latestPlan.get(turn.semanticPlan.planId) ?? -1, turn.sequence));
    }

    return detail.turns.filter(
        (turn) => turn.actor !== 'SYSTEM' && (!turn.semanticPlan || turn.sequence === latestPlan.get(turn.semanticPlan.planId)),
    );
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

/** The model receives full context; the dialogue shows only a new clarification reply. */
export function conversationTurnText(detail: TConversationDetail, turn: TConversationTurn): string | null {
    if (turn.actor !== 'USER' || !turn.text) return turn.text;

    const split = turn.text.lastIndexOf('\n추가 답변: ');

    if (split < 0) return turn.text;

    const previous = [...detail.turns]
        .sort((a, b) => b.sequence - a.sequence)
        .find((entry) => entry.sequence < turn.sequence && entry.semanticPlan?.state === 'NEEDS_CLARIFICATION');

    if (!previous || requestTextForTurn(detail, previous) !== turn.text.slice(0, split)) return turn.text;

    return turn.text.slice(split + '\n추가 답변: '.length);
}
