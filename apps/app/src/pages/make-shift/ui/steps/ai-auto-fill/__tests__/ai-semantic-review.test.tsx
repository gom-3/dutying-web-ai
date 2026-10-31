import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {describe, expect, it, vi} from 'vitest';
import type {TSemanticPlan} from '../../../../model/schedule-conversation-api';
import {AiSemanticReview} from '../ai-semantic-review';

const conflictPlan: TSemanticPlan = {
    planId: 'conflict-plan',
    planHash: 'conflict-hash',
    sourceVersionId: 'source-version',
    state: 'LOCKED_CONFLICT',
    summary: '고정된 배치와 요청이 충돌해요. 해당 배치를 확인해 주세요.',
    confirmationAllowed: false,
    reasonCodes: [],
    conditions: [
        {
            intentId: 'forbid-evening',
            action: 'FORBID',
            nurseIds: [1],
            dates: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
            shiftCodes: ['E'],
            quantifier: 'EACH',
            modality: 'HARD',
            operator: null,
            count: null,
            sourceSpan: {quote: '검증간호사 1~5일 E 근무 없게 해줘'},
        },
    ],
    conditionGroups: [
        {
            conditionId: 'request-1',
            sourceSpan: {start: 0, end: 22, quote: '검증간호사 1~5일 E 근무 없게 해줘'},
            intentIds: ['forbid-evening'],
            status: 'SUPPORTED',
            reasonCodes: [],
            selectable: true,
        },
    ],
};

function renderReview(overrides: Partial<ComponentProps<typeof AiSemanticReview>> = {}) {
    const props: ComponentProps<typeof AiSemanticReview> = {
        plan: conflictPlan,
        current: true,
        disabled: false,
        stale: false,
        applied: false,
        processing: null,
        rosterNurseIds: [1, 2],
        nurseName: (id) => (id === 1 ? '검증간호사' : `간호사${id}`),
        copy: (ko) => ko,
        onApply: vi.fn(),
        onEdit: vi.fn(),
        onRetry: vi.fn(),
        ...overrides,
    };

    render(<AiSemanticReview {...props} />);

    return props;
}

