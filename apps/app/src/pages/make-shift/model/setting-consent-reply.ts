import {canSelectAuthoringCandidate} from './intent-first-authoring';
import type {TConversationDetail} from './schedule-conversation-api';

/** A yes/no only belongs to the latest exact still-current proposal. */
export function settingConsentReply(
    detail: TConversationDetail | null,
    text: string,
    dirty: boolean,
    declined: ReadonlySet<string>,
    now = Date.now(),
) {
    if (!detail || dirty || detail.conversationState?.pendingQuestion) return null;
    const operation = [...detail.operations].sort((a, b) => b.sequence - a.sequence)[0];
    const result = operation?.result;
    const priority = result?.authoringOutcome?.requestPriority;
    if (
        !operation ||
        !result?.candidate ||
        priority?.version !== 'request-first-v2' ||
        !priority.settingChangesRequired ||
        declined.has(result.candidate.candidateDigest) ||
        operation.baseRevision !== detail.conversation.revision ||
        detail.turns.some((turn) => turn.actor === 'USER' && turn.sequence > operation.sequence) ||
        !canSelectAuthoringCandidate(result, detail.conversation.currentVersionId, now)
    )
        return null;
    const value = text
        .trim()
        .replace(/[.!。！]$/u, '')
        .trim()
        .toLocaleLowerCase();
    const decision = /^(응|네|예|동의|동의해|동의해요|yes|agree|はい|同意)$/u.test(value)
        ? 'ACCEPT'
        : /^(아니|아니요|거절|유지|no|keep|いいえ)$/u.test(value)
          ? 'DECLINE'
          : null;
    return decision ? ({decision, operation} as const) : null;
}
