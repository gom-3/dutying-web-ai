import {QueryClient} from '@tanstack/react-query';
import {describe, expect, it} from 'vitest';
import {handoffBootstrapRead, scheduleWorkspaceKey, takeBootstrapRead} from '../bootstrap-read-handoff';

describe('bootstrap read handoff', () => {
    const key = scheduleWorkspaceKey(1, 10, 2026, 12);

    it('is consumed once and never substitutes a later live read', () => {
        const client = new QueryClient();
        const data = {cells: [{fixed: true}], rulesHash: 'same'};

        handoffBootstrapRead(client, key, data);
        expect(takeBootstrapRead(client, key)?.data).toEqual(data);
        expect(takeBootstrapRead(client, key)).toBeUndefined();
        client.clear();
    });

    it('does not reuse a response after invalidation', async () => {
        const client = new QueryClient();

        handoffBootstrapRead(client, key, {cells: []});
        await client.invalidateQueries({queryKey: key});
        expect(takeBootstrapRead(client, key)).toBeUndefined();
        client.clear();
    });

    it('does not hide an intervening newer response', () => {
        const client = new QueryClient();

        handoffBootstrapRead(client, key, {revision: 1});
        client.setQueryData(key, {revision: 2});
        expect(takeBootstrapRead(client, key)).toBeUndefined();
        client.clear();
    });

    it('does not reuse a response after its query is removed and recreated', () => {
        const client = new QueryClient();

        handoffBootstrapRead(client, key, {revision: 1});
        client.removeQueries({queryKey: key});
        client.setQueryData(key, {revision: 2});
        expect(takeBootstrapRead(client, key)).toBeUndefined();
        client.clear();
    });

    it('isolates ward/team/month and query client', () => {
        const client = new QueryClient();
        const other = new QueryClient();

        handoffBootstrapRead(client, key, {cells: []});
        expect(takeBootstrapRead(other, key)).toBeUndefined();
        expect(takeBootstrapRead(client, scheduleWorkspaceKey(1, 11, 2026, 12))).toBeUndefined();
        expect(takeBootstrapRead(client, scheduleWorkspaceKey(1, 10, 2027, 1))).toBeUndefined();
        expect(takeBootstrapRead(client, key)).toBeDefined();
        client.clear();
        other.clear();
    });

    it('releases cancelled bootstrap without removing a newer handoff', () => {
        const client = new QueryClient();
        const release = handoffBootstrapRead(client, key, {revision: 1});

        handoffBootstrapRead(client, key, {revision: 2});
        release();
        expect(takeBootstrapRead<{revision: number}>(client, key)?.data.revision).toBe(2);

        const cancel = handoffBootstrapRead(client, key, {revision: 3});

        cancel();
        expect(takeBootstrapRead(client, key)).toBeUndefined();
        client.clear();
    });
});