describe('fixed shift conflict recovery', () => {
    it('shows an empty-request removal as complete without clarification or execution controls', () => {
        renderReview({
            plan: {...conflictPlan, state: 'NEEDS_CLARIFICATION', reasonCodes: ['EMPTY_CONDITIONS'], conditions: [], conditionGroups: []},
        });

        expect(screen.getByRole('img', {name: '삭제 완료'})).toBeVisible();
        expect(screen.getByText('요청 조건을 삭제했어요.')).toBeVisible();
        expect(screen.getByText('새 요청을 입력해 주세요.')).toBeVisible();
        expect(screen.queryByText('요청을 조금 더 확인할게요')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it.each(['HARD', 'SOFT'] as const)('shows the request once without exclusion or selection UI: %s', (modality) => {
        renderReview({plan: {...conflictPlan, conditions: [{...conflictPlan.conditions[0], modality}]}});

        expect(screen.getByRole('img', {name: '고정 근무 충돌'})).toBeVisible();
        expect(screen.getByText('고정 근무와 요청이 충돌해요')).toBeVisible();

        const requests = screen.getByRole('list', {name: '확인할 요청'});

        expect(within(requests).getAllByRole('listitem')).toHaveLength(1);
        expect(requests).toHaveTextContent('11월 1~5일');
        expect(requests).toHaveTextContent('검증간호사님');
        expect(requests).toHaveTextContent('E 근무 제외');
        expect(requests).toHaveTextContent(modality === 'HARD' ? '필수 조건' : '선호 조건');
        expect(screen.getByText('고정 근무를 확인하거나 요청을 수정해 주세요.')).toBeVisible();
        expect(screen.queryByText(conflictPlan.conditions[0].sourceSpan.quote)).not.toBeInTheDocument();
        expect(screen.queryByText(/선택하지 않음|줄바꿈|제외 예정/)).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('keeps actual selection records collapsed without using them as the conflict recovery UI', async () => {
        const user = userEvent.setup();

        renderReview({
            plan: {
                ...conflictPlan,
                selectionAudit: {
                    sourcePreviewId: 'old-preview',
                    originalText: conflictPlan.conditions[0].sourceSpan.quote,
                    conditionGroups: conflictPlan.conditionGroups!,
                    selectedConditionIds: [],
                    excludedConditionIds: ['request-1'],
                },
            },
        });

        expect(screen.getByText('제외:')).not.toBeVisible();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.getByRole('list', {name: '확인할 요청'})).toHaveTextContent('E 근무 제외');
        await user.click(screen.getByText('선택 내역 보기'));
        expect(screen.getByRole('list', {name: '적용 및 제외 조건'})).toHaveTextContent('제외:');
        expect(screen.getByRole('list', {name: '적용 및 제외 조건'})).toHaveTextContent(conflictPlan.conditions[0].sourceSpan.quote);
        expect(screen.queryByRole('button', {name: '선택한 조건만 다시 검증'})).not.toBeInTheDocument();
    });

    it.each([false, true])('only edits the request, including when the schedule changed: stale=%s', async (stale) => {
        const user = userEvent.setup();
        const props = renderReview({stale});

        await user.click(screen.getByRole('button', {name: '요청 수정하기'}));

        expect(props.onEdit).toHaveBeenCalledOnce();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onRetry).not.toHaveBeenCalled();
    });

    it('prevents editing while another action is busy', async () => {
        const user = userEvent.setup();
        const props = renderReview({disabled: true});
        const edit = screen.getByRole('button', {name: '요청 수정하기'});

        expect(edit).toBeDisabled();
        await user.click(edit);
        expect(props.onEdit).not.toHaveBeenCalled();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onRetry).not.toHaveBeenCalled();
    });

    it('keeps historical conflicts readable without exposing actions', () => {
        renderReview({current: false, stale: true});

        expect(screen.getByRole('img', {name: '고정 근무 충돌'})).toBeVisible();
        expect(screen.getByRole('list', {name: '확인할 요청'})).toHaveTextContent('E 근무 제외');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('does not invent a conflicting target or allow execution when details are missing', () => {
        renderReview({plan: {...conflictPlan, conditions: []}});

        expect(screen.getByText('고정 근무와 요청이 충돌해요')).toBeVisible();
        expect(screen.queryByRole('list', {name: '확인할 요청'})).not.toBeInTheDocument();
        expect(screen.queryByText(/검증간호사|11월|E 근무/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다시 시도하기'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(1);
        expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeEnabled();
    });

    it('keeps unsupported requests in the conversation for natural-language correction', async () => {
        const user = userEvent.setup();
        const props = renderReview({plan: {...conflictPlan, state: 'UNSUPPORTED'}});

        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '선택한 조건만 다시 검증'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '요청 수정하기'}));

        expect(props.onEdit).toHaveBeenCalledOnce();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onRetry).not.toHaveBeenCalled();
    });
});

describe('request review actions', () => {
    const readyPlan: TSemanticPlan = {...conflictPlan, state: 'PREVIEW_READY', confirmationAllowed: true};

    it('executes a ready request only after explicit confirmation', async () => {
        const user = userEvent.setup();
        const props = renderReview({plan: readyPlan});

        expect(screen.getByText('이렇게 바꿀까요?')).toBeVisible();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(screen.getByRole('region')).toHaveTextContent('E 근무 제외');
        expect(screen.getByRole('region')).toHaveTextContent('필수 조건');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '이대로 수정하기'}));
        expect(props.onApply).toHaveBeenCalledOnce();
        expect(props.onEdit).not.toHaveBeenCalled();
        expect(props.onRetry).not.toHaveBeenCalled();
    });

    it.each([
        {name: 'busy', disabled: true},
        {name: 'changed schedule', stale: true},
        {name: 'server blocked confirmation', plan: {...readyPlan, confirmationAllowed: false}},
    ])('prevents confirmation when $name', async ({name: _name, ...overrides}) => {
        const user = userEvent.setup();
        const props = renderReview({plan: readyPlan, ...overrides});
        const apply = screen.getByRole('button', {name: '이대로 수정하기'});

        expect(apply).toBeDisabled();
        await user.click(apply);
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onRetry).not.toHaveBeenCalled();
    });

    it('retains confirmed conditions even when the preview confirmation flag is false', async () => {
        const user = userEvent.setup();
        const props = renderReview({plan: {...readyPlan, state: 'CONFIRMED', confirmationAllowed: false}});

        expect(screen.getByText('확인한 조건이에요')).toBeVisible();
        await user.click(screen.getByRole('button', {name: '이대로 수정하기'}));
        expect(props.onApply).toHaveBeenCalledOnce();
    });

    it.each([false, true])('shows historical confirmed requests without rerunning actions: applied=%s', (applied) => {
        renderReview({plan: {...readyPlan, state: 'CONFIRMED'}, current: false, applied});

        expect(screen.getByText(applied ? '이 요청으로 계산을 마쳤어요.' : '이전 요청 내용')).toBeVisible();
        expect(screen.getByRole('region')).toHaveTextContent('E 근무 제외');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('does not offer to execute already applied conditions again even when the message is current', () => {
        renderReview({plan: {...readyPlan, state: 'CONFIRMED'}, applied: true});

        expect(screen.getByText('이 요청으로 계산을 마쳤어요.')).toBeVisible();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('explains an invalid AI edit as an interpretation failure without asking the user to revise it', async () => {
        const user = userEvent.setup();
        const props = renderReview({plan: {...conflictPlan, state: 'FAILED', reasonCodes: ['INVALID_CONDITION_EDIT']}});
        expect(screen.getByText('요청 해석을 마치지 못했어요.')).toBeVisible();
        expect(screen.getByText(/AI의 요청 해석 결과를 확인하는 중 오류가 발생했어요/)).toHaveTextContent(
            '이번 요청으로 자동완성을 시작하거나 근무표를 바꾸지 않았어요.',
        );
        await user.click(screen.getByRole('button', {name: '다시 시도하기'}));
        expect(props.onRetry).toHaveBeenCalledOnce();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onEdit).not.toHaveBeenCalled();
    });

    it('recovers a failed interpretation through retry without executing or condition selection', async () => {
        const user = userEvent.setup();
        const props = renderReview({plan: {...conflictPlan, state: 'FAILED', reasonCodes: ['MODEL_TIMEOUT']}});

        expect(screen.queryByText(conflictPlan.conditions[0].sourceSpan.quote)).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '다시 시도하기'}));
        expect(props.onRetry).toHaveBeenCalledOnce();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onEdit).not.toHaveBeenCalled();
    });

    it('does not execute or offer generic partial selection for expired conditions', async () => {
        const user = userEvent.setup();
        const props = renderReview({plan: {...conflictPlan, state: 'EXPIRED'}});

        expect(screen.queryByText(conflictPlan.conditions[0].sourceSpan.quote)).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '이대로 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다시 시도하기'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '요청 수정하기'}));
        expect(props.onEdit).toHaveBeenCalledOnce();
        expect(props.onApply).not.toHaveBeenCalled();
        expect(props.onRetry).not.toHaveBeenCalled();
    });
});

