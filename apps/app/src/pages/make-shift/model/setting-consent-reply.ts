import {canSelectAuthoringCandidate} from './intent-first-authoring';
import type {TConversationDetail} from './schedule-conversation-api';

const declineStorageKey = (scope: string) => `${scope}:declined-setting-candidates:v1`;

function declinedEntries(scope: string | null, now: number): [string, number][] {
    if (!scope) return [];

    try {
        const stored: unknown = JSON.parse(localStorage.getItem(declineStorageKey(scope)) ?? '{}');

        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return [];

        return Object.entries(stored)
            .filter((entry): entry is [string, number] => entry[0].length <= 256 && typeof entry[1] === 'number' && entry[1] > now)
            .slice(-128);
    } catch {
        return [];
    }
}

/** Only digests and expiry times: no candidate token, prompt, person or roster data. */
export function declinedSettingCandidates(scope: string | null, now = Date.now()) {
    return new Set(declinedEntries(scope, now).map(([digest]) => digest));
}

export function rememberDeclinedSettingCandidate(scope: string | null, digest: string, expiresAt: string, now = Date.now()) {
    const expiry = Date.parse(expiresAt);

    if (!scope || !digest || !Number.isFinite(expiry) || expiry <= now) return;

    try {
        localStorage.setItem(
            declineStorageKey(scope),
            JSON.stringify(
                Object.fromEntries([...declinedEntries(scope, now).filter(([value]) => value !== digest), [digest, expiry]].slice(-128)),
            ),
        );
    } catch {
        // The current mounted review still retains its in-memory rejection.
    }
}

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
