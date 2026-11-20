import type {TSnapshotSummaryDto} from '@dutying/api/ward';
import {QueryClient} from '@tanstack/react-query';
import {describe, expect, it} from 'vitest';
import {
    invalidateConfirmedScheduleContext,
    normalizeScheduleSnapshots,
    prependSnapshotToListCache,
    removeSnapshotFromListCache,
    scheduleSnapshotsQueryKey,
    updateSnapshotTitleInListCache,
} from '../use-schedule-snapshots';

function makeSnapshot(snapshotId: number, day: number): TSnapshotSummaryDto {
    const timestamp = `2026-06-${String(day).padStart(2, '0')}T09:00:00.000Z`;

    return {
        snapshotId,
        title: `V${snapshotId}`,
        year: 2026,
        month: 6,
        cellCount: snapshotId,
        emptyCellCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

describe('schedule snapshot list helpers', () => {
    it('returns every snapshot in most recently updated order', () => {
        const snapshots = Array.from({length: 22}, (_, index) => makeSnapshot(index + 1, index + 1));
        const result = normalizeScheduleSnapshots(snapshots);

        expect(result).toHaveLength(22);
        expect(result.map((snapshot) => snapshot.snapshotId)).toEqual(Array.from({length: 22}, (_, i) => 22 - i));
    });

    it('preserves prior snapshots when a new snapshot is prepended', () => {
        const queryClient = new QueryClient();
        const key = scheduleSnapshotsQueryKey(1, 2, 2026, 6);

        queryClient.setQueryData(
            key,
            normalizeScheduleSnapshots(Array.from({length: 20}, (_, index) => makeSnapshot(index + 1, index + 1))),
        );

        prependSnapshotToListCache(queryClient, 1, 2, 2026, 6, {
            snapshotId: 21,
            title: 'V21',
            year: 2026,
            month: 6,
            savedAt: '2026-06-21T09:00:00.000Z',
        });

        const result = queryClient.getQueryData<TSnapshotSummaryDto[]>(key);

        expect(result).toHaveLength(21);
        expect(result?.map((snapshot) => snapshot.snapshotId)).toEqual(Array.from({length: 21}, (_, i) => 21 - i));
    });

    it('updates the cached title without dropping snapshot summary counts', () => {
        const queryClient = new QueryClient();
        const key = scheduleSnapshotsQueryKey(1, 2, 2026, 6);

        queryClient.setQueryData(key, [makeSnapshot(1, 1)]);

        updateSnapshotTitleInListCache(queryClient, 1, 2, 2026, 6, {
            snapshotId: 1,
            title: '초안',
            year: 2026,
            month: 6,
            savedAt: '2026-06-02T09:00:00.000Z',
        });

        const result = queryClient.getQueryData<TSnapshotSummaryDto[]>(key);

        expect(result?.[0]).toMatchObject({
            snapshotId: 1,
            title: '초안',
            cellCount: 1,
            emptyCellCount: 0,
            updatedAt: '2026-06-02T09:00:00.000Z',
        });
    });

    it('removes a deleted snapshot from the cached list', () => {
        const queryClient = new QueryClient();
        const key = scheduleSnapshotsQueryKey(1, 2, 2026, 6);

        queryClient.setQueryData(key, [makeSnapshot(1, 1), makeSnapshot(2, 2)]);

        removeSnapshotFromListCache(queryClient, 1, 2, 2026, 6, 1);

        const result = queryClient.getQueryData<TSnapshotSummaryDto[]>(key);

        expect(result?.map((snapshot) => snapshot.snapshotId)).toEqual([2]);
    });
});

describe('confirmation context refresh', () => {
    it.each([
        [2026, 10, 2026, 11],
        [2026, 12, 2027, 1],
    ])('invalidates the next month after confirming %i/%i', async (year, month, nextYear, nextMonth) => {
        const client = new QueryClient();
        const current = ['ward', 'duty', 1, 10, year, month];
        const next = ['ward', 'duty', 1, 10, nextYear, nextMonth];
        const workspace = ['ward', 1, 'shift-team', 10, 'schedule-workspace', nextYear, nextMonth];
        const other = ['ward', 'duty', 2, 10, nextYear, nextMonth];
        [current, next, workspace, other].forEach((key) => client.setQueryData(key, {}));
        await invalidateConfirmedScheduleContext(client, 1, 10, year, month);
        [current, next, workspace].forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
        expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    });
});
