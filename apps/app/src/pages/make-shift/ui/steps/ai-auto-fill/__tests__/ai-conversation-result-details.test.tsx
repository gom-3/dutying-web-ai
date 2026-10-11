import type {TAutofillResponse} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import {AiConversationResultDetails} from '../ai-conversation-result-details';

const result = {
    operationType: 'GENERATE', applicable: true, approvable: false, validationTarget: 'RESULT', draftRevision: 0,
    resultType: 'PATCH', changedCells: [{wardShiftTypeId: 1, shiftNurseId: 1, date: '2026-11-01'}], sameAsPrevious: false, unmetInstructions: [],
    engineResult: {status: 'REJECTED', candidateVisible: true, reviewRequired: true},
    validation: {draftRevision: 0, rulesHash: 'r', summary: {hardCount: 1, softCount: 2, totalCount: 3, valid: false},
        violations: [{violationId: 'v1', ruleId: 1, templateCode: 'MIN_OFF', severity: 'HARD', affectedCells: [], fixable: true, message: '김 간호사님의 휴무가 부족해요.'}]},
    requestRuleResults: [{requestId: 1, displayLabel: '야간 근무 다음 날 휴무', violationCount: 2}],
} as TAutofillResponse;

describe('conversation result review', () => {
    it('keeps an unapprovable draft open with concrete rules and unmet requests', () => {
        const {container} = render(<AiConversationResultDetails result={result} />);
        expect(container.querySelector('details')).toHaveAttribute('open');
        expect(screen.getByText(/필수 규칙 1건/)).toBeVisible();
        expect(screen.getByText('김 간호사님의 휴무가 부족해요.')).toBeVisible();
        expect(screen.getByText('야간 근무 다음 날 휴무 · 2곳 남았어요')).toBeVisible();
        expect(screen.getByText(/필수 규칙에 맞게 근무를 수정한 뒤/)).toBeVisible();
        expect(screen.queryByText(/REJECTED/)).not.toBeInTheDocument();
    });
    it.each(['SATISFIED', 'IMPROVED_UNMET', 'NOT_IMPROVED', 'NOT_EVALUABLE'] as const)('explains goal outcome %s without exposing internal statuses', goalStatus => {
        render(<AiConversationResultDetails result={{...result, goalResults: [{goalType: 'MINIMIZE_SINGLE_NIGHT_RUNS', goalStatus, beforeSingleNightRuns: 4, afterSingleNightRuns: 2} as NonNullable<TAutofillResponse['goalResults']>[number]]}} />);
        expect(screen.queryByText(new RegExp(goalStatus))).not.toBeInTheDocument();
        expect(screen.getByText('하루만 배정된 야간 근무: 4회 → 2회')).toBeVisible();
    });
    it('does not add an empty review panel to a clean result', () => {
        const {container} = render(<AiConversationResultDetails result={{...result, approvable: true, engineResult: {status: 'ACCEPTED'}, requestRuleResults: [], validation: {...result.validation, summary: {hardCount: 0, softCount: 0, totalCount: 0, valid: true}, violations: []}}} />);
        expect(container).toBeEmptyDOMElement();
    });
});
