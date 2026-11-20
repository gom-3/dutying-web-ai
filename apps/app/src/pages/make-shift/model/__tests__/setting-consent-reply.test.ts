import {beforeEach, describe, expect, it} from 'vitest';
import {
    declinedSettingCandidates,
    rememberDeclinedSettingCandidate,
    settingCandidateIdentity,
    isSettingCandidateDeclined,
    settingConsentReply,
} from '../setting-consent-reply';
import {candidate, outcome, response} from './fixtures/intent-first';
import type {TConversationDetail} from '../schedule-conversation-api';

function detail() {
    return {
        conversation: {revision: 7, currentVersionId: 'source:1'},
        turns: [],
        operations: [
            {
                operationId: 'op:1',
                sequence: 10,
                operationType: 'ADJUST',
                baseRevision: 7,
                result: response({
                    applicable: false,
                    changedCells: [],
                    validationTarget: 'CANDIDATE',
                    candidate: candidate(),
                    authoringOutcome: outcome({
                        draftState: 'CONSENT_REQUIRED',
                        candidateDigest: 'digest:1',
                        requestPriority: {version: 'request-first-v2', settingChangesRequired: true},
                    }),
                }),
            },
        ],
    } as unknown as TConversationDetail;
}
describe('scoped setting consent reply', () => {
    beforeEach(() => localStorage.clear());
    it('retains a rejection after reload and blocks short consent without storing tokens or roster data', () => {
        const now = Date.now();
        const operation = detail().operations[0]!;
        operation.result!.candidate!.expiresAt = new Date(now + 300000).toISOString();
        rememberDeclinedSettingCandidate('owner:1:ward:2:month:11', operation);
        const restored = declinedSettingCandidates('owner:1:ward:2:month:11');
        expect(settingConsentReply({...detail(), operations: [operation]}, '응', false, restored)).toBeNull();
        expect([...restored]).toEqual([settingCandidateIdentity(operation)]);
        expect(declinedSettingCandidates('owner:2:ward:2:month:11').size).toBe(0);
        expect(declinedSettingCandidates('owner:1:ward:2:month:11', now + 300001).size).toBe(0);
        expect(JSON.stringify(localStorage)).not.toMatch(/synthetic-token|cells|requestText/);
    });
    it('does not carry a rejection over to a new exact candidate', () => {
        const other = detail().operations[0]!;
        other.result!.candidate!.candidateDigest = 'other-digest';
        rememberDeclinedSettingCandidate('scope', other);
        expect(settingConsentReply(detail(), '응', false, declinedSettingCandidates('scope'))?.decision).toBe('ACCEPT');
    });
    it('allows a fresh explicit operation with the same grid digest without reviving the rejected proposal', () => {
        const old = detail();
        rememberDeclinedSettingCandidate('scope', old.operations[0]!);
        const rejected = declinedSettingCandidates('scope');
        const fresh = structuredClone(old);
        fresh.operations[0]!.operationId = 'op:fresh';
        fresh.operations[0]!.interpretationId = 'interpretation:fresh';
        fresh.operations[0]!.result!.candidate!.expiresAt = new Date(Date.now() + 600000).toISOString();
        expect(isSettingCandidateDeclined(old.operations[0]!, rejected)).toBe(true);
        expect(settingConsentReply(old, '응', false, rejected)).toBeNull();
        expect(settingConsentReply(fresh, '응', false, rejected)?.operation.operationId).toBe('op:fresh');
        expect(isSettingCandidateDeclined(old.operations[0]!, declinedSettingCandidates('scope'))).toBe(true);
    });
    it('keeps a legacy digest rejection bound to its recorded expiry instead of clearing it', () => {
        const old = detail();
        const candidate = old.operations[0]!.result!.candidate!;
        localStorage.setItem(
            'scope:declined-setting-candidates:v1',
            JSON.stringify({[candidate.candidateDigest]: Date.parse(candidate.expiresAt)}),
        );
        const fresh = structuredClone(old);
        fresh.operations[0]!.operationId = 'op:fresh';
        fresh.operations[0]!.result!.candidate!.expiresAt = new Date(Date.parse(candidate.expiresAt) + 300000).toISOString();
        const restored = declinedSettingCandidates('scope');
        expect(settingConsentReply(old, '응', false, restored)).toBeNull();
        expect(settingConsentReply(fresh, '응', false, restored)?.decision).toBe('ACCEPT');
        expect(localStorage.getItem('scope:declined-setting-candidates:v1')).not.toBeNull();
    });
    it('ignores malformed and expired rejection records', () => {
        localStorage.setItem('scope:declined-setting-candidates:v1', '{');
        expect(declinedSettingCandidates('scope').size).toBe(0);
        const expired = detail().operations[0]!;
        expired.result!.candidate!.expiresAt = '2000-01-01';
        rememberDeclinedSettingCandidate('scope', expired);
        expect(declinedSettingCandidates('scope').size).toBe(0);
    });
    it('binds a yes only to the latest exact candidate and leaves request data unchanged', () => {
        const d = detail();
        const before = JSON.stringify(d);
        expect(settingConsentReply(d, '응', false, new Set())?.decision).toBe('ACCEPT');
        expect(settingConsentReply(d, '아니요', false, new Set())?.decision).toBe('DECLINE');
        expect(JSON.stringify(d)).toBe(before);
    });
    it.each(['dirty', 'declined', 'changed', 'expired', 'newTurn', 'question', 'missing', 'otherText'] as const)(
        'does not infer permission after %s',
        (reason) => {
            const d = detail();
            const denied = new Set<string>();
            let dirty = false;
            if (reason === 'dirty') dirty = true;
            if (reason === 'declined') denied.add(settingCandidateIdentity(d.operations[0]!)!);
            if (reason === 'changed') d.conversation.revision++;
            if (reason === 'expired') d.operations[0]!.result!.candidate!.expiresAt = '2000-01-01';
            if (reason === 'newTurn') d.turns = [{actor: 'USER', sequence: 11} as TConversationDetail['turns'][0]];
            if (reason === 'question')
                d.conversationState = {pendingQuestion: {question: 'which one'}} as TConversationDetail['conversationState'];
            if (reason === 'missing') d.operations = [];
            expect(settingConsentReply(d, reason === 'otherText' ? 'N도 추가해줘' : '응', dirty, denied)).toBeNull();
        },
    );
});
