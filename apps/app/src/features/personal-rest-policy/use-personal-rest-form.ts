import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState} from 'react';
import type {TWardShiftType} from '@/entities';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import {adminAxiosInstance} from '@/shared/api/client';
import {usePersonalRestText} from './copy';

export type TPersonalRestPolicy = {
    nurseId: number;
    year: number;
    month: number;
    offDays: number | null;
    annualDaysByWardShiftTypeId: Record<string, number>;
    version: number | null;
};

export function usePersonalRestForm({
    nurseId,
    y,
    m,
    shiftTypes,
    enabled,
    onApplied,
    refreshFailed = '',
}: {
    nurseId: number;
    y: number;
    m: number;
    shiftTypes: TWardShiftType[];
    enabled: boolean;
    onApplied?: () => Promise<void> | void;
    refreshFailed?: string;
}) {
    const text = usePersonalRestText();
    const client = useQueryClient();
    const endpoint = `/nurses/${nurseId}/monthly-rest-policy/${y}/${m}`;
    const query = useQuery({
        queryKey: ['personal-rest-policy', nurseId, y, m],
        enabled: enabled && !!nurseId && !!y && !!m,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        queryFn: async () => (await adminAxiosInstance.get<TPersonalRestPolicy>(endpoint)).data,
    });
    const [off, setOff] = useState('');
    const [annual, setAnnual] = useState<Record<string, string>>({});
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshPending, setRefreshPending] = useState(false);
    const pending = useRef(false);
    const ownWrite = useRef<TPersonalRestPolicy | undefined>(undefined);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const [error, setError] = useState('');
    const errorRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (error) errorRef.current?.focus();
    }, [error]);

    const [saved, setSaved] = useState(false);
    const annualTypes = shiftTypes.filter((type) => type.isActive !== false && type.classification === 'ANNUAL_LEAVE');
    const reset = () => {
        setOff(query.data?.offDays == null ? '' : String(query.data.offDays));
        setAnnual(
            Object.fromEntries(Object.entries(query.data?.annualDaysByWardShiftTypeId ?? {}).map(([id, days]) => [id, String(days)])),
        );
        setDirty(false);
        setError('');
    };

    useEffect(() => {
        if (!dirty && query.data !== ownWrite.current) reset();
    }, [query.data, nurseId, y, m]);

    const save = async (): Promise<boolean> => {
        if (pending.current || query.isPending || query.isError || query.isFetching) return false;

        const days = new Date(y, m, 0).getDate();
        const values = [off, ...Object.values(annual)].filter((v) => v !== '');

        if (values.some((v) => !/^\d+$/.test(v) || Number(v) > days) || values.reduce((sum, v) => sum + Number(v), 0) > days) {
            setError(text.invalid);

            return false;
        }

        const annualValues = Object.fromEntries(
            Object.entries(annual)
                .filter(([, value]) => value !== '')
                .map(([id, value]) => [id, Number(value)]),
        );

        if (Object.keys(annualValues).length && off === '') {
            setError(text.annualOff);

            return false;
        }

        pending.current = true;
        setSaving(true);
        setError('');

        try {
            if (!refreshPending) {
                const {data} = await adminAxiosInstance.put<TPersonalRestPolicy>(endpoint, {
                    offDays: off === '' ? null : Number(off),
                    annualDaysByWardShiftTypeId: annualValues,
                    version: query.data?.version ?? null,
                });

                ownWrite.current = client.setQueryData<TPersonalRestPolicy>(['personal-rest-policy', nurseId, y, m], data);

                if (!mounted.current) return false;

                setDirty(false);
                setSaved(true);
                setRefreshPending(true);
                useShiftEditorStore.getState().setRulesHash(null);
                useShiftEditorStore.getState().setScheduleValidationSnapshot(null);
            }
        } catch (e) {
            if (mounted.current) {
                if ((e as {response?: {status?: number}}).response?.status === 409) {
                    await query.refetch();

                    if (mounted.current) setError(text.stale);
                } else setError(text.failure);
            }

            pending.current = false;

            if (mounted.current) setSaving(false);

            return false;
        }

        try {
            if (!mounted.current) return false;

            await onApplied?.();

            if (mounted.current) setRefreshPending(false);

            return true;
        } catch {
            if (mounted.current) setError(refreshFailed);

            return false;
        } finally {
            pending.current = false;

            if (mounted.current) setSaving(false);
        }
    };

    return {
        query,
        off,
        setOff,
        annual,
        setAnnual,
        dirty,
        setDirty,
        saving,
        error,
        errorRef,
        saved,
        setSaved,
        annualTypes,
        reset,
        save,
        refreshPending,
    };
}
