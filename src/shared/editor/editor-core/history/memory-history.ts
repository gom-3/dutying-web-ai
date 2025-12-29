import {EditorHistory} from './history';
import type {HistoryEntry} from './types';

type PersistedHistory<Op, Sel> = {
    undoStack: HistoryEntry<Op, Sel>[];
    redoStack: HistoryEntry<Op, Sel>[];
    depth: number;
};

/**
 * 기본 메모리 기반 history 구현.
 * - transaction 단위 undo/redo
 * - depth 초과 시 FIFO(trim)
 * - redo 스택 유지
 */
export class MemoryEditorHistory<Op, Sel> extends EditorHistory<Op, Sel> {
    private undoStack: HistoryEntry<Op, Sel>[] = [];
    private redoStack: HistoryEntry<Op, Sel>[] = [];

    constructor(private readonly depth: number) {
        super();
    }

    push(entry: HistoryEntry<Op, Sel>): void {
        this.undoStack.push(entry);
        this.redoStack = [];

        if (this.undoStack.length > this.depth) {
            this.undoStack.splice(0, this.undoStack.length - this.depth);
        }
    }

    undo(): HistoryEntry<Op, Sel> | null {
        const entry = this.undoStack.pop() ?? null;

        if (!entry) return null;

        this.redoStack.push(entry);

        return entry;
    }

    redo(): HistoryEntry<Op, Sel> | null {
        const entry = this.redoStack.pop() ?? null;

        if (!entry) return null;

        this.undoStack.push(entry);

        return entry;
    }

    serialize(): string {
        const payload: PersistedHistory<Op, Sel> = {
            undoStack: this.undoStack,
            redoStack: this.redoStack,
            depth: this.depth,
        };

        return JSON.stringify(payload);
    }

    hydrate(raw: string): void {
        const parsed = JSON.parse(raw) as PersistedHistory<Op, Sel>;

        // depth는 생성자 기준을 신뢰한다(외부 입력 무시)
        this.undoStack = Array.isArray(parsed.undoStack) ? parsed.undoStack : [];
        this.redoStack = Array.isArray(parsed.redoStack) ? parsed.redoStack : [];

        if (this.undoStack.length > this.depth) {
            this.undoStack.splice(0, this.undoStack.length - this.depth);
        }

        if (this.redoStack.length > this.depth) {
            this.redoStack.splice(0, this.redoStack.length - this.depth);
        }
    }
}
