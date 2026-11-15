import {describe, expect, it} from 'vitest';
import {settingConsentReply} from '../setting-consent-reply';
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
            if (reason === 'declined') denied.add('digest:1');
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
