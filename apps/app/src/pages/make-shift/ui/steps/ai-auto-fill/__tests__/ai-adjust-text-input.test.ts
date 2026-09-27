import {describe, expect, it} from 'vitest';
import {toCardItems} from '../ai-adjust-text-input';

describe('toCardItems', () => {
    it('defaults an unspecified goal scope to the current team', () => {
        const [card] = toCardItems(
            [
                {
                    kind: 'GOAL',
                    goalType: 'MINIMIZE_SINGLE_NIGHT_RUNS',
                    maxOffDifference: 1,
                    required: false,
                },
            ],
            [101, 102],
        );

        expect(card?.item).toMatchObject({
            targetNurseIds: [101, 102],
            comparisonNurseIds: [101, 102],
        });
    });

    it('keeps an explicitly interpreted scope', () => {
        const [card] = toCardItems(
            [
                {
                    kind: 'GOAL',
                    goalType: 'MINIMIZE_SINGLE_NIGHT_RUNS',
                    maxOffDifference: 1,
                    required: false,
                    targetNurseIds: [101],
                    comparisonNurseIds: [101, 102],
                },
            ],
            [101, 102, 103],
        );

        expect(card?.item).toMatchObject({
            targetNurseIds: [101],
            comparisonNurseIds: [101, 102],
        });
    });
});
