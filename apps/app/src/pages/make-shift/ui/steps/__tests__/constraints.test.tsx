import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WardAPI} from '@/shared/api';
import {render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import {Constraints} from '../constraints';

vi.mock('@/features/auth/model/store', () => ({
    default: (selector: (state: {wardId: number}) => unknown) => selector({wardId: 1}),
}));

vi.mock('../../../model/make-shift-store', () => ({
    useMakeShiftStore: (
        selector: (state: {
            currentShiftTeamId: number;
            shiftTeams: {shiftTeamId: number; name: string; nurseCnt: number; nurses: never[]}[];
            year: number;
            month: number;
        }) => unknown,
    ) =>
        selector({
            currentShiftTeamId: 10,
            shiftTeams: [{shiftTeamId: 10, name: 'A Team', nurseCnt: 2, nurses: []}],
            year: 2026,
            month: 6,
        }),
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

const wardApiMocks = vi.mocked(WardAPI);
const recommendedTemplateCodes = [
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MIN_NIGHT_INTERVAL',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_CONTINUOUS_NIGHT',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_CERTAIN_WORK_TYPES',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
];
const recommendedDefaultParamsByTemplateCode: Record<string, Record<string, unknown>> = {
    CORE_MAX_CONTINUOUS_WORK: {target: {type: 'ALL'}, count: 5},
    CORE_MIN_NIGHT_INTERVAL: {target: {type: 'ALL'}, count: 5},
    CORE_MAX_CONTINUOUS_NIGHT: {target: {type: 'ALL'}, count: 3},
    CORE_MIN_CONTINUOUS_NIGHT: {target: {type: 'ALL'}, count: 2},
    CORE_MIN_OFF_AFTER_NIGHT: {target: {type: 'ALL'}, count: 2},
    CORE_EXCLUDE_CERTAIN_WORK_TYPES: {target: {type: 'ALL'}},
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: {target: {type: 'ALL'}},
};
const recommendedTemplates = recommendedTemplateCodes.map((templateCode, index) => ({
    templateCode,
    category: 'CORE',
    displayTemplate: index === 0 ? '연속 근무는 {count}일 이하로 배정해요' : `${templateCode} {count}`,
    severity: 'HARD' as const,
    allowedSeverities: ['HARD' as const, 'SOFT' as const],
    supportedInGenerator: true,
    supportedInValidator: true,
    slots:
        templateCode === 'CORE_EXCLUDE_CERTAIN_WORK_TYPES' || templateCode === 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF'
            ? [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}]
            : [
                  {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                  {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 7},
              ],
}));
const recommendedServerRules = recommendedTemplateCodes.map((templateCode, index) => ({
    shiftConstraintRuleId: index + 1,
    templateCode,
    category: 'CORE',
    severity: 'HARD' as const,
    sortOrder: index + 1,
    params: recommendedDefaultParamsByTemplateCode[templateCode],
    selected: true,
    isImportant: true,
}));

describe('Constraints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        wardApiMocks.getShiftConstraintRules.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [],
        });
        wardApiMocks.updateShiftConstraintRules.mockImplementation(async (wardId, shiftTeamId, payload) => ({
            schemaVersion: 1,
            wardId,
            shiftTeamId,
            rules: payload.rules.map((rule, index) => ({
                ...rule,
                shiftConstraintRuleId: rule.shiftConstraintRuleId ?? index + 100,
                category: rule.templateCode === 'SOFT_NO_SAME_DUTY_PAIR' ? 'COMBINATION' : 'CORE',
                displayText: '',
                isValid: true,
                invalidReason: null,
            })),
        }));
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValue({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{type: 'ALL', label: '전체'}],
                nurses: [
                    {type: 'NURSE', nurseId: 1, label: 'Nurse A', name: 'Nurse A'},
                    {type: 'NURSE', nurseId: 2, label: 'Nurse B', name: 'Nurse B'},
                ],
            },
            templates: [
                ...recommendedTemplates,
                {
                    templateCode: 'SOFT_NO_SAME_DUTY_PAIR',
                    category: 'COMBINATION',
                    displayTemplate: '{nurseA} and {nurseB} should not work together',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nurseA', label: 'Nurse A', inputType: 'SELECT', optionGroup: 'NURSES'},
                        {key: 'nurseB', label: 'Nurse B', inputType: 'SELECT', optionGroup: 'NURSES'},
                    ],
                },
            ],
        });
        wardApiMocks.getShiftTeamNurses.mockResolvedValue([
            {nurseId: 1, name: 'Nurse A', isPreceptor: false},
            {nurseId: 2, name: 'Nurse B', isPreceptor: false},
        ] as never);
        wardApiMocks.getShiftTypes.mockResolvedValue([]);
    });

    it('keeps the rule list empty when the server has no saved rules', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByText('제약조건을 추가하면 여기에 보여요.')).toBeInTheDocument();

        expect(screen.queryByText((content) => content.includes('연속 근무는'))).not.toBeInTheDocument();
        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
    });

    it('asks for confirmation before deleting or unmarking one of the seven recommended rules', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: recommendedServerRules,
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByText((content) => content.includes('연속 근무는'))).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole('button', {name: '제약 조건 삭제'})[0]!);
        expect(screen.getByText('권장 조건을 삭제할까요?')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '유지하기'}));
        await userEvent.click(screen.getAllByRole('checkbox', {name: '중요 표시 해제'})[0]!);

        expect(screen.getByText('중요 표시를 뺄까요?')).toBeInTheDocument();
    });

    it('saves important toggles as severity changes', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'SOFT_NO_SAME_DUTY_PAIR',
                    category: 'COMBINATION',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {
                        nurseA: {type: 'NURSE', nurseId: 1, label: 'Nurse A'},
                        nurseB: {type: 'NURSE', nurseId: 2, label: 'Nurse B'},
                    },
                    selected: true,
                    isImportant: true,
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByRole('button', {name: 'Nurse A'})).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole('checkbox', {name: '중요 표시 해제'})[0]!);

        await waitFor(() => {
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledWith(
                1,
                10,
                expect.objectContaining({
                    rules: expect.arrayContaining([
                        expect.objectContaining({
                            templateCode: 'SOFT_NO_SAME_DUTY_PAIR',
                            severity: 'SOFT',
                            isImportant: false,
                        }),
                    ]),
                }),
            );
        });
    });

    it('shows all nurses for the first worker-combination dropdown and excludes that nurse from the next dropdown', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(screen.getByRole('button', {name: '근무자 조합'}));
        await userEvent.click(screen.getByRole('button', {name: 'Nurse A'}));

        let listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByRole('option', {name: 'Nurse A'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: 'Nurse B'})).toBeInTheDocument();

        await userEvent.click(within(listbox).getByRole('option', {name: 'Nurse B'}));
        await userEvent.click(screen.getByRole('button', {name: 'Nurse A'}));

        listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByRole('option', {name: 'Nurse A'})).toBeInTheDocument();
        expect(within(listbox).queryByRole('option', {name: 'Nurse B'})).not.toBeInTheDocument();
    });

    it('saves changed rules through the shared shift constraint rules API', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="flow" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(screen.getByRole('button', {name: '근무자 조합'}));
        await userEvent.click(document.querySelector<HTMLButtonElement>('button[title="추가"]')!);

        await waitFor(() => {
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledWith(
                1,
                10,
                expect.objectContaining({
                    rules: expect.arrayContaining([
                        expect.objectContaining({
                            templateCode: 'SOFT_NO_SAME_DUTY_PAIR',
                            severity: 'SOFT',
                            params: expect.objectContaining({
                                nurseA: expect.objectContaining({type: 'NURSE', nurseId: 1}),
                                nurseB: expect.objectContaining({type: 'NURSE', nurseId: 2}),
                            }),
                            selected: true,
                        }),
                    ]),
                }),
            );
        });
    });

    it('renders server rules with numeric params without crashing', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {},
            templates: [
                {
                    templateCode: 'SOFT_NO_N_TO_D',
                    category: 'FORBIDDEN',
                    displayTemplate: '{target}은 N 다음날 D 근무를 피해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'NURSES'}],
                },
            ],
        });
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 20,
                    templateCode: 'SOFT_NO_N_TO_D',
                    category: 'FORBIDDEN',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {target: 1},
                    selected: true,
                    isImportant: false,
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByRole('button', {name: 'Nurse A'})).toBeInTheDocument();
    });
});
