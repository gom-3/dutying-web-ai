import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createShiftEditorPersistence} from './persistence';
import {type TDutyDoc, type THistoryState} from './types';

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

    it('clear 호출 시 대기 중인 save 타이머도 함께 정리해야 한다', () => {
        const persistence = createShiftEditorPersistence({
            storageKey: 'shift-editor:draft:test',
            saveDebounceMs: 400,
        });

        persistence.save(mockDoc, mockHistory);
        persistence.clear();

        vi.advanceTimersByTime(400);

        expect(window.localStorage.getItem('shift-editor:draft:test')).toBeNull();
    });
});