describe('readable request scope', () => {
    it.each([true, false])('uses people for a single-day headcount and counts for a monthly total: %s', (singleDay) => {
        const plan: TSemanticPlan = {
            planId: 'p',
            planHash: 'h',
            sourceVersionId: 'v',
            state: 'PREVIEW_READY',
            summary: '',
            confirmationAllowed: true,
            reasonCodes: [],
            conditions: [
                {
                    intentId: 'i',
                    action: 'COUNT',
                    nurseIds: [1, 2],
                    dates: singleDay ? ['2026-10-05'] : ['2026-10-01', '2026-10-02'],
                    shiftCodes: ['O'],
                    quantifier: 'GROUP_TOTAL',
                    modality: 'HARD',
                    operator: 'EXACT',
                    count: 7,
                    sourceSpan: {quote: '휴무 인원 7명'},
                },
            ],
        };

        render(
            <AiSemanticReview
                plan={plan}
                current
                disabled={false}
                stale={false}
                applied={false}
                processing={null}
                rosterNurseIds={[2, 1]}
                nurseName={(id) => `간호사${id}`}
                copy={(ko) => ko}
                onApply={vi.fn()}
                onEdit={vi.fn()}
                onRetry={vi.fn()}
            />,
        );
        expect(screen.getByText('전체 간호사')).toBeVisible();
        expect(screen.getByRole('region')).toHaveTextContent(singleDay ? '휴무 인원 · 정확히 7명' : 'O 근무 · 합계 정확히 7회');
    });
    it('keeps each-nurse counts distinct from group totals in compact conditions', () => {
        renderReview({
            plan: {
                ...conflictPlan,
                state: 'PREVIEW_READY',
                confirmationAllowed: true,
                conditions: [{...conflictPlan.conditions[0], action: 'COUNT', shiftCodes: ['O'], operator: 'EXACT', count: 12}],
            },
        });

        expect(screen.getByRole('region')).toHaveTextContent('O 근무 · 정확히 12회씩');
        expect(screen.getByRole('region')).not.toHaveTextContent('합계');
    });
    it('does not label a selected subset as the whole roster', () => {
        const plan: TSemanticPlan = {
            planId: 'p',
            planHash: 'h',
            sourceVersionId: 'v',
            state: 'PREVIEW_READY',
            summary: '',
            confirmationAllowed: true,
            reasonCodes: [],
            conditions: [
                {
                    intentId: 'i',
                    action: 'ASSIGN',
                    nurseIds: [1],
                    dates: ['2026-10-05'],
                    shiftCodes: ['D'],
                    quantifier: 'EACH',
                    modality: 'HARD',
                    operator: null,
                    count: null,
                    sourceSpan: {quote: '간호사1 D'},
                },
            ],
        };

        render(
            <AiSemanticReview
                plan={plan}
                current
                disabled={false}
                stale={false}
                applied={false}
                processing={null}
                rosterNurseIds={[1, 2]}
                nurseName={(id) => `간호사${id}`}
                copy={(ko) => ko}
                onApply={vi.fn()}
                onEdit={vi.fn()}
                onRetry={vi.fn()}
            />,
        );
        expect(screen.getByText('간호사1님')).toBeVisible();
        expect(screen.queryByText('전체 간호사')).not.toBeInTheDocument();
    });
});

