import {describe, expect, it} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {response, outcome} from '../../../../model/__tests__/fixtures/intent-first';
import {AiConversationResultDetails} from '../ai-conversation-result-details';

const violation = {
    violationId: 'v1',
    ruleId: 1,
    templateCode: 'MIN_OFF',
    severity: 'HARD' as const,
    affectedCells: [],
    fixable: true,
    message: '휴무가 부족해요.',
};

describe('conversation result diagnostics', () => {
    it.each(['SATISFIED', 'PARTIAL', 'NEEDS_REVIEW', 'UNSATISFIED'] as const)(
        'keeps applied %s draft diagnostics in the table',
        (requestState) => {
            const result = response({authoringOutcome: outcome({requestState})});
            result.validation!.violations = [violation];
            result.authoringOutcome!.violationDelta.new = [violation];
            const {container} = render(<AiConversationResultDetails result={result} />);
            expect(container).toBeEmptyDOMElement();
            expect(result.validation!.violations).toEqual([violation]);
        },
    );
    it('retains baseline diagnostics for an actual failed execution', async () => {
        const result = response({applicable: false, changedCells: [], validationTarget: 'BASELINE'});
        delete result.authoringOutcome;
        result.validation!.violations = [violation];
        render(<AiConversationResultDetails result={result} />);
        await userEvent.click(screen.getByText('기존 근무표의 검사 결과'));
        expect(screen.getByText('휴무가 부족해요.')).toBeVisible();
    });
});
