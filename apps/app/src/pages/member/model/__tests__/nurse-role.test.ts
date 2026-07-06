import {describe, expect, it} from 'vitest';
import {
    getMemoWithoutPrecepteeMarker,
    getMemoWithoutRoleMarkers,
    hasNursePreceptorRole,
    hasPrecepteeMemo,
    hasPreceptorMemo,
    setPrecepteeMemo,
} from '../nurse-role';

describe('nurse preceptee memo marker', () => {
    it('detects an exact preceptee marker line', () => {
        expect(hasPrecepteeMemo('__PRECEPTEE__')).toBe(true);
        expect(hasPrecepteeMemo('__PRECEPTEE__\nnote')).toBe(true);
        expect(hasPrecepteeMemo('프리셉티')).toBe(true);
        expect(hasPrecepteeMemo('__PRECEPTEE__ note')).toBe(false);
    });

    it('adds and removes the marker without dropping other memo text', () => {
        const withMarker = setPrecepteeMemo('note', true);

        expect(withMarker).toBe('__PRECEPTEE__\nnote');
        expect(setPrecepteeMemo(withMarker, false)).toBe('note');
    });

    it('removes preceptee role markers from memo text', () => {
        expect(getMemoWithoutPrecepteeMarker('__PRECEPTEE__\nnote')).toBe('note');
        expect(getMemoWithoutPrecepteeMarker('프리셉티\nnote')).toBe('note');
    });

    it('keeps preceptor markers out of memo text while still reading the role', () => {
        expect(hasPreceptorMemo('프리셉터')).toBe(true);
        expect(hasNursePreceptorRole({memo: '프리셉터\n확인 필요'})).toBe(true);
        expect(getMemoWithoutRoleMarkers('프리셉터\n확인 필요')).toBe('확인 필요');
    });
});
