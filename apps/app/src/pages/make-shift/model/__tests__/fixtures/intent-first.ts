import type {TAutofillResponse, TAuthoringOutcome, TAuthoringCandidate} from '@dutying/api/ward';

export const emptyDelta = () => ({unchanged: [], improved: [], resolved: [], new: [], worsened: []});
export const outcome = (overrides: Partial<TAuthoringOutcome> = {}): TAuthoringOutcome => ({
    contractVersion: 'intent-first-v1',
    solveState: 'FEASIBLE',
    optimalityProven: false,
    requestState: 'SATISFIED',
    draftState: 'APPLICABLE',
    reasonCodes: [],
    clauses: [{clauseId: 'exact:1', kind: 'EXACT', status: 'SATISFIED', before: 0, after: 1, affectedCells: []}],
    baselineVersionId: 'source:1',
    validation: {python: 'VERIFIED', spring: 'VERIFIED', protection: 'PASS', completeTarget: true},
    violationDelta: emptyDelta(),
    appliedConcessionIds: [],
    timing: {
        interactionId: 'interaction:1',
        totalMs: 20,
        interpretMs: 1,
        queueMs: 0,
        modelBuildMs: 1,
        searchMs: 10,
        verificationMs: 8,
        recoveryMs: 0,
        deadlineExceeded: false,
    },
    ...overrides,
});
export const candidate = (overrides: Partial<TAuthoringCandidate> = {}): TAuthoringCandidate => ({
    candidateDigest: 'digest:1',
    sourceVersionId: 'source:1',
    changedCells: [
        {cellKey: '1:2026-11-01', shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 1, shiftCode: 'D', source: 'AI', fixed: false},
    ],
    violations: [],
    violationDelta: emptyDelta(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    token: 'synthetic-token',
    selectionReason: 'MATERIAL_TRADEOFF',
    ...overrides,
});
export const response = (overrides: Partial<TAutofillResponse> = {}): TAutofillResponse => ({
    operationType: 'ADJUST',
    draftRevision: 0,
    resultType: 'PATCH',
    applicable: true,
    approvable: false,
    validationTarget: 'RESULT',
    changedCells: candidate().changedCells,
    unmetInstructions: [],
    sameAsPrevious: false,
    validation: {
        draftRevision: 0,
        rulesHash: 'rules:1',
        summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
        violations: [],
    },
    engineResult: {status: 'DRAFT_READY', reviewRequired: true},
    authoringOutcome: outcome(),
    ...overrides,
});