const priorityPlan: TSemanticPlan = {
    planId: 'priority',
    planHash: 'hash1',
    sourceVersionId: 'v',
    state: 'PREVIEW_READY',
    summary: '',
    confirmationAllowed: true,
    reasonCodes: [],
    modalityEditableIntentIds: ['count1', 'count2'],
    conditions: [1, 2].map((id) => ({
        intentId: `count${id}`,
        action: 'COUNT',
        nurseIds: [id],
        dates: ['2026-11-01'],
        shiftCodes: ['D'],
        quantifier: 'EACH',
        modality: 'HARD',
        operator: 'MAX',
        count: 1,
        sourceSpan: {quote: '데이 최대 1회'},
    })),
};

function priorityProps() {
    return {
        plan: priorityPlan,
        current: true,
        disabled: false,
        stale: false,
        applied: false,
        processing: null,
        nurseName: (id: number) => `간호사${id}`,
        copy: (ko: string) => ko,
        onApply: vi.fn(),
        onEdit: vi.fn(),
        onRetry: vi.fn(),
        onChangeModalities: vi.fn().mockResolvedValue(undefined),
    };
}

describe('request priority controls', () => {
    it('batches changes, blocks execution before saving and can cancel without a request', async () => {
        const props = priorityProps();

        render(<AiSemanticReview {...props} />);

        const groups = screen.getAllByRole('group', {name: '반영 방식'});

        fireEvent.click(within(groups[0]!).getByRole('radio', {name: '권장'}));
        fireEvent.click(within(groups[1]!).getByRole('radio', {name: '권장'}));
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        expect(props.onChangeModalities).not.toHaveBeenCalled();
        expect(screen.getByText('반영 방식 변경은 이번 실행에만 적용돼요.')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: '변경 취소'}));
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeEnabled();
        expect(screen.getAllByRole('radio', {name: '필수'}).every((input) => (input as HTMLInputElement).checked)).toBe(true);
        fireEvent.click(within(groups[0]!).getByRole('radio', {name: '권장'}));
        fireEvent.click(within(groups[1]!).getByRole('radio', {name: '권장'}));
        fireEvent.click(screen.getByRole('button', {name: '변경한 조건 확인하기'}));
        await waitFor(() => expect(props.onChangeModalities).toHaveBeenCalledExactlyOnceWith({count1: 'SOFT', count2: 'SOFT'}));
        expect(props.onApply).not.toHaveBeenCalled();
    });
    it('retains edits after a save failure and resets them for a new server hash', async () => {
        const props = priorityProps();

        props.onChangeModalities.mockRejectedValue(new Error('offline'));

        const {rerender} = render(<AiSemanticReview {...props} />);

        fireEvent.click(screen.getAllByRole('radio', {name: '권장'})[0]!);
        fireEvent.click(screen.getByRole('button', {name: '변경한 조건 확인하기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('변경 내용을 저장하지 못했어요');
        expect(screen.getAllByRole('radio', {name: '권장'})[0]).toBeChecked();
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        rerender(<AiSemanticReview {...props} plan={{...priorityPlan, planId: 'new', planHash: 'hash2'}} />);
        expect(screen.queryByRole('button', {name: '변경한 조건 확인하기'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('radio', {name: '필수'})[0]).toBeChecked();
    });
    it.each([{current: false}, {stale: true}, {disabled: true}, {plan: {...priorityPlan, modalityEditableIntentIds: undefined}}])(
        'prevents editing stale, historical, busy or old-server plans: %j',
        (override) => {
            render(<AiSemanticReview {...priorityProps()} {...override} />);

            for (const radio of screen.queryAllByRole('radio')) expect(radio).toBeDisabled();
        },
    );
    it('explains fixed assignment and exclusion semantics without offering unsupported soft controls', () => {
        render(
            <AiSemanticReview
                {...priorityProps()}
                plan={{...priorityPlan, conditions: [{...priorityPlan.conditions[0]!, action: 'FORBID'}], modalityEditableIntentIds: []}}
            />,
        );
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.getByText(/지정·금지한 배정은 필수로 적용해요/)).toBeVisible();
    });
});

describe('catalog plan wire compatibility', () => {
    const catalogCondition: TSemanticPlan['conditions'][number] = {
        ...conflictPlan.conditions[0],
        action: 'CATALOG_RULE',
        nurseIds: [1, 2],
        shiftCodes: ['D', 'E', 'N', 'O'],
        rule: {templateCode: 'FORBID_TRANSITION', params: {target: [1], fromShift: 'N', toShift: 'D'}},
        displayText: '검증간호사는 N 근무 다음 날 D 근무를 피해요.',
        count: null,
        operator: null,
    };
    const readyPlan = {...conflictPlan, state: 'PREVIEW_READY', confirmationAllowed: true, conditions: [catalogCondition]};

    it('shows the confirmed rule description without turning its evaluation scope into a quota', () => {
        renderReview({plan: readyPlan});

        const requests = screen.getByRole('list', {name: '반영할 요청'});

        expect(requests).toHaveTextContent(catalogCondition.displayText!);
        expect(requests).toHaveTextContent('필수 조건');
        expect(requests).not.toHaveTextContent('전체 간호사');
        expect(requests).not.toHaveTextContent(/null|정확히|D, E, N, O 근무/);
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeEnabled();
    });

    it('prevents confirming a catalog rule with no rendered description', () => {
        renderReview({plan: {...readyPlan, conditions: [{...catalogCondition, displayText: null}]}});
        expect(screen.getByRole('button', {name: '이대로 수정하기'})).toBeDisabled();
        expect(screen.queryByText(/null회/)).not.toBeInTheDocument();
    });

    it('renders a consecutive work limit as days rather than a monthly shift count', () => {
        renderReview({
            plan: {...readyPlan, conditions: [{...conflictPlan.conditions[0], action: 'MAX_CONSECUTIVE_WORK', operator: 'MAX', count: 4}]},
        });
        expect(screen.getByRole('list', {name: '반영할 요청'})).toHaveTextContent('연속 근무 최대 4일');
        expect(screen.getByRole('list', {name: '반영할 요청'})).not.toHaveTextContent('4회');
    });

    it('renders a soft assignment as a preference', () => {
        renderReview({plan: {...readyPlan, conditions: [{...conflictPlan.conditions[0], action: 'ASSIGN', modality: 'SOFT'}]}});
        expect(screen.getByRole('list', {name: '반영할 요청'})).toHaveTextContent('E 근무 선호');
    });
});
