import {describe, expect, it} from 'vitest';
import {hasPrecepteeMemo, setPrecepteeMemo} from '../nurse-role';

describe('nurse preceptee memo marker', () => {
    it('detects an exact preceptee marker line', () => {
        expect(hasPrecepteeMemo('프리셉티')).toBe(true);
        expect(hasPrecepteeMemo('프리셉티\n나이트 전담')).toBe(true);
        expect(hasPrecepteeMemo('프리셉티 교육 예정')).toBe(false);
    });

    it('adds and removes the marker without dropping other memo text', () => {
        const withMarker = setPrecepteeMemo('나이트 전담', true);

        expect(withMarker).toBe('프리셉티\n나이트 전담');
        expect(setPrecepteeMemo(withMarker, false)).toBe('나이트 전담');
    });
});
