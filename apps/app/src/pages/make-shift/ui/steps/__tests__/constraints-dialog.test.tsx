import * as Dialog from '@radix-ui/react-dialog';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createRef, type ReactElement, useRef, useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import {act, fireEvent, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import {Constraints, type TConstraintsEditorHandle, type TConstraintsEditorState} from '../constraints';

vi.mock('react-hot-toast', () => ({default: {success: vi.fn(), error: vi.fn()}}));
vi.mock('@/features/auth/model/store', () => ({
    default: (selector: (state: {wardId: number}) => unknown) => selector({wardId: 1}),
}));
vi.mock('../../../model/make-shift-store', () => ({
    useMakeShiftStore: (selector: (state: Record<string, unknown>) => unknown) =>
        selector({wardId: 1, currentShiftTeamId: 10, shiftTeams: [], shiftTeamsStatus: 'success', year: 2026, month: 6}),
}));
vi.mock('@/shared/api', () => ({
    WardAPI: {
        getShiftConstraintRuleCandidates: vi.fn(),
        getShiftConstraintRules: vi.fn(),
        updateShiftConstraintRules: vi.fn(),
        getShiftTeamNurses: vi.fn(),
        getShiftTypes: vi.fn(),
    },
}));

const api = vi.mocked(WardAPI);
const allTarget = {type: 'ALL'};
const nurseA = {type: 'NURSE', nurseId: 1};
const nurseB = {type: 'NURSE', nurseId: 2};
const countRule = {
    shiftConstraintRuleId: 41,
    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
    category: 'CORE',
    severity: 'HARD' as const,
    sortOrder: 1,
    params: {target: allTarget, count: 5},
    selected: true,
    isImportant: true,
};
const pairRule = {
    shiftConstraintRuleId: 42,
    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
    category: 'NURSE_COMBINATION',
    severity: 'SOFT' as const,
    sortOrder: 2,
    params: {nurseA, nurseB},
    selected: true,
    isImportant: false,
};
const hiddenRule = {
    shiftConstraintRuleId: 43,
    templateCode: 'EXISTING_SERVER_ONLY_RULE',
    category: 'CORE',
    severity: 'HARD' as const,
    sortOrder: 3,
    params: {days: [1, 7], nested: {type: 'KEEP_ME', value: 'original'}},
    selected: false,
    isImportant: true,
};
const editorProps = {wardId: 1, shiftTeamId: 10, shiftTeams: [], year: 2026, month: 6, variant: 'dialog' as const};
const clients: QueryClient[] = [];

function renderEditor(element: ReactElement) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});

    clients.push(client);

    return render(element, {wrapper: ({children}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>});
}

async function ready(stateChanged: ReturnType<typeof vi.fn>) {
    await waitFor(() => expect(stateChanged).toHaveBeenLastCalledWith(expect.objectContaining({ready: true, saving: false})));
}

function latestState(stateChanged: ReturnType<typeof vi.fn>) {
    const calls = stateChanged.mock.calls;

    return calls[calls.length - 1]?.[0] as TConstraintsEditorState;
}

async function apply(ref: {current: TConstraintsEditorHandle | null}) {
    let result: boolean | undefined;

    await act(async () => {
        result = await ref.current!.apply();
    });

    return result;
}

