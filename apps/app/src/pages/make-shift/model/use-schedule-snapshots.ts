import type {TSnapshotListRes, TSnapshotSaveRes, TSnapshotSummaryDto} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import WardAPI from '@/shared/api/ward';

export const MAX_SCHEDULE_SNAPSHOT_COUNT = 10;

export const scheduleSnapshotsQueryKey = (wardId: number, shiftTeamId: number, year: number, month: number) =>
    ['schedule', 'snapshots', wardId, shiftTeamId, year, month] as const;

export const scheduleSnapshotDetailQueryKey = (wardId: number, shiftTeamId: number, snapshotId: number) =>
    ['schedule', 'snapshot', wardId, shiftTeamId, snapshotId] as const;

export function normalizeScheduleSnapshots(snapshots: TSnapshotSummaryDto[]): TSnapshotSummaryDto[] {
    return [...snapshots]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, MAX_SCHEDULE_SNAPSHOT_COUNT);
}

export function useScheduleSnapshots(params: {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
    enabled?: boolean;
}) {
    const {wardId, shiftTeamId, year, month, enabled = true} = params;

    return useQuery({
        queryKey: scheduleSnapshotsQueryKey(wardId ?? -1, shiftTeamId ?? -1, year, month),
        queryFn: async (): Promise<TSnapshotSummaryDto[]> => {
            const res: TSnapshotListRes = await WardAPI.getSnapshots(wardId!, shiftTeamId!, year, month);

            return normalizeScheduleSnapshots(res.snapshots);
        },
        enabled: enabled && wardId != null && shiftTeamId != null,
    });
}

export function useScheduleSnapshotDetail(params: {
    wardId: number | null;
    shiftTeamId: number | null;
    snapshotId: number | null;
    enabled?: boolean;
}) {
    const {wardId, shiftTeamId, snapshotId, enabled = true} = params;

    return useQuery({
        queryKey: scheduleSnapshotDetailQueryKey(wardId ?? -1, shiftTeamId ?? -1, snapshotId ?? -1),
        queryFn: () => WardAPI.getSnapshot(wardId!, shiftTeamId!, snapshotId!),
        enabled: enabled && wardId != null && shiftTeamId != null && snapshotId != null,
    });
}

export function useInvalidateScheduleSnapshots() {
    const queryClient = useQueryClient();

    return (wardId: number, shiftTeamId: number, year: number, month: number) => {
        void queryClient.invalidateQueries({
            queryKey: scheduleSnapshotsQueryKey(wardId, shiftTeamId, year, month),
        });
    };
}

export function prependSnapshotToListCache(
    queryClient: ReturnType<typeof useQueryClient>,
    wardId: number,
    shiftTeamId: number,
    year: number,
    month: number,
    saved: TSnapshotSaveRes,
) {
    const key = scheduleSnapshotsQueryKey(wardId, shiftTeamId, year, month);
    const prev = queryClient.getQueryData<TSnapshotSummaryDto[]>(key) ?? [];
    const summary: TSnapshotSummaryDto = {
        snapshotId: saved.snapshotId,
        title: saved.title,
        year: saved.year,
        month: saved.month,
        cellCount: 0,
        emptyCellCount: 0,
        createdAt: saved.savedAt,
        updatedAt: saved.savedAt,
    };

    queryClient.setQueryData(key, normalizeScheduleSnapshots([summary, ...prev.filter((item) => item.snapshotId !== saved.snapshotId)]));
}

export function updateSnapshotTitleInListCache(
    queryClient: ReturnType<typeof useQueryClient>,
    wardId: number,
    shiftTeamId: number,
    year: number,
    month: number,
    saved: TSnapshotSaveRes,
) {
    const key = scheduleSnapshotsQueryKey(wardId, shiftTeamId, year, month);
    const prev = queryClient.getQueryData<TSnapshotSummaryDto[]>(key) ?? [];

    queryClient.setQueryData(
        key,
        normalizeScheduleSnapshots(
            prev.map((item) =>
                item.snapshotId === saved.snapshotId
                    ? {
                          ...item,
                          title: saved.title,
                          updatedAt: saved.savedAt,
                      }
                    : item,
            ),
        ),
    );
}

export function removeSnapshotFromListCache(
    queryClient: ReturnType<typeof useQueryClient>,
    wardId: number,
    shiftTeamId: number,
    year: number,
    month: number,
    snapshotId: number,
) {
    const key = scheduleSnapshotsQueryKey(wardId, shiftTeamId, year, month);
    const prev = queryClient.getQueryData<TSnapshotSummaryDto[]>(key) ?? [];

    queryClient.setQueryData(
        key,
        prev.filter((item) => item.snapshotId !== snapshotId),
    );
}
