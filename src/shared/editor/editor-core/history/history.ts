import type {HistoryEntry} from './types';

export abstract class EditorHistory<Op, Sel> {
    abstract push(entry: HistoryEntry<Op, Sel>): void;
    abstract undo(): HistoryEntry<Op, Sel> | null;
    abstract redo(): HistoryEntry<Op, Sel> | null;

    abstract serialize(): string;
    abstract hydrate(raw: string): void;

    dispose(): void {
        // 기본 no-op
    }
}
