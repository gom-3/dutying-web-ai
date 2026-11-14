import {describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {failureMessagePoints, localizeStoredFailureMessage} from '../failure-message-points';

describe('failure message points', () => {
    it('splits Korean sentences and preserves supplied bullets', () => {
        expect(failureMessagePoints('완료하지 못했어요. 기존 표는 그대로예요.\n• 설정을 확인해 주세요.')).toEqual([
            '완료하지 못했어요.',
            '기존 표는 그대로예요.',
            '설정을 확인해 주세요.',
        ]);
    });
    it('splits Japanese without requiring whitespace', () => {
        expect(failureMessagePoints('完了できませんでした。元の勤務表は変更されていません。')).toHaveLength(2);
    });
    it('preserves decimals and ignores blank lines', () => {
        expect(failureMessagePoints('\n1.5일이 필요합니다.\n\n')).toEqual(['1.5일이 필요합니다.']);
    });
});

it('updates a Korean saved failure to Japanese and preserves unrecognized text', async () => {
    const saved = i18n.getFixedT('ko')('aiAdjust.failed');
    await i18n.changeLanguage('ja');
    try {
        expect(localizeStoredFailureMessage(saved)).toBe(i18n.t('aiAdjust.failed'));
        expect(localizeStoredFailureMessage(saved)).not.toMatch(/[가-힣]/);
        expect(failureMessagePoints(localizeStoredFailureMessage(saved))).toContain('もう一度お試しください。');
        expect(localizeStoredFailureMessage('사용자가 작성한 요청')).toBe('사용자가 작성한 요청');
    } finally {
        await i18n.changeLanguage('ko');
    }
});
