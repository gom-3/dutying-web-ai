import {afterAll, describe, expect, it} from 'vitest';
import i18n from '@/i18n';

function leaves(value: unknown, prefix = ''): Record<string, string> {
    if (typeof value === 'string') return {[prefix]: value};

    if (typeof value !== 'object' || value === null) return {};

    return Object.fromEntries(
        Object.entries(value).flatMap(([key, nested]) => Object.entries(leaves(nested, prefix ? `${prefix}.${key}` : key))),
    );
}

const placeholders = (text: string) => [...text.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort();

describe('Japanese AI autofill translations', () => {
    afterAll(async () => {
        await i18n.changeLanguage('ko');
    });

    it.each(['aiAdjust', 'aiAutofillPage', 'aiAutofillUi', 'aiConversationSidebar'])(
        'provides every %s message directly in Japanese with the required interpolation values',
        (section) => {
            const korean = leaves(i18n.getResource('ko', 'translation', section));
            const english = leaves(i18n.getResource('en', 'translation', section));
            const japanese = leaves(i18n.getResource('ja', 'translation', section));

            expect(Object.keys(japanese).sort()).toEqual(Object.keys(korean).sort());
            expect(Object.keys(japanese).length).toBeGreaterThan(0);

            for (const [key, text] of Object.entries(japanese)) {
                expect(text.trim(), `${section}.${key}`).not.toBe('');
                expect(text, `${section}.${key}`).not.toMatch(/[가-힣]/);

                // Korean particles are supplied separately; Japanese follows the English grammar here.
                const reference = section === 'aiAdjust' && key === 'review.countSuggestion' ? english[key] : korean[key];

                expect(placeholders(text), `${section}.${key}`).toEqual(placeholders(reference));
            }
        },
    );

    it('resolves regional Japanese and renders dynamic schedule details without falling back to English', async () => {
        await i18n.changeLanguage('ja-JP');

        expect(i18n.t('aiAdjust.title')).toMatch(/自動入力/);
        expect(i18n.t('aiAdjust.snapshot.monthTitle', {year: 2026, month: 10})).toMatch(/2026年.*10月/);
        expect(i18n.t('aiConversationSidebar.exampleAssignShift', {name: '田中', day: 12, shift: 'N'})).toBe(
            '12日は田中さんにN勤務を割り当ててください',
        );
        expect(i18n.t('aiAutofillPage.batchConfirm', {count: 24})).toContain('24マス');
        expect(i18n.t('aiAdjust.issue.clarify')).not.toMatch(/[가-힣]|{{/);
    });

    it('uses natural Japanese word order for combined count conditions and roster targets', async () => {
        await i18n.changeLanguage('ja');

        const limit = i18n.t('aiAdjust.review.countLimit.MAX', {count: 3});
        const frequency = i18n.t('aiAdjust.review.frequency.WEEK', {limit});

        expect(i18n.t('aiAdjust.review.countRule', {shift: 'N', aggregation: i18n.t('aiAdjust.review.perNurse'), frequency})).toBe(
            'N勤務：1人につき週3回以下',
        );
        expect(i18n.t('aiAutofillUi.interpretCard.allNurses', {count: 4})).toBe('現在の勤務表の看護師全員（4名）');
        expect(i18n.t('aiAutofillUi.interpretCard.duplicateNurse', {name: '田中', row: 2})).toBe('田中（名簿の2行目）');
        expect(i18n.t('aiAdjust.executionFailure.restTargetExcess', {name: '田中', fixed: 12, target: 10})).toBe(
            '田中：指定済みの休み12日 / 月の休み日数の上限10日',
        );
    });

    it.each(['zh', 'th', 'vi'])('keeps the existing English fallback for %s', async (language) => {
        await i18n.changeLanguage(language);

        expect(i18n.t('aiConversationSidebar.loadingConversation')).toBe('Loading your conversation');
        expect(i18n.t('aiAutofillPage.batchReview')).toBe('Load result for review · no extra use');
    });
});