describe('Constraints dialog editor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()});
        api.getShiftConstraintRules.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [countRule, pairRule, hiddenRule],
        });
        api.updateShiftConstraintRules.mockImplementation(async (wardId, shiftTeamId, payload) => ({
            schemaVersion: 1,
            wardId,
            shiftTeamId,
            rules: (payload.rules ?? []).map((rule, index) => ({
                ...rule,
                shiftConstraintRuleId: rule.shiftConstraintRuleId ?? index + 100,
                category: rule.templateCode === 'NURSE_PAIR_NOT_SAME_SHIFT' ? 'NURSE_COMBINATION' : 'CORE',
                displayText: '',
                isValid: true,
                invalidReason: null,
            })),
        }));
        api.getShiftConstraintRuleCandidates.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{type: 'ALL', label: '모든 간호사'}],
                nurses: [
                    {...nurseA, label: 'Nurse A', name: 'Nurse A'},
                    {...nurseB, label: 'Nurse B', name: 'Nurse B'},
                ],
            },
            templates: [
                {
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'CORE',
                    displayTemplate: '{target}은 {count}일 이상 연속으로 근무하면 안 돼요.',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 31},
                    ],
                },
                {
                    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
                    category: 'NURSE_COMBINATION',
                    displayTemplate: '{nurseA} and {nurseB} should not work together',
                    severity: 'SOFT',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nurseA', label: 'Nurse A', inputType: 'SELECT', optionGroup: 'NURSES'},
                        {key: 'nurseB', label: 'Nurse B', inputType: 'SELECT', optionGroup: 'NURSES'},
                    ],
                },
                {
                    templateCode: 'FORBID_N_THEN_D',
                    category: 'FORBIDDEN_PATTERN',
                    displayTemplate: '{target}은 N 다음 날 D 근무를 피해요.',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}],
                },
            ],
        });
        api.getShiftTeamNurses.mockResolvedValue([
            {nurseId: 1, name: 'Nurse A', nurseShiftTypes: [{wardShiftTypeId: 1, isPossible: true}]},
            {nurseId: 2, name: 'Nurse B', nurseShiftTypes: [{wardShiftTypeId: 1, isPossible: true}]},
        ] as never);
        api.getShiftTypes.mockResolvedValue([
            {wardShiftTypeId: 1, shortName: 'D', classification: 'DAY', rotationSystem: 'THREE', isActive: true},
            {wardShiftTypeId: 2, shortName: 'E', classification: 'EVENING', rotationSystem: 'THREE', isActive: true},
            {wardShiftTypeId: 3, shortName: 'N', classification: 'NIGHT', rotationSystem: 'THREE', isActive: true},
        ] as never);
    });

    afterEach(async () => {
        clients.splice(0).forEach((client) => client.clear());

        if (i18n.language !== 'ko')
            await act(async () => {
                await i18n.changeLanguage('ko');
            });
    });

    it('edits migrated OFF and annual leave rules through the common editor with month and revision preserved', async () => {
        const shifts = [
            {type: 'SET', wardShiftTypeIds: [4], label: 'OFF', classification: 'OFF'},
            {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5, label: '연차', classification: 'ANNUAL_LEAVE'},
        ];
        const rules = shifts.map((_, index) => ({
            shiftConstraintRuleId: 101 + index,
            templateCode: 'SHIFT_COUNT_PER_PERIOD',
            category: 'FORBIDDEN_PATTERN',
            severity: 'HARD' as const,
            sortOrder: index + 1,
            selected: true,
            isImportant: true,
            params: {
                target: nurseA,
                shift: index === 0 ? {type: 'SET', wardShiftTypeIds: [4]} : {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5},
                count: index === 0 ? 9 : 2,
                period: {type: 'MONTH'},
                operator: {type: 'EXACT'},
                aggregation: {type: 'EACH'},
                monthScope: {year: 2026, month: 6},
                source: 'PERSONAL_MONTHLY_REST_POLICY',
            },
        }));

        api.getShiftConstraintRules.mockResolvedValue({schemaVersion: 1, wardId: 1, shiftTeamId: 10, revision: 'original-r1', rules});
        api.getShiftConstraintRuleCandidates.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{...nurseA, label: 'Nurse A'}],
                nurses: [{...nurseA, label: 'Nurse A'}],
                shiftsWithAll: shifts,
                periods: [{type: 'MONTH', label: '한 달'}],
                countOperators: [{type: 'EXACT', label: '정확히'}],
                mixedAssignmentAggregations: [{type: 'EACH', label: '개인별'}],
            },
            templates: [
                {
                    templateCode: 'SHIFT_COUNT_PER_PERIOD',
                    category: 'FORBIDDEN_PATTERN',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    displayTemplate: '{target}의 {shift} 근무는 {period}에 {operator} {count}회예요.',
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: '대상', inputType: 'SELECT', optionGroup: 'targets'},
                        {key: 'shift', label: '근무', inputType: 'SELECT', optionGroup: 'shiftsWithAll'},
                        {key: 'period', label: '기간', inputType: 'SELECT', optionGroup: 'periods'},
                        {key: 'operator', label: '조건', inputType: 'SELECT', optionGroup: 'countOperators'},
                        {key: 'aggregation', label: '집계', inputType: 'SELECT', optionGroup: 'mixedAssignmentAggregations'},
                        {key: 'count', label: '횟수', inputType: 'NUMBER', min: 0, max: 31},
                    ],
                },
            ],
        } as never);
        api.getShiftTypes.mockResolvedValue([
            {wardShiftTypeId: 1, shortName: 'D', classification: 'DAY', rotationSystem: 'THREE', isActive: true},
            {wardShiftTypeId: 4, shortName: 'O', classification: 'OFF', rotationSystem: 'NONE', isActive: true},
            {wardShiftTypeId: 5, shortName: 'A', classification: 'ANNUAL_LEAVE', rotationSystem: 'NONE', isActive: true},
        ] as never);

        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();

        renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} />);
        await ready(stateChanged);
        expect(api.getShiftConstraintRules).toHaveBeenCalledWith(1, 10, 2026, 6);
        expect(screen.getAllByText('2026년 6월')).toHaveLength(2);

        const offInput = screen.getAllByRole('spinbutton').find((input) => (input as HTMLInputElement).value === '9')!;

        expect(offInput).toBeDefined();
        expect(screen.getByRole('button', {name: 'OFF'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '연차'})).toBeInTheDocument();
        fireEvent.change(offInput, {target: {value: '8'}});
        fireEvent.blur(offInput);
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(await apply(ref)).toBe(true);
        expect(api.updateShiftConstraintRules).toHaveBeenCalledWith(
            1,
            10,
            expect.objectContaining({
                year: 2026,
                month: 6,
                revision: 'original-r1',
                rules: expect.arrayContaining([
                    expect.objectContaining({
                        shiftConstraintRuleId: 101,
                        params: expect.objectContaining({
                            count: 8,
                            shift: {type: 'SET', wardShiftTypeIds: [4]},
                            monthScope: {year: 2026, month: 6},
                        }),
                    }),
                    expect.objectContaining({
                        shiftConstraintRuleId: 102,
                        params: expect.objectContaining({count: 2, shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5}}),
                    }),
                ]),
            }),
        );
    });

    it('loads an empty editor without writing recommended defaults or migrations', async () => {
        api.getShiftConstraintRules.mockResolvedValue({schemaVersion: 1, wardId: 1, shiftTeamId: 10, rules: []});

        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();
        const onApplied = vi.fn();

        renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} onApplied={onApplied} />);
        await ready(stateChanged);

        expect(latestState(stateChanged)).toMatchObject({dirty: false, count: 0});
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(await apply(ref)).toBe(true);
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
    });

    it('keeps inline edits and deletion local until apply, preserving untouched server IDs and params', async () => {
        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();
        const onApplied = vi.fn();

        renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} onApplied={onApplied} />);
        await ready(stateChanged);

        const input = screen.getByRole('spinbutton');

        fireEvent.change(input, {target: {value: '6'}});
        fireEvent.blur(input);

        const pairRow = screen.getByRole('button', {name: 'Nurse A'}).closest('[data-constraint-rule-id]')!;

        await userEvent.click(within(pairRow as HTMLElement).getByRole('button', {name: '제약 조건 삭제'}));

        expect(latestState(stateChanged)).toMatchObject({dirty: true, count: 1});
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(await apply(ref)).toBe(true);
        expect(api.updateShiftConstraintRules).toHaveBeenCalledExactlyOnceWith(1, 10, {
            year: 2026,
            month: 6,
            revision: undefined,
            rules: [
                {
                    shiftConstraintRuleId: 41,
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {target: allTarget, count: 6},
                    selected: true,
                    isImportant: true,
                },
                {
                    shiftConstraintRuleId: 43,
                    templateCode: 'EXISTING_SERVER_ONLY_RULE',
                    severity: 'HARD',
                    sortOrder: 2,
                    params: hiddenRule.params,
                    selected: false,
                    isImportant: true,
                },
            ],
        });
        expect(onApplied).toHaveBeenCalledOnce();
        expect(latestState(stateChanged)).toMatchObject({dirty: false, saving: false});
    });

    it('retains the edited draft after a failed PUT and saves the same values when retried', async () => {
        api.updateShiftConstraintRules.mockRejectedValueOnce(new Error('temporary write failure'));

        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();
        const onApplied = vi.fn();

        renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} onApplied={onApplied} />);
        await ready(stateChanged);
        fireEvent.change(screen.getByRole('spinbutton'), {target: {value: '4'}});
        fireEvent.blur(screen.getByRole('spinbutton'));

        expect(await apply(ref)).toBe(false);
        expect(screen.getByRole('spinbutton')).toHaveValue(4);
        expect(latestState(stateChanged)).toMatchObject({dirty: true, saving: false});
        expect(onApplied).not.toHaveBeenCalled();

        const failedPayload = api.updateShiftConstraintRules.mock.calls[0]?.[2];

        expect(await apply(ref)).toBe(true);
        expect(api.updateShiftConstraintRules).toHaveBeenCalledTimes(2);
        expect(api.updateShiftConstraintRules.mock.calls[1]?.[2]).toEqual(failedPayload);
        expect(onApplied).toHaveBeenCalledOnce();
    });

    it('adds a rule through the same condition picker without persisting until apply', async () => {
        api.getShiftConstraintRules.mockResolvedValue({schemaVersion: 1, wardId: 1, shiftTeamId: 10, rules: [countRule]});

        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();

        renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} />);
        await ready(stateChanged);
        await userEvent.click(screen.getByRole('button', {name: '제약 조건 추가'}));
        await userEvent.click(screen.getByRole('button', {name: '근무자 조합'}));

        const card = document.querySelector<HTMLElement>('[data-constraint-template-card="NURSE_PAIR_NOT_SAME_SHIFT"]')!;

        expect(card).toBeInTheDocument();
        await userEvent.click(within(card).getByTitle('추가'));

        expect(latestState(stateChanged)).toMatchObject({dirty: true, count: 2});
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(await apply(ref)).toBe(true);
        expect(api.updateShiftConstraintRules.mock.calls[0]?.[2]?.rules).toEqual([
            expect.objectContaining({shiftConstraintRuleId: 41, templateCode: countRule.templateCode, params: countRule.params}),
            expect.objectContaining({
                shiftConstraintRuleId: undefined,
                templateCode: pairRule.templateCode,
                params: {nurseA, nurseB},
                selected: true,
            }),
        ]);
    });

    it('retries only context refresh when the PUT succeeded but onApplied failed', async () => {
        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();
        const onApplied = vi.fn().mockRejectedValueOnce(new Error('context refresh failed')).mockResolvedValueOnce(undefined);

        renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} onApplied={onApplied} />);
        await ready(stateChanged);
        fireEvent.change(screen.getByRole('spinbutton'), {target: {value: '7'}});
        fireEvent.blur(screen.getByRole('spinbutton'));

        expect(await apply(ref)).toBe(false);
        expect(api.updateShiftConstraintRules).toHaveBeenCalledOnce();
        expect(latestState(stateChanged)).toMatchObject({dirty: false, refreshPending: true, saving: false});
        expect(await apply(ref)).toBe(true);
        expect(api.updateShiftConstraintRules).toHaveBeenCalledOnce();
        expect(onApplied).toHaveBeenCalledTimes(2);
        expect(latestState(stateChanged)).toMatchObject({dirty: false, refreshPending: false, saving: false});
    });

    it('guards both editing and applying while externally disabled', async () => {
        const ref = createRef<TConstraintsEditorHandle>();
        const stateChanged = vi.fn();
        const view = renderEditor(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} />);

        await ready(stateChanged);
        fireEvent.change(screen.getByRole('spinbutton'), {target: {value: '6'}});
        fireEvent.blur(screen.getByRole('spinbutton'));
        view.rerender(<Constraints {...editorProps} editorRef={ref} onEditorStateChange={stateChanged} disabled />);

        expect(screen.getByRole('spinbutton')).toBeDisabled();
        expect(screen.getByRole('button', {name: '제약 조건 추가'})).toBeDisabled();
        expect(await apply(ref)).toBe(false);
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
    });

    it('keeps child selection and recommended-delete confirmation inside the parent dialog', async () => {
        api.getShiftConstraintRules.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [{...countRule, shiftConstraintRuleId: 51, templateCode: 'FORBID_N_THEN_D', params: {target: allTarget}}],
        });

        const stateChanged = vi.fn();

        function ParentDialog() {
            const [open, setOpen] = useState(true);
            const content = useRef<HTMLDivElement>(null);

            return (
                <Dialog.Root open={open} onOpenChange={setOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay />
                        <Dialog.Content
                            ref={content}
                            aria-describedby={undefined}
                            onEscapeKeyDown={(event) => {
                                if (content.current?.querySelector('[data-constraint-layer-open="true"]')) event.preventDefault();
                            }}
                        >
                            <Dialog.Title>근무표 제약조건</Dialog.Title>
                            <Constraints {...editorProps} onEditorStateChange={stateChanged} />
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            );
        }

        renderEditor(<ParentDialog />);
        await ready(stateChanged);

        const parent = screen.getByRole('dialog', {name: '근무표 제약조건'});

        await userEvent.click(within(parent).getByRole('button', {name: '모든 간호사'}));

        const listbox = await screen.findByRole('listbox');

        expect(parent).toContainElement(listbox);
        await userEvent.click(within(listbox).getByRole('option', {name: '모든 간호사'}));
        expect(parent).toBeInTheDocument();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        await userEvent.click(within(parent).getByRole('button', {name: '모든 간호사'}));
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(parent).toBeInTheDocument();

        await userEvent.click(within(parent).getByRole('button', {name: '제약 조건 삭제'}));

        const warning = await screen.findByRole('dialog', {name: '권장 조건을 삭제할까요?'});

        expect(parent).toContainElement(warning);
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', {name: '권장 조건을 삭제할까요?'})).not.toBeInTheDocument();
        expect(parent).toBeInTheDocument();
        expect(api.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(latestState(stateChanged)).toMatchObject({dirty: false, count: 1});
    });
});
