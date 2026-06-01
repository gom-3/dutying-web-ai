import {describe, expect, it} from 'vitest';
import {hasPrecepteeMemo, setPrecepteeMemo} from '../nurse-role';

describe('nurse preceptee memo marker', () => {
    it('detects an exact preceptee marker line', () => {
        expect(hasPrecepteeMemo('__PRECEPTEE__')).toBe(true);
        expect(hasPrecepteeMemo('__PRECEPTEE__\nnote')).toBe(true);
        expect(hasPrecepteeMemo('__PRECEPTEE__ note')).toBe(false);
    });

    it('adds and removes the marker without dropping other memo text', () => {
        const withMarker = setPrecepteeMemo('note', true);

        expect(withMarker).toBe('__PRECEPTEE__\nnote');
        expect(setPrecepteeMemo(withMarker, false)).toBe('note');
    });
});
