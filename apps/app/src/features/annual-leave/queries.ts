import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useMemo, useState} from 'react';
import type {TShift} from '@/entities';
import type {TDutyDoc} from '@/features/shift-editor/model';
import {WardAPI} from '@/shared/api';
import {annualLeaveMonthRange, annualLeavePreview, annualLeaveAssignments, sumAnnualLeaveAssignments} from './model';

export const annualLeaveKey = (wardId: number) => ['annualLeave', wardId] as const;

export function useAnnualLeave(wardId: number | null, from: string, to: string) {
    return useQuery({
        queryKey: [...annualLeaveKey(wardId ?? -1), from, to],
        queryFn: () => WardAPI.getAnnualLeave(wardId!, from, to),
        enabled: wardId != null,
        staleTime: 10_000,
        refetchOnMount: 'always',
        retry: false,
    });
}

export function useRefreshAnnualLeave(wardId: number) {
    const client = useQueryClient();

    return () => client.invalidateQueries({queryKey: annualLeaveKey(wardId)});
}

export function useAnnualLeaveSchedule(
    wardId: number | null,
    shiftTeamId: number | null,
    year: number,
    month: number,
    shift: TShift | null | undefined,
    doc: TDutyDoc | null | undefined,
    confirmed = false,
) {
    const range = annualLeaveMonthRange(year, month);
    const overview = useAnnualLeave(wardId, range.from, range.to);
    const request = useMemo(
        () =>
            shift && doc && shiftTeamId != null && doc.columns.every((date) => date >= range.from && date <= range.to)
                ? annualLeavePreview(shift, doc, shiftTeamId, year, month)
                : null,
        [shift, doc, shiftTeamId, year, month, range.from, range.to],
    );
    const [settled, setSettled] = useState(request);

    useEffect(() => {
        const timer = window.setTimeout(() => setSettled(request), 400);

        return () => window.clearTimeout(timer);
    }, [request]);

    const preview = useQuery({
        queryKey: [...annualLeaveKey(wardId ?? -1), 'preview', settled, overview.dataUpdatedAt],
        queryFn: () => WardAPI.previewAnnualLeave(wardId!, settled!),
        enabled: wardId != null && settled != null && overview.data?.settings.enabled === true,
        staleTime: 0,
        gcTime: 30_000,
        retry: false,
    });
    const managed = overview.data?.settings.enabled === true;
    const data = managed ? preview.data : undefined;
    const pending = request !== settled || preview.isFetching;
    const assignments = useMemo(
        () =>
            shift && request
                ? annualLeaveAssignments(
                      shift,
                      request,
                      overview.data?.settings.unitRules,
                      (pending ? undefined : data?.days) ?? overview.data?.days,
                  )
                : [],
        [shift, request, overview.data, data?.days, pending],
    );
    const counts = useMemo(() => sumAnnualLeaveAssignments(assignments), [assignments]);
    const names = useMemo(
        () => new Map(shift?.divisionShiftNurses.flat().map((row) => [row.shiftNurse.nurseId, row.shiftNurse.name]) ?? []),
        [shift],
    );

    return {
        overview,
        preview,
        data: pending ? undefined : data,
        counts,
        assignments,
        confirmed,
        names,
        pending,
        range,
        request,
        managed,
    };
}
