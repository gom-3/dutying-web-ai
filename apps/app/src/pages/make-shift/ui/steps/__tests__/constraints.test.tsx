import toast from 'react-hot-toast';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {WardAPI} from '@/shared/api';
import {fireEvent, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import {Constraints} from '../constraints';

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

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
const scrollIntoViewMock = vi.fn();

function getLastUpdatePayload() {
    const calls = wardApiMocks.updateShiftConstraintRules.mock.calls;

    return calls[calls.length - 1]?.[2];
}

const recommendedTemplateCodes = [
    'CORE_MAX_CONTINUOUS_WORK',
    'CORE_MIN_NIGHT_INTERVAL',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'FORBID_E_THEN_N',
    'CORE_MAX_CONTINUOUS_NIGHT',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
];
const threeShiftDefaultTemplateCodes = [
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
    'CORE_MIN_OFF_AFTER_NIGHT',
    'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
];
const recommendedDefaultParamsByTemplateCode: Record<string, Record<string, unknown>> = {
    CORE_MAX_CONTINUOUS_WORK: {target: {type: 'ALL'}, count: 5},
    CORE_MIN_NIGHT_INTERVAL: {target: {type: 'ALL'}, count: 5},
    CORE_MAX_CONTINUOUS_NIGHT: {target: {type: 'ALL'}, count: 3},
    CORE_MIN_CONTINUOUS_NIGHT: {target: {type: 'ALL'}, count: 2},
    CORE_MIN_OFF_AFTER_NIGHT: {target: {type: 'ALL'}, count: 2},
    FORBID_N_THEN_D: {target: {type: 'ALL'}},
    FORBID_N_THEN_E: {target: {type: 'ALL'}},
    FORBID_E_THEN_D: {target: {type: 'ALL'}},
    FORBID_E_THEN_N: {target: {type: 'ALL'}},
    CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: {target: {type: 'ALL'}},
};
const recommendedCategoryByTemplateCode: Record<string, string> = {
    FORBID_N_THEN_D: 'FORBIDDEN_PATTERN',
    FORBID_N_THEN_E: 'FORBIDDEN_PATTERN',
    FORBID_E_THEN_D: 'FORBIDDEN_PATTERN',
    FORBID_E_THEN_N: 'FORBIDDEN_PATTERN',
};
const recommendedTemplates = recommendedTemplateCodes.map((templateCode, index) => ({
    templateCode,
    category: recommendedCategoryByTemplateCode[templateCode] ?? 'CORE',
    displayTemplate: index === 0 ? '연속 근무는 {count}일 이하로 배정해요' : `${templateCode} {count}`,
    severity: 'HARD' as const,
    allowedSeverities: ['HARD' as const, 'SOFT' as const],
    supportedInGenerator: true,
    supportedInValidator: true,
    slots:
        templateCode === 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF' || templateCode.startsWith('FORBID_')
            ? [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}]
            : [
                  {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                  {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 7},
              ],
}));
const recommendedServerRules = threeShiftDefaultTemplateCodes.map((templateCode, index) => ({
    shiftConstraintRuleId: index + 1,
    templateCode,
    category: recommendedCategoryByTemplateCode[templateCode] ?? 'CORE',
    severity: 'HARD' as const,
    sortOrder: index + 1,
    params: recommendedDefaultParamsByTemplateCode[templateCode],
    selected: true,
    isImportant: true,
}));
const threeShiftWardShiftTypes = [
    {wardShiftTypeId: 1, shortName: 'D', classification: 'DAY', rotationSystem: 'THREE', isActive: true},
    {wardShiftTypeId: 2, shortName: 'E', classification: 'EVENING', rotationSystem: 'THREE', isActive: true},
    {wardShiftTypeId: 3, shortName: 'N', classification: 'NIGHT', rotationSystem: 'THREE', isActive: true},
];
const twoShiftWardShiftTypes = [
    {
        wardShiftTypeId: 4,
        name: '2교대 주간',
        shortName: 'ⓓ',
        color: '#F59E0B',
        classification: 'DAY',
        rotationSystem: 'TWO',
        isActive: true,
    },
    {
        wardShiftTypeId: 5,
        name: '2교대 야간',
        shortName: 'ⓝ',
        color: '#4F46E5',
        classification: 'NIGHT',
        rotationSystem: 'TWO',
        isActive: true,
    },
];
const twoShiftConstraintTemplates = ['TWO_SHIFT_MAX_LINES', 'CORE_MIN_REST_HOURS', 'MAX_MONTHLY_WORK_HOURS'].map((templateCode) => ({
    templateCode,
    category: templateCode === 'TWO_SHIFT_MAX_LINES' ? 'TWO_SHIFT' : 'CORE',
    displayTemplate: `${templateCode}_SENTINEL`,
    severity: 'HARD' as const,
    allowedSeverities: ['HARD' as const],
    supportedInGenerator: true,
    supportedInValidator: true,
    slots: [],
}));

describe('Constraints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            writable: true,
            value: scrollIntoViewMock,
        });
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
            rules: (payload.rules ?? []).map((rule, index) => ({
                ...rule,
                shiftConstraintRuleId: rule.shiftConstraintRuleId ?? index + 100,
                category: rule.templateCode === 'NURSE_PAIR_NOT_SAME_SHIFT' ? 'NURSE_COMBINATION' : 'CORE',
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
            ],
        });
        wardApiMocks.getShiftTeamNurses.mockResolvedValue([
            {
                nurseId: 1,
                name: 'Nurse A',
                isPreceptor: false,
                nurseShiftTypes: [
                    {wardShiftTypeId: 1, isPossible: true},
                    {wardShiftTypeId: 4, isPossible: true},
                ],
            },
            {
                nurseId: 2,
                name: 'Nurse B',
                isPreceptor: false,
                nurseShiftTypes: [
                    {wardShiftTypeId: 1, isPossible: true},
                    {wardShiftTypeId: 4, isPossible: true},
                ],
            },
        ] as never);
        wardApiMocks.getShiftTypes.mockResolvedValue(threeShiftWardShiftTypes as never);
    });

    afterEach(async () => {
        await i18n.changeLanguage('ko');
    });

    it('shows a constraint-shaped skeleton while rules are loading', () => {
        wardApiMocks.getShiftConstraintRules.mockReturnValueOnce(new Promise(() => {}));
        wardApiMocks.getShiftConstraintRuleCandidates.mockReturnValueOnce(new Promise(() => {}));

        render(<Constraints wardId={999} shiftTeamId={9990} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const skeleton = screen.getByTestId('make-shift-constraints-skeleton');

        expect(skeleton).toHaveAttribute('role', 'status');
        expect(skeleton).toHaveAttribute('aria-busy', 'true');
    });

    it('keeps the rule list empty when the server has no saved rules', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByText('제약조건을 추가하면 여기에 보여요.')).toBeInTheDocument();

        expect(screen.queryByText((content) => content.includes('연속 근무는'))).not.toBeInTheDocument();
        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
    });

    it('renders constraint templates from the active locale instead of Korean server templates', async () => {
        await i18n.changeLanguage('ja');

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        await waitFor(() => expect(document.body.textContent).toContain('N勤務後に最低'));
        expect(document.body.textContent).toContain('日の休みが必要です');
        expect(screen.queryByText((content) => content.includes('연속 근무는'))).not.toBeInTheDocument();
    });

    it('localizes two-shift night recovery templates instead of mixing Korean server text with Japanese options', async () => {
        await i18n.changeLanguage('ja');
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 2,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'TWO',
            options: {
                twoShiftNights: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 5,
                        code: '夜勤',
                        name: '夜勤',
                        label: '夜勤',
                        classification: 'NIGHT',
                        rotationSystem: 'TWO',
                    },
                ],
                twoShiftNightContinuations: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 6,
                        code: '夜勤終了日',
                        name: '夜勤終了日',
                        label: '夜勤終了日',
                        classification: 'NIGHT_CONTINUATION',
                        rotationSystem: 'TWO',
                    },
                ],
                offShifts: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 7,
                        code: '休み',
                        name: '休み',
                        label: '休み',
                        classification: 'OFF',
                        rotationSystem: 'NONE',
                    },
                ],
            },
            templates: [
                {
                    templateCode: 'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
                    category: 'CORE',
                    displayTemplate:
                        '모든 간호사는 연속 {nightShift} 근무 후 {nightContinuationShift}와 최소 {count}일의 {offShift}가 필요해요.',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nightShift', label: '야간 근무', inputType: 'SHIFT', optionGroup: 'twoShiftNights'},
                        {
                            key: 'nightContinuationShift',
                            label: '야간 후반부',
                            inputType: 'SHIFT',
                            optionGroup: 'twoShiftNightContinuations',
                        },
                        {key: 'count', label: '추가 오프 일수', inputType: 'NUMBER', min: 0, max: 7},
                        {key: 'offShift', label: '휴무', inputType: 'SHIFT', optionGroup: 'offShifts'},
                    ],
                },
                {
                    templateCode: 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
                    category: 'CORE',
                    displayTemplate:
                        '모든 간호사는 연속 {nightShift} 근무 후 최소 {count}일의 {offShift}가 필요해요. 이 중 첫날은 야간근무 후 회복일로 계산해요.',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nightShift', label: '야간 근무', inputType: 'SHIFT', optionGroup: 'twoShiftNights'},
                        {key: 'count', label: '오프 일수', inputType: 'NUMBER', min: 1, max: 8},
                        {key: 'offShift', label: '휴무', inputType: 'SHIFT', optionGroup: 'offShifts'},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        const continuationCard = await waitFor(() => {
            const card = document.querySelector<HTMLElement>(
                '[data-constraint-template-card="TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF"]',
            );

            expect(card).toBeInTheDocument();

            return card!;
        });
        const pairCard = document.querySelector<HTMLElement>('[data-constraint-template-card="TWO_SHIFT_NIGHT_PAIR_MIN_OFF"]');

        expect(continuationCard.textContent).toContain('すべての看護師は連続した');
        expect(continuationCard.textContent).toContain('勤務後、');
        expect(continuationCard.textContent).toContain('と最低');
        expect(continuationCard.textContent).toContain('日の');
        expect(continuationCard.textContent).toContain('が必要です。');
        expect(continuationCard.textContent).not.toContain('모든 간호사는');
        expect(continuationCard.textContent).not.toContain('근무 후');
        expect(pairCard?.textContent).toContain('このうち初日は夜勤後の回復日として扱います。');
        expect(pairCard?.textContent).not.toContain('이 중 첫날은');
    });

    it('shows the recommended night-block recovery rule when night continuation exists', async () => {
        const nightContinuation = {
            wardShiftTypeId: 6,
            name: '야간 후반부',
            shortName: 'S',
            color: '#64748B',
            classification: 'NIGHT_CONTINUATION',
            rotationSystem: 'TWO',
            isActive: true,
        };
        const offShift = {
            wardShiftTypeId: 7,
            name: '휴무',
            shortName: 'O',
            color: '#94A3B8',
            classification: 'OFF',
            rotationSystem: 'NONE',
            isActive: true,
        };

        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...twoShiftWardShiftTypes, nightContinuation, offShift] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 2,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'TWO',
            options: {
                twoShiftNights: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 5,
                        code: 'ⓝ',
                        name: '2교대 야간',
                        label: 'ⓝ',
                        classification: 'NIGHT',
                        rotationSystem: 'TWO',
                    },
                ],
                twoShiftNightContinuations: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 6,
                        code: 'S',
                        name: '야간 후반부',
                        label: 'S',
                        classification: 'NIGHT_CONTINUATION',
                        rotationSystem: 'TWO',
                    },
                ],
                offShifts: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 7,
                        code: 'O',
                        name: '휴무',
                        label: 'O',
                        classification: 'OFF',
                        rotationSystem: 'NONE',
                    },
                ],
            },
            templates: [
                {
                    templateCode: 'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
                    category: 'CORE',
                    displayTemplate:
                        '모든 간호사는 연속 {nightShift} 근무 후 {nightContinuationShift}와 최소 {count}일의 {offShift}가 필요해요.',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nightShift', label: '야간 근무', inputType: 'SHIFT', optionGroup: 'twoShiftNights'},
                        {
                            key: 'nightContinuationShift',
                            label: '야간 후반부',
                            inputType: 'SHIFT',
                            optionGroup: 'twoShiftNightContinuations',
                        },
                        {key: 'count', label: '추가 오프 일수', inputType: 'NUMBER', min: 0, max: 7},
                        {key: 'offShift', label: '휴무', inputType: 'SHIFT', optionGroup: 'offShifts'},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));

        const dialog = screen.getByRole('dialog');
        const minOffCard = dialog.querySelector<HTMLElement>('[data-constraint-template-card="TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF"]');

        expect(minOffCard).not.toBeNull();
        expect(within(minOffCard!).getByText('2교대 야간')).toBeInTheDocument();
        expect(within(minOffCard!).getByText('야간 후반부')).toBeInTheDocument();
        expect(within(minOffCard!).getByText('휴무')).toBeInTheDocument();
        expect(minOffCard!.querySelectorAll('button[aria-haspopup="listbox"]')).toHaveLength(2);

        const offCount = within(minOffCard!).getByRole('spinbutton');

        expect(offCount).toHaveValue(1);
        expect(offCount).toHaveAttribute('min', '0');
        expect(offCount).toHaveAttribute('max', '7');
        await userEvent.clear(offCount);
        expect(offCount).toHaveValue(null);
        await userEvent.type(offCount, '2');
        expect(offCount).toHaveValue(2);
        await userEvent.click(within(minOffCard!).getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'TWO_SHIFT_NIGHT_CONTINUATION_MIN_OFF',
                    severity: 'HARD',
                    params: {
                        nightShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5},
                        nightContinuationShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 6},
                        count: 2,
                        offShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 7},
                    },
                }),
            ]);
        });
    });

    it('shows the recommended total-off recovery rule when night continuation is not configured', async () => {
        const offShift = {
            wardShiftTypeId: 7,
            name: '휴무',
            shortName: 'O',
            color: '#94A3B8',
            classification: 'OFF',
            rotationSystem: 'NONE',
            isActive: true,
        };

        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...twoShiftWardShiftTypes, offShift] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 2,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'TWO',
            options: {
                twoShiftNights: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 5,
                        code: 'ⓝ',
                        name: '2교대 야간',
                        label: 'ⓝ',
                        classification: 'NIGHT',
                        rotationSystem: 'TWO',
                    },
                ],
                offShifts: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 7,
                        code: 'O',
                        name: '휴무',
                        label: 'O',
                        classification: 'OFF',
                        rotationSystem: 'NONE',
                    },
                ],
            },
            templates: [
                {
                    templateCode: 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
                    category: 'CORE',
                    displayTemplate:
                        '모든 간호사는 연속 {nightShift} 근무 후 최소 {count}일의 {offShift}가 필요해요. 이 중 첫날은 야간근무 후 회복일로 계산해요.',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nightShift', label: '야간 근무', inputType: 'SHIFT', optionGroup: 'twoShiftNights'},
                        {key: 'count', label: '오프 일수', inputType: 'NUMBER', min: 1, max: 8},
                        {key: 'offShift', label: '휴무', inputType: 'SHIFT', optionGroup: 'offShifts'},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));

        const dialog = screen.getByRole('dialog');
        const minOffCard = dialog.querySelector<HTMLElement>('[data-constraint-template-card="TWO_SHIFT_NIGHT_PAIR_MIN_OFF"]');

        expect(minOffCard).not.toBeNull();
        expect(within(minOffCard!).getByText('2교대 야간')).toBeInTheDocument();
        expect(within(minOffCard!).getByText('휴무')).toBeInTheDocument();
        expect(minOffCard!.querySelectorAll('button[aria-haspopup="listbox"]')).toHaveLength(1);

        const offCount = within(minOffCard!).getByRole('spinbutton');

        expect(offCount).toHaveValue(2);
        expect(offCount).toHaveAttribute('min', '1');
        expect(offCount).toHaveAttribute('max', '8');
        fireEvent.change(offCount, {target: {value: '3'}});
        await userEvent.click(within(minOffCard!).getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
                    severity: 'HARD',
                    params: {
                        nightShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5},
                        count: 3,
                        offShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 7},
                    },
                }),
            ]);
        });
    });

    it('exposes the add modal as a bounded dialog, closes it with Escape, and restores focus', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openButton = await screen.findByRole('button', {name: '제약 조건 추가'});

        await waitFor(() => expect(openButton).toBeEnabled());
        await userEvent.click(openButton);

        const dialog = await screen.findByRole('dialog');
        const closeButton = within(dialog).getByRole('button', {name: '닫기'});

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleName('제약조건 추가');
        expect(dialog).toHaveClass('h-[min(90dvh,900px)]', 'max-h-[calc(100dvh-1rem)]');
        await waitFor(() => expect(closeButton).toHaveFocus());

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(openButton).toHaveFocus();
    });

    it.each([
        ['ko', '저장됐지만 확인이 필요한 제약조건이 있어요'],
        ['en', 'Saved, but some constraints need review'],
        ['ja', '保存しましたが、確認が必要な制約条件があります'],
        ['zh', '已保存，但有些约束条件需要确认'],
        ['th', 'บันทึกแล้ว แต่มีข้อจำกัดบางรายการที่ต้องตรวจสอบ'],
        ['vi', 'Đã lưu, nhưng có một số điều kiện cần kiểm tra'],
    ])('shows the localized saved-warning title in %s while keeping the server message unchanged', async (language, title) => {
        await i18n.changeLanguage(language);
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [],
            warnings: [
                {
                    code: 'SERVER_WARNING_SENTINEL',
                    message: 'SERVER_LOCALIZED_WARNING_SENTINEL',
                    relatedTemplateCodes: ['CORE_MAX_CONTINUOUS_WORK'],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const warningBanner = await screen.findByRole('status', {name: title});

        expect(warningBanner).toHaveAttribute('aria-live', 'polite');
        expect(within(warningBanner).getByText('SERVER_LOCALIZED_WARNING_SENTINEL')).toHaveAttribute(
            'data-warning-code',
            'SERVER_WARNING_SENTINEL',
        );
        expect(document.getElementById('make_constraint_add_button')).toBeEnabled();
    });

    it('shows a readable saved-warning message when the server returns a warning key', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [],
            warnings: [
                {
                    code: 'NURSE_SHIFT_PREFER_AVOID_CONFLICT',
                    message: 'shiftConstraintRule.warning.NURSE_SHIFT_PREFER_AVOID_CONFLICT',
                    relatedTemplateCodes: ['NURSE_PREFER_SHIFT', 'NURSE_AVOID_SHIFT'],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(
            await screen.findByText('같은 간호사의 같은 근무에 선호와 회피가 동시에 설정되어 있어요. 둘 중 하나를 삭제하거나 서로 다른 근무로 바꿔 주세요.'),
        ).toHaveAttribute('data-warning-code', 'NURSE_SHIFT_PREFER_AVOID_CONFLICT');
        expect(screen.queryByText('shiftConstraintRule.warning.NURSE_SHIFT_PREFER_AVOID_CONFLICT')).not.toBeInTheDocument();
    });

    it('keeps previous warnings during an optimistic save and replaces them from the successful response', async () => {
        type TSaveResponse = Awaited<ReturnType<typeof WardAPI.updateShiftConstraintRules>>;

        let resolveSave!: (response: TSaveResponse) => void;

        const pendingSave = new Promise<TSaveResponse>((resolve) => {
            resolveSave = resolve;
        });

        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [],
            warnings: [
                {
                    code: 'PREVIOUS_WARNING',
                    message: 'PREVIOUS_WARNING_MESSAGE',
                    relatedTemplateCodes: ['CORE_MAX_CONTINUOUS_WORK'],
                },
            ],
        });
        wardApiMocks.updateShiftConstraintRules.mockReturnValueOnce(pendingSave);

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByText('PREVIOUS_WARNING_MESSAGE')).toBeInTheDocument();

        await userEvent.click(document.getElementById('make_constraint_add_button') as HTMLButtonElement);
        await userEvent.click(screen.getAllByRole('button', {name: /^제약 조건 추가:/})[0]!);
        await waitFor(() => expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(1));

        expect(screen.getByText('PREVIOUS_WARNING_MESSAGE')).toBeInTheDocument();

        const savedRules = (getLastUpdatePayload()?.rules ?? []).map((rule, index) => ({
            ...rule,
            shiftConstraintRuleId: index + 100,
            category: 'CORE',
            displayText: '',
            isValid: true,
            invalidReason: null,
        }));

        resolveSave({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: savedRules,
            warnings: [
                {
                    code: 'LATEST_WARNING',
                    message: 'LATEST_WARNING_MESSAGE',
                    relatedTemplateCodes: ['CORE_MAX_CONTINUOUS_WORK', 'MIN_OFF_AFTER_CONSECUTIVE_WORK'],
                },
            ],
        });

        expect(await screen.findByText('LATEST_WARNING_MESSAGE')).toBeInTheDocument();
        expect(screen.queryByText('PREVIOUS_WARNING_MESSAGE')).not.toBeInTheDocument();
    });

    it('does not expose retired automatic two-shift settings', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce(twoShiftWardShiftTypes as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {targets: [{type: 'ALL', label: '전체'}]},
            templates: twoShiftConstraintTemplates,
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByText('제약조건을 추가하면 여기에 보여요.')).toBeInTheDocument();
        expect(screen.queryByRole('switch', {name: '2교대 자동 배치 사용'})).not.toBeInTheDocument();

        await userEvent.click(document.getElementById('make_constraint_add_button') as HTMLButtonElement);

        expect(screen.queryByRole('button', {name: '2교대'})).not.toBeInTheDocument();
        expect(screen.queryByText('TWO_SHIFT_MAX_LINES_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByText('CORE_MIN_REST_HOURS_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByText('MAX_MONTHLY_WORK_HOURS_SENTINEL')).not.toBeInTheDocument();
    });

    it('hides two-shift automation and its modal category for a three-shift-only ward', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce(threeShiftWardShiftTypes as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 91,
            shiftTeamId: 910,
            options: {targets: [{type: 'ALL', label: '전체'}]},
            templates: twoShiftConstraintTemplates,
        });
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 91,
            shiftTeamId: 910,
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'TWO_SHIFT_MAX_LINES',
                    category: 'TWO_SHIFT',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {count: 2, unpaired: 1},
                    selected: true,
                    isImportant: true,
                },
            ],
        });

        render(<Constraints wardId={91} shiftTeamId={910} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        expect(screen.queryByRole('switch', {name: '2교대 자동 배치 사용'})).not.toBeInTheDocument();
        expect(screen.queryByText('하루 최대 2교대 세트 수')).not.toBeInTheDocument();

        await userEvent.click(addButton);

        expect(screen.queryByRole('button', {name: '2교대'})).not.toBeInTheDocument();
        expect(screen.queryByText('TWO_SHIFT_MAX_LINES_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByText('CORE_MIN_REST_HOURS_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByText('MAX_MONTHLY_WORK_HOURS_SENTINEL')).not.toBeInTheDocument();
    });

    it('shows the adaptive recovery rule first in two-shift recommendations', async () => {
        const standardTemplate = (templateCode: string, category: string) => ({
            templateCode,
            category,
            displayTemplate: `sentinel-${templateCode.toLowerCase()}`,
            severity: 'SOFT' as const,
            allowedSeverities: ['HARD' as const, 'SOFT' as const],
            supportedInGenerator: true,
            supportedInValidator: true,
            slots: ['CORE_MAX_CONTINUOUS_WORK', 'CORE_MAX_CONTINUOUS_NIGHT', 'CORE_MIN_CONTINUOUS_NIGHT'].includes(templateCode)
                ? [
                      {key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'},
                      {key: 'count', label: 'Count', inputType: 'NUMBER' as const, min: 1, max: 31},
                  ]
                : templateCode === 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF'
                  ? [{key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'}]
                  : [],
        });
        const offShift = {
            wardShiftTypeId: 7,
            name: '휴무',
            shortName: 'O',
            color: '#94A3B8',
            classification: 'OFF',
            rotationSystem: 'NONE',
            isActive: true,
        };

        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...twoShiftWardShiftTypes, offShift] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 2,
            wardId: 92,
            shiftTeamId: 920,
            rotationMode: 'TWO',
            options: {
                twoShiftNights: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 5,
                        code: 'ⓝ',
                        name: '2교대 야간',
                        label: 'ⓝ',
                        classification: 'NIGHT',
                        rotationSystem: 'TWO',
                    },
                ],
                offShifts: [
                    {
                        type: 'WARD_SHIFT_TYPE',
                        wardShiftTypeId: 7,
                        code: 'O',
                        name: '휴무',
                        label: 'O',
                        classification: 'OFF',
                        rotationSystem: 'NONE',
                    },
                ],
            },
            templates: [
                standardTemplate('CORE_MAX_CONTINUOUS_WORK', 'CORE'),
                standardTemplate('CORE_MAX_CONTINUOUS_NIGHT', 'CORE'),
                standardTemplate('CORE_MIN_CONTINUOUS_NIGHT', 'CORE'),
                {
                    templateCode: 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
                    category: 'CORE',
                    displayTemplate:
                        '모든 간호사는 연속 {nightShift} 근무 후 최소 {count}일의 {offShift}가 필요해요. 이 중 첫날은 야간근무 후 회복일로 계산해요.',
                    severity: 'HARD' as const,
                    allowedSeverities: ['HARD' as const, 'SOFT' as const],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'nightShift', label: '야간 근무', inputType: 'SHIFT' as const, optionGroup: 'twoShiftNights'},
                        {key: 'count', label: '오프 일수', inputType: 'NUMBER' as const, min: 1, max: 8},
                        {key: 'offShift', label: '휴무', inputType: 'SHIFT' as const, optionGroup: 'offShifts'},
                    ],
                },
                standardTemplate('CORE_MIN_OFF_AFTER_NIGHT', 'WORK_REST'),
                standardTemplate('FORBID_N_THEN_D', 'FORBIDDEN_PATTERN'),
            ],
        });

        render(<Constraints wardId={92} shiftTeamId={920} shiftTeams={[]} year={2026} month={6} variant="settings" />);
        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));

        const dialog = screen.getByRole('dialog');
        const recommendationCodes = [
            'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
            'FORBID_N_THEN_D',
            'CORE_MAX_CONTINUOUS_WORK',
            'CORE_MAX_CONTINUOUS_NIGHT',
            'CORE_MIN_CONTINUOUS_NIGHT',
        ];
        const recommendationCards = recommendationCodes.map((templateCode) => {
            const card = dialog.querySelector<HTMLElement>(`[data-constraint-template-card="${templateCode}"]`);

            expect(card).not.toBeNull();

            return card!;
        });

        expect(dialog.querySelectorAll('[data-constraint-template-card]')).toHaveLength(5);
        recommendationCards.slice(0, -1).forEach((card, index) => {
            expect(card.compareDocumentPosition(recommendationCards[index + 1]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        });
        expect(dialog.querySelector('[data-constraint-template-card="CORE_MIN_OFF_AFTER_NIGHT"]')).toBeNull();
        expect(within(recommendationCards[2]!).getByRole('spinbutton')).toHaveValue(4);
        expect(within(recommendationCards[3]!).getByRole('spinbutton')).toHaveValue(3);
        expect(within(recommendationCards[4]!).getByRole('spinbutton')).toHaveValue(1);

        const minOffCard = recommendationCards[0]!;
        const offCount = within(minOffCard).getByRole('spinbutton');

        expect(within(minOffCard).getByText('2교대 야간')).toBeInTheDocument();
        expect(within(minOffCard).getByText('휴무')).toBeInTheDocument();
        expect(offCount).toHaveValue(2);
        expect(offCount).toHaveAttribute('min', '1');
        expect(offCount).toHaveAttribute('max', '8');
        await userEvent.click(within(minOffCard).getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'TWO_SHIFT_NIGHT_PAIR_MIN_OFF',
                    severity: 'HARD',
                    params: {
                        nightShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5},
                        count: 2,
                        offShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 7},
                    },
                }),
            ]);
        });
    });

    it.each(['THREE', 'MIXED'] as const)('keeps the shared existing rules available in %s catalogs', async (rotationMode) => {
        const template = (templateCode: string, category: string) => ({
            templateCode,
            category,
            displayTemplate: `sentinel-${templateCode.toLowerCase()}`,
            severity: 'SOFT' as const,
            allowedSeverities: ['HARD' as const, 'SOFT' as const],
            supportedInGenerator: true,
            supportedInValidator: true,
            slots:
                templateCode === 'CORE_MIN_OFF_AFTER_NIGHT'
                    ? [
                          {key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'},
                          {key: 'count', label: 'Count', inputType: 'NUMBER' as const, min: 1, max: 31},
                      ]
                    : templateCode === 'FORBID_N_THEN_D'
                      ? [{key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'}]
                      : [],
        });

        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 94,
            shiftTeamId: 940,
            rotationMode,
            options: {},
            templates: [
                template('MIN_OFF_AFTER_CONSECUTIVE_WORK', 'WORK_REST'),
                template('CORE_MIN_OFF_AFTER_NIGHT', 'WORK_REST'),
                template('FORBID_N_THEN_D', 'FORBIDDEN_PATTERN'),
            ],
        });

        render(<Constraints wardId={94} shiftTeamId={940} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(
            await waitFor(() => {
                const button = document.getElementById('make_constraint_add_button');

                expect(button).toBeInTheDocument();

                return button as HTMLButtonElement;
            }),
        );
        await userEvent.click(screen.getByRole('button', {name: rotationMode === 'MIXED' ? '연속 근무/휴식' : '연속 근무·휴무'}));

        expect(screen.getByText(/일 이상 연속으로 근무하면/)).toBeInTheDocument();
        expect(screen.queryByText('sentinel-min_off_after_consecutive_work')).not.toBeInTheDocument();

        if (rotationMode === 'THREE') {
            await userEvent.click(screen.getByRole('button', {name: '권장'}));
            expect(screen.getAllByTitle('추가')).toHaveLength(2);
        }

        await userEvent.click(screen.getByRole('button', {name: rotationMode === 'MIXED' ? '금지 패턴' : '야간·전환'}));

        if (rotationMode === 'MIXED') {
            expect(screen.getByRole('button', {name: /제약 조건 추가:.*야간 근무 다음 날 데이·주간 근무/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /제약 조건 추가:.*야간 근무 후 최소.*휴무/})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /제약 조건 추가:.*N.*다음 날.*D/})).not.toBeInTheDocument();
        } else {
            expect(screen.getByRole('button', {name: /제약 조건 추가:.*N.*다음 날.*D/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /제약 조건 추가:.*N 근무 후 최소.*휴무/})).toBeInTheDocument();
        }
        expect(screen.getAllByRole('button', {name: '모든 간호사'}).length).toBeGreaterThan(0);

        await userEvent.click(
            screen.getByRole('button', {
                name:
                    rotationMode === 'MIXED'
                        ? /제약 조건 추가:.*야간 근무 다음 날 데이·주간 근무/
                        : /제약 조건 추가:.*N.*다음 날.*D/,
            }),
        );

        const importantToggle = await screen.findByRole('checkbox', {name: '중요 표시 해제'});

        expect(importantToggle).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('button', {name: '모든 간호사'})).toBeInTheDocument();
    });

    it('renders mixed night rules with group wording instead of two-shift shift names', async () => {
        const mixedTemplateCodes = [
            'CORE_MIN_NIGHT_INTERVAL',
            'CORE_MAX_CONTINUOUS_NIGHT',
            'CORE_MIN_CONTINUOUS_NIGHT',
            'CORE_MIN_OFF_AFTER_NIGHT',
            'FORBID_N_THEN_D',
            'FORBID_N_THEN_E',
            'FORBID_E_THEN_D',
            'FORBID_E_THEN_N',
            'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
        ];
        const categoryByCode: Record<string, string> = {
            FORBID_N_THEN_D: 'FORBIDDEN_PATTERN',
            FORBID_N_THEN_E: 'FORBIDDEN_PATTERN',
            FORBID_E_THEN_D: 'FORBIDDEN_PATTERN',
            FORBID_E_THEN_N: 'FORBIDDEN_PATTERN',
        };
        const template = (templateCode: string) => ({
            templateCode,
            category: categoryByCode[templateCode] ?? 'CORE',
            displayTemplate: `{target}는 2교대 야간 ${templateCode} SENTINEL`,
            severity: 'SOFT' as const,
            allowedSeverities: ['HARD' as const, 'SOFT' as const],
            supportedInGenerator: true,
            supportedInValidator: true,
            slots:
                templateCode.startsWith('FORBID_') || templateCode === 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF'
                    ? [{key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'}]
                    : [
                          {key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'},
                          {key: 'count', label: 'Count', inputType: 'NUMBER' as const, min: 1, max: 31},
                      ],
        });

        wardApiMocks.getShiftTypes.mockResolvedValueOnce([
            ...twoShiftWardShiftTypes,
            {...threeShiftWardShiftTypes[0], name: '데이'},
            {...threeShiftWardShiftTypes[1], name: '이브닝'},
            {...threeShiftWardShiftTypes[2], name: '나이트'},
        ] as never);
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 95,
            shiftTeamId: 950,
            rules: mixedTemplateCodes.map((templateCode, index) => ({
                shiftConstraintRuleId: 300 + index,
                templateCode,
                category: categoryByCode[templateCode] ?? 'CORE',
                severity: 'SOFT' as const,
                sortOrder: index + 1,
                params: recommendedDefaultParamsByTemplateCode[templateCode],
                selected: true,
                isImportant: false,
                displayText: `모든 간호사는 2교대 야간 ${templateCode} OLD`,
                isValid: true,
                invalidReason: null,
            })),
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 95,
            shiftTeamId: 950,
            rotationMode: 'MIXED',
            options: {
                targets: [{type: 'ALL', label: '모든 간호사'}],
            },
            templates: mixedTemplateCodes.map(template),
        });

        render(<Constraints wardId={95} shiftTeamId={950} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => expect(document.body.textContent).toContain('야간 근무 사이에 최소'));

        expect(document.body.textContent).toContain('야간 근무를 최대');
        expect(document.body.textContent).toContain('연속 야간 근무 후 최소');
        expect(document.body.textContent).toContain('야간 근무 다음 날 데이·주간 근무');
        expect(document.body.textContent).toContain('이브닝 근무 다음 날 야간 근무');
        expect(screen.getAllByText('이브닝').some((node) => Boolean(node.closest('span[class*="text-white"]')))).toBe(true);
        expect(document.body.textContent).toContain('신청 휴무 전날에는 야간 근무를 하면 안 돼요');
        expect(document.body.textContent).not.toContain('2교대 야간');
        expect(document.body.textContent).not.toContain('2교대 주간');
        expect(document.body.textContent).not.toContain('N 근무 사이');
    });

    it('shows only the requested mixed-shift templates as recommendations', async () => {
        const recommendedOrder = [
            'FORBID_N_THEN_D',
            'FORBID_N_THEN_E',
            'FORBID_E_THEN_D',
            'CORE_MIN_OFF_AFTER_NIGHT',
            'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
        ];
        const oldRecommendedCodes = [
            'CORE_MAX_CONTINUOUS_WORK',
            'CORE_MIN_NIGHT_INTERVAL',
            'FORBID_E_THEN_N',
            'CORE_MAX_CONTINUOUS_NIGHT',
        ];
        const categoryByCode: Record<string, string> = {
            FORBID_N_THEN_D: 'FORBIDDEN_PATTERN',
            FORBID_N_THEN_E: 'FORBIDDEN_PATTERN',
            FORBID_E_THEN_D: 'FORBIDDEN_PATTERN',
            FORBID_E_THEN_N: 'FORBIDDEN_PATTERN',
        };
        const template = (templateCode: string) => ({
            templateCode,
            category: categoryByCode[templateCode] ?? 'CORE',
            displayTemplate: `sentinel-${templateCode.toLowerCase()}`,
            severity: 'SOFT' as const,
            allowedSeverities: ['HARD' as const, 'SOFT' as const],
            supportedInGenerator: true,
            supportedInValidator: true,
            slots:
                templateCode.startsWith('FORBID_') || templateCode === 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF'
                    ? [{key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'}]
                    : [
                          {key: 'target', label: 'Target', inputType: 'SELECT' as const, optionGroup: 'TARGETS'},
                          {key: 'count', label: 'Count', inputType: 'NUMBER' as const, min: 1, max: 31},
                      ],
        });

        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 96,
            shiftTeamId: 960,
            rotationMode: 'MIXED',
            options: {
                targets: [{type: 'ALL', label: '모든 간호사'}],
            },
            templates: [...recommendedOrder, ...oldRecommendedCodes].map(template),
        });

        render(<Constraints wardId={96} shiftTeamId={960} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(
            await waitFor(() => {
                const button = document.getElementById('make_constraint_add_button');

                expect(button).toBeInTheDocument();

                return button as HTMLButtonElement;
            }),
        );

        const dialog = screen.getByRole('dialog');
        const recommendationCards = Array.from(dialog.querySelectorAll<HTMLElement>('[data-constraint-template-card]'));

        expect(recommendationCards.map((card) => card.dataset.constraintTemplateCard)).toEqual(recommendedOrder);
        expect(screen.getAllByTitle('추가')).toHaveLength(5);
        oldRecommendedCodes.forEach((templateCode) => {
            expect(dialog.querySelector(`[data-constraint-template-card="${templateCode}"]`)).not.toBeInTheDocument();
        });
    });

    it('shows exactly the 20 three-shift rules without the removed skills and roles category', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 93,
            shiftTeamId: 930,
            rules: recommendedServerRules,
        });

        const categoryByCode: Record<string, string> = {
            STAFF_COUNT_BY_SHIFT: 'STAFFING_COUNT',
            CORE_MAX_CONTINUOUS_WORK: 'CORE',
            MIN_OFF_AFTER_CONSECUTIVE_WORK: 'WORK_REST',
            AVOID_ISOLATED_WORK_DAY: 'WORK_REST',
            AVOID_ISOLATED_OFF_DAY: 'WORK_REST',
            MIN_MONTHLY_OFF: 'WORK_REST',
            CORE_MIN_NIGHT_INTERVAL: 'CORE',
            CORE_MAX_CONTINUOUS_NIGHT: 'CORE',
            CORE_MIN_CONTINUOUS_NIGHT: 'FORBIDDEN_PATTERN',
            CORE_MIN_OFF_AFTER_NIGHT: 'CORE',
            FORBID_N_THEN_D: 'FORBIDDEN_PATTERN',
            FORBID_N_THEN_E: 'FORBIDDEN_PATTERN',
            FORBID_E_THEN_D: 'FORBIDDEN_PATTERN',
            FORBID_E_THEN_N: 'FORBIDDEN_PATTERN',
            CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF: 'CORE',
            NURSE_MAX_WEEKEND_HOLIDAY_SHIFTS: 'NURSE_LIMIT',
            NURSE_PREFER_SHIFT: 'NURSE_LIMIT',
            NURSE_AVOID_SHIFT: 'NURSE_LIMIT',
            PRECEPTEE_NOT_ALONE_SHIFT: 'ROLE_COVERAGE',
            PRECEPTOR_PRECEPTEE_SAME_SHIFT: 'ROLE_COVERAGE',
            NURSE_PAIR_NOT_SAME_SHIFT: 'NURSE_COMBINATION',
            NURSE_PAIR_PREFER_SAME_SHIFT: 'NURSE_COMBINATION',
        };
        const template = (templateCode: string, category: string, supported = true) => ({
            templateCode,
            category,
            displayTemplate: `sentinel-${templateCode.toLowerCase()}`,
            severity: 'SOFT' as const,
            allowedSeverities: ['HARD' as const, 'SOFT' as const],
            supportedInGenerator: supported,
            supportedInValidator: supported,
            slots: [],
        });

        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 93,
            shiftTeamId: 930,
            rotationMode: 'THREE',
            options: {},
            templates: [
                ...Object.entries(categoryByCode).map(([code, category]) => template(code, category)),
                template('EXACT_STAFF_BY_SHIFT', 'STAFFING_COUNT'),
                template('MAX_DAY_NIGHT_TRANSITIONS', 'FORBIDDEN_PATTERN'),
                template('MIN_CHARGE_NURSE_BY_SHIFT', 'ROLE_COVERAGE'),
                template('CORE_UNLISTED_SENTINEL', 'CORE'),
                template('UNSUPPORTED_SENTINEL', 'WORK_REST', false),
            ],
        });

        render(<Constraints wardId={93} shiftTeamId={930} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => expect(screen.getAllByRole('checkbox', {name: '중요 표시 해제'})).toHaveLength(5));
        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();

        await userEvent.click(
            await waitFor(() => {
                const button = document.getElementById('make_constraint_add_button');

                expect(button).toBeInTheDocument();

                return button as HTMLButtonElement;
            }),
        );

        const dialog = screen.getByRole('dialog');
        const scrollRegion = dialog.querySelector<HTMLElement>('[data-constraint-modal-scroll="true"]');
        const recommendationCards = dialog.querySelectorAll<HTMLElement>('[data-constraint-template-card]');

        expect(scrollRegion).toHaveClass(
            'overflow-y-auto',
            '[scrollbar-width:auto]',
            '[scrollbar-gutter:stable]',
            '[&::-webkit-scrollbar]:w-3',
        );
        expect(recommendationCards).toHaveLength(5);
        recommendationCards.forEach((card) => expect(card).toHaveClass('py-1.5'));
        expect(within(recommendationCards[0]!).getByTitle('추가').firstElementChild).toHaveClass('size-8');
        expect(within(dialog).queryByText('중요')).not.toBeInTheDocument();
        expect(screen.getAllByTitle('추가')).toHaveLength(5);

        const recommendedOrder = [
            'CORE_MIN_OFF_AFTER_NIGHT',
            'FORBID_N_THEN_D',
            'FORBID_N_THEN_E',
            'FORBID_E_THEN_D',
            'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
        ].map((templateCode) => dialog.querySelector<HTMLElement>(`[data-constraint-template-card="${templateCode}"]`)!);

        recommendedOrder.slice(0, -1).forEach((template, index) => {
            expect(template.compareDocumentPosition(recommendedOrder[index + 1]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        });
        for (const removedRecommendedCode of [
            'STAFF_COUNT_BY_SHIFT',
            'CORE_MAX_CONTINUOUS_WORK',
            'CORE_MIN_NIGHT_INTERVAL',
            'CORE_MAX_CONTINUOUS_NIGHT',
            'MAX_MONTHLY_NIGHT_COUNT',
            'FORBID_E_THEN_N',
        ]) {
            expect(within(dialog).queryByText(`sentinel-${removedRecommendedCode.toLowerCase()}`)).not.toBeInTheDocument();
        }

        await userEvent.click(screen.getByRole('button', {name: '인원수'}));
        expect(dialog.querySelector('[data-constraint-template-card="STAFF_COUNT_BY_SHIFT"]')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '연속 근무·휴무'}));
        expect(dialog.querySelector('[data-constraint-template-card="CORE_MAX_CONTINUOUS_WORK"]')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '야간·전환'}));
        for (const normalCategoryCode of [
            'CORE_MIN_NIGHT_INTERVAL',
            'CORE_MAX_CONTINUOUS_NIGHT',
            'FORBID_E_THEN_N',
        ]) {
            expect(dialog.querySelector(`[data-constraint-template-card="${normalCategoryCode}"]`)).toBeInTheDocument();
        }
        expect(dialog.querySelector('[data-constraint-template-card="MAX_MONTHLY_NIGHT_COUNT"]')).not.toBeInTheDocument();

        let normalRuleCount = 0;

        for (const category of ['인원수', '연속 근무·휴무', '야간·전환', '사람별 제한', '근무자 조합']) {
            await userEvent.click(screen.getByRole('button', {name: category}));
            normalRuleCount += screen.queryAllByTitle('추가').length;
        }

        expect(normalRuleCount).toBe(20);
        expect(screen.queryByRole('button', {name: '숙련도·역할'})).not.toBeInTheDocument();
        expect(document.body.textContent).not.toContain('sentinel-exact_staff_by_shift');
        expect(document.body.textContent).not.toContain('sentinel-max_day_night_transitions');
        expect(document.body.textContent).not.toContain('sentinel-min_charge_nurse_by_shift');
        expect(document.body.textContent).not.toContain('sentinel-core_unlisted_sentinel');
        expect(document.body.textContent).not.toContain('sentinel-unsupported_sentinel');
    });

    it('promotes an existing soft rule to important when it is added again from recommendations', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 51,
                    templateCode: 'CORE_MIN_OFF_AFTER_NIGHT',
                    category: 'CORE',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {target: {type: 'ALL'}, count: 2},
                    selected: true,
                    isImportant: false,
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(await waitFor(() => document.getElementById('make_constraint_add_button') as HTMLButtonElement));

        const recommendedCard = screen
            .getByRole('dialog')
            .querySelector<HTMLElement>('[data-constraint-template-card="CORE_MIN_OFF_AFTER_NIGHT"]');

        expect(recommendedCard).not.toBeNull();
        await userEvent.click(within(recommendedCard!).getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    shiftConstraintRuleId: 51,
                    templateCode: 'CORE_MIN_OFF_AFTER_NIGHT',
                    severity: 'HARD',
                    params: {target: {type: 'ALL'}, count: 2},
                }),
            ]);
        });
    });

    it('keeps the three-shift night interval rule optional and non-important', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(await waitFor(() => document.getElementById('make_constraint_add_button') as HTMLButtonElement));

        const dialog = screen.getByRole('dialog');

        expect(dialog.querySelector('[data-constraint-template-card="CORE_MIN_NIGHT_INTERVAL"]')).toBeNull();

        await userEvent.click(screen.getByRole('button', {name: '야간·전환'}));

        const nightIntervalCard = dialog.querySelector<HTMLElement>('[data-constraint-template-card="CORE_MIN_NIGHT_INTERVAL"]');

        expect(nightIntervalCard).not.toBeNull();
        await userEvent.click(within(nightIntervalCard!).getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({templateCode: 'CORE_MIN_NIGHT_INTERVAL', severity: 'SOFT', isImportant: false}),
            ]);
        });
    });

    it('unmarks the legacy default night interval rule for an existing three-shift team', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 98,
            shiftTeamId: 980,
            rules: [
                {
                    shiftConstraintRuleId: 99,
                    templateCode: 'CORE_MIN_NIGHT_INTERVAL',
                    category: 'CORE',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {target: {type: 'ALL'}, count: 5},
                    selected: true,
                    isImportant: true,
                },
                ...recommendedServerRules.map((rule, index) => ({
                    ...rule,
                    shiftConstraintRuleId: index + 100,
                    sortOrder: index + 2,
                })),
            ],
        });

        render(<Constraints wardId={98} shiftTeamId={980} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => {
            const savedRules = getLastUpdatePayload()?.rules;

            expect(savedRules?.find((rule) => rule.templateCode === 'CORE_MIN_NIGHT_INTERVAL')).toEqual(
                expect.objectContaining({severity: 'SOFT', isImportant: false}),
            );
            expect(savedRules?.filter((rule) => rule.templateCode !== 'CORE_MIN_NIGHT_INTERVAL')).toHaveLength(5);
        });
    });

    it('prunes removed legacy defaults for an existing mixed-shift team', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 97,
            shiftTeamId: 970,
            rules: recommendedTemplateCodes.map((templateCode, index) => ({
                shiftConstraintRuleId: index + 200,
                templateCode,
                category: recommendedCategoryByTemplateCode[templateCode] ?? 'CORE',
                severity: 'HARD' as const,
                sortOrder: index + 1,
                params: recommendedDefaultParamsByTemplateCode[templateCode],
                selected: true,
                isImportant: true,
            })),
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 97,
            shiftTeamId: 970,
            rotationMode: 'MIXED',
            options: {
                targets: [{type: 'ALL', label: '모든 간호사'}],
            },
            templates: recommendedTemplates,
        });

        render(<Constraints wardId={97} shiftTeamId={970} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => {
            const savedRules = getLastUpdatePayload()?.rules;

            if (!savedRules) throw new Error('Expected mixed legacy defaults to be resaved');

            expect(savedRules.map((rule) => rule.templateCode)).toEqual([
                'FORBID_N_THEN_D',
                'FORBID_N_THEN_E',
                'FORBID_E_THEN_D',
                'CORE_MIN_OFF_AFTER_NIGHT',
                'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
            ]);
            expect(savedRules).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({templateCode: 'CORE_MIN_OFF_AFTER_NIGHT', severity: 'HARD', isImportant: true}),
                    expect.objectContaining({templateCode: 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF', severity: 'HARD', isImportant: true}),
                ]),
            );
        });
    });

    it('removes retired role rules while preserving other hidden compatible rules on save', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'THREE',
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
                    category: 'NURSE_COMBINATION',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {
                        nurseA: {type: 'NURSE', nurseId: 1},
                        nurseB: {type: 'NURSE', nurseId: 2},
                    },
                    selected: true,
                    isImportant: false,
                    displayText: 'VISIBLE_PAIR_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
                {
                    shiftConstraintRuleId: 2,
                    templateCode: 'MIN_CHARGE_NURSE_BY_SHIFT',
                    category: 'ROLE_COVERAGE',
                    severity: 'SOFT',
                    sortOrder: 2,
                    params: {},
                    selected: true,
                    isImportant: false,
                    displayText: 'HIDDEN_CHARGE_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
                {
                    shiftConstraintRuleId: 3,
                    templateCode: 'MAX_DAY_NIGHT_TRANSITIONS',
                    category: 'FORBIDDEN_PATTERN',
                    severity: 'SOFT',
                    sortOrder: 3,
                    params: {},
                    selected: true,
                    isImportant: false,
                    displayText: 'HIDDEN_TRANSITION_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
                {
                    shiftConstraintRuleId: 4,
                    templateCode: 'MAX_CONSECUTIVE_WORK_DAYS',
                    category: 'WORK_REST',
                    severity: 'SOFT',
                    sortOrder: 4,
                    params: {count: 5},
                    selected: true,
                    isImportant: false,
                    displayText: 'VISIBLE_LEGACY_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        } as never);

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findByRole('button', {name: 'Nurse A'})).toBeInTheDocument();
        expect(screen.getByText('VISIBLE_LEGACY_SENTINEL')).toBeInTheDocument();
        expect(screen.queryByText('HIDDEN_CHARGE_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByText('HIDDEN_TRANSITION_SENTINEL')).not.toBeInTheDocument();

        await userEvent.click(screen.getAllByRole('checkbox', {name: '중요 표시'})[0]!);

        await waitFor(() => {
            const savedCodes = getLastUpdatePayload()?.rules?.map((rule) => rule.templateCode);

            expect(savedCodes).toEqual(['NURSE_PAIR_NOT_SAME_SHIFT', 'MAX_DAY_NIGHT_TRANSITIONS', 'MAX_CONSECUTIVE_WORK_DAYS']);
        });
    });

    it('uses the stored ward rotation mode without rendering a temporary selector', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'TWO',
            options: {},
            templates: [],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => {
            expect(wardApiMocks.getShiftConstraintRuleCandidates).toHaveBeenCalledWith(1, 10);
        });
        expect(screen.queryByRole('radio', {name: '2교대'})).not.toBeInTheDocument();
    });

    it('hides a legacy MIXED operation policy and omits only that policy from the next save', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 10,
                    templateCode: 'MIXED_OPERATION_POLICY',
                    category: 'MIXED_POLICY',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {strategy: {type: 'PLANNED_MIXED_WITH_FALLBACK'}},
                    selected: true,
                    isImportant: true,
                    displayText: 'LEGACY_MIXED_POLICY_SENTINEL',
                },
                {
                    shiftConstraintRuleId: 11,
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'WORK_REST',
                    severity: 'SOFT',
                    sortOrder: 2,
                    params: {target: {type: 'ALL'}, count: 5},
                    selected: true,
                    isImportant: false,
                    displayText: 'EXISTING_MIXED_RULE_SENTINEL',
                },
            ],
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {},
            templates: [
                {
                    templateCode: 'MIXED_OPERATION_POLICY',
                    category: 'MIXED_POLICY',
                    displayTemplate: '{strategy}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [{key: 'strategy', label: 'Strategy', inputType: 'SELECT', optionGroup: 'strategies'}],
                },
                {
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'WORK_REST',
                    displayTemplate: '{target} {count}',
                    severity: 'SOFT',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'targets'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 31},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => expect(document.getElementById('constraint-rule-saved-11')).toBeInTheDocument());
        expect(screen.queryByText('혼합교대 운영 방식')).not.toBeInTheDocument();
        expect(screen.queryByText('LEGACY_MIXED_POLICY_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByRole('radio', {name: /3교대 우선·부족 시 2교대/})).not.toBeInTheDocument();

        await userEvent.click(document.getElementById('make_constraint_add_button') as HTMLButtonElement);

        expect(screen.queryByText('{strategy}')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));

        await userEvent.click(screen.getByRole('checkbox', {name: '중요 표시'}));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    severity: 'HARD',
                    params: {target: {type: 'ALL'}, count: 5},
                }),
            ]);
        });
    });

    it('saves MIXED participation with target options and exposes all four understandable modes', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftTeamNurses.mockResolvedValueOnce([
            {
                nurseId: 1,
                name: 'Nurse A',
                divisionNum: 1,
                isPreceptor: false,
                nurseShiftTypes: [
                    {wardShiftTypeId: 1, isPossible: true},
                    {wardShiftTypeId: 4, isPossible: true},
                ],
            },
            {
                nurseId: 2,
                name: 'Nurse B',
                divisionNum: 1,
                isPreceptor: false,
                nurseShiftTypes: [
                    {wardShiftTypeId: 1, isPossible: true},
                    {wardShiftTypeId: 4, isPossible: true},
                ],
            },
        ] as never);
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 10,
                    templateCode: 'MIXED_OPERATION_POLICY',
                    category: 'MIXED_POLICY',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {strategy: {type: 'PLANNED_MIXED_WITH_FALLBACK'}},
                    selected: true,
                    isImportant: true,
                },
            ],
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {
                targets: [
                    {type: 'ALL', label: '모든 간호사'},
                    {type: 'DIVISION', divisionNum: 1, label: '신규 간호사 1'},
                ],
            },
            templates: [
                {
                    templateCode: 'MIXED_ROTATION_PARTICIPATION',
                    category: 'MIXED_PARTICIPATION',
                    displayTemplate: '{target} {participationMode} {dateScope}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {
                            key: 'participationMode',
                            label: 'Participation',
                            inputType: 'SELECT',
                            optionGroup: 'participationModes',
                        },
                        {key: 'dateScope', label: 'Date', inputType: 'SELECT', optionGroup: 'dateScopes'},
                    ],
                },
            ],
        });

        render(
            <Constraints
                wardId={1}
                shiftTeamId={10}
                shiftTeams={[{shiftTeamId: 10, name: 'A Team', divisions: [{divisionNum: 1, name: '신규 간호사 1'}]}] as never}
                year={2026}
                month={6}
                variant="settings"
            />,
        );

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));

        await userEvent.click(screen.getByRole('button', {name: '모든 간호사'}));

        const targetListbox = await screen.findByRole('listbox');

        expect(within(targetListbox).getByRole('option', {name: '모든 간호사'})).toBeInTheDocument();
        expect(within(targetListbox).getByRole('option', {name: '신규 간호사 1'})).toBeInTheDocument();
        expect(within(targetListbox).getByRole('option', {name: /Nurse A/})).toBeInTheDocument();
        await userEvent.click(within(targetListbox).getByRole('option', {name: '신규 간호사 1'}));

        const participationButton = screen.getByRole('button', {name: '인력 부족 시 2교대 가능'});

        await userEvent.click(participationButton);

        const listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByRole('option', {name: '3교대만'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '2교대만'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '계획에 따라 2·3교대'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '인력 부족 시 2교대 가능'})).toBeInTheDocument();
        await userEvent.click(within(listbox).getByRole('option', {name: '인력 부족 시 2교대 가능'}));

        await userEvent.click(screen.getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'MIXED_ROTATION_PARTICIPATION',
                    params: {
                        target: {type: 'DIVISION', divisionNum: 1},
                        participationMode: {type: 'FALLBACK_TWO'},
                        dateScope: {type: 'EVERYDAY'},
                    },
                }),
            ]);
        });
    });

    it('supports TIME slots and keeps unknown MIXED templates out of the explicit allowlist', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {},
            templates: [
                {
                    templateCode: 'TIME_WINDOW_STAFF_COUNT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope} {startTime} {endTime} {operator} {count}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'startTime', label: '시작 시간', inputType: 'TIME'},
                        {key: 'endTime', label: '종료 시간', inputType: 'TIME'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 20},
                    ],
                },
                {
                    templateCode: 'UNLISTED_MIXED_SENTINEL',
                    category: 'STAFFING_COUNT',
                    displayTemplate: 'UNLISTED_MIXED_SENTINEL_TEXT',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));

        expect(screen.queryByText('UNLISTED_MIXED_SENTINEL_TEXT')).not.toBeInTheDocument();
        expect(screen.getByLabelText('시간대별 필요 인원: 시작 시각')).toHaveValue('07:00');
        expect(screen.getByLabelText('시간대별 필요 인원: 종료 시각')).toHaveValue('15:00');

        await userEvent.click(screen.getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'TIME_WINDOW_STAFF_COUNT',
                    params: {
                        dateScope: {type: 'EVERYDAY'},
                        startTime: '07:00',
                        endTime: '15:00',
                        operator: {type: 'MIN'},
                        count: 1,
                    },
                }),
            ]);
        });
    });

    it('fails closed and explains unavailable mixed-shift nurses when possible shifts are missing or incompatible', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftTeamNurses.mockResolvedValueOnce([
            {nurseId: 1, name: 'No Config', divisionNum: 1, isPreceptor: false},
            {
                nurseId: 2,
                name: 'Three Only',
                divisionNum: 1,
                isPreceptor: false,
                nurseShiftTypes: [{wardShiftTypeId: 1, isPossible: true}],
            },
            {
                nurseId: 3,
                name: 'Both Shifts',
                divisionNum: 2,
                isPreceptor: false,
                nurseShiftTypes: [
                    {wardShiftTypeId: 1, isPossible: true},
                    {wardShiftTypeId: 4, isPossible: true},
                ],
            },
        ] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {},
            templates: [
                {
                    templateCode: 'MIXED_ROTATION_PARTICIPATION',
                    category: 'MIXED_PARTICIPATION',
                    displayTemplate: '{target} {participationMode} {dateScope}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {
                            key: 'participationMode',
                            label: 'Participation',
                            inputType: 'SELECT',
                            optionGroup: 'participationModes',
                        },
                        {key: 'dateScope', label: 'Date', inputType: 'SELECT', optionGroup: 'dateScopes'},
                    ],
                },
            ],
        });

        render(
            <Constraints
                wardId={1}
                shiftTeamId={10}
                shiftTeams={
                    [
                        {
                            shiftTeamId: 10,
                            name: 'A Team',
                            divisions: [
                                {divisionNum: 1, name: '신규 간호사 1'},
                                {divisionNum: 2, name: '신규 간호사 2'},
                            ],
                        },
                    ] as never
                }
                year={2026}
                month={6}
                variant="settings"
            />,
        );

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));
        await userEvent.click(screen.getByRole('button', {name: '모든 간호사'}));

        const listbox = await screen.findByRole('listbox');
        const groupOneOption = within(listbox).getByRole('option', {name: /신규 간호사 1/});
        const groupTwoOption = within(listbox).getByRole('option', {name: /신규 간호사 2/});
        const noConfigOption = within(listbox).getByRole('option', {name: /No Config/});
        const threeOnlyOption = within(listbox).getByRole('option', {name: /Three Only/});
        const bothOption = within(listbox).getByRole('option', {name: /Both Shifts/});

        expect(groupOneOption).toBeDisabled();
        expect(groupOneOption).toHaveTextContent('가능 근무 설정 필요');
        expect(groupTwoOption).toBeEnabled();
        expect(noConfigOption).toBeDisabled();
        expect(noConfigOption).toHaveTextContent('가능 근무 설정 필요');
        expect(threeOnlyOption).toBeDisabled();
        expect(threeOnlyOption).toHaveTextContent('2교대와 3교대 가능 근무가 모두 필요해요.');
        expect(bothOption).toBeEnabled();
        expect(bothOption).toHaveAttribute('aria-selected', 'false');
    });

    it('shows mixed participation options without deleted mixed planning templates', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {},
            templates: [
                {
                    templateCode: 'MIXED_ROTATION_PARTICIPATION',
                    category: 'MIXED_PARTICIPATION',
                    displayTemplate: '{target} {participationMode} {dateScope}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {
                            key: 'participationMode',
                            label: 'Participation',
                            inputType: 'SELECT',
                            optionGroup: 'mixedParticipationModes',
                        },
                        {key: 'dateScope', label: 'Date', inputType: 'SELECT', optionGroup: 'dateScopes'},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openOptions = async (name: string) => {
            await userEvent.click(screen.getByRole('button', {name}));

            return screen.findByRole('listbox');
        };

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));

        const listbox = await openOptions('인력 부족 시 2교대 가능');

        expect(within(listbox).getByRole('option', {name: '3교대만'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '2교대만'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '계획에 따라 2·3교대'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '인력 부족 시 2교대 가능'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '혼합 편성 계획'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '공정성'})).not.toBeInTheDocument();
    });

    it.each([
        ['ko', '혼합교대 운영 방식', '3교대 우선·부족 시 2교대'],
        ['en', 'Mixed-shift operating policy', 'Three-shift first then two-shift if needed'],
        ['ja', '混合交代の運用方式', '3交代優先・不足時は2交代'],
        ['zh', '混合轮班运行方式', '三班优先·不足时使用两班'],
        ['th', 'นโยบายการทำงานแบบผสม', 'ใช้ 3 กะก่อน·ขาดคนจึงใช้ 2 กะ'],
        ['vi', 'Chính sách vận hành ca hỗn hợp', 'Ưu tiên 3 ca·thiếu người mới dùng 2 ca'],
    ])('does not render the retired MIXED policy selector in %s', async (language, title, strategyLabel) => {
        await i18n.changeLanguage(language);
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {},
            templates: [],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => expect(wardApiMocks.getShiftConstraintRuleCandidates).toHaveBeenCalledWith(1, 10));
        expect(screen.queryAllByRole('radio')).toHaveLength(0);
        expect(screen.queryByText(title)).not.toBeInTheDocument();
        expect(screen.queryByRole('radio', {name: new RegExp(strategyLabel)})).not.toBeInTheDocument();
        expect(document.body.textContent).not.toContain('THREE_BASE_FALLBACK_TWO');
    });

    it('imports only the exact three-shift allowlist from another team', async () => {
        const sourceRule = (shiftConstraintRuleId: number, templateCode: string, category: string) => ({
            shiftConstraintRuleId,
            templateCode,
            category,
            severity: 'SOFT' as const,
            sortOrder: shiftConstraintRuleId,
            params: {},
            selected: true,
            isImportant: false,
            displayText: templateCode,
            isValid: true,
            invalidReason: null,
        });

        wardApiMocks.getShiftConstraintRules
            .mockResolvedValueOnce({schemaVersion: 1, wardId: 1, shiftTeamId: 10, rules: []})
            .mockResolvedValueOnce({
                schemaVersion: 1,
                wardId: 1,
                shiftTeamId: 20,
                rules: [
                    sourceRule(1, 'CORE_MAX_CONTINUOUS_WORK', 'CORE'),
                    sourceRule(2, 'MIN_CHARGE_NURSE_BY_SHIFT', 'ROLE_COVERAGE'),
                    sourceRule(3, 'MAX_DAY_NIGHT_TRANSITIONS', 'FORBIDDEN_PATTERN'),
                    sourceRule(4, 'MAX_CONSECUTIVE_WORK_DAYS', 'WORK_REST'),
                ],
            });

        render(
            <Constraints
                wardId={1}
                shiftTeamId={10}
                shiftTeams={
                    [
                        {shiftTeamId: 10, name: 'A Team'},
                        {shiftTeamId: 20, name: 'B Team'},
                    ] as never
                }
                year={2026}
                month={6}
                variant="settings"
            />,
        );

        const importButton = await screen.findByRole('button', {name: '다른 팀 제약조건 불러오기'});

        await waitFor(() => expect(importButton).toBeEnabled());
        await userEvent.click(importButton);

        const dialog = await screen.findByRole('dialog');

        await userEvent.click(within(dialog).getByRole('button', {name: '불러오기'}));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules?.map((rule) => rule.templateCode)).toEqual(['CORE_MAX_CONTINUOUS_WORK']);
        });
    });

    it('omits a legacy mixed operation policy while importing other compatible non-nurse rules', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([...threeShiftWardShiftTypes, ...twoShiftWardShiftTypes] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'MIXED',
            options: {},
            templates: [
                {
                    templateCode: 'MIXED_OPERATION_POLICY',
                    category: 'MIXED_POLICY',
                    displayTemplate: '{strategy}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [{key: 'strategy', label: 'Strategy', inputType: 'SELECT', optionGroup: 'strategies'}],
                },
                {
                    templateCode: 'MIXED_ROTATION_PARTICIPATION',
                    category: 'MIXED_PARTICIPATION',
                    displayTemplate: '{target} {participationMode} {dateScope}',
                    severity: 'HARD',
                    allowedSeverities: ['HARD'],
                    supportedInGenerator: false,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {
                            key: 'participationMode',
                            label: 'Participation',
                            inputType: 'SELECT',
                            optionGroup: 'participationModes',
                        },
                        {key: 'dateScope', label: 'Date', inputType: 'SELECT', optionGroup: 'dateScopes'},
                    ],
                },
            ],
        });
        wardApiMocks.getShiftConstraintRules
            .mockResolvedValueOnce({schemaVersion: 1, wardId: 1, shiftTeamId: 10, rules: []})
            .mockResolvedValueOnce({
                schemaVersion: 1,
                wardId: 1,
                shiftTeamId: 20,
                rules: [
                    {
                        shiftConstraintRuleId: 301,
                        templateCode: 'MIXED_OPERATION_POLICY',
                        category: 'MIXED_POLICY',
                        severity: 'HARD',
                        sortOrder: 1,
                        params: {strategy: {type: 'PLANNED_MIXED'}},
                        selected: true,
                        isImportant: true,
                        displayText: 'PLANNED_POLICY_SENTINEL',
                    },
                    {
                        shiftConstraintRuleId: 302,
                        templateCode: 'MIXED_ROTATION_PARTICIPATION',
                        category: 'MIXED_PARTICIPATION',
                        severity: 'HARD',
                        sortOrder: 2,
                        params: {
                            nurseIds: [{type: 'NURSE', nurseId: 1}],
                            participationMode: {type: 'FLEX'},
                            dateScope: {type: 'EVERYDAY'},
                        },
                        selected: true,
                        isImportant: true,
                        displayText: 'FLEX_RULE_SENTINEL',
                    },
                    {
                        shiftConstraintRuleId: 303,
                        templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                        category: 'WORK_REST',
                        severity: 'SOFT',
                        sortOrder: 3,
                        params: {target: {type: 'ALL'}, count: 5},
                        selected: true,
                        isImportant: false,
                        displayText: 'IMPORTED_MIXED_RULE_SENTINEL',
                    },
                ],
            });

        render(
            <Constraints
                wardId={1}
                shiftTeamId={10}
                shiftTeams={
                    [
                        {shiftTeamId: 10, name: 'A Team'},
                        {shiftTeamId: 20, name: 'Mixed Team'},
                    ] as never
                }
                year={2026}
                month={6}
                variant="settings"
            />,
        );

        await userEvent.click(await screen.findByRole('button', {name: '다른 팀 제약조건 불러오기'}));
        await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', {name: '불러오기'}));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    params: {target: {type: 'ALL'}, count: 5},
                }),
            ]);
            expect(screen.getByText('CORE_MAX_CONTINUOUS_WORK')).toBeInTheDocument();
        });

        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('간호사별 제약조건 1개는 제외했어요.'));

        expect(document.body.textContent).not.toContain('PLANNED_POLICY_SENTINEL');
        expect(screen.queryByText('혼합교대 운영 방식')).not.toBeInTheDocument();
        await userEvent.click(document.getElementById('make_constraint_add_button') as HTMLButtonElement);
        expect(document.body.textContent).not.toContain('{strategy}');
    });

    it('hides legacy bundled and fully duplicated templates from the add modal', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{type: 'ALL', label: 'All'}],
            },
            templates: [
                {
                    templateCode: 'NURSE_PREFER_SHIFT',
                    category: 'NURSE_LIMIT',
                    displayTemplate: 'VISIBLE_RECOMMENDED_SENTINEL',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
                {
                    templateCode: 'CORE_FORBIDDEN_DUTY_PATTERNS',
                    category: 'CORE',
                    displayTemplate: 'LEGACY_BUNDLE_SHOULD_HIDE',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
                {
                    templateCode: 'MAX_CONSECUTIVE_WORK_DAYS',
                    category: 'WORK_REST',
                    displayTemplate: 'DUPLICATE_MAX_WORK_SHOULD_HIDE',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
                {
                    templateCode: 'MAX_CONSECUTIVE_N',
                    category: 'WORK_REST',
                    displayTemplate: 'DUPLICATE_MAX_NIGHT_SHOULD_HIDE',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
                {
                    templateCode: 'MIN_OFF_AFTER_N',
                    category: 'WORK_REST',
                    displayTemplate: 'DUPLICATE_OFF_AFTER_NIGHT_SHOULD_HIDE',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
                {
                    templateCode: 'MIN_STAFF_WEEKEND_HOLIDAY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: 'DUPLICATE_WEEKEND_STAFFING_SHOULD_HIDE',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        expect(await screen.findByText('{nurse}')).toBeInTheDocument();
        expect(screen.queryByText('VISIBLE_RECOMMENDED_SENTINEL')).not.toBeInTheDocument();
        expect(screen.queryByText('LEGACY_BUNDLE_SHOULD_HIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('DUPLICATE_MAX_WORK_SHOULD_HIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('DUPLICATE_MAX_NIGHT_SHOULD_HIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('DUPLICATE_OFF_AFTER_NIGHT_SHOULD_HIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('DUPLICATE_WEEKEND_STAFFING_SHOULD_HIDE')).not.toBeInTheDocument();
        expect(screen.queryByText('CORE')).not.toBeInTheDocument();
    });

    it('keeps the add icon enabled after reopening so the same constraint can be added with another dropdown value', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [
                    {type: 'ALL', label: '전체'},
                    {type: 'NURSE', nurseId: 7, label: '홍길동'},
                ],
            },
            templates: [
                {
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'CORE',
                    displayTemplate: '{target} VISIBLE_RECOMMENDED_SENTINEL',
                    severity: 'HARD',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openAddModal = async () => {
            const addButton = await waitFor(() => {
                const button = document.getElementById('make_constraint_add_button');

                expect(button).toBeInTheDocument();

                return button as HTMLButtonElement;
            });

            await userEvent.click(addButton);
        };

        await openAddModal();
        {
            const modalAddButtons = screen.getAllByRole('button', {name: /^제약 조건 추가:/});

            await userEvent.click(modalAddButtons[modalAddButtons.length - 1]!);
        }

        await waitFor(() => {
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument();
        });

        await openAddModal();

        const modalAddButtons = screen.getAllByRole('button', {name: /^제약 조건 추가:/});
        const modalAddButton = modalAddButtons[modalAddButtons.length - 1]!;

        expect(screen.queryByText('추가됨')).not.toBeInTheDocument();
        expect(modalAddButton).toBeEnabled();
        expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(1);

        const targetButtons = screen.getAllByRole('button', {name: '모든 간호사'});

        await userEvent.click(targetButtons[targetButtons.length - 1]!);
        await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', {name: '홍길동'}));
        await userEvent.click(modalAddButton);

        await waitFor(() => {
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(2);
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenLastCalledWith(
                1,
                10,
                expect.objectContaining({
                    rules: expect.arrayContaining([
                        expect.objectContaining({
                            params: expect.objectContaining({target: expect.objectContaining({type: 'ALL'})}),
                        }),
                        expect.objectContaining({
                            params: expect.objectContaining({
                                target: expect.objectContaining({type: 'NURSE', nurseId: 7}),
                            }),
                        }),
                    ]),
                }),
            );
        });
    });

    it('offers division groups in general target dropdowns', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [
                    {type: 'ALL', label: '전체'},
                    {type: 'DIVISION', label: '신규 간호사', divisionNum: 2},
                    {type: 'NURSE', nurseId: 7, label: '홍길동'},
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
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 7},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await userEvent.click(await screen.findByRole('button', {name: '제약 조건 추가'}));
        await userEvent.click(await screen.findByRole('button', {name: '모든 간호사'}));

        const listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByRole('option', {name: '신규 간호사'})).toBeInTheDocument();

        await userEvent.click(within(listbox).getByRole('option', {name: '신규 간호사'}));
        await userEvent.click(screen.getByTitle('추가'));

        await waitFor(() => {
            const savedRule = getLastUpdatePayload()?.rules?.[0];

            expect(savedRule).toMatchObject({
                templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                params: {target: {type: 'DIVISION', divisionNum: 2}, count: 5},
            });
            expect(JSON.stringify(savedRule?.params)).not.toMatch(/label|name|신규/);
        });
    });

    it('closes the modal and moves focus to the existing editable rule when an exact duplicate is added', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

            expect(button).toBeEnabled();

            return button;
        });

        await userEvent.click(openButton);

        let modal = screen.getByRole('button', {name: '닫기'}).closest('.fixed') as HTMLElement;
        let modalAddButton = within(modal).getAllByTitle('추가')[0]!;

        await userEvent.click(modalAddButton);
        await waitFor(() => expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(1));

        const ruleRow = await waitFor(() => {
            const row = document.querySelector<HTMLElement>('[data-constraint-rule-id]');

            expect(row).toBeInTheDocument();

            return row!;
        });

        await userEvent.click(openButton);
        modal = screen.getByRole('button', {name: '닫기'}).closest('.fixed') as HTMLElement;
        modalAddButton = within(modal).getAllByTitle('추가')[0]!;

        await userEvent.click(modalAddButton);

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument();
            expect(scrollIntoViewMock).toHaveBeenCalledWith({block: 'center'});
        });

        const firstParamEditor = within(ruleRow).getByRole('button', {name: '모든 간호사'});

        expect(firstParamEditor).toHaveFocus();
        expect(ruleRow).toHaveClass('ring-2');
        expect(openButton).toBeEnabled();
    });

    it('keeps the add icon enabled when the same template and params already exist with another severity', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'CORE',
                    severity: 'HARD',
                    sortOrder: 1,
                    params: {},
                    selected: true,
                    isImportant: true,
                    displayText: 'VISIBLE_RECOMMENDED_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {},
            templates: [
                {
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'CORE',
                    displayTemplate: 'VISIBLE_RECOMMENDED_SENTINEL',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        const modalAddButtons = screen.getAllByRole('button', {name: /^제약 조건 추가:/});
        const modalAddButton = modalAddButtons[modalAddButtons.length - 1]!;

        expect(screen.queryByText('추가됨')).not.toBeInTheDocument();
        expect(modalAddButton).toBeEnabled();
        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
    });

    it('treats nurse A+B and B+A as the same duplicate after reopening the add modal', async () => {
        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

            expect(button).toBeEnabled();

            return button;
        });

        await userEvent.click(openButton);

        let modal = screen.getByRole('button', {name: '닫기'}).closest('.fixed') as HTMLElement;

        await userEvent.click(within(modal).getByRole('button', {name: '근무자 조합'}));

        await userEvent.click(within(modal).getByTitle('추가'));
        await waitFor(() => expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(1));

        await waitFor(() => expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument());

        await userEvent.click(openButton);
        modal = screen.getByRole('button', {name: '닫기'}).closest('.fixed') as HTMLElement;
        await userEvent.click(within(modal).getByRole('button', {name: '근무자 조합'}));
        await userEvent.click(within(modal).getByRole('button', {name: 'Nurse A'}));
        await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', {name: 'Nurse B'}));
        await userEvent.click(within(modal).getByTitle('추가'));

        expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument());
    });

    it('treats legacy minimum staffing and unified minimum staffing as the same duplicate', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'MIN_STAFF_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'D 데이', code: 'D'}, count: 2},
                    selected: true,
                    isImportant: false,
                    displayText: 'D 근무에 최소 2명이 필요해요',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                dateScopes: [{type: 'EVERYDAY', label: '매일'}],
                shifts: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'D 데이', code: 'D', name: '데이'}],
                staffCountOperators: [
                    {type: 'MIN', label: '최소'},
                    {type: 'EXACT', label: '정확히'},
                ],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope} {shift} 근무 인원이 {operator} {count}명이어야 해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 5},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(await screen.findByRole('button', {name: '정확히'}));
        await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', {name: '최소'}));

        const modalAddButtons = screen.getAllByRole('button', {name: /^제약 조건 추가:/});
        const modalAddButton = modalAddButtons[modalAddButtons.length - 1]!;

        expect(screen.queryByText('추가됨')).not.toBeInTheDocument();
        expect(modalAddButton).toBeEnabled();
        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
    });

    it('blocks and highlights a non-recommended continuous-work rule when its legacy alias already exists', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'MAX_CONSECUTIVE_WORK_DAYS',
                    category: 'WORK_REST',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {target: {type: 'ALL'}, count: '5'},
                    selected: true,
                    isImportant: false,
                    displayText: 'LEGACY_MAX_WORK_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {targets: [{type: 'ALL', label: '모든 사람'}]},
            templates: [
                {
                    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
                    category: 'CORE',
                    displayTemplate: '{target}은 {count}일 이하로 연속 근무해요',
                    severity: 'SOFT',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 31},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const legacyCard = (await screen.findByText('LEGACY_MAX_WORK_SENTINEL')).closest('.grid') as HTMLElement;
        const openButton = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

        await userEvent.click(openButton);
        await userEvent.click(screen.getByTitle('추가'));

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument();
            expect(legacyCard).toHaveClass('ring-2');
        });

        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(scrollIntoViewMock).toHaveBeenCalledWith({block: 'center'});
        expect(openButton).toBeEnabled();
    });

    it('blocks and highlights a canonical work-rest rule matching the transformed legacy alias', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'OFF_AFTER_CONSECUTIVE_WORK',
                    category: 'WORK_REST',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {target: {type: 'ALL'}, count: 5},
                    selected: true,
                    isImportant: false,
                    displayText: 'LEGACY_OFF_AFTER_WORK_SENTINEL',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        });
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {targets: [{type: 'ALL', label: '모든 사람'}]},
            templates: [
                {
                    templateCode: 'MIN_OFF_AFTER_CONSECUTIVE_WORK',
                    category: 'WORK_REST',
                    displayTemplate: '{target}은 {workCount}일 연속 근무 후 {offCount}일 휴무해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'},
                        {key: 'workCount', label: 'Work count', inputType: 'NUMBER', min: 1, max: 31},
                        {key: 'offCount', label: 'Off count', inputType: 'NUMBER', min: 1, max: 31},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const legacyCard = (await screen.findByText('LEGACY_OFF_AFTER_WORK_SENTINEL')).closest('.grid') as HTMLElement;
        const openButton = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

        await userEvent.click(openButton);

        const modal = screen.getByRole('button', {name: '닫기'}).closest('.fixed') as HTMLElement;
        const offCountInput = within(modal).getAllByRole('spinbutton')[1]!;

        await userEvent.click(offCountInput);
        await userEvent.keyboard('1');
        await userEvent.click(within(modal).getByTitle('추가'));

        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(within(modal).getByTitle('추가')).toBeEnabled();
        expect(legacyCard).toHaveClass('ring-2');
    });

    it('shows recommended templates in their original modal categories too', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{type: 'ALL', label: '모든 사람'}],
            },
            templates: [
                {
                    templateCode: 'FORBID_N_THEN_D',
                    category: 'FORBIDDEN_PATTERN',
                    displayTemplate: '{target}은 N나이트 다음 날 D데이 근무를 피해요.',
                    severity: 'SOFT',
                    allowedSeverities: ['HARD', 'SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}],
                },
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
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        await waitFor(() => {
            expect(document.body.textContent).toContain('다음 날');
            expect(document.body.textContent).toContain('근무를 피해요');
        });

        await userEvent.click(screen.getByRole('button', {name: '야간·전환'}));

        expect(document.body.textContent).toContain('다음 날');
        expect(document.body.textContent).toContain('근무를 피해요');

        await userEvent.click(screen.getByRole('button', {name: '연속 근무·휴무'}));

        expect(document.body.textContent).toContain('최대 일까지 연속으로 근무');
        expect(screen.getByRole('spinbutton')).toHaveValue(5);

        const maxWorkCard = screen
            .getByRole('dialog')
            .querySelector<HTMLElement>('[data-constraint-template-card="CORE_MAX_CONTINUOUS_WORK"]');

        expect(maxWorkCard).not.toBeNull();
        await userEvent.click(within(maxWorkCard!).getByTitle('추가'));

        await waitFor(() => {
            expect(getLastUpdatePayload()?.rules).toEqual([
                expect.objectContaining({templateCode: 'CORE_MAX_CONTINUOUS_WORK', severity: 'SOFT', isImportant: false}),
            ]);
        });
    });

    it('shows date-scope staffing options above the add modal and saves the selected option', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([
            {wardShiftTypeId: 11, shortName: 'D', name: '데이', classification: 'DAY', rotationSystem: 'THREE', isActive: true},
        ] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                dateScopes: [
                    {type: 'ALL', label: '모든날'},
                    {type: 'EVERYDAY', label: '매일'},
                    {type: 'WEEKDAY', label: '평일'},
                    {type: 'WEEKEND_OR_HOLIDAY', label: '주말/공휴일'},
                ],
                shifts: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'D 데이', code: 'D', name: '데이'}],
                staffCountOperators: [
                    {type: 'MIN', label: '최소'},
                    {type: 'MAX', label: '최대'},
                    {type: 'EXACT', label: '정확히'},
                ],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope}에는 {shift} 근무 인원이 {operator} {count}명이어야 해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 5},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(await screen.findByRole('button', {name: '매일'}));

        const listbox = await screen.findByRole('listbox');

        expect(listbox).toHaveClass('z-[2147483647]');
        expect(within(listbox).queryByRole('option', {name: '모든날'})).not.toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '매일'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '평일'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '주말/공휴일'})).toBeInTheDocument();

        await userEvent.click(within(listbox).getByRole('option', {name: '주말/공휴일'}));

        const modalAddButtons = screen.getAllByRole('button', {name: /^제약 조건 추가:/});

        await userEvent.click(modalAddButtons[modalAddButtons.length - 1]!);

        await waitFor(() => {
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledWith(
                1,
                10,
                expect.objectContaining({
                    rules: expect.arrayContaining([
                        expect.objectContaining({
                            templateCode: 'STAFF_COUNT_BY_SHIFT',
                            params: expect.objectContaining({
                                dateScope: {type: 'WEEKEND_OR_HOLIDAY'},
                                shift: expect.objectContaining({type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11}),
                                operator: expect.objectContaining({type: 'EXACT'}),
                                count: 2,
                            }),
                        }),
                    ]),
                }),
            );
        });
    });

    it('saves the unified staff-count-by-shift constraint with date scope and exact count defaults', async () => {
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([
            {wardShiftTypeId: 11, shortName: 'D', name: '데이', classification: 'DAY', rotationSystem: 'THREE', isActive: true},
        ] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                dateScopes: [
                    {type: 'EVERYDAY', label: '매일'},
                    {type: 'WEEKEND_OR_HOLIDAY', label: '주말/공휴일'},
                ],
                shifts: [
                    {type: 'ALL', label: '모든'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'D 데이', code: 'D', name: '데이'},
                ],
                staffCountOperators: [
                    {type: 'MIN', label: '최소'},
                    {type: 'MAX', label: '최대'},
                    {type: 'EXACT', label: '정확히'},
                ],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope} {shift} 근무 인원이 {operator} {count}명이어야 해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 5},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        expect(await screen.findByRole('button', {name: '매일'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '데이'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '정확히'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '모든'})).not.toBeInTheDocument();

        const modalAddButtons = screen.getAllByRole('button', {name: /^제약 조건 추가:/});

        await userEvent.click(modalAddButtons[modalAddButtons.length - 1]!);

        await waitFor(() => {
            expect(wardApiMocks.updateShiftConstraintRules).toHaveBeenCalledWith(
                1,
                10,
                expect.objectContaining({
                    rules: expect.arrayContaining([
                        expect.objectContaining({
                            templateCode: 'STAFF_COUNT_BY_SHIFT',
                            params: expect.objectContaining({
                                dateScope: expect.objectContaining({type: 'EVERYDAY'}),
                                shift: expect.objectContaining({type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11}),
                                operator: expect.objectContaining({type: 'EXACT'}),
                                count: 2,
                            }),
                        }),
                    ]),
                }),
            );
        });
    });

    it('blocks a second staffing rule with the same scope shift and operator but a different count', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'THREE',
            rules: [
                {
                    shiftConstraintRuleId: 1,
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {
                        dateScope: {type: 'EVERYDAY'},
                        shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 1},
                        operator: {type: 'MIN'},
                        count: 1,
                    },
                    selected: true,
                    isImportant: false,
                    displayText: '매일 D 근무는 최소 1명',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        } as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'THREE',
            options: {
                dateScopes: [{type: 'EVERYDAY', label: '매일'}],
                shifts: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 1, label: 'D'}],
                staffCountOperators: [
                    {type: 'MIN', label: '최소'},
                    {type: 'EXACT', label: '정확히'},
                ],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope} {shift} {operator} {count}',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 0, max: 20},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

            expect(button).toBeEnabled();

            return button;
        });

        await userEvent.click(openButton);
        await userEvent.click(await screen.findByRole('button', {name: '정확히'}));
        await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', {name: '최소'}));

        await userEvent.click(screen.getByTitle('추가'));

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument();
            expect(scrollIntoViewMock).toHaveBeenCalledWith({block: 'center'});
        });

        expect(wardApiMocks.updateShiftConstraintRules).not.toHaveBeenCalled();
        expect(openButton).toBeEnabled();
    });

    it('uses localized neutral options and limits three-shift staffing choices to active D E N shifts', async () => {
        await i18n.changeLanguage('en');
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([
            ...threeShiftWardShiftTypes.map((shiftType, index) => ({...shiftType, name: ['Day', 'Evening', 'Night'][index]})),
            {wardShiftTypeId: 4, shortName: '2D', name: 'Two-day', classification: 'DAY', rotationSystem: 'TWO', isActive: true},
            {wardShiftTypeId: 5, shortName: 'O', name: 'Off', classification: 'OFF', rotationSystem: 'NONE', isActive: true},
            {wardShiftTypeId: 6, shortName: 'EDU', name: 'Education', classification: 'OTHER_WORK', rotationSystem: 'NONE', isActive: true},
            {wardShiftTypeId: 7, shortName: 'ID', name: 'Inactive day', classification: 'DAY', rotationSystem: 'THREE', isActive: false},
            {wardShiftTypeId: 8, shortName: 'UE', name: 'Unscoped evening', classification: 'EVENING', isActive: true},
            {wardShiftTypeId: 9, shortName: 'UA', name: 'Unknown active', classification: 'DAY', rotationSystem: 'THREE'},
            {wardShiftTypeId: 10, shortName: 'TO', name: 'Three off', classification: 'OFF', rotationSystem: 'THREE', isActive: true},
        ] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'THREE',
            options: {
                dateScopes: [{type: 'EVERYDAY', label: '매일'}],
                shifts: [
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 1, label: '데이'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 2, label: '이브닝'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 3, label: '나이트'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 4, label: '2교대 주간'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 5, label: '휴무'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 6, label: '교육'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 7, label: '비활성 데이'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 8, label: '교대제 미지정 이브닝'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 9, label: '활성 여부 미지정 데이'},
                    {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 10, label: '3교대 휴무'},
                ],
                staffCountOperators: [{type: 'EXACT', label: '정확히'}],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope} {shift} {operator} {count}',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 0, max: 20},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

            expect(button).toBeEnabled();

            return button;
        });

        await userEvent.click(addButton);

        expect(screen.getByRole('button', {name: 'Every day'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Exactly'})).toBeInTheDocument();
        expect(
            screen.getByRole('button', {name: /^Add constraint: Every day: exactly 2 nurses must be assigned to .+\.$/}),
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Day'}));

        const listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByRole('option', {name: 'Day'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: 'Evening'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: 'Night'})).toBeInTheDocument();
        expect(
            within(listbox).queryByRole('option', {
                name: /2D|Two-day|Off|Education|Inactive day|Unscoped evening|Unknown active|Three off/,
            }),
        ).not.toBeInTheDocument();

        await userEvent.click(within(listbox).getByRole('option', {name: 'Evening'}));
        await userEvent.click(screen.getByTitle('Add'));

        await waitFor(() => {
            const savedPayload = getLastUpdatePayload();
            const serializedParams = JSON.stringify(savedPayload?.rules?.[0]?.params);

            expect(savedPayload?.rules?.[0]).toMatchObject({
                templateCode: 'STAFF_COUNT_BY_SHIFT',
                params: {
                    dateScope: {type: 'EVERYDAY'},
                    shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 2},
                    operator: {type: 'EXACT'},
                    count: 2,
                },
            });
            expect(serializedParams).not.toMatch(/매일|정확히|이브닝|label|name/);
        });

        await waitFor(() => expect(screen.queryByRole('button', {name: 'Close'})).not.toBeInTheDocument());

        await userEvent.click(addButton);

        const modal = screen.getByRole('button', {name: 'Close'}).closest('.fixed') as HTMLElement;

        await userEvent.click(within(modal).getByRole('button', {name: 'Day'}));
        await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', {name: 'Night'}));
        await userEvent.click(within(modal).getByTitle('Add'));

        await waitFor(() => {
            const savedRules = getLastUpdatePayload()?.rules ?? [];

            expect(savedRules).toHaveLength(2);
            expect(savedRules.map((rule) => (rule.params.shift as {wardShiftTypeId?: number}).wardShiftTypeId)).toEqual([2, 3]);
        });
    });

    it('removes display-only metadata recursively before saving constraint params', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 71,
                    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
                    category: 'NURSE_COMBINATION',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {
                        nurseA: {
                            type: 'NURSE',
                            nurseId: 1,
                            label: '간호사 A',
                            name: 'Nurse A',
                            shortName: 'A',
                            color: '#FFFFFF',
                            presentation: {
                                label: '중첩 라벨',
                                name: 'Nested name',
                                shortName: 'Nested',
                                color: '#000000',
                                stableId: 'nurse-a',
                            },
                        },
                        nurseB: {type: 'NURSE', nurseId: 2, label: '간호사 B', name: 'Nurse B'},
                    },
                    selected: true,
                    isImportant: false,
                    displayText: 'Nurse A and Nurse B should not work together',
                    isValid: true,
                    invalidReason: null,
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const openButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

            expect(button).toBeEnabled();

            return button;
        });

        await userEvent.click(openButton);
        await userEvent.click(screen.getAllByRole('button', {name: /^제약 조건 추가:/})[0]!);

        await waitFor(() => {
            const savedRule = getLastUpdatePayload()?.rules?.find((rule) => rule.templateCode === 'NURSE_PAIR_NOT_SAME_SHIFT');

            expect(savedRule?.params).toEqual({
                nurseA: {
                    type: 'NURSE',
                    nurseId: 1,
                    presentation: {stableId: 'nurse-a'},
                },
                nurseB: {type: 'NURSE', nurseId: 2},
            });
            expect(JSON.stringify(savedRule?.params)).not.toMatch(/label|name|shortName|color|간호사|Nested|#FFFFFF|#000000/);
        });
    });

    it('removes the all-days option from date-scope staffing dropdowns', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                dateScopes: [
                    {type: 'ALL', label: '모든날'},
                    {type: 'EVERYDAY', label: '매일'},
                    {type: 'DAY_OF_MONTH', day: 1, label: '1일'},
                    {type: 'DAY_OF_MONTH', day: 2, label: '2일'},
                ],
                shifts: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'D 데이', code: 'D', name: '데이'}],
                staffCountOperators: [{type: 'EXACT', label: '정확히'}],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope}에는 {shift} 근무 인원이 {operator} {count}명이어야 해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 5},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(await screen.findByRole('button', {name: '매일'}));

        const listbox = await screen.findByRole('listbox');

        expect(within(listbox).queryByRole('option', {name: '모든날'})).not.toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '매일'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '매월 1일'})).toBeInTheDocument();
        expect(within(listbox).getByRole('option', {name: '매월 2일'})).toBeInTheDocument();
    });

    it('keeps leap-day but removes dates outside the selected month', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rotationMode: 'THREE',
            options: {
                dateScopes: [
                    {type: 'EVERYDAY', label: '매일'},
                    {type: 'DAY_OF_MONTH', day: 29, label: '29일'},
                    {type: 'DAY_OF_MONTH', day: 30, label: '30일'},
                    {type: 'DAY_OF_MONTH', day: 31, label: '31일'},
                ],
                shifts: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 1, label: 'D'}],
                staffCountOperators: [{type: 'EXACT', label: '정확히'}],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope} {shift} {operator} {count}',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 0, max: 20},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2024} month={2} variant="settings" />);

        const openButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button') as HTMLButtonElement;

            expect(button).toBeEnabled();

            return button;
        });

        await userEvent.click(openButton);
        await userEvent.click(await screen.findByRole('button', {name: '매일'}));

        const listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByRole('option', {name: '매월 29일'})).toBeInTheDocument();
        expect(within(listbox).queryByRole('option', {name: '매월 30일'})).not.toBeInTheDocument();
        expect(within(listbox).queryByRole('option', {name: '매월 31일'})).not.toBeInTheDocument();
    });

    it('does not duplicate monthly wording in date-scope staffing sentences', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                dateScopes: [
                    {type: 'EVERYDAY', label: '매일'},
                    {type: 'DAY_OF_MONTH', day: 1, label: '매월 1일'},
                ],
                shifts: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'D 데이', code: 'D', name: '데이'}],
                staffCountOperators: [{type: 'EXACT', label: '정확히'}],
            },
            templates: [
                {
                    templateCode: 'STAFF_COUNT_BY_SHIFT',
                    category: 'STAFFING_COUNT',
                    displayTemplate: '{dateScope}에는 {shift} 근무 인원이 {operator} {count}명이어야 해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'dateScope', label: 'Date Scope', inputType: 'SELECT', optionGroup: 'dateScopes'},
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'shifts'},
                        {key: 'operator', label: 'Operator', inputType: 'SELECT', optionGroup: 'staffCountOperators'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 5},
                    ],
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(await screen.findByRole('button', {name: '매일'}));
        await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', {name: '매월 1일'}));

        expect(screen.getByRole('button', {name: '매월 1일'})).toBeInTheDocument();
        expect(document.body.textContent).toContain('매월 1일');
        expect(document.body.textContent).toContain('근무 인원이');
        expect(document.body.textContent).not.toContain('매월 매월');
        expect(document.body.textContent).not.toContain('1일일에는');
    });

    it('shows preceptor and preceptee badges in person target dropdowns using member-role details', async () => {
        wardApiMocks.getShiftTeamNurses.mockResolvedValueOnce([
            {nurseId: 1, name: '오지헌', isPreceptor: true, isPreceptee: true, memo: ''},
        ] as never);
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [
                    {type: 'ALL', label: '전체'},
                    {type: 'NURSE', nurseId: 1, label: '오지헌', name: '오지헌'},
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
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);
        await userEvent.click(await screen.findByRole('button', {name: '모든 간호사'}));

        const listbox = await screen.findByRole('listbox');
        const preceptorBadge = within(listbox).getByText('프리셉터');
        const allPeopleOption = within(listbox).getByRole('option', {name: '모든 간호사'});

        expect(allPeopleOption).toHaveClass('justify-start');
        expect(allPeopleOption).toHaveClass('text-left');
        expect(within(listbox).getByText('오지헌')).toBeInTheDocument();
        expect(preceptorBadge).toBeInTheDocument();
        expect(preceptorBadge).not.toHaveClass('ring-1');
        expect(within(listbox).getByText('프리셉티')).toBeInTheDocument();

        await userEvent.click(within(listbox).getByRole('option', {name: /오지헌/}));

        const selectedButton = screen.getByRole('button', {name: '오지헌'});

        expect(within(selectedButton).queryByText('프리셉터')).not.toBeInTheDocument();
        expect(within(selectedButton).queryByText('프리셉티')).not.toBeInTheDocument();
    });

    it('shows nurse role badges in constraint dropdown options', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                nurses: [
                    {
                        type: 'NURSE',
                        nurseId: 1,
                        label: '오지현',
                        name: '오지현',
                        isPreceptor: true,
                        isPreceptee: true,
                    },
                ],
            },
            templates: [
                {
                    templateCode: 'FORBID_N_THEN_D',
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

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        const selectedButton = screen.getByRole('button', {name: '오지현'});

        expect(within(selectedButton).queryByText('프리셉터')).not.toBeInTheDocument();
        expect(within(selectedButton).queryByText('프리셉티')).not.toBeInTheDocument();

        await userEvent.click(selectedButton);

        const listbox = await screen.findByRole('listbox');

        expect(within(listbox).getByText('오지현')).toBeInTheDocument();
        expect(within(listbox).getByText('프리셉터')).toBeInTheDocument();
        expect(within(listbox).getByText('프리셉티')).toBeInTheDocument();
    });

    it('hides proficiency constraints from the add modal', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                shiftsWithAll: [{type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11, label: 'N 나이트', code: 'N', name: '나이트'}],
                proficiencies: [{type: 'PROFICIENCY_AT_LEAST', label: '서버값'}],
                nurses: [
                    {type: 'NURSE', nurseId: 1, label: 'Nurse A', name: 'Nurse A'},
                    {type: 'NURSE', nurseId: 2, label: 'Nurse B', name: 'Nurse B'},
                ],
            },
            templates: [
                {
                    templateCode: 'MIN_PROFICIENCY_STAFF_BY_SHIFT',
                    category: 'PROFICIENCY',
                    displayTemplate: '{shift} 근무에는 LV{level} 이상 간호사가 {count}명 이상 있어야 해요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [
                        {key: 'shift', label: 'Shift', inputType: 'SELECT', optionGroup: 'SHIFTS_WITH_ALL'},
                        {key: 'level', label: 'Level', inputType: 'SELECT', optionGroup: 'PROFICIENCIES'},
                        {key: 'count', label: 'Count', inputType: 'NUMBER', min: 1, max: 3},
                    ],
                },
                {
                    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
                    category: 'NURSE_COMBINATION',
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

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        const addButton = await waitFor(() => {
            const button = document.getElementById('make_constraint_add_button');

            expect(button).toBeInTheDocument();

            return button as HTMLButtonElement;
        });

        await userEvent.click(addButton);

        expect(screen.queryByText((content) => content.includes('근무에는'))).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '서버값'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Nurse A'})).toBeInTheDocument();
    });

    it('asks for confirmation before deleting or unmarking a recommended rule', async () => {
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: recommendedServerRules,
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        expect(await screen.findAllByRole('button', {name: '모든 간호사'})).not.toHaveLength(0);

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
                    templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
                    category: 'NURSE_COMBINATION',
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
                            templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
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
                            templateCode: 'NURSE_PAIR_NOT_SAME_SHIFT',
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

    it('hides proficiency rules returned by the server', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                nurses: [{type: 'NURSE', nurseId: 1, label: 'Nurse A', name: 'Nurse A'}],
            },
            templates: [
                {
                    templateCode: 'NURSE_NOT_ALONE_N',
                    category: 'PROFICIENCY',
                    displayTemplate: '{nurse}은 혼자 N나이트 근무를 하면 안 돼요',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'nurse', label: 'Nurse', inputType: 'SELECT', optionGroup: 'NURSES'}],
                },
            ],
        });
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 22,
                    templateCode: 'NURSE_NOT_ALONE_N',
                    category: 'PROFICIENCY',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {nurse: {type: 'NURSE', nurseId: 1, label: 'Nurse A', name: 'Nurse A'}},
                    selected: true,
                    isImportant: false,
                },
            ],
        });

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => {
            expect(document.getElementById('make_constraint_add_button')).toBeInTheDocument();
            expect(wardApiMocks.getShiftConstraintRules).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: 'Nurse A'})).not.toBeInTheDocument();
            expect(document.body.textContent).not.toContain('혼자');
        });
    });

    it('renders legacy forbidden pattern duty chips from configured ward shift types', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{type: 'ALL', label: '전체'}],
            },
            templates: [
                {
                    templateCode: 'FORBID_N_THEN_D',
                    category: 'FORBIDDEN_PATTERN',
                    displayTemplate: '{target}은 N나이트 다음 날 D데이 근무를 피해요.',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}],
                },
            ],
        });
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 21,
                    templateCode: 'FORBID_N_THEN_D',
                    category: 'FORBIDDEN_PATTERN',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {target: {type: 'ALL'}},
                    selected: true,
                    isImportant: false,
                },
            ],
        });
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([
            {
                wardShiftTypeId: 101,
                name: '야간전담',
                shortName: 'Y',
                color: '#263238',
                isOff: false,
                classification: 'NIGHT',
                startTime: '21:00',
                endTime: '06:00',
                isDefault: false,
                isCounted: true,
            },
            {
                wardShiftTypeId: 102,
                name: '오전근무',
                shortName: 'M',
                color: '#1976D2',
                isOff: false,
                classification: 'DAY',
                startTime: '07:00',
                endTime: '15:00',
                isDefault: false,
                isCounted: true,
            },
        ]);

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => {
            expect(document.body.textContent).toContain('야간전담');
            expect(document.body.textContent).toContain('오전근무');
            expect(document.body.textContent).not.toContain('N나이트');
            expect(document.body.textContent).not.toContain('D데이');
        });
        expect(screen.queryByText('Y')).not.toBeInTheDocument();
        expect(screen.queryByText('M')).not.toBeInTheDocument();
    });

    it('renders slash-prefixed Korean off text as the configured off shift type chip', async () => {
        wardApiMocks.getShiftConstraintRuleCandidates.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            options: {
                targets: [{type: 'ALL', label: '전체'}],
            },
            templates: [
                {
                    templateCode: 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
                    category: 'FORBIDDEN_PATTERN',
                    displayTemplate: '신청한 /오프 전날에는 N나이트 근무를 하면 안 돼요.',
                    severity: 'SOFT',
                    allowedSeverities: ['SOFT'],
                    supportedInGenerator: true,
                    supportedInValidator: true,
                    slots: [{key: 'target', label: 'Target', inputType: 'SELECT', optionGroup: 'TARGETS'}],
                },
            ],
        });
        wardApiMocks.getShiftConstraintRules.mockResolvedValueOnce({
            schemaVersion: 1,
            wardId: 1,
            shiftTeamId: 10,
            rules: [
                {
                    shiftConstraintRuleId: 22,
                    templateCode: 'CORE_EXCLUDE_NIGHT_BEFORE_REQ_OFF',
                    category: 'FORBIDDEN_PATTERN',
                    severity: 'SOFT',
                    sortOrder: 1,
                    params: {target: {type: 'ALL'}},
                    selected: true,
                    isImportant: false,
                },
            ],
        });
        wardApiMocks.getShiftTypes.mockResolvedValueOnce([
            {
                wardShiftTypeId: 201,
                name: '휴무',
                shortName: 'R',
                color: '#6B7280',
                isOff: true,
                classification: 'OFF',
                startTime: '',
                endTime: '',
                isDefault: false,
                isCounted: false,
            },
            {
                wardShiftTypeId: 202,
                name: '야간전담',
                shortName: 'Y',
                color: '#263238',
                isOff: false,
                classification: 'NIGHT',
                startTime: '21:00',
                endTime: '06:00',
                isDefault: false,
                isCounted: true,
            },
        ]);

        render(<Constraints wardId={1} shiftTeamId={10} shiftTeams={[]} year={2026} month={6} variant="settings" />);

        await waitFor(() => {
            expect(document.body.textContent).toContain('휴무');
            expect(document.body.textContent).toContain('야간전담');
            expect(document.body.textContent).not.toContain('/오프');
            expect(document.body.textContent).not.toContain('N나이트');
        });
    });
});
