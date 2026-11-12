import {type QueryClient, type QueryKey} from '@tanstack/react-query';

type TRead = {data: unknown; version: number};

const reads = new WeakMap<QueryClient, Map<string, TRead>>();

export const scheduleWorkspaceKey = (wardId: number, teamId: number, year: number, month: number) => [
    'ward',
    wardId,
    'shift-team',
    teamId,
    'schedule-workspace',
    year,
    month,
];

/** One-time handoff for the immediate URL-directed editor entry, never a TTL cache. */
export function handoffBootstrapRead<T>(client: QueryClient, key: QueryKey, data: T): () => void {
    client.setQueryData(key, data);

    const entry = {data: client.getQueryData(key), version: client.getQueryState(key)?.dataUpdateCount ?? 0};

    let pending = reads.get(client);

    if (!pending) {
        pending = new Map();
        reads.set(client, pending);
    }

    const id = JSON.stringify(key);

    pending.set(id, entry);

    return () => {
        if (pending.get(id) === entry) pending.delete(id);
    };
}

export function takeBootstrapRead<T>(client: QueryClient, key: QueryKey): {data: T} | undefined {
    const pending = reads.get(client);
    const id = JSON.stringify(key);
    const entry = pending?.get(id);

    pending?.delete(id);

    const state = client.getQueryState(key);

    if (!entry || !state || state.isInvalidated || state.dataUpdateCount !== entry.version || state.data !== entry.data) return undefined;

    return {data: entry.data as T};
}
