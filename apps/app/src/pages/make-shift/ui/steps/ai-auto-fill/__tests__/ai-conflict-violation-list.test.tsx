import type {TScheduleViolationDto} from '@dutying/api/ward';
import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {AiConflictViolationList} from '../ai-conflict-violation-list';
import incident from './incident-889-conflict-review.json';

// Anonymous reconstruction of the incident shape, not a production payload.
const staffing = (date: string, shift: string, actual = 3, operator = 'EXACT'): TScheduleViolationDto => ({
    violationId: `${date}:${shift}`,
    ruleId: shift === 'D' ? 1 : 2,
    templateCode: 'STAFF_COUNT_BY_SHIFT',
    severity: 'HARD',
    message: 'Repeated staffing message',
    messageArgs: {shift, actual, expected: 4, operator},
    period: {dates: [date]},
    affectedCells: [],
    fixable: true,
});
const consecutive: TScheduleViolationDto = {
    violationId: 'work-run',
    ruleId: 3,
    templateCode: 'CORE_MAX_CONTINUOUS_WORK',
    severity: 'HARD',
    message: '가상간호사님은 근무가 7일 연속이에요. 최대 5일까지 가능해요.',
    messageArgs: {nurseName: '가상간호사', actual: 7, expected: 5},
    period: {dates: ['2026-11-01']},
    affectedCells: [],
    fixable: true,
};
const renderList = (violations: TScheduleViolationDto[], ruleLabels = {'1': 'D 인원 조건', '2': 'E 인원 조건', '3': '연속근무 조건'}) =>
    render(<AiConflictViolationList review={{token: 'synthetic', expiresAt: '2099-01-01T00:00:00Z', violations, ruleLabels}} />);

describe('legacy conflict evidence display', () => {
    it('preserves all eight actual dates and the ninth consecutive-work issue with one heading per rule', () => {
        renderList([
            staffing('2026-11-01', 'D', 2),
            staffing('2026-11-03', 'D'),
            staffing('2026-11-27', 'D'),
            ...['01', '05', '07', '15', '17'].map((day) => staffing(`2026-11-${day}`, 'E')),
            consecutive,
        ]);
        expect(screen.getAllByText('D 인원 조건')).toHaveLength(1);
        expect(screen.getAllByText('E 인원 조건')).toHaveLength(1);

        const tables = screen.getAllByRole('table');

        expect(tables).toHaveLength(2);
        expect(within(tables[0]!).getAllByRole('row')).toHaveLength(4);
        expect(within(tables[1]!).getAllByRole('row')).toHaveLength(6);
        expect(within(tables[0]!).getByText('2명')).toBeVisible();
        expect(within(tables[1]!).getAllByText('3명')).toHaveLength(5);
        expect(screen.getAllByText('정확히 4명')).toHaveLength(8);

        for (const date of ['03', '05', '07', '15', '17', '27']) expect(screen.getByText(`2026-11-${date}`)).toBeVisible();

        expect(screen.getByText('가상간호사 · 제안 7일 연속 / 허용 최대 5일')).toBeVisible();
        expect(screen.getByText('보고된 날짜 · 2026-11-01')).toBeVisible();
    });
    it.each(['MIN', 'MAX', 'EXACT'])('supports STAFF_COUNT_BY_SHIFT %s without shortening custom shift codes', (operator) => {
        renderList([staffing('2026-11-01', 'LONG_DAY', 3, operator)]);
        expect(screen.getByText('LONG_DAY')).toBeVisible();
        expect(screen.getByText(`${operator === 'MIN' ? '최소' : operator === 'MAX' ? '최대' : '정확히'} 4명`)).toBeVisible();
    });
    it('uses full context rather than excess cells and never fills gaps in reported dates', () => {
        renderList([{...consecutive, displayContext: {period: {dates: ['2026-10-26', '2026-10-28', '2026-11-01']}, affectedCells: []}}]);
        expect(screen.getByText('보고된 날짜 · 2026-10-26, 2026-10-28, 2026-11-01')).toBeVisible();
    });
    it('compacts only contiguous full-context dates', () => {
        renderList([{...consecutive, displayContext: {period: {dates: ['2026-10-30', '2026-10-31', '2026-11-01']}, affectedCells: []}}]);
        expect(screen.getByText('보고된 날짜 · 2026-10-30 – 2026-11-01')).toBeVisible();
    });
    it('keeps unknown evidence explicit and preserves the fallback message', () => {
        renderList([{...staffing('2026-11-01', 'D'), period: undefined, messageArgs: {actual: 3, expected: 4}}]);
        expect(screen.getByText('날짜 정보 없음')).toBeVisible();
        expect(screen.getByText('Repeated staffing message')).toBeVisible();
    });
    it('keeps same-text rows from separate rules and every hidden dated row', () => {
        const issues = Array.from({length: 7}, (_, index) => staffing(`2026-11-0${index + 1}`, 'D'));

        renderList([...issues, {...issues[0]!, ruleId: 2}]);
        expect(screen.getAllByRole('table', {hidden: true})).toHaveLength(3);
        expect(screen.getAllByText('2026-11-01')).toHaveLength(2);
        expect(screen.getByText('나머지 2건 보기')).toBeVisible();
        expect(screen.getByText('2026-11-07')).toBeInTheDocument();
    });
});

it('replays the anonymized production response without dropping dates or claiming 6-to-7 worsening', () => {
    render(
        <AiConflictViolationList
            review={{
                ...incident.review,
                token: 'display-only',
                expiresAt: '2099-01-01T00:00:00Z',
                violations: incident.review.violations as unknown as TScheduleViolationDto[],
            }}
        />,
    );
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getAllByText('정확히 4명')).toHaveLength(8);
    expect(screen.getByText('간호사 9 · 제안 7일 연속 / 허용 최대 5일')).toBeVisible();
    expect(screen.getByText('보고된 날짜 · 2026-11-01')).toBeVisible();
    expect(screen.queryByText(/6.*→.*7/)).not.toBeInTheDocument();
    expect(screen.queryByText('간호사 1')).not.toBeInTheDocument();
});
