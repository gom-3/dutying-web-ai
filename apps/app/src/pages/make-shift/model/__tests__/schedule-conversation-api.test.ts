import {describe, expect, it} from 'vitest';
import {
    currentConversationTurns,
    operationAttempt,
    precedingCompletedOperation,
    requestTextForTurn,
    visibleConversationTurns,
    unexecutedRequestForRecovery,
} from '../conversation-presentation';
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
        expect(operationAttempt({...monthly, operations: [operation, {...operation, operationId: 'a2', sequence: 5}]}, 'a2')).toBe(1);
    });
    it('numbers runs within their own request section while preserving earlier history and operation types', () => {
        const monthly = {
            ...detail,
            turns: [{...turn, sequence: 3, actor: 'SYSTEM', type: 'SEGMENT_START'}],
            operations: [
                operation,
                {...operation, operationId: 'a2', sequence: 5},
                {...operation, operationId: 'a3', sequence: 6},
                {...operation, operationId: 'adjust:1', sequence: 7, operationType: 'ADJUST' as const},
            ],
        };

        expect(operationAttempt(monthly, operation.operationId)).toBe(1);
        expect(operationAttempt(monthly, 'a2')).toBe(1);
        expect(operationAttempt(monthly, 'a3')).toBe(2);
        expect(operationAttempt(monthly, 'adjust:1')).toBe(1);
    });
    it('places each follow-up boundary before the next user request and avoids duplicate new-section boundaries', () => {
        const next = {...turn, sequence: 3, actor: 'USER'};
        const monthly = {...detail, turns: [next]};

        expect(precedingCompletedOperation(monthly, next)).toEqual(operation);

        const boundary = {...turn, sequence: 2, type: 'SEGMENT_START', actor: 'SYSTEM'};

        expect(precedingCompletedOperation({...monthly, turns: [boundary, next]}, next)).toBeUndefined();
        expect(precedingCompletedOperation({...monthly, turns: [{...next, sequence: 2}, next]}, next)).toBeUndefined();
        expect(precedingCompletedOperation({...monthly, operations: [{...operation, executionStatus: 'RUNNING'}]}, next)).toBeUndefined();
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

describe('refreshed semantic plan presentation', () => {
    const proposal = (planId: string, sequence: number, refreshedFromPlanId?: string): TConversationTurn => ({
        ...turn,
        eventId: sequence,
        sequence,
        type: 'SEMANTIC_PLAN',
        interpretationId: `interpretation:${planId}`,
        semanticPlan: {
            planId,
            ...(refreshedFromPlanId ? {refreshedFromPlanId} : {}),
            planHash: 'same-reviewed-conditions',
            sourceVersionId: `source:${planId}`,
            state: 'PREVIEW_READY',
            summary: '조건 확인',
            confirmationAllowed: true,
            reasonCodes: [],
            conditions: [
                {
                    intentId: 'condition:1',
                    action: 'FORBID',
                    nurseIds: [1],
                    dates: ['2026-11-01'],
                    shiftCodes: ['N'],
                    quantifier: 'EACH',
                    modality: 'HARD',
                    operator: null,
                    count: null,
                    sourceSpan: {quote: '김 간호사 1일 N 금지'},
                },
            ],
        },
    });
    const message = (sequence: number, text: string): TConversationTurn => ({
        ...turn,
        eventId: sequence,
        sequence,
        actor: 'USER',
        type: 'MESSAGE',
        interpretationId: null,
        text,
    });
    const confirm = (source: TConversationTurn, sequence: number): TConversationTurn => ({
        ...source,
        eventId: sequence,
        sequence,
        type: 'SEMANTIC_PLAN_CONFIRMED',
        semanticPlan: {...source.semanticPlan!, state: 'CONFIRMED', confirmationAllowed: false},
    });

    it('shows only the latest confirmed card across an explicit refresh chain', () => {
        const original = message(1, '김 간호사 1일 N 금지');
        const initial = proposal('initial', 2);
        const refreshed = proposal('refreshed', 3, 'initial');
        const next = proposal('next', 4, 'refreshed');
        const confirmed = confirm(next, 5);
        const conversation = {...detail, turns: [original, initial, refreshed, next, confirmed]};

        expect(visibleConversationTurns(conversation)).toEqual([original, confirmed]);
        expect(requestTextForTurn(conversation, confirmed)).toBe(original.text);
    });

    it('retains the original request through refresh metadata on the confirmation', () => {
        const original = message(1, '김 간호사 1일 N 금지');
        const initial = proposal('initial', 2);
        const intervening = message(3, '다른 입력');
        const refreshed = proposal('refreshed', 4);
        const confirmed = confirm({...refreshed, semanticPlan: {...refreshed.semanticPlan!, refreshedFromPlanId: 'initial'}}, 5);
        const conversation = {...detail, turns: [original, initial, intervening, refreshed, confirmed]};

        expect(visibleConversationTurns(conversation)).toEqual([original, intervening, confirmed]);
        expect(requestTextForTurn(conversation, confirmed)).toBe(original.text);
        expect(requestTextForTurn(conversation, refreshed)).toBe(original.text);
    });

    it('preserves independently requested identical conditions in different request sections', () => {
        const original = message(1, '김 간호사 1일 N 금지');
        const initial = proposal('initial', 2);
        const confirmed = confirm(initial, 3);
        const start = {...turn, eventId: 4, sequence: 4, actor: 'SYSTEM', type: 'SEGMENT_START', text: 'CURRENT_DRAFT'};
        const repeated = message(5, '다시 김 간호사 1일 N 금지');
        const independent = proposal('independent', 6);
        const conversation = {...detail, turns: [original, initial, confirmed, start, repeated, independent]};

        expect(independent.semanticPlan!.conditions).toEqual(initial.semanticPlan!.conditions);
        expect(visibleConversationTurns(conversation)).toEqual([original, confirmed, start, repeated, independent]);
        expect(currentConversationTurns(conversation)).toEqual([repeated, independent]);
        expect(requestTextForTurn(conversation, independent)).toBe(repeated.text);
    });

    it('uses the first source request even when later refreshes follow other user messages', () => {
        const original = message(1, '김 간호사 1일 N 금지');
        const initial = proposal('initial', 2);
        const intervening = message(3, '다른 입력');
        const refreshed = proposal('refreshed', 4, 'initial');
        const next = proposal('next', 5, 'refreshed');
        const conversation = {...detail, turns: [original, initial, intervening, refreshed, next]};

        expect(requestTextForTurn(conversation, next)).toBe(original.text);
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

const negotiatedConfirmed = (): TConversationTurn => ({
    ...turn,
    type: 'SEMANTIC_PLAN_CONFIRMED',
    semanticPlan: {
        authoringContractVersion: 'intent-first-v1',
        interactionId: 'interaction:window',
        deadlineAt: new Date(Date.now() + 15000).toISOString(),
        planExpiresAt: new Date(Date.now() + 300000).toISOString(),
        autoExecutable: true,
        planId: 'window:1',
        planHash: 'a'.repeat(64),
        sourceVersionId: 'result:1',
        state: 'CONFIRMED',
        summary: '1일 D',
        conditions: [],
        reasonCodes: [],
        confirmationAllowed: true,
    },
});

it.each(['planExpiresAt', 'deadlineAt'] as const)(
    'enforces %s on confirmed negotiated plans without changing legacy confirmation',
    (field) => {
        const confirmed = negotiatedConfirmed();

        expect(isSemanticExecutionCurrent(detail, confirmed, false)).toBe(true);
        confirmed.semanticPlan![field] = '2000-01-01T00:00:00Z';
        expect(isSemanticExecutionCurrent(detail, confirmed, false)).toBe(false);
        delete confirmed.semanticPlan!.authoringContractVersion;
        expect(isSemanticExecutionCurrent(detail, confirmed, false)).toBe(true);
    },
);
it.each(['interactionId', 'deadlineAt', 'planExpiresAt'] as const)('does not infer missing %s from confirmation', (field) => {
    const confirmed = negotiatedConfirmed();

    delete confirmed.semanticPlan![field];
    expect(isSemanticExecutionCurrent(detail, confirmed, false)).toBe(false);
});
it('checks the latest interpretation, source, revision, and context for negotiated confirmation', () => {
    const confirmed = negotiatedConfirmed();

    expect(isSemanticExecutionCurrent({...detail, contextHash: 'changed'}, confirmed, false)).toBe(false);
    expect(isSemanticExecutionCurrent({...detail, conversation: {...detail.conversation, revision: 4}}, confirmed, false)).toBe(false);
    expect(
        isSemanticExecutionCurrent({...detail, conversation: {...detail.conversation, currentVersionId: 'other'}}, confirmed, false),
    ).toBe(false);
    expect(
        isSemanticExecutionCurrent({...detail, conversation: {...detail.conversation, latestInterpretationId: 'other'}}, confirmed, false),
    ).toBe(false);
});

describe('request recovery from a saved local error', () => {
    const raw = {...turn, eventId: 8, sequence: 2, actor: 'USER', type: 'MESSAGE', interpretationId: null, text: '간호사 4의 E를 줄여줘'};
    const proposal = {
        ...turn,
        eventId: 9,
        sequence: 3,
        interpretation: {items: []} as unknown as NonNullable<TConversationTurn['interpretation']>,
    };
    const history = {...detail, turns: [raw, proposal], operations: [operation]};

    it('recovers an unsubmitted plan even when syncing the draft cleared the latest interpretation', () => {
        expect(
            unexecutedRequestForRecovery({...history, conversation: {...history.conversation, latestInterpretationId: null}}, 3.001),
        ).toEqual(proposal);
    });
    it('uses the raw request when interpretation did not complete', () => {
        expect(unexecutedRequestForRecovery({...history, turns: [raw]}, 2.001)).toEqual(raw);
    });
    it('does not reopen a stale error after a newer user request or reset', () => {
        expect(
            unexecutedRequestForRecovery({...history, turns: [raw, proposal, {...raw, eventId: 11, sequence: 5}]}, 3.001),
        ).toBeUndefined();
        expect(
            unexecutedRequestForRecovery({...history, turns: [raw, proposal, {...turn, type: 'SEGMENT_START', sequence: 5}]}, 3.001),
        ).toBeUndefined();
    });
    it('keeps an accepted calculation on its own recovery path', () => {
        expect(
            unexecutedRequestForRecovery(
                {
                    ...history,
                    operations: [{...operation, sequence: 4, interpretationId: proposal.interpretationId, executionStatus: 'UNKNOWN'}],
                },
                4.001,
            ),
        ).toBeUndefined();
    });
});
