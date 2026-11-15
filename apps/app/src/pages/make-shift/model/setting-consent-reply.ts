import {canSelectAuthoringCandidate} from './intent-first-authoring';
import type {TConversationDetail, TConversationOperation} from './schedule-conversation-api';

const declineStorageKey = (scope: string, version = 2) => `${scope}:declined-setting-candidates:v${version}`;

function declinedEntries(scope: string | null, now: number, version = 2): [string, number][] {
    if (!scope) return [];

    try {
        const stored: unknown = JSON.parse(localStorage.getItem(declineStorageKey(scope, version)) ?? '{}');

        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return [];

        return Object.entries(stored)
            .filter((entry): entry is [string, number] => entry[0].length <= 1024 && typeof entry[1] === 'number' && entry[1] > now)
            .slice(-128);
    } catch {
        return [];
    }
}

/** The reviewed proposal is an operation, not every future grid with this digest. */
export function settingCandidateIdentity(operation: TConversationOperation) {
    const candidate = operation.result?.candidate;

    if (!candidate || !operation.operationId) return null;

    return JSON.stringify([
        'proposal:v2',
        operation.operationId,
        operation.interpretationId,
        operation.sourceVersionId,
        candidate.sourceVersionId,
        candidate.candidateDigest,
        candidate.expiresAt,
    ]);
}

const legacyIdentity = (digest: string, expiry: number) => JSON.stringify(['legacy:v1', digest, expiry]);

export function isSettingCandidateDeclined(operation: TConversationOperation, declined: ReadonlySet<string>) {
    const candidate = operation.result?.candidate;
    const identity = settingCandidateIdentity(operation);

    return Boolean(
        candidate &&
            identity &&
            (declined.has(identity) || declined.has(legacyIdentity(candidate.candidateDigest, Date.parse(candidate.expiresAt)))),
    );
}

/** Proposal IDs and expiry only; never persist tokens, prompts, names or cells. */
export function declinedSettingCandidates(scope: string | null, now = Date.now()) {
    return new Set([
        ...declinedEntries(scope, now).map(([identity]) => identity),
        // Keep old rejections for their exact digest+expiry, without blocking a
        // newly issued proposal or reviving old controls via a broad clear.
        ...declinedEntries(scope, now, 1).map(([digest, expiry]) => legacyIdentity(digest, expiry)),
    ]);
}

export function rememberDeclinedSettingCandidate(scope: string | null, operation: TConversationOperation, now = Date.now()) {
    const identity = settingCandidateIdentity(operation);
    const expiry = Date.parse(operation.result?.candidate?.expiresAt ?? '');

    if (!scope || !identity || !Number.isFinite(expiry) || expiry <= now) return;

    try {
        localStorage.setItem(
            declineStorageKey(scope),
            JSON.stringify(
                Object.fromEntries(
                    [...declinedEntries(scope, now).filter(([value]) => value !== identity), [identity, expiry]].slice(-128),
                ),
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
        isSettingCandidateDeclined(operation, declined) ||
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
