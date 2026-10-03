import type {
    TAutofillResponse,
    TScheduleAdjustInterpretRes,
    TScheduleMonthRequestItem,
    TSnapshotCellDTO,
    TSnapshotRowOrderDTO,
} from '@dutying/api/ward';
import client from '@/shared/api/client';

export type TConversation = {
    conversationId: number;
    year: number;
    month: number;
    revision: number;
    currentVersionId: string;
    latestInterpretationId: string | null;
    createdAt: string;
};
export type TResultVersion = {
    versionId: string;
    parentVersionId: string | null;
    year: number;
    month: number;
    cells: TSnapshotCellDTO[];
    rowOrder: TSnapshotRowOrderDTO[];
    carryOverCells: TSnapshotCellDTO[];
    constraintsJson: string;
    inputDigest: string;
    createdAt: string;
};
export type TConversationTurn = {
    eventId: number;
    sequence: number;
    actor: string;
    type: string;
    text: string | null;
    interpretationId: string | null;
    baseRevision: number;
    contextHash: string | null;
    interpretation: TScheduleAdjustInterpretRes | null;
    createdAt: string;
};
export type TConversationOperation = {
    operationId: string;
    sequence: number;
    operationType: 'GENERATE' | 'ADJUST';
    fillPolicy: string | null;
    sourceVersionId: string;
    resultVersionId: string | null;
    interpretationId: string | null;
    baseRevision: number;
    executionStatus: 'RUNNING' | 'RESULT_READY' | 'UNKNOWN' | 'SUCCEEDED' | 'FAILED';
    applyStatus: string;
    failureReason: string | null;
    result: TAutofillResponse | null;
    createdAt: string;
};
export type TConversationDetail = {
    contextHash: string;
    activeConditionLabels: string[];
    conversation: TConversation;
    draft: TResultVersion;
    turns: TConversationTurn[];
    operations: TConversationOperation[];
};
export type TConversationPreference = {
    id: number;
    category: 'REQUEST_TEXT' | 'DETAIL_LEVEL';
    value: string;
    provenance: string;
    confirmedAt: string;
};
export type TConversationExecute = {
    expectedRevision: number;
    idempotencyKey: string;
    operationType: 'GENERATE' | 'ADJUST';
    fillPolicy?: 'EMPTY_ONLY' | 'REBUILD_UNLOCKED';
    rebuildConfirmed?: boolean;
    interpretationId?: string;
};
export function conversationApi(wardId: number, teamId: number) {
    const base = `/wards/${wardId}/shift-teams/${teamId}/schedule`;
    const get = async <T>(path: string) => (await client.get<T>(`${base}${path}`, {suppressErrorToast: true})).data;
    const post = async <T>(path: string, data: unknown) =>
        (await client.post<T>(`${base}${path}`, data, {suppressErrorToast: true, timeout: 330000})).data;
    const put = async <T>(path: string, data: unknown) => (await client.put<T>(`${base}${path}`, data, {suppressErrorToast: true})).data;

    return {
        list: (year: number, month: number) => get<TConversation[]>(`/conversations?year=${year}&month=${month}`),
        create: (year: number, month: number) => post<TConversation>('/conversations', {year, month}),
        detail: (id: number) => get<TConversationDetail>(`/conversations/${id}`),
        sync: (
            id: number,
            draft: {
                expectedRevision: number;
                cells: TSnapshotCellDTO[];
                rowOrder: TSnapshotRowOrderDTO[];
                carryOverCells?: TSnapshotCellDTO[];
            },
        ) => put<TConversationDetail>(`/conversations/${id}/draft`, draft),
        interpret: (
            id: number,
            request: {
                expectedRevision: number;
                text: string;
                language: string;
                previousInterpretationId?: string;
                change?: 'ADD' | 'REPLACE' | 'REMOVE' | 'RESET';
                removeLabels?: string[];
            },
        ) => post<TConversationTurn>(`/conversations/${id}/interpretations`, request),
        confirm: (id: number, interpretationId: string, expectedRevision: number, items: TScheduleMonthRequestItem[]) =>
            put<TConversationTurn>(`/conversations/${id}/interpretations/${encodeURIComponent(interpretationId)}`, {
                expectedRevision,
                items,
            }),
        execute: (id: number, request: TConversationExecute) => post<TConversationOperation>(`/conversations/${id}/operations`, request),
        operation: (id: string) => get<TConversationOperation>(`/conversation-operations/${encodeURIComponent(id)}`),
        version: (id: string) => get<TResultVersion>(`/result-versions/${encodeURIComponent(id)}`),
        branch: (id: number, versionId: string, expectedRevision: number) =>
            post<TConversation>(`/conversations/${id}/branches`, {versionId, expectedRevision}),
        preferences: () => get<TConversationPreference[]>('/conversation-preferences'),
        savePreference: (value: string, provenance: string) =>
            post<TConversationPreference>('/conversation-preferences', {category: 'REQUEST_TEXT', value, provenance, confirmed: true}),
        replacePreference: (id: number, value: string) =>
            put<TConversationPreference>(`/conversation-preferences/${id}`, {
                category: 'REQUEST_TEXT',
                value,
                provenance: 'EXPLICIT_USER_EDIT',
                confirmed: true,
            }),
        deletePreference: (id: number) => client.delete(`${base}/conversation-preferences/${id}`, {suppressErrorToast: true}),
    };
}

export function conversationEvents(detail: TConversationDetail) {
    return [
        ...detail.turns.map((turn) => ({kind: 'turn' as const, sequence: turn.sequence, id: `turn:${turn.eventId}`, turn})),
        ...detail.operations.map((operation) => ({
            kind: 'operation' as const,
            sequence: operation.sequence,
            id: operation.operationId,
            operation,
        })),
    ].sort((a, b) => a.sequence - b.sequence);
}
export function isConversationConfirmationCurrent(detail: TConversationDetail, turn: TConversationTurn, localDirty: boolean) {
    return (
        !localDirty &&
        turn.interpretationId === detail.conversation.latestInterpretationId &&
        turn.baseRevision === detail.conversation.revision &&
        turn.contextHash === detail.contextHash
    );
}
