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

describe('Constraints', () => {
    beforeEach(() => {
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
                nurses: [
                    {type: 'NURSE', nurseId: 1, label: 'Nurse A', name: 'Nurse A'},
                    {type: 'NURSE', nurseId: 2, label: 'Nurse B', name: 'Nurse B'},
                ],
            },
            templates: [
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

    it('shows all nurses for the first worker-combination dropdown and excludes that nurse from the next dropdown', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
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
