import {describe, expect, it} from 'vitest';
import {clampPos} from './model';
import type {Selection} from './types';
import {moveSelection, normalizeRange} from './utils';

describe('editor-core/selection', () => {
    it('normalizeRange(single)은 from/to가 동일하다', () => {
        const sel: Selection = {type: 'single', anchor: {row: 2, col: 3}};

        expect(normalizeRange(sel)).toEqual({from: {row: 2, col: 3}, to: {row: 2, col: 3}});
    });

    it('normalizeRange(range)은 row/col min/max로 정규화한다', () => {
        const sel: Selection = {type: 'range', from: {row: 5, col: 1}, to: {row: 2, col: 4}};

        expect(normalizeRange(sel)).toEqual({from: {row: 2, col: 1}, to: {row: 5, col: 4}});
    });

    it('clampPos는 bounds 안으로 좌표를 보정한다', () => {
        expect(clampPos({row: -1, col: 10}, {rowCount: 3, colCount: 4})).toEqual({row: 0, col: 3});
        expect(clampPos({row: 2, col: 2}, {rowCount: 3, colCount: 4})).toEqual({row: 2, col: 2});
    });

    it('moveSelection: ctrl/cmd(jumpToEdge)로 행/열 끝으로 이동한다', () => {
        const bounds = {rowCount: 3, colCount: 5};
        const sel: Selection = {type: 'single', anchor: {row: 1, col: 2}};

        expect(moveSelection(sel, 'right', bounds, false, true)).toEqual({type: 'single', anchor: {row: 1, col: 4}});
        expect(moveSelection(sel, 'left', bounds, false, true)).toEqual({type: 'single', anchor: {row: 1, col: 0}});
        expect(moveSelection(sel, 'down', bounds, false, true)).toEqual({type: 'single', anchor: {row: 2, col: 2}});
        expect(moveSelection(sel, 'up', bounds, false, true)).toEqual({type: 'single', anchor: {row: 0, col: 2}});
    });
});
