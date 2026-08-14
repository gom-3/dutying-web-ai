import {describe, expect, it} from 'vitest';
import {formatNurseDisplayName} from '../format-nurse-display-name';

describe('formatNurseDisplayName', () => {
    it('4자 이하면 그대로 반환한다', () => {
        expect(formatNurseDisplayName('김민')).toBe('김민');
        expect(formatNurseDisplayName('홍길동')).toBe('홍길동');
    });

    it('4자 초과면 4자 + 말줄임을 반환한다', () => {
        expect(formatNurseDisplayName('박서연지희')).toBe('박서연지…');
        expect(formatNurseDisplayName('  김철수영희  ')).toBe('김철수영…');
    });

    it('화면별 글자 수를 적용하거나 실제 열 너비에 맡길 수 있다', () => {
        expect(formatNurseDisplayName('박서연지희수', 5)).toBe('박서연지희…');
        expect(formatNurseDisplayName('  박서연지희  ', null)).toBe('박서연지희');
    });
});
