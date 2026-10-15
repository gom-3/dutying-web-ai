import type {TFailureSuggestion} from '@dutying/api/ward';
import type {TConversationDetail, TConversationOperation} from './schedule-conversation-api';

export function isFailureSuggestionAvailable(suggestion: TFailureSuggestion, now = Date.now()): boolean {
    const expiresAt = Date.parse(suggestion.expiresAt);

    return (
        suggestion.applyEnabled && suggestion.verificationStatus === 'VERIFIED_FEASIBLE' && Number.isFinite(expiresAt) && expiresAt > now
    );
}

export function isConversationSuggestionCurrent(detail: TConversationDetail, operation: TConversationOperation): boolean {
    return (
        operation.baseRevision === detail.conversation.revision &&
        operation.interpretationId === detail.conversation.latestInterpretationId &&
        detail.turns.some((turn) => turn.interpretationId === operation.interpretationId && turn.contextHash === detail.contextHash)
    );
}
