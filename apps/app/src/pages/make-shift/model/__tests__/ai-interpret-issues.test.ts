import {describe, expect, it} from 'vitest';
import {canRetryInterpretation, hasNamedNurse, interpretIssueCode, readableIssueHint} from '../ai-interpret-issues';

const nurses = [{nurseId: 7301, name: '신규 간호사 3'}];

describe('interpretation recovery', () => {
    it.each([
        ['어떤 간호사인지 특정하지 못했어요. 이름을 넣어 주세요.', 'NURSE_NOT_RESOLVED'],
        ['그 근무를 이 병동의 근무 종류에서 찾지 못했어요.', 'SHIFT_NOT_RESOLVED'],
        ['2026년 10월 안의 날짜만 지정할 수 있어요.', 'INVALID_DATE'],
        ['숫자가 빠졌어요. 몇 번인지 알려 주세요.', 'INVALID_VALUE'],
        ['그 조건은 자동 채우기가 아직 반영하지 못해요.', 'UNSUPPORTED_REQUEST'],
        ['문장을 이해하지 못했어요. 잠시 후 다시 시도해 주세요.', 'INTERPRETATION_FAILED'],
    ])('handles older server responses: %s', (hint, expected) => {
        expect(interpretIssueCode({text: '요청', hint})).toBe(expected);
    });

    it('uses structured reasons before legacy wording', () => {
        expect(interpretIssueCode({text: '', hint: '간호사를 찾지 못했어요.', reasonCode: 'INTERPRETATION_FAILED'})).toBe(
            'INTERPRETATION_FAILED',
        );
    });

    it('does not ask again for a name already written and distinguishes 3 from 30', () => {
        expect(hasNamedNurse('신규간호사3 나이트', nurses)).toBe(true);
        expect(hasNamedNurse('김서현 나이트', [{nurseId: 1, name: '김서'}])).toBe(false);
        expect(hasNamedNurse('Kimberly night shifts', [{nurseId: 1, name: 'Kim'}])).toBe(false);
        expect(hasNamedNurse('김서현 15일 나이트', [{nurseId: 1, name: '김서현'}])).toBe(true);
        expect(hasNamedNurse('신규 간호사 30 나이트', nurses)).toBe(false);
        expect(hasNamedNurse('신규 간호사 30 말고 신규 간호사 3', nurses)).toBe(true);
        expect(canRetryInterpretation([{text: '', reasonCode: 'NURSE_NOT_RESOLVED'}], '신규간호사3 나이트', nurses)).toBe(true);
        expect(canRetryInterpretation([{text: '', reasonCode: 'NURSE_NOT_RESOLVED'}], '나이트', nurses)).toBe(false);
    });

    it('hides placeholder and internal contract hints while preserving useful bounds', () => {
        expect(readableIssueHint('-')).toBeUndefined();
        expect(readableIssueHint('SHIFT_COUNT_PER_PERIOD를 사용하세요')).toBeUndefined();
        expect(readableIssueHint('period는 MONTH여야 해요')).toBeUndefined();
        expect(readableIssueHint('횟수는 1~31 사이로 알려 주세요.')).toBe('횟수는 1~31 사이로 알려 주세요.');
    });
});
