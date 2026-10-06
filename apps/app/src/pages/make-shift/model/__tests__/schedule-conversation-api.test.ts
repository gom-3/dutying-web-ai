import {describe, expect, it} from 'vitest';
import {currentConversationTurns, operationAttempt, visibleConversationTurns} from '../conversation-presentation';
import {
    conversationEvents,
    isConversationConfirmationCurrent,
    isSemanticExecutionCurrent,
    type TConversationDetail,
    type TConversationOperation,
    type TConversationTurn,
} from '../schedule-conversation-api';

const turn: TConversationTurn = {
    eventId: 10,
    sequence: 2,
    actor: 'ASSISTANT',
    type: 'INTERPRETATION',
    text: null,
    interpretationId: 'interpretation:1',
    baseRevision: 3,
    contextHash: 'rules:1',
    interpretation: null,
    createdAt: '2026-10-03T10:01:00',
};
const operation: TConversationOperation = {
    operationId: 'operation:1',
    sequence: 1,
    operationType: 'GENERATE',
    fillPolicy: 'EMPTY_ONLY',
    sourceVersionId: 'source:1',
    resultVersionId: 'result:1',
    interpretationId: null,
    baseRevision: 2,
    executionStatus: 'SUCCEEDED',
    applyStatus: 'APPLIED',
    failureReason: null,
    result: null,
    createdAt: '2026-10-03T10:10:00',
};
const detail = {
    contextHash: 'rules:1',
    activeConditionLabels: [],
    conversation: {
        conversationId: 1,
        year: 2026,
        month: 11,
        revision: 3,
        currentVersionId: 'result:1',
        latestInterpretationId: 'interpretation:1',
        createdAt: '',
    },
    draft: {
        versionId: 'result:1',
        parentVersionId: null,
        year: 2026,
        month: 11,
        cells: [],
        rowOrder: [],
        carryOverCells: [],
        constraintsJson: '{}',
        inputDigest: 'a',
        createdAt: '',
    },
    turns: [turn],
    operations: [operation],
} as TConversationDetail;

describe('conversation state', () => {
    it('retains historical messages but limits active UI state to the new request section', () => {
        const start = {...turn, eventId: 11, sequence: 3, actor: 'SYSTEM', type: 'SEGMENT_START', text: 'CURRENT_DRAFT'};
        const next = {...turn, eventId: 12, sequence: 4, actor: 'USER', type: 'MESSAGE', text: '새 요청'};
        const monthly = {...detail, turns: [turn, start, next]};

        expect(visibleConversationTurns(monthly)).toEqual([turn, start, next]);
        expect(currentConversationTurns(monthly)).toEqual([next]);
        expect(operationAttempt({...monthly, operations: [operation, {...operation, operationId: 'a2', sequence: 5}]}, 'a2')).toBe(2);
    });
    it('uses server sequence rather than client clock or request arrival order', () => {
        expect(conversationEvents(detail).map((event) => event.id)).toEqual(['operation:1', 'turn:10']);
    });
    it('keeps the same card identity when an execution status is refreshed', () => {
        const running = {...detail, operations: [{...operation, executionStatus: 'RUNNING' as const, resultVersionId: null}]};

        expect(conversationEvents(running)[0]?.id).toBe(conversationEvents(detail)[0]?.id);
    });
    it('invalidates confirmation on manual edits, server revision, rules, and newer proposals', () => {
        expect(isConversationConfirmationCurrent(detail, turn, false)).toBe(true);
        expect(isConversationConfirmationCurrent(detail, turn, true)).toBe(false);
        expect(isConversationConfirmationCurrent({...detail, contextHash: 'rules:2'}, turn, false)).toBe(false);
        expect(isConversationConfirmationCurrent({...detail, conversation: {...detail.conversation, revision: 4}}, turn, false)).toBe(
            false,
        );
        expect(
            isConversationConfirmationCurrent(
                {...detail, conversation: {...detail.conversation, latestInterpretationId: 'new'}},
                turn,
                false,
            ),
        ).toBe(false);
    });
});

it('requires a confirmed immutable semantic plan bound to the current source', () => {
    const proposal = {
        ...turn,
        type: 'SEMANTIC_PLAN',
        semanticPlan: {
            planId: 'p1',
            planHash: 'a'.repeat(64),
            sourceVersionId: 'result:1',
            state: 'PREVIEW_READY',
            summary: '조건 확인',
            conditions: [],
            reasonCodes: [],
            confirmationAllowed: true,
        },
    };

    expect(isSemanticExecutionCurrent(detail, proposal, false)).toBe(false);

    const confirmed = {...proposal, type: 'SEMANTIC_PLAN_CONFIRMED', semanticPlan: {...proposal.semanticPlan, state: 'CONFIRMED'}};

    expect(isSemanticExecutionCurrent(detail, confirmed, false)).toBe(true);
    expect(isSemanticExecutionCurrent(detail, confirmed, true)).toBe(false);
    expect(
        isSemanticExecutionCurrent({...detail, conversation: {...detail.conversation, currentVersionId: 'edited'}}, confirmed, false),
    ).toBe(false);
});
