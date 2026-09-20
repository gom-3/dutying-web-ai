import {describe, expect, it} from 'vitest';
import {getNextNewNurseName, getNextNewNurseNumber} from '../new-nurse-name';

describe('new nurse numbering', () => {
    it('uses the highest existing number across old and current Korean formats', () => {
        const names = ['신규간호사2', '신규 간호사 5', '신규 간호사 3'];
        expect(getNextNewNurseName(names, '신규 간호사')).toBe('신규 간호사 6');
    });

    it('ignores unrelated or malformed suffixes and starts at one', () => {
        expect(getNextNewNurseNumber(['신규 간호사 2호', '김간호사 9', '신규 간호사 0'], '신규 간호사')).toBe(1);
    });
});
