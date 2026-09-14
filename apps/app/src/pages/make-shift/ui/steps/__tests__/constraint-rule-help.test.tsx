import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {TooltipProvider} from '@/shared/ui/primitives/tooltip';
import {render, screen, userEvent, within} from '@/shared/util/test-utils';
import type {TShiftConstraintRuleDraft} from '../../../model/shift-constraint-rules';
import {ConstraintRuleHelp, type TConstraintHelpOption} from '../constraint-rule-help';
import {CONSTRAINT_HELP_CODES, hasConstraintHelp} from '../constraint-rule-help-codes';

const optionMap: Record<string, TConstraintHelpOption[]> = {
    dutyStrict: [
        {
            value: '11',
            label: '주간특수',
            kind: 'duty',
            shortName: '주',
            name: '주간특수',
            color: '#128B7A',
            classification: 'DAY',
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11},
        },
        {
            value: '12',
            label: '저녁특수',
            kind: 'duty',
            shortName: '저',
            name: '저녁특수',
            color: '#C95872',
            classification: 'EVENING',
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 12},
        },
        {
            value: '13',
            label: '심야특수',
            kind: 'duty',
            shortName: '심',
            name: '심야특수',
            color: '#6255CA',
            classification: 'NIGHT',
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 13},
        },
    ],
    dutyReference: [
        {
            value: '14',
            label: '회복휴무',
            kind: 'duty',
            shortName: '휴',
            name: '회복휴무',
            color: '#667085',
            classification: 'OFF',
            isOff: true,
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 14},
        },
    ],
    dateScope: [{value: 'WEEKEND', label: '주말', raw: {type: 'WEEKEND'}}],
    period: [{value: 'MONTH', label: '한 달', raw: {type: 'MONTH'}}],
    target: [
        {value: 'ALL', label: '모든 간호사', raw: {type: 'ALL'}},
        {value: 'DIVISION-1', label: '신규 간호사 1그룹', raw: {type: 'DIVISION', divisionNum: 1}},
    ],
    nurse: [
        {value: '1', label: '김다정', kind: 'nurse', raw: {type: 'NURSE', nurseId: 1}},
        {value: '2', label: '이든든', kind: 'nurse', raw: {type: 'NURSE', nurseId: 2}},
    ],
    twoShiftNight: [
        {
            value: '21',
            label: '야간전담',
            kind: 'duty',
            shortName: '야',
            name: '야간전담',
            color: '#6255CA',
            classification: 'NIGHT',
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 21},
        },
    ],
    twoShiftNightContinuation: [
        {
            value: '22',
            label: '심야근무',
            kind: 'duty',
            shortName: '심',
            name: '심야근무',
            color: '#536276',
            classification: 'NIGHT_CONTINUATION',
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 22},
        },
    ],
    offShift: [
        {
            value: '23',
            label: '회복오프',
            kind: 'duty',
            shortName: '회',
            name: '회복오프',
            color: '#667085',
            classification: 'OFF',
            isOff: true,
            raw: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 23},
        },
    ],
};

function rule(templateCode: string, params: Record<string, unknown> = {}): TShiftConstraintRuleDraft {
    return {
        clientId: `help-${templateCode}`,
        templateCode,
        category: 'TEST',
        severity: 'SOFT',
        sortOrder: 1,
        params,
    };
}

function renderHelp(item: TShiftConstraintRuleDraft, ruleTitle = '테스트 제약조건', rotationMode: 'THREE' | 'TWO' | 'MIXED' = 'THREE') {
    return render(
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
            <ConstraintRuleHelp rule={item} ruleTitle={ruleTitle} optionMap={optionMap} rotationMode={rotationMode} />
        </TooltipProvider>,
    );
}

