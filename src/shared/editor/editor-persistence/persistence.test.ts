import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryEditorHistory} from '../editor-core/history';
import {EditorPersistence} from './persistence';

describe('editor-persistence/EditorPersistence', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.useRealTimers();
    });

    it('save/load/clear가 동작한다', () => {
        const history = new MemoryEditorHistory<string, number>(10);

        history.push({tx: {ops: ['A'], source: 'user', timestamp: 1}, inverseOps: ['a'], prevSelection: 0, nextSelection: 1});

        const p = new EditorPersistence<{x: number}, string>({storageKey: 'test-key', debounceMs: 1});

        p.save({x: 1}, history);

        const loaded = p.load();

        expect(loaded?.doc).toEqual({x: 1});
        expect(typeof loaded?.history).toBe('string');
        expect(typeof loaded?.savedAt).toBe('number');

        p.clear();
        expect(p.load()).toBeNull();
    });

    it('scheduleSave는 debounce로 마지막 호출만 저장한다', () => {
        vi.useFakeTimers();

        const history = new MemoryEditorHistory<string, number>(10);
        const p = new EditorPersistence<{x: number}, string>({storageKey: 'test-key2', debounceMs: 100});

        p.scheduleSave({x: 1}, history);
        p.scheduleSave({x: 2}, history);

        vi.advanceTimersByTime(99);
        expect(p.load()).toBeNull();

        vi.advanceTimersByTime(1);
        expect(p.load()?.doc).toEqual({x: 2});
    });
});
