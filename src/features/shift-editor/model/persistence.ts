import type {TDutyDoc, THistoryState, TPersisted} from './types';

export type TShiftEditorPersistence = {
    storageKey: string;
    saveDebounceMs: number;
    save: (doc: TDutyDoc, history: THistoryState) => void;
    load: () => TPersisted | null;
    clear: () => void;
    dispose: () => void;
};

function serializeHistory(history: THistoryState): string {
    // MVP: JSON stringify (ops 기반이라 payload 크기는 상대적으로 작음)
    return JSON.stringify(history);
}

function deserializeHistory(raw: string): THistoryState | null {
    try {
        return JSON.parse(raw) as THistoryState;
    } catch {
        return null;
    }
}

export function createShiftEditorPersistence(opts: {storageKey: string; saveDebounceMs?: number}): TShiftEditorPersistence {
    const {storageKey, saveDebounceMs = 400} = opts;

    let timer: number | null = null;

    const saveNow = (doc: TDutyDoc, history: THistoryState) => {
        const persisted: TPersisted = {
            doc,
            history: serializeHistory(history),
            savedAt: Date.now(),
        };

        window.localStorage.setItem(storageKey, JSON.stringify(persisted));
    };

    return {
        storageKey,
        saveDebounceMs,
        save: (doc, history) => {
            if (timer) window.clearTimeout(timer);

            timer = window.setTimeout(() => {
                saveNow(doc, history);
                timer = null;
            }, saveDebounceMs);
        },
        load: () => {
            const raw = window.localStorage.getItem(storageKey);

            if (!raw) return null;

            try {
                const parsed = JSON.parse(raw) as TPersisted;

                if (!parsed || typeof parsed !== 'object') return null;

                if (typeof parsed.history !== 'string') return null;

                const hist = deserializeHistory(parsed.history);

                if (!hist) return null;

                return parsed;
            } catch {
                return null;
            }
        },
        clear: () => {
            window.localStorage.removeItem(storageKey);
        },
        dispose: () => {
            if (timer) window.clearTimeout(timer);

            timer = null;
        },
    };
}
