import type {TScheduleMonthRequestItem} from '@dutying/api/ward';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AiAdjustInterpretCard} from '../ai-adjust-interpret-card';

vi.mock('@/i18n', () => ({default: {language: 'ko'}}));
vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {createInstance} = await import('i18next');
    const {aiAdjustKo} = await import('@/shared/locales/ai-adjust');
    const translator = createInstance();

    await translator.init({lng: 'ko', resources: {ko: {translation: {aiAdjust: aiAdjustKo}}}, interpolation: {escapeValue: false}});

    return {useTypedTranslation: () => ({t: translator.t.bind(translator)})};
});

const nurses = [
    {nurseId: 1, name: '신규 간호사 1'},
    {nurseId: 2, name: '신규 간호사 2'},
];
const item: TScheduleMonthRequestItem = {
    kind: 'RULE',
    templateCode: 'SHIFT_COUNT_PER_PERIOD',
    displayLabel: '신규 간호사 1 데이 근무 많이 배정 (기본값 10회 이상)',
    params: {target: [1], shift: 'D', period: 'MONTH', operator: 'MIN', aggregation: 'EACH', count: 10},
    requiresConfirmation: true,
    confirmationReasons: ['ASSUMED_VALUE'],
    assumedSlots: ['count'],
};

function show(rule: TScheduleMonthRequestItem) {
    return render(
        <AiAdjustInterpretCard
            nurses={nurses}
            card={{requestText: '데이 많이', items: [{item: rule, lifetime: 'MONTH', severity: 'SOFT'}], unmapped: [], strength: 'NORMAL'}}
        />,
    );
}

describe('readable interpretation', () => {
    it('explains the actual rule and its inferred count once without technical details', () => {
        show(item);
        expect(screen.getByRole('heading', {name: '이렇게 반영할까요?'})).toBeVisible();
        expect(screen.getByText('신규 간호사 1')).toBeVisible();
        expect(screen.getByText('D 근무를 월 10회 이상 배정')).toBeVisible();
        expect(screen.getByText('횟수를 따로 말씀하지 않아 월 10회 이상으로 제안했어요.')).toBeVisible();
        expect(screen.queryByText(/기본값|가정한 값|말씀하지 않은 값을 가정/)).not.toBeInTheDocument();
        expect(screen.queryByText('적용 내용 보기')).not.toBeInTheDocument();
        expect(screen.queryByText(/MONTH|MIN|EACH|period|aggregation|operator/)).not.toBeInTheDocument();
        expect(item.params).toEqual({target: [1], shift: 'D', period: 'MONTH', operator: 'MIN', aggregation: 'EACH', count: 10});
    });

    it.each([
        ['MONTH', 'MAX', 'EACH', [1, 2], 'D 근무를 1인당 월 10회 이하 배정'],
        ['WEEK', 'EXACT', 'GROUP_TOTAL', [1, 2], 'D 근무를 모두 합쳐 주 10회 배정'],
        ['DAY', 'MIN', 'EACH', 'ALL', 'D 근무를 1인당 하루 10회 이상 배정'],
        ['ROLLING_7_DAYS', 'MAX', 'PER_NURSE', [1], 'D 근무를 연속 7일 기준 10회 이하 배정'],
    ])('preserves the meaning of %s / %s / %s', (period, operator, aggregation, target, expected) => {
        show({
            ...item,
            assumedSlots: [],
            requiresConfirmation: false,
            confirmationReasons: [],
            params: {...item.params, period, operator, aggregation, target},
        });
        expect(screen.getByText(expected as string)).toBeVisible();
        expect(screen.queryByText(/횟수를 따로 말씀하지 않아/)).not.toBeInTheDocument();
    });

    it('keeps additional conditions accessible with readable parameter names and values', () => {
        show({...item, condition: {key: 'PATIENT_COUNT', operator: 'GTE', value: 20}});
        fireEvent.click(screen.getByText('적용 내용 보기'));
        expect(screen.getByText('환자 수', {exact: false})).toHaveTextContent('환자 수 · 20 이상');
        expect(screen.getByText('횟수 기준')).toBeVisible();
        expect(screen.getByText('한 달')).toBeVisible();
        expect(screen.getByText('최소')).toBeVisible();
        expect(screen.getByText('1인당')).toBeVisible();
        expect(screen.queryByText(/MONTH|MIN|EACH|PATIENT_COUNT|period|aggregation|operator/)).not.toBeInTheDocument();
    });
});
