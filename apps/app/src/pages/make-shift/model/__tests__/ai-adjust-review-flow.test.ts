import {describe, expect, it} from 'vitest';
import {answerReviewQuestion, getReviewQuestions, isReviewComplete, parseReviewReply} from '../ai-adjust-review-flow';
import type {TAdjustCard} from '../../ui/steps/ai-auto-fill/ai-adjust-interpret-card';

const card: TAdjustCard = {
    requestText: '오프 차이 조절',
    items: [{item: {kind: 'GOAL', goalType: 'MINIMIZE_SINGLE_NIGHT_RUNS'}, lifetime: 'MONTH', severity: 'SOFT'}],
    unmapped: [],
    strength: 'NORMAL',
};
describe('conversational review answers', () => {
    it.each(['-1일', '32일', '3.1일', '1.5일', '999일'])('does not turn an invalid tolerance into another number: %s', (text) => {
        expect(parseReviewReply(getReviewQuestions(card)[0], text)).toBeNull();
    });
    it('does not infer a scope when the reply includes another instruction', () => {
        const scope = {id: '0:lifetime', kind: 'lifetime' as const, itemIndex: 0};
        expect(parseReviewReply(scope, '이번 달만 적용해줘')).toBe('MONTH');
        expect(parseReviewReply(scope, '매달 적용해주세요')).toBe('TEAM');
        expect(parseReviewReply(scope, '이번 달만 하고 연속 근무도 줄여줘')).toBeNull();
    });
    it('requires valid ordered answers and unique nurse groups before completion', () => {
        const questions = getReviewQuestions(card);
        expect(answerReviewQuestion(card, questions[0]!, 1.5)).toBeNull();
        expect(answerReviewQuestion(card, questions[2]!, [1, 1])).toBeNull();
        expect(answerReviewQuestion(card, questions[2]!, [1])).toBeNull();
        expect(isReviewComplete(card, [])).toBe(false);
        const replies = [
            {questionId: questions[0]!.id, value: 1},
            {questionId: questions[1]!.id, value: [1]},
            {questionId: questions[2]!.id, value: [1, 2]},
        ];
        expect(isReviewComplete(card, replies)).toBe(true);
        expect(isReviewComplete(card, [replies[1]!, replies[0]!, replies[2]!])).toBe(false);
    });
});
