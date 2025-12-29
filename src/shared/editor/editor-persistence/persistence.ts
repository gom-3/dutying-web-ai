import type {EditorHistory} from '../editor-core/history';

export type Persisted<Doc> = {
    doc: Doc;
    history: string;
    savedAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type EditorPersistenceOptions = {
    storageKey: string;
    debounceMs?: number;
    storage?: StorageLike;
};

/**
 * LocalStorage 기반 draft 저장/복구.
 * - 편집 발생 시 debounce 저장
 * - dispose에서 timer 정리
 */
export class EditorPersistence<Doc, Op> {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private readonly debounceMs: number;
    private readonly storage: StorageLike;

    constructor(private readonly opts: EditorPersistenceOptions) {
        this.debounceMs = opts.debounceMs ?? 250;
        this.storage = opts.storage ?? window.localStorage;
    }

    save(doc: Doc, history: EditorHistory<Op>): void {
        const persisted: Persisted<Doc> = {
            doc,
            history: history.serialize(),
            savedAt: Date.now(),
        };

        this.storage.setItem(this.opts.storageKey, JSON.stringify(persisted));
    }

    scheduleSave(doc: Doc, history: EditorHistory<Op>): void {
        if (this.timer) clearTimeout(this.timer);

        this.timer = setTimeout(() => {
            this.timer = null;
            this.save(doc, history);
        }, this.debounceMs);
    }

    load(): Persisted<Doc> | null {
        const raw = this.storage.getItem(this.opts.storageKey);

        if (!raw) return null;

        try {
            return JSON.parse(raw) as Persisted<Doc>;
        } catch {
            return null;
        }
    }

    clear(): void {
        this.storage.removeItem(this.opts.storageKey);
    }

    dispose(): void {
        if (this.timer) clearTimeout(this.timer);

        this.timer = null;
    }
}
