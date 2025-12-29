import {describe, expect, it} from 'vitest';
import {MemoryEditorHistory} from './memory-history';
import type {HistoryEntry} from './types';

describe('editor-core/history/MemoryEditorHistory', () => {
    it('push 후 undo/redo가 transaction 단위로 동작한다', () => {
        const history = new MemoryEditorHistory<string, number>(10);
        const e1: HistoryEntry<string, number> = {
            tx: {ops: ['A'], source: 'user', timestamp: 1},
            inverseOps: ['a'],
            prevSelection: 0,
            nextSelection: 1,
        };
        const e2: HistoryEntry<string, number> = {
            tx: {ops: ['B'], source: 'user', timestamp: 2},
            inverseOps: ['b'],
            prevSelection: 1,
            nextSelection: 2,
        };

        history.push(e1);
        history.push(e2);

        expect(history.undo()).toEqual(e2);
        expect(history.undo()).toEqual(e1);
        expect(history.undo()).toBeNull();

        expect(history.redo()).toEqual(e1);
        expect(history.redo()).toEqual(e2);
        expect(history.redo()).toBeNull();
    });

    it('push는 redoStack을 비운다', () => {
        const history = new MemoryEditorHistory<string, number>(10);
        const e1: HistoryEntry<string, number> = {
            tx: {ops: ['A'], source: 'user', timestamp: 1},
            inverseOps: ['a'],
            prevSelection: 0,
            nextSelection: 1,
        };
        const e2: HistoryEntry<string, number> = {
            tx: {ops: ['B'], source: 'user', timestamp: 2},
            inverseOps: ['b'],
            prevSelection: 1,
            nextSelection: 2,
        };
        const e3: HistoryEntry<string, number> = {
            tx: {ops: ['C'], source: 'user', timestamp: 3},
            inverseOps: ['c'],
            prevSelection: 2,
            nextSelection: 3,
        };

        history.push(e1);
        history.push(e2);
        expect(history.undo()).toEqual(e2);
        // 여기서 push하면 redoStack은 폐기되어야 함
        history.push(e3);
        expect(history.redo()).toBeNull();
    });

    it('depth 초과 시 FIFO로 trim 된다', () => {
        const history = new MemoryEditorHistory<number, number>(2);
        const mk = (n: number): HistoryEntry<number, number> => ({
            tx: {ops: [n], source: 'user', timestamp: n},
            inverseOps: [-n],
            prevSelection: n,
            nextSelection: n + 1,
        });

        history.push(mk(1));
        history.push(mk(2));
        history.push(mk(3)); // 1은 버려져야 함

        expect(history.undo()?.tx.ops).toEqual([3]);
        expect(history.undo()?.tx.ops).toEqual([2]);
        expect(history.undo()).toBeNull();
    });

    it('serialize/hydrate로 undo/redo 스택이 복구된다', () => {
        const h1 = new MemoryEditorHistory<string, number>(10);
        const e1: HistoryEntry<string, number> = {
            tx: {ops: ['A'], source: 'user', timestamp: 1},
            inverseOps: ['a'],
            prevSelection: 0,
            nextSelection: 1,
        };
        const e2: HistoryEntry<string, number> = {
            tx: {ops: ['B'], source: 'user', timestamp: 2},
            inverseOps: ['b'],
            prevSelection: 1,
            nextSelection: 2,
        };

        h1.push(e1);
        h1.push(e2);
        h1.undo(); // e2는 redo로 이동

        const raw = h1.serialize();
        const h2 = new MemoryEditorHistory<string, number>(10);

        h2.hydrate(raw);

        expect(h2.redo()).toEqual(e2);
        expect(h2.undo()).toEqual(e2);
        expect(h2.undo()).toEqual(e1);
    });
});
