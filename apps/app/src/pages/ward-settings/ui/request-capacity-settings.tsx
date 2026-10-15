import {type TReqShiftCapacitySettings} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import {useEffect, useId, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {capacityDraftRows, capacityDraftRules, type TCapacityDraftRow} from '../model/request-capacity';
import {RequestCapacityRule} from './request-capacity-rule';

const FOCUS_CLASS =
    'focus-visible:bg-[#EDE7FF] focus-visible:text-[#45229E] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';
const ACTION_CLASS = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#5833D6] hover:bg-[#F3F0FF] disabled:opacity-50 ${FOCUS_CLASS}`;

export function RequestCapacitySettings() {
    const id = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const addTypeRef = useRef<HTMLButtonElement>(null);
    const newTypeFocusRef = useRef<number | null>(null);
    const {t} = useTypedTranslation();
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const teamsQuery = useQuery({...wardQueryOptions.shiftTeams(wardId ?? -1), enabled: wardId != null});
    const typesQuery = useQuery({...wardQueryOptions.shiftTypes(wardId ?? -1), enabled: wardId != null});
    const teams = teamsQuery.data ?? [];
    const types = (typesQuery.data ?? []).filter((type) => type.isActive !== false);
    const teamId = teams.find((team) => team.shiftTeamId === selectedTeamId)?.shiftTeamId ?? teams[0]?.shiftTeamId ?? null;
    const settingsKey = ['ward', 'requestCapacitySettings', wardId, teamId];
    const settingsQuery = useQuery({
        queryKey: settingsKey,
        queryFn: () => WardAPI.getReqShiftCapacitySettings(wardId!, teamId!),
        enabled: wardId != null && teamId !== null,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
    const saved = settingsQuery.data;
    const [enabled, setEnabled] = useState(false);
    const [rows, setRows] = useState<TCapacityDraftRow[]>([]);
    const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});
    const [addingType, setAddingType] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorKey, setErrorKey] = useState<'invalid' | 'saveError' | 'stale' | null>(null);

    useEffect(() => {
        if (errorKey === 'invalid') sectionRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
    }, [errorKey]);

    useEffect(() => {
        if (newTypeFocusRef.current === null) return;

        sectionRef.current?.querySelector<HTMLInputElement>(`[data-shift-type="${newTypeFocusRef.current}"] input`)?.focus();
        newTypeFocusRef.current = null;
    }, [rows]);

    const typeSignature = types.map((type) => `${type.wardShiftTypeId}:${type.classification}`).join(',');
    const resetDraft = () => {
        if (!saved) return;

        const nextRows = capacityDraftRows(saved, types);

        setEnabled(saved.enabled);
        setRows(nextRows);
        setAddingType(false);
        setOpenGroups(Object.fromEntries(nextRows.map((row) => [row.wardShiftTypeId, row.groups.length > 0])));
        setErrorKey(null);
    };

    useEffect(resetDraft, [saved, typeSignature]);

    const rules = capacityDraftRules(rows);
    const normalizedRules = (value: TReqShiftCapacitySettings['rules']) =>
        JSON.stringify([...value].sort((a, b) => a.wardShiftTypeId - b.wardShiftTypeId || (a.groupId ?? 0) - (b.groupId ?? 0)));
    const dirty = Boolean(
        saved && (enabled !== saved.enabled || rules === null || normalizedRules(rules) !== normalizedRules(saved.rules)),
    );
    const overflows =
        enabled && rules
            ? (saved?.usage ?? []).flatMap((usage) => {
                  const rule = rules.find(
                      (candidate) => candidate.wardShiftTypeId === usage.wardShiftTypeId && candidate.groupId === usage.groupId,
                  );

                  return rule && usage.requestedCount > rule.maxPerDay ? [{...usage, maxPerDay: rule.maxPerDay}] : [];
              })
            : [];
    const patchRow = (id: number, patch: Partial<TCapacityDraftRow>) => {
        setRows((previous) => previous.map((row) => (row.wardShiftTypeId === id ? {...row, ...patch} : row)));

        if (errorKey !== 'stale') setErrorKey(null);
    };
    const reload = async () => {
        if (dirty && !window.confirm(t('requestCapacity.unsaved'))) return;

        await Promise.all([teamsQuery.refetch(), typesQuery.refetch(), settingsQuery.refetch()]);
    };
    const save = async () => {
        if (!saved || wardId === null || teamId === null) return;

        const nextRules = enabled ? rules : (rules ?? saved.rules);

        if (nextRules === null || (enabled && (nextRules.length === 0 || rows.some((row) => !capacityDraftRules([row])?.length)))) {
            setOpenGroups((previous) => ({
                ...previous,
                ...Object.fromEntries(
                    rows
                        .filter((row) => row.groups.some((group) => !/^\d+$/.test(group.max) || Number(group.max) > 10000))
                        .map((row) => [row.wardShiftTypeId, true]),
                ),
            }));
            setErrorKey('invalid');

            return;
        }

        setSaving(true);
        setErrorKey(null);

        try {
            const result = await WardAPI.updateReqShiftCapacitySettings(wardId, teamId, {
                enabled,
                revision: saved.revision,
                rules: nextRules,
            });

            queryClient.setQueryData(settingsKey, result);
            toast.success(t('requestCapacity.saved'));
        } catch (error) {
            setErrorKey(
                isAxiosError(error) && error.response?.data?.code === 'REQ_SHIFT_CAPACITY_SETTINGS_CONFLICT' ? 'stale' : 'saveError',
            );
        } finally {
            setSaving(false);
        }
    };
    const currentTeam = teams.find((team) => team.shiftTeamId === teamId);
    const unusedTypes = types.filter((type) => !rows.some((row) => row.wardShiftTypeId === type.wardShiftTypeId));

    let stateContent = null;

    if (teamsQuery.isError || typesQuery.isError || settingsQuery.isError) {
        stateContent = (
            <PageState
                tone="error"
                title={t('requestCapacity.error')}
                action={{label: t('requestCapacity.retry'), onClick: () => void reload()}}
            />
        );
    } else if (teamsQuery.isPending || typesQuery.isPending || (teamId !== null && settingsQuery.isPending)) {
        stateContent = <PageState tone="loading" title={t('requestCapacity.loading')} />;
    } else if (teams.length === 0) {
        stateContent = <p className="text-sm text-gray-3">{t('requestCapacity.emptyTeam')}</p>;
    } else if (types.length === 0) {
        stateContent = <p className="text-sm text-gray-3">{t('requestCapacity.emptyType')}</p>;
    }

    return (
        <section ref={sectionRef} className="mt-7 min-w-0" aria-label={t('requestCapacity.title')}>
            <div className="mb-5">
                <h3 className="text-[1.375rem] leading-8 font-bold text-[#252735]">{t('requestCapacity.dailyTitle')}</h3>
                <p className="mt-1 text-sm leading-6 text-[#626573]">{t('requestCapacity.allDates')}</p>
            </div>
            {stateContent ? (
                <div className="rounded-xl bg-white p-6">{stateContent}</div>
            ) : (
                <>
                    <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <label className="flex min-w-0 flex-wrap items-center gap-3 text-sm font-medium text-[#626573]">
                            {t('requestCapacity.team')}
                            <select
                                value={teamId ?? ''}
                                disabled={saving || teams.length === 1}
                                className={`min-h-12 max-w-full min-w-24 rounded-lg bg-white px-4 text-base font-bold text-[#252735] disabled:opacity-100 ${FOCUS_CLASS}`}
                                onChange={(event) => {
                                    if (dirty && !window.confirm(t('requestCapacity.unsaved'))) return;

                                    setSelectedTeamId(Number(event.target.value));
                                }}
                            >
                                {teams.map((team) => (
                                    <option key={team.shiftTeamId} value={team.shiftTeamId}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={t('requestCapacity.enabled')}
                            disabled={saving}
                            onClick={() => {
                                setEnabled((value) => !value);

                                if (errorKey !== 'stale') setErrorKey(null);
                            }}
                            className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-lg px-2 text-sm font-semibold text-[#454856] disabled:opacity-50 ${FOCUS_CLASS}`}
                        >
                            <span>{t(enabled ? 'requestCapacity.on' : 'requestCapacity.off')}</span>
                            <span
                                aria-hidden="true"
                                className={`inline-flex h-7 w-12 items-center rounded-full px-1 ${enabled ? 'bg-[#6242D9]' : 'bg-[#9094A5]'}`}
                            >
                                <span className={`size-5 rounded-full bg-white ${enabled ? 'translate-x-5' : ''}`} />
                            </span>
                        </button>
                    </div>
                    {enabled ? (
                        <>
                            <div className="grid grid-cols-1 gap-6">
                                {rows.map((row) => (
                                    <RequestCapacityRule
                                        key={row.wardShiftTypeId}
                                        row={row}
                                        type={types.find((type) => type.wardShiftTypeId === row.wardShiftTypeId)}
                                        groups={saved?.groups ?? []}
                                        groupsOpen={openGroups[row.wardShiftTypeId] ?? false}
                                        disabled={saving}
                                        canRemove={rows.length > 1}
                                        showErrors={errorKey === 'invalid'}
                                        onChange={(patch) => patchRow(row.wardShiftTypeId, patch)}
                                        onToggleGroups={() =>
                                            setOpenGroups((previous) => ({
                                                ...previous,
                                                [row.wardShiftTypeId]: !previous[row.wardShiftTypeId],
                                            }))
                                        }
                                        onRemove={() => {
                                            setRows((previous) =>
                                                previous.filter((value) => value.wardShiftTypeId !== row.wardShiftTypeId),
                                            );

                                            if (errorKey !== 'stale') setErrorKey(null);
                                        }}
                                    />
                                ))}
                            </div>
                            {unusedTypes.length > 0 ? (
                                <div className="mt-4 min-w-0">
                                    <button
                                        ref={addTypeRef}
                                        type="button"
                                        disabled={saving}
                                        aria-expanded={addingType}
                                        aria-controls={`${id}-add-types`}
                                        className={`min-h-12 max-w-full gap-2 rounded-lg bg-white px-4 py-3 text-left text-sm leading-6 font-semibold text-[#5630C4] disabled:opacity-50 ${FOCUS_CLASS}`}
                                        onClick={() => setAddingType((value) => !value)}
                                    >
                                        <span aria-hidden="true" className="text-xl">
                                            {addingType ? '−' : '＋'}
                                        </span>
                                        <span className="min-w-0">{t('requestCapacity.addType')}</span>
                                    </button>
                                    <div
                                        id={`${id}-add-types`}
                                        hidden={!addingType}
                                        className="mt-2 rounded-lg bg-white p-2"
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Escape') return;

                                            setAddingType(false);
                                            addTypeRef.current?.focus();
                                        }}
                                    >
                                        {unusedTypes.map((type) => (
                                            <button
                                                key={type.wardShiftTypeId}
                                                type="button"
                                                aria-label={`${type.shortName} ${type.name}`}
                                                disabled={saving}
                                                className={`flex min-h-12 w-full min-w-0 flex-wrap justify-start gap-x-2 rounded-md px-3 py-2 text-left text-base leading-6 text-[#363244] hover:bg-[#F1EDF9] ${FOCUS_CLASS}`}
                                                onClick={() => {
                                                    newTypeFocusRef.current = type.wardShiftTypeId;
                                                    setRows((previous) => [
                                                        ...previous,
                                                        {wardShiftTypeId: type.wardShiftTypeId, teamMax: '', groups: []},
                                                    ]);
                                                    setAddingType(false);

                                                    if (errorKey !== 'stale') setErrorKey(null);
                                                }}
                                            >
                                                <span className="font-bold break-all">{type.shortName}</span>
                                                <span className="min-w-0 break-words">{type.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <p className="rounded-xl bg-white p-6 text-base leading-7 text-[#454856]">{t('requestCapacity.offHint')}</p>
                    )}
                    {overflows.length > 0 ? (
                        <div className="mt-5 rounded-lg bg-orange-50 p-4 text-sm leading-6 text-orange-900" role="status">
                            <p>{t('requestCapacity.overflowHint')}</p>
                            <ul className="mt-2 grid gap-1">
                                {overflows.map((overflow) => (
                                    <li key={`${overflow.date}:${overflow.wardShiftTypeId}:${overflow.groupId}`}>
                                        {t('requestCapacity.overflow', {
                                            date: overflow.date,
                                            type: types.find((type) => type.wardShiftTypeId === overflow.wardShiftTypeId)?.shortName ?? '',
                                            scope:
                                                saved?.groups.find((group) => group.groupId === overflow.groupId)?.name ??
                                                t('requestCapacity.team'),
                                            count: overflow.requestedCount,
                                            limit: overflow.maxPerDay,
                                        })}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {errorKey ? (
                        <div className="mt-5 rounded-lg bg-[#FDECEB] p-4 text-sm leading-6 text-[#A52D26]" role="alert">
                            <p>{t(`requestCapacity.${errorKey}`)}</p>
                            {errorKey === 'stale' ? (
                                <button type="button" className={ACTION_CLASS} onClick={() => void reload()}>
                                    {t('requestCapacity.retry')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                        <p className="min-w-0 text-sm leading-6 text-[#626573]">
                            {dirty ? t('requestCapacity.changed') : t('requestCapacity.appliedTeam', {team: currentTeam?.name ?? ''})}
                        </p>
                        <div className="flex w-full items-center gap-2 sm:w-auto">
                            {dirty ? (
                                <button
                                    type="button"
                                    onClick={resetDraft}
                                    disabled={saving || errorKey === 'stale'}
                                    className={`${ACTION_CLASS} text-[#505464]`}
                                >
                                    {t('requestCapacity.cancel')}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className={`min-h-12 flex-1 rounded-lg px-7 text-base font-bold disabled:bg-[#E5E4ED] disabled:text-[#626573] sm:min-w-40 ${FOCUS_CLASS} bg-[#6242D9] text-white hover:bg-[#5434C5]`}
                                disabled={saving || !dirty || settingsQuery.isFetching || errorKey === 'stale'}
                                onClick={() => void save()}
                            >
                                {t(saving ? 'requestCapacity.saving' : dirty ? 'requestCapacity.save' : 'requestCapacity.savedLabel')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
