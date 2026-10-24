import {describe, expect, it} from 'vitest';
import {failureMessagePoints} from '../failure-message-points';

describe('failure message points', () => {
    it('splits Korean sentences and preserves supplied bullets', () => {
        expect(failureMessagePoints('완료하지 못했어요. 기존 표는 그대로예요.\n• 설정을 확인해 주세요.'))
            .toEqual(['완료하지 못했어요.', '기존 표는 그대로예요.', '설정을 확인해 주세요.']);
    });
    it('splits Japanese without requiring whitespace', () => {
        expect(failureMessagePoints('完了できませんでした。元の勤務表は変更されていません。')).toHaveLength(2);
    });
    it('preserves decimals and ignores blank lines', () => {
        expect(failureMessagePoints('\n1.5일이 필요합니다.\n\n')).toEqual(['1.5일이 필요합니다.']);
    });
});