function getLeafPaths(value: unknown, prefix = ''): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];

    return Object.entries(value).flatMap(([key, child]) => getLeafPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe('constraint help', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
    });

    it('supports every visible constraint type and saved legacy aliases', () => {
        expect(CONSTRAINT_HELP_CODES).toHaveLength(34);
        CONSTRAINT_HELP_CODES.forEach((templateCode) => expect(hasConstraintHelp(templateCode)).toBe(true));
        expect(hasConstraintHelp('REMOVED_UNKNOWN_RULE')).toBe(false);
    });

    it('provides complete tooltip copy in every supported language', () => {
        const expectedTitles = {
            ko: '이 조건은 이렇게 적용돼요',
            en: 'How this constraint works',
            ja: 'この条件はこう適用されます',
            zh: '此条件将这样应用',
            th: 'เงื่อนไขนี้จะถูกนำไปใช้แบบนี้',
            vi: 'Điều kiện này được áp dụng như sau',
        } as const;
        const koHelp = i18n.getResourceBundle('ko', 'translation').page.makeShift.constraints.help;
        const expectedPaths = getLeafPaths(koHelp).sort();

        Object.entries(expectedTitles).forEach(([language, title]) => {
            const help = i18n.getResourceBundle(language, 'translation').page.makeShift.constraints.help;

            expect(help.title).toBe(title);
            expect(getLeafPaths(help).sort()).toEqual(expectedPaths);
            expect(Object.keys(help.description)).toHaveLength(CONSTRAINT_HELP_CODES.length);
        });
    });

    it.each([
        ['en', 'How this constraint works'],
        ['ja', 'この条件はこう適用されます'],
        ['zh', '此条件将这样应用'],
        ['th', 'เงื่อนไขนี้จะถูกนำไปใช้แบบนี้'],
        ['vi', 'Điều kiện này được áp dụng như sau'],
    ])('renders the tooltip using the active %s locale', async (language, title) => {
        await i18n.changeLanguage(language);

        const user = userEvent.setup();

        renderHelp(rule('CORE_MAX_CONTINUOUS_WORK', {count: 4}));

        const trigger = document.querySelector<HTMLElement>('[data-constraint-help-trigger="CORE_MAX_CONTINUOUS_WORK"]');

        expect(trigger).toBeInTheDocument();
        await user.hover(trigger!);
        expect(await screen.findByRole('tooltip')).toHaveTextContent(title);
    });

    it('uses direct, particle-safe copy for the two pair constraints', () => {
        expect(i18n.t('page.makeShift.constraints.templates.SOFT_NO_SAME_DUTY_PAIR.sentence')).toBe(
            '{nurseA} · {nurseB} 두 간호사는 같은 날짜에 서로 다른 근무를 하도록 배정해요',
        );
        expect(i18n.t('page.makeShift.constraints.templates.SOFT_PREFER_SAME_DUTY_PAIR.sentence')).toBe(
            '{nurseA} · {nurseB} 두 간호사는 같은 날짜에 같은 근무를 하도록 우선 배정해요',
        );
    });

    it('renders a help trigger for every supported constraint type', () => {
        CONSTRAINT_HELP_CODES.forEach((templateCode) => {
            const view = renderHelp(rule(templateCode));

            expect(document.querySelector(`[data-constraint-help-trigger="${templateCode}"]`)).toBeInTheDocument();
            view.unmount();
        });
    });

    it('uses the configured two-shift duty names in both the description and chips', async () => {
        const user = userEvent.setup();

        renderHelp(
            rule('TWO_SHIFT_NIGHT_THEN_CONTINUATION', {
                nightShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 21},
                nightContinuationShift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 22},
            }),
            '야간 다음 후속 근무',
            'TWO',
        );

        await user.hover(screen.getByRole('button', {name: '야간 다음 후속 근무 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('모든 간호사는 야간전담 다음 표시일을 심야근무로 배정해 두 근무가 한 쌍이 되도록 해요.');
        expect(tooltip).not.toHaveTextContent('퇴근일 근무');
        expect(tooltip.querySelectorAll('[aria-label="야간전담"]')).toHaveLength(2);
        expect(tooltip.querySelector('[data-constraint-help-example="good"]')).toHaveTextContent('심야근무');
    });

    it('describes preferred duties as a soft preference instead of a restriction', async () => {
        const user = userEvent.setup();

        renderHelp(
            rule('NURSE_PREFER_SHIFT', {
                nurse: {type: 'NURSE', nurseId: 1},
                shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 11},
            }),
            '선호 근무',
        );

        await user.hover(screen.getByRole('button', {name: '선호 근무 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('우선 배정해요');
        expect(tooltip).toHaveTextContent('다른 근무도 가능해요');
        expect(tooltip).not.toHaveTextContent('조건에서 제한되는 배정');
        expect(tooltip.querySelector('[data-constraint-help-example="note"]')).toBeInTheDocument();
    });

    it('describes avoided duties as optional avoidance instead of a restriction', async () => {
        const user = userEvent.setup();

        renderHelp(
            rule('NURSE_AVOID_SHIFT', {
                nurse: {type: 'NURSE', nurseId: 1},
                shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 13},
            }),
            '피하고 싶은 근무',
        );

        await user.hover(screen.getByRole('button', {name: '피하고 싶은 근무 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('다른 근무를 우선해요');
        expect(tooltip).toHaveTextContent('가능하면 배정하지 않아요');
        expect(tooltip).not.toHaveTextContent('조건에서 제한되는 배정');
    });

    it('uses the current target selection in both examples', async () => {
        const user = userEvent.setup();

        renderHelp(rule('CORE_MAX_CONTINUOUS_WORK', {target: {type: 'DIVISION', divisionNum: 1}, count: 4}));

        await user.hover(screen.getByRole('button', {name: '테스트 제약조건 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');
        const audiences = tooltip.querySelectorAll('[data-constraint-help-audience="true"]');

        expect(audiences).toHaveLength(2);
        expect(Array.from(audiences).every((item) => item.textContent === '신규 간호사 1그룹')).toBe(true);
    });

    it('maps each selected nurse to a duty in pair-avoid examples', async () => {
        const user = userEvent.setup();

        renderHelp(
            rule('NURSE_PAIR_NOT_SAME_SHIFT', {
                nurseA: {type: 'NURSE', nurseId: 1},
                nurseB: {type: 'NURSE', nurseId: 2},
            }),
        );

        await user.hover(screen.getByRole('button', {name: '테스트 제약조건 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');
        const allowedAssignments = tooltip
            .querySelector('[data-constraint-help-example="good"]')
            ?.querySelectorAll('[data-constraint-help-assignment="true"]');
        const restrictedAssignments = tooltip
            .querySelector('[data-constraint-help-example="avoid"]')
            ?.querySelectorAll('[data-constraint-help-assignment="true"]');

        expect(tooltip).toHaveTextContent('같은 날짜');
        expect(allowedAssignments).toHaveLength(2);
        expect(allowedAssignments?.[0]).toHaveTextContent('김다정');
        expect(allowedAssignments?.[0]).toHaveTextContent('주간특수');
        expect(allowedAssignments?.[1]).toHaveTextContent('이든든');
        expect(allowedAssignments?.[1]).toHaveTextContent('저녁특수');
        expect(restrictedAssignments?.[0]).toHaveTextContent('주간특수');
        expect(restrictedAssignments?.[1]).toHaveTextContent('주간특수');
        expect(tooltip.querySelector('[data-constraint-help-audience="true"]')).not.toBeInTheDocument();
    });

    it('shows matching duties as the allowed pair-preference example', async () => {
        const user = userEvent.setup();

        renderHelp(
            rule('NURSE_PAIR_PREFER_SAME_SHIFT', {
                nurseA: {type: 'NURSE', nurseId: 1},
                nurseB: {type: 'NURSE', nurseId: 2},
            }),
        );

        await user.hover(screen.getByRole('button', {name: '테스트 제약조건 설명 보기'}));

        const allowedAssignments = (await screen.findByRole('tooltip'))
            .querySelector('[data-constraint-help-example="good"]')
            ?.querySelectorAll('[data-constraint-help-assignment="true"]');

        expect(allowedAssignments).toHaveLength(2);
        expect(allowedAssignments?.[0]).toHaveTextContent('김다정');
        expect(allowedAssignments?.[0]).toHaveTextContent('주간특수');
        expect(allowedAssignments?.[1]).toHaveTextContent('이든든');
        expect(allowedAssignments?.[1]).toHaveTextContent('주간특수');
    });

    it('opens on hover and uses the current team duty names in examples', async () => {
        const user = userEvent.setup();

        renderHelp(rule('FORBID_N_THEN_D', {target: {type: 'ALL'}}), '나이트 다음 데이 피하기');

        await user.hover(screen.getByRole('button', {name: '나이트 다음 데이 피하기 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('심야특수 바로 다음 달력일에는 주간특수 배정을 하지 않아요.');
        expect(tooltip).toHaveTextContent('심야특수');
        expect(tooltip).toHaveTextContent('주간특수');
        expect(tooltip).toHaveTextContent('회복휴무');
        expect(tooltip).toHaveTextContent('이렇게 배정해요');
        expect(tooltip).toHaveTextContent('이렇게는 배정하지 않아요');
        expect(tooltip).not.toHaveTextContent('조건에 맞는 배정');
        expect(tooltip).not.toHaveTextContent('조건에서 제한되는 배정');
        expect(tooltip.querySelector('[data-constraint-help-description="true"]')).toHaveClass('w-[360px]', 'whitespace-normal');
    });

    it('renders repeated off days as individual duty chips', async () => {
        const user = userEvent.setup();

        renderHelp(rule('CORE_MIN_OFF_AFTER_NIGHT', {count: 2}), '나이트 후 최소 휴무');

        await user.hover(screen.getByRole('button', {name: '나이트 후 최소 휴무 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');
        const tooltipPanel = document.querySelector('[data-constraint-help-content="CORE_MIN_OFF_AFTER_NIGHT"]');
        const allowedExample = tooltip.querySelector('[data-constraint-help-example="good"]');
        const sequence = allowedExample?.querySelector('[data-constraint-help-sequence="true"]');

        expect(allowedExample).not.toBeNull();
        expect(tooltipPanel).toHaveClass('w-max', 'max-w-[min(720px,calc(100vw-24px))]');
        expect(sequence).toHaveClass('flex-nowrap');
        expect(allowedExample?.querySelectorAll('[aria-label="회복휴무"]')).toHaveLength(2);
        expect(within(allowedExample as HTMLElement).getAllByText('회복휴무')).toHaveLength(2);
    });

    it('shows example counts from the current row values', async () => {
        const user = userEvent.setup();

        renderHelp(
            rule('STAFF_COUNT_BY_SHIFT', {
                dateScope: {type: 'WEEKEND'},
                shift: {type: 'WARD_SHIFT_TYPE', wardShiftTypeId: 13},
                operator: {type: 'MAX'},
                count: 2,
            }),
            '주말 심야 최대 2명',
        );

        await user.hover(screen.getByRole('button', {name: '주말 심야 최대 2명 설명 보기'}));

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('주말');
        expect(tooltip).toHaveTextContent('심야특수');
        expect(tooltip).toHaveTextContent('2명');
        expect(tooltip).toHaveTextContent('3명');
    });

    it('opens when the information button receives keyboard focus', async () => {
        const user = userEvent.setup();

        renderHelp(rule('AVOID_ISOLATED_OFF_DAY'));

        await user.tab();

        expect(await screen.findByRole('tooltip')).toHaveTextContent('근무 사이에 휴무가 하루만 끼는 배치를 피하도록 해요.');
    });
});
