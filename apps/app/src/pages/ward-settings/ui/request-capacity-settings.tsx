import {type TReqShiftCapacitySettings} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import {useEffect, useId, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {capacityDraftRows, capacityDraftRules, type TCapacityDraftRow} from '../model/request-capacity';

const FOCUS_CLASS =
    'focus-visible:bg-[#EDE7FF] focus-visible:text-[#45229E] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';
const FIELD_CLASS = `h-11 min-w-0 rounded-lg px-3 disabled:opacity-60 ${FOCUS_CLASS}`;
const ACTION_CLASS = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#5833D6] hover:bg-[#F3F0FF] disabled:opacity-50 ${FOCUS_CLASS}`;

export function RequestCapacitySettings() {
    const sectionId = useId();
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
        setExpandedTypes([]);
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
        <section className="mt-6 rounded-2xl bg-white p-5 sm:p-6" aria-label={t('requestCapacity.title')}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-[17px] leading-6 font-semibold text-sub-1">{t('requestCapacity.title')}</h3>
                    <p className="mt-1 text-sm leading-5 text-[#626775]">{t('requestCapacity.description')}</p>
                </div>
                {saved && !stateContent ? (
                    <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={t('requestCapacity.enabled')}
                        disabled={saving}
                        onClick={() => setEnabled((value) => !value)}
                        className={`group -mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-50 ${FOCUS_CLASS}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`inline-flex h-6 w-10 items-center rounded-full px-0.5 group-focus-visible:bg-[#45229E] ${enabled ? 'bg-main-1' : 'bg-[#B2B6C0]'}`}
                        >
                            <span className={`h-5 w-5 rounded-full bg-white ${enabled ? 'translate-x-4' : ''}`} />
                        </span>
                    </button>
                ) : null}
            </div>
            {stateContent ?? (
                <>
                    {teams.length > 1 ? (
                        <label className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#626775]">
                            {t('requestCapacity.team')}
                            <select
                                className={`${FIELD_CLASS} flex-1 bg-[#F3F4F7] text-sm text-sub-1 sm:max-w-56`}
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
                        <div className="mt-6">
                            <p className="mb-4 text-xs leading-5 text-[#626775]">{t('requestCapacity.allDates')}</p>
                            <div className="grid gap-6">
                                {rows.map((row) => {
                                    const type = types.find((candidate) => candidate.wardShiftTypeId === row.wardShiftTypeId);
                                    const typeLabel = type?.shortName ?? '';
                                    const expanded = expandedTypes.includes(row.wardShiftTypeId);
                                    const groupPanelId = `${sectionId}-${row.wardShiftTypeId}-groups`;
                                    const groupSummary = row.groups
                                        .map((rule) =>
                                            t('requestCapacity.groupSummary', {
                                                group: saved?.groups.find((group) => group.groupId === rule.groupId)?.name ?? '',
                                                count: rule.max,
                                            }),
                                        )
                                        .join(' · ');

                                    return (
                                        <div key={row.wardShiftTypeId}>
                                            <div className="flex items-start gap-2">
                                                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                                                    <label className="min-w-0">
                                                        <span className="sr-only">{`${typeLabel} ${t('requestCapacity.type')}`}</span>
                                                        <select
                                                            className={`${FIELD_CLASS} max-w-full bg-[#F3F0FF] text-sm font-semibold text-[#45229E]`}
                                                            value={row.wardShiftTypeId}
                                                            disabled={saving}
                                                            onChange={(event) => {
                                                                setExpandedTypes([]);
                                                                patchRow(row.wardShiftTypeId, {
                                                                    wardShiftTypeId: Number(event.target.value),
                                                                });
                                                            }}
                                                        >
                                                            {types
                                                                .filter(
                                                                    (candidate) =>
                                                                        candidate.wardShiftTypeId === row.wardShiftTypeId ||
                                                                        !rows.some(
                                                                            (value) => value.wardShiftTypeId === candidate.wardShiftTypeId,
                                                                        ),
                                                                )
                                                                .map((candidate) => (
                                                                    <option
                                                                        key={candidate.wardShiftTypeId}
                                                                        value={candidate.wardShiftTypeId}
                                                                    >
                                                                        {candidate.shortName} · {candidate.name}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </label>
                                                    <label className="flex max-w-full flex-wrap items-center gap-2 text-sm text-sub-1">
                                                        {t('requestCapacity.dailyMax')}
                                                        <span className="flex max-w-full items-center gap-2">
                                                            <input
                                                                className={`${FIELD_CLASS} w-24 bg-[#F3F4F7] text-center text-lg font-semibold text-sub-1`}
                                                                type="number"
                                                                inputMode="numeric"
                                                                min={0}
                                                                max={10000}
                                                                step={1}
                                                                value={row.teamMax}
                                                                placeholder={t('requestCapacity.unlimited')}
                                                                disabled={saving}
                                                                aria-label={`${typeLabel} ${t('requestCapacity.teamLimit')}`}
                                                                onChange={(event) =>
                                                                    patchRow(row.wardShiftTypeId, {teamMax: event.target.value})
                                                                }
                                                            />
                                                            {t('requestCapacity.people')}
                                                        </span>
                                                    </label>
                                                </div>
                                                {rows.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        className={`${ACTION_CLASS} shrink-0 text-[#626775]`}
                                                        disabled={saving}
                                                        aria-label={`${typeLabel} ${t('requestCapacity.remove')}`}
                                                        onClick={() => setRows((previous) => previous.filter((value) => value !== row))}
                                                    >
                                                        {t('requestCapacity.remove')}
                                                    </button>
                                                ) : null}
                                            </div>
                                            {(saved?.groups.length ?? 0) > 0 ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`${ACTION_CLASS} mt-1 -ml-3 text-[#626775]`}
                                                        disabled={saving}
                                                        aria-label={`${typeLabel} ${t('requestCapacity.groups')}`}
                                                        aria-expanded={expanded}
                                                        aria-controls={groupPanelId}
                                                        onClick={() =>
                                                            setExpandedTypes((previous) =>
                                                                expanded
                                                                    ? previous.filter((id) => id !== row.wardShiftTypeId)
                                                                    : [...previous, row.wardShiftTypeId],
                                                            )
                                                        }
                                                    >
                                                        {t('requestCapacity.groups')}
                                                        <span aria-hidden="true" className={`text-base ${expanded ? 'rotate-180' : ''}`}>
                                                            ⌄
                                                        </span>
                                                    </button>
                                                    {!expanded && groupSummary ? (
                                                        <p className="text-xs leading-5 text-[#626775]">{groupSummary}</p>
                                                    ) : null}
                                                    {expanded ? (
                                                        <div id={groupPanelId} className="mt-1 rounded-lg bg-[#F7F8FA] p-3 sm:p-4">
                                                            <p className="mb-2 text-xs leading-5 text-[#626775]">
                                                                {t('requestCapacity.groupHint')}
                                                            </p>
                                                            <div className="grid gap-2">
                                                                {saved?.groups.map((group) => (
                                                                    <label
                                                                        key={group.groupId}
                                                                        className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm text-sub-1"
                                                                    >
                                                                        <span className="min-w-0 break-words">{group.name}</span>
                                                                        <span className="flex max-w-full shrink-0 items-center gap-2">
                                                                            <input
                                                                                className={`${FIELD_CLASS} w-24 bg-white text-center text-sm font-semibold text-sub-1`}
                                                                                type="number"
                                                                                inputMode="numeric"
                                                                                min={0}
                                                                                max={10000}
                                                                                step={1}
                                                                                value={
                                                                                    row.groups.find(
                                                                                        (rule) => rule.groupId === group.groupId,
                                                                                    )?.max ?? ''
                                                                                }
                                                                                placeholder={t('requestCapacity.unlimited')}
                                                                                disabled={saving}
                                                                                aria-label={`${typeLabel} ${group.name} ${t('requestCapacity.groupLimit')}`}
                                                                                onChange={(event) =>
                                                                                    patchRow(row.wardShiftTypeId, {
                                                                                        groups: [
                                                                                            ...row.groups.filter(
                                                                                                (rule) => rule.groupId !== group.groupId,
                                                                                            ),
                                                                                            ...(event.target.value === ''
                                                                                                ? []
                                                                                                : [
                                                                                                      {
                                                                                                          groupId: group.groupId,
                                                                                                          max: event.target.value,
                                                                                                      },
                                                                                                  ]),
                                                                                        ],
                                                                                    })
                                                                                }
                                                                            />
                                                                            {t('requestCapacity.people')}
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                            {row.teamMax !== '' ? (
                                                                <p className="mt-3 text-xs leading-5 text-[#626775]">
                                                                    {t('requestCapacity.groupBoth')}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                </>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                            {rows.length < types.length ? (
                                <button
                                    type="button"
                                    className={`${ACTION_CLASS} mt-4 -ml-3`}
                                    disabled={saving}
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
                                    <span aria-hidden="true" className="text-lg">
                                        ＋
                                    </span>
                                    {t('requestCapacity.addType')}
                                </button>
                            ) : null}
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
                            className={`min-h-11 rounded-lg bg-main-1 px-5 text-sm font-semibold text-white hover:bg-main-1-hover disabled:bg-[#F3F4F7] disabled:text-[#626775] ${FOCUS_CLASS}`}
                            disabled={saving || !dirty || settingsQuery.isFetching || errorKey === 'stale'}
                            onClick={() => void save()}
                        >
                            {t(saving ? 'requestCapacity.saving' : !dirty ? 'requestCapacity.savedLabel' : 'requestCapacity.save')}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
