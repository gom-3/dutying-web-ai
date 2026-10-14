import {type TReqShiftCapacitySettings} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import {ChevronDown, Plus, Trash2} from 'lucide-react';
import {useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {Switch} from '@/shared/ui/primitives/switch';
import {capacityDraftRows, capacityDraftRules, type TCapacityDraftRow} from '../model/request-capacity';

const FIELD_CLASS = 'h-11 min-w-0 rounded-[10px] bg-gray-7 px-3 text-sm text-sub-1 disabled:opacity-60';
const ACTION_CLASS =
    'inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium text-main-1 hover:bg-gray-7 disabled:opacity-50';

export function RequestCapacitySettings() {
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
    const [expandedTypes, setExpandedTypes] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);
    const [errorKey, setErrorKey] = useState<'invalid' | 'saveError' | 'stale' | null>(null);
    const typeSignature = types.map((type) => `${type.wardShiftTypeId}:${type.classification}`).join(',');

    useEffect(() => {
        if (!saved) return;

        setEnabled(saved.enabled);

        const nextRows = capacityDraftRows(saved, types);

        setRows(nextRows);
        setExpandedTypes(nextRows.filter((row) => row.groups.length > 0).map((row) => row.wardShiftTypeId));
        setErrorKey(null);
        // Reset only when a server result or the available shift types actually changes.
    }, [saved, typeSignature]);

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

        if (nextRules === null || (enabled && nextRules.length === 0)) {
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
        <section className="mt-6 rounded-[16px] bg-white px-5 py-5" aria-label={t('requestCapacity.title')}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-[17px] leading-6 font-semibold text-sub-1">{t('requestCapacity.title')}</h3>
                    <p className="mt-1 text-[13px] leading-5 text-gray-3">{t('requestCapacity.description')}</p>
                </div>
                {saved && !stateContent ? (
                    <Switch
                        checked={enabled}
                        disabled={saving}
                        onCheckedChange={setEnabled}
                        aria-label={t('requestCapacity.enabled')}
                        className="shrink-0 data-[state=checked]:bg-main-1"
                    />
                ) : null}
            </div>
            {stateContent ?? (
                <>
                    {teams.length > 1 ? (
                        <label className="mt-5 flex flex-col gap-2 text-sm font-medium text-sub-1">
                            {t('requestCapacity.team')}
                            <select
                                className={FIELD_CLASS}
                                value={teamId ?? ''}
                                disabled={saving}
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
                    ) : null}
                    {enabled ? (
                        <div className="mt-5 grid gap-4">
                            <p className="text-xs leading-5 text-gray-3">{t('requestCapacity.allDates')}</p>
                            {rows.map((row) => {
                                const type = types.find((candidate) => candidate.wardShiftTypeId === row.wardShiftTypeId);
                                const typeLabel = type?.shortName ?? '';
                                const expanded = expandedTypes.includes(row.wardShiftTypeId);
                                const availableGroups = (saved?.groups ?? []).filter(
                                    (group) => !row.groups.some((value) => value.groupId === group.groupId),
                                );

                                return (
                                    <div key={row.wardShiftTypeId} className="rounded-[12px] bg-[#F6F7F9] p-4">
                                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                                            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-sub-1">
                                                {t('requestCapacity.type')}
                                                <select
                                                    className="h-11 rounded-[10px] bg-white px-3 text-sm"
                                                    value={row.wardShiftTypeId}
                                                    disabled={saving}
                                                    onChange={(event) =>
                                                        patchRow(row.wardShiftTypeId, {wardShiftTypeId: Number(event.target.value)})
                                                    }
                                                >
                                                    {types
                                                        .filter(
                                                            (candidate) =>
                                                                candidate.wardShiftTypeId === row.wardShiftTypeId ||
                                                                !rows.some((value) => value.wardShiftTypeId === candidate.wardShiftTypeId),
                                                        )
                                                        .map((candidate) => (
                                                            <option key={candidate.wardShiftTypeId} value={candidate.wardShiftTypeId}>
                                                                {candidate.shortName} · {candidate.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                className={`${ACTION_CLASS} self-end text-gray-3`}
                                                disabled={saving}
                                                aria-label={`${typeLabel} ${t('requestCapacity.remove')}`}
                                                onClick={() => setRows((previous) => previous.filter((value) => value !== row))}
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                        <label className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-sub-1">
                                            {t('requestCapacity.teamLimit')}
                                            <span className="flex items-center gap-2">
                                                <input
                                                    className="h-11 w-28 rounded-[10px] bg-white px-3 text-sm"
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={0}
                                                    max={10000}
                                                    step={1}
                                                    value={row.teamMax}
                                                    placeholder={t('requestCapacity.unlimited')}
                                                    disabled={saving}
                                                    aria-label={`${typeLabel} ${t('requestCapacity.teamLimit')}`}
                                                    onChange={(event) => patchRow(row.wardShiftTypeId, {teamMax: event.target.value})}
                                                />
                                                {t('requestCapacity.people')}
                                            </span>
                                        </label>
                                        <button
                                            type="button"
                                            className={`${ACTION_CLASS} mt-3 px-0`}
                                            disabled={saving}
                                            aria-expanded={expanded}
                                            onClick={() =>
                                                setExpandedTypes((previous) =>
                                                    expanded
                                                        ? previous.filter((id) => id !== row.wardShiftTypeId)
                                                        : [...previous, row.wardShiftTypeId],
                                                )
                                            }
                                        >
                                            {t('requestCapacity.groups')}
                                            {row.groups.length > 0 ? ` (${row.groups.length})` : ''}
                                            <ChevronDown className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                                        </button>
                                        {expanded ? (
                                            <div className="mt-2 grid gap-3">
                                                {row.groups.map((groupRule, index) => (
                                                    <div key={groupRule.groupId} className="flex flex-wrap items-center gap-2">
                                                        <select
                                                            className="h-11 min-w-24 flex-1 rounded-[10px] bg-white px-3 text-sm"
                                                            value={groupRule.groupId}
                                                            disabled={saving}
                                                            aria-label={`${typeLabel} ${t('requestCapacity.group')} ${index + 1}`}
                                                            onChange={(event) =>
                                                                patchRow(row.wardShiftTypeId, {
                                                                    groups: row.groups.map((value, i) =>
                                                                        i === index
                                                                            ? {...value, groupId: Number(event.target.value)}
                                                                            : value,
                                                                    ),
                                                                })
                                                            }
                                                        >
                                                            {(saved?.groups ?? [])
                                                                .filter(
                                                                    (candidate) =>
                                                                        candidate.groupId === groupRule.groupId ||
                                                                        availableGroups.some(
                                                                            (value) => value.groupId === candidate.groupId,
                                                                        ),
                                                                )
                                                                .map((candidate) => (
                                                                    <option key={candidate.groupId} value={candidate.groupId}>
                                                                        {candidate.name}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                        <input
                                                            className="h-11 w-24 rounded-[10px] bg-white px-3 text-sm"
                                                            type="number"
                                                            inputMode="numeric"
                                                            min={0}
                                                            max={10000}
                                                            step={1}
                                                            value={groupRule.max}
                                                            placeholder={t('requestCapacity.example')}
                                                            disabled={saving}
                                                            aria-label={`${typeLabel} ${saved?.groups.find((value) => value.groupId === groupRule.groupId)?.name ?? ''} ${t('requestCapacity.groupLimit')}`}
                                                            onChange={(event) =>
                                                                patchRow(row.wardShiftTypeId, {
                                                                    groups: row.groups.map((value, i) =>
                                                                        i === index ? {...value, max: event.target.value} : value,
                                                                    ),
                                                                })
                                                            }
                                                        />
                                                        <span className="text-sm text-gray-3">{t('requestCapacity.people')}</span>
                                                        <button
                                                            type="button"
                                                            className={`${ACTION_CLASS} px-2 text-gray-3`}
                                                            disabled={saving}
                                                            aria-label={`${typeLabel} ${saved?.groups.find((value) => value.groupId === groupRule.groupId)?.name ?? ''} ${t('requestCapacity.remove')}`}
                                                            onClick={() =>
                                                                patchRow(row.wardShiftTypeId, {
                                                                    groups: row.groups.filter((_, i) => i !== index),
                                                                })
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    className={`${ACTION_CLASS} justify-self-start px-0`}
                                                    disabled={saving || availableGroups.length === 0}
                                                    onClick={() => {
                                                        const group = availableGroups[0];

                                                        if (group)
                                                            patchRow(row.wardShiftTypeId, {
                                                                groups: [...row.groups, {groupId: group.groupId, max: ''}],
                                                            });
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                                    {t('requestCapacity.addGroup')}
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                            <button
                                type="button"
                                className={`${ACTION_CLASS} justify-self-start px-0`}
                                disabled={saving || rows.length >= types.length}
                                onClick={() => {
                                    const type = types.find(
                                        (candidate) => !rows.some((row) => row.wardShiftTypeId === candidate.wardShiftTypeId),
                                    );

                                    if (type)
                                        setRows((previous) => [
                                            ...previous,
                                            {wardShiftTypeId: type.wardShiftTypeId, teamMax: '', groups: []},
                                        ]);
                                }}
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                {t('requestCapacity.addType')}
                            </button>
                        </div>
                    ) : null}
                    {overflows.length > 0 ? (
                        <div className="mt-4 rounded-[12px] bg-orange-50 p-4 text-sm text-orange-900" role="status">
                            <p>{t('requestCapacity.overflowHint')}</p>
                            <ul className="mt-2 grid gap-1 text-xs">
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
                        <div className="mt-4 text-sm text-red" role="alert">
                            <p>{t(`requestCapacity.${errorKey}`)}</p>
                            {errorKey === 'stale' ? (
                                <button type="button" className={ACTION_CLASS} onClick={() => void reload()}>
                                    {t('requestCapacity.retry')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-gray-3">{dirty ? t('requestCapacity.changed') : ''}</span>
                        <button
                            type="button"
                            className="h-11 rounded-[12px] bg-main-1 px-5 text-sm font-semibold text-white hover:bg-main-1-hover disabled:bg-gray-6 disabled:text-gray-3"
                            disabled={saving || !dirty || settingsQuery.isFetching || errorKey === 'stale'}
                            onClick={() => void save()}
                        >
                            {t(saving ? 'requestCapacity.saving' : 'requestCapacity.save')}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
