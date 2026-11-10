import {afterAll, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {localizeConversationServerCopy} from '@/pages/make-shift/model/conversation-presentation';

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

    it.each([
        ['zh', '正在加载对话'],
        ['zh-TW', '正在載入對話'],
        ['th', 'กำลังโหลดการสนทนา'],
        ['vi', 'Đang tải cuộc trò chuyện'],
    ])('renders the chat directly in %s', async (language, loading) => {
        await i18n.changeLanguage(language);

        expect(i18n.t('aiConversationSidebar.loadingConversation')).toBe(loading);
        for (const section of ['aiAdjust', 'aiAutofillPage', 'aiAutofillUi', 'aiConversationSidebar']) {
            const english = leaves(i18n.getResource('en', 'translation', section));
            const translated = leaves(i18n.getResource(language, 'translation', section));

            expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
            for (const [key, text] of Object.entries(translated)) {
                expect(text, `${section}.${key}`).not.toMatch(/[가-힣]|<unk>/);
                expect(placeholders(text), `${section}.${key}`).toEqual(placeholders(english[key]));
            }
        }
    });
});

describe('saved AI clarification messages', () => {
    it.each(['en', 'ja', 'zh', 'zh-TW', 'th', 'vi'])('renders a known server clarification in %s', (language) => {
        const t = i18n.getFixedT(language);
        const legacyMessage = '어느 간호사에게 적용할지 이름을 다시 확인해 주세요.';
        const localized = localizeConversationServerCopy(legacyMessage, t);

        expect(localized).toBe(i18n.getResource(language, 'translation', 'aiChatServerCopy.checkPeople'));
        expect(localized).not.toMatch(/[가-힣]/);
        expect(localizeConversationServerCopy('대상 간호사를 확인하지 못했어요. 표에 있는 이름을 알려 주세요.', t)).toBe(localized);
        expect(localizeConversationServerCopy('대상 간호사를 이 근무팀에서 찾지 못했어요.', t)).toBe(localized);
        expect(localizeConversationServerCopy('未設定的訊息', t)).toBe('未設定的訊息');

        const spellingQuestion =
            '말씀하신 간호사가 김서연 / 김서현 선생님인가요? 이름을 확인해 주시면 앞서 요청한 내용을 이어서 확인할게요.';

        expect(localizeConversationServerCopy(spellingQuestion, t)).toBe(t('aiChatServerCopy.confirmSpelling', {names: '김서연 / 김서현'}));
    });
});
