import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createShiftEditorPersistence} from '../persistence';
import {type TDutyDoc, type THistoryState} from '../types';

const storageKey = 'shift-editor:draft:test';
const mockDoc: TDutyDoc = {
    columns: ['2026-03-01'],
    rows: [{workerId: '1', cells: [null]}],
    workerMeta: {1: {name: '간호사 1'}},
};
const mockHistory: THistoryState = {
    past: [],
    future: [],
    maxDepth: 50,
};

describe('createShiftEditorPersistence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        window.localStorage.clear();
    });

    it('save 호출 후 debounce 시간이 지나면 localStorage에 저장해야 한다', () => {
        const persistence = createShiftEditorPersistence({
            storageKey,
            saveDebounceMs: 400,
        });

        persistence.save(mockDoc, mockHistory);
        vi.advanceTimersByTime(400);

        const raw = window.localStorage.getItem(storageKey);

        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!)).toEqual({
            doc: mockDoc,
            history: JSON.stringify(mockHistory),
            savedAt: expect.any(Number),
        });
    });

    it('load는 저장된 persisted 데이터를 반환해야 한다', () => {
        const persistence = createShiftEditorPersistence({
            storageKey,
            saveDebounceMs: 400,
        });

        persistence.save(mockDoc, mockHistory);
        vi.advanceTimersByTime(400);

        expect(persistence.load()).toEqual({
            doc: mockDoc,
            history: JSON.stringify(mockHistory),
            savedAt: expect.any(Number),
        });
    });

    it('clear 호출 시 대기 중인 save 타이머도 함께 정리해야 한다', () => {
        const persistence = createShiftEditorPersistence({
            storageKey,
            saveDebounceMs: 400,
        });

        persistence.save(mockDoc, mockHistory);
        persistence.clear();

        vi.advanceTimersByTime(400);

        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });

    it('dispose 호출 시 대기 중인 save 타이머를 취소해야 한다', () => {
        const persistence = createShiftEditorPersistence({
            storageKey,
            saveDebounceMs: 400,
        });

        persistence.save(mockDoc, mockHistory);
        persistence.dispose();

        vi.advanceTimersByTime(400);

        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });

    it('대기 중인 타이머가 없어도 clear는 안전하게 동작해야 한다', () => {
        const persistence = createShiftEditorPersistence({
            storageKey,
            saveDebounceMs: 400,
        });

        window.localStorage.setItem(storageKey, 'stale');

        expect(() => persistence.clear()).not.toThrow();
        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });
});
