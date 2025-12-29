import {describe, expect, it} from 'vitest';
import type {GridDoc} from '../grid';
import type {Selection} from '../selection';
import {copy} from './copy';
import {paste} from './paste';
import type {ClipboardPayload} from './types';

class TestGridDoc implements GridDoc {
    constructor(
        public readonly rowCount: number,
        public readonly colCount: number,
        private readonly data: Array<Array<string | null>>,
    ) {}

    getCell(row: number, col: number) {
        return this.data[row]?.[col] ?? null;
    }
}

describe('editor-core/clipboard', () => {
    it('copy는 selection을 직사각형 payload로 만든다(정규화 포함)', () => {
        const doc = new TestGridDoc(3, 3, [
            ['a', 'b', 'c'],
            ['d', 'e', 'f'],
            ['g', 'h', 'i'],
        ]);
        const sel: Selection = {type: 'range', from: {row: 1, col: 2}, to: {row: 0, col: 1}}; // 뒤집힌 범위
        const payload = copy(sel, doc);

        expect(payload).toEqual({
            width: 2,
            height: 2,
            cells: [
                ['b', 'c'],
                ['e', 'f'],
            ],
        });
    });

    it('paste는 selection 좌상단 기준으로 붙여넣고, doc bounds 초과는 자동으로 잘라낸다', () => {
        const doc = new TestGridDoc(2, 2, [
            ['x', 'y'],
            ['z', null],
        ]);
        const payload: ClipboardPayload = {
            width: 3,
            height: 2,
            cells: [
                ['A', 'B', 'C'],
                ['D', 'E', 'F'],
            ],
        };
        const sel: Selection = {type: 'single', anchor: {row: 0, col: 0}};
        const op = paste(payload, sel, doc);

        // 2x2에 맞게 잘려야 함 + prev 값은 doc 기준
        expect(op.kind).toBe('setCells');
        expect(op.cells).toEqual([
            {row: 0, col: 0, prev: 'x', next: 'A'},
            {row: 0, col: 1, prev: 'y', next: 'B'},
            {row: 1, col: 0, prev: 'z', next: 'D'},
            {row: 1, col: 1, prev: null, next: 'E'},
        ]);
    });

    it('paste는 값이 동일하면 cells 엔트리를 만들지 않는다', () => {
        const doc = new TestGridDoc(1, 2, [['A', null]]);
        const payload: ClipboardPayload = {width: 2, height: 1, cells: [['A', null]]};
        const sel: Selection = {type: 'single', anchor: {row: 0, col: 0}};
        const op = paste(payload, sel, doc);

        expect(op).toEqual({kind: 'setCells', cells: []});
    });
});
