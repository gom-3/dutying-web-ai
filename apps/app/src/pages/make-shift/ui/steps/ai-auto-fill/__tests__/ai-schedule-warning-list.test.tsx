import type {TScheduleViolationDto} from '@dutying/api/ward';
import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, within} from '@/shared/util/test-utils';
import actual from '../../../../model/__tests__/fixtures/actual-http-staffing-warnings.json';
import {candidate, outcome, response} from '../../../../model/__tests__/fixtures/intent-first';
import {AiAuthoringCandidate} from '../ai-authoring-candidate';
import {AiConversationResultDetails} from '../ai-conversation-result-details';
import {AiScheduleWarningList} from '../ai-schedule-warning-list';

const source = (index = 0) => structuredClone(actual.cases[index]!.violations) as unknown as TScheduleViolationDto[];

describe('concise staffing warnings', () => {
    it.each([0, 1])('renders actual C/D candidate case %s as date/shift/count without ward-wide nurse enumeration', (index) => {
        const violations = source(index);
        const result = response({
            applicable: false,
            changedCells: [],
            validationTarget: 'CANDIDATE',
            candidate: candidate({selectionReason: 'MATERIAL_TRADEOFF', violations}),
            authoringOutcome: outcome({draftState: 'CONSENT_REQUIRED', candidateDigest: 'digest:1'}),
        });
        const before = JSON.stringify(result);

        render(
            <AiAuthoringCandidate
                result={result}
                sourceVersionId="source:1"
                baseline={[]}
                nurseName={(id) => `간호사 ${id}`}
                current
                disabled={false}
                onApply={vi.fn()}
            />,
        );

        const list = screen.getByRole('list');

        expect(within(list).getAllByRole('listitem')).toHaveLength(3);

        for (const shift of ['D', 'E', 'N']) expect(within(list).getByText(`10월 3일 ${shift}: 0명 / 필요 1명`)).toBeVisible();

        expect(list).not.toHaveTextContent(/합성 간호사|간호사 1|필요한 근무에 배정된 인원이 없습니다/);
        expect(JSON.stringify(result)).toBe(before);
    });
    it('keeps applied result diagnostics in the table instead of duplicating them in result details', () => {
        const result = response();

        result.authoringOutcome!.violationDelta.new = source();
        render(<AiConversationResultDetails result={result} />);
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });
    it('keeps other warnings in their original message and nurse/date form', () => {
        const other = {
            ...source()[0]!,
            templateCode: 'SYNTHETIC_OTHER',
            messageKey: undefined,
            message: '야간 뒤 휴무가 부족해요.',
            affectedCells: [source()[0]!.affectedCells[0]!],
        };

        render(<AiScheduleWarningList violations={[other]} nurseName={() => '첫 간호사'} />);
        expect(screen.getByRole('listitem')).toHaveTextContent('야간 뒤 휴무가 부족해요. · 첫 간호사 2026-10-03 O');
    });
    it('preserves separate visible rows for different dates, shifts, counts, and target groups', () => {
        const configured = source()[0]!;
        const others = ['date', 'shift', 'required', 'group'].map((kind) => {
            const row = source()[3]!;

            if (kind === 'date') {
                row.period = {dates: ['2026-10-04']};
                row.comparisonKey![3] = ['2026-10-04', '2026-10-04'];
            }

            if (kind === 'shift') {
                row.messageArgs!.shift = 'N12';
                row.comparisonKey![4] = [30];
            }

            if (kind === 'required') row.messageArgs!.expected = 2;

            if (kind === 'group') row.comparisonKey![2] = {group: {target: {nurseIds: [1]}, division: null}};

            return row;
        });

        render(<AiScheduleWarningList violations={[configured, ...others]} />);
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
        expect(screen.getByText('10월 4일 D: 0명 / 필요 1명')).toBeVisible();
        expect(screen.getByText('10월 3일 N12: 0명 / 필요 1명')).toBeVisible();
        expect(screen.getByText('10월 3일 D: 0명 / 필요 2명')).toBeVisible();
        expect(screen.getAllByText('10월 3일 D: 0명 / 필요 1명')).toHaveLength(2);
    });
    it('localizes the compact counts and keeps custom shift codes intact in Japanese', async () => {
        await i18n.changeLanguage('ja');

        try {
            const warning = source()[0]!;

            warning.messageArgs!.shift = '夜12';
            render(<AiScheduleWarningList violations={[warning]} />);
            expect(screen.getByText('10月3日 夜12：0人／必要1人')).toBeVisible();
        } finally {
            await i18n.changeLanguage('ko');
        }
    });
});
