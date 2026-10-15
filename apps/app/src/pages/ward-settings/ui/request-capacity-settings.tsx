import {type TReqShiftCapacitySettings} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import {useEffect, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {capacityDraftRows, capacityDraftRules, type TCapacityDraftRow} from '../model/request-capacity';
import {RequestCapacityRule, type TCapacityScope} from './request-capacity-rule';

const FOCUS_CLASS =
    'focus-visible:bg-[#EDE7FF] focus-visible:text-[#45229E] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';
const ACTION_CLASS = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#5833D6] hover:bg-[#F3F0FF] disabled:opacity-50 ${FOCUS_CLASS}`;

export function RequestCapacitySettings() {
    const sectionRef = useRef<HTMLElement>(null);
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
    const [scopes, setScopes] = useState<Record<number, TCapacityScope>>({});
    const [saving, setSaving] = useState(false);
    const [errorKey, setErrorKey] = useState<'invalid' | 'saveError' | 'stale' | null>(null);

    useEffect(() => {
        if (errorKey === 'invalid') sectionRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
    }, [errorKey]);

    const typeSignature = types.map((type) => `${type.wardShiftTypeId}:${type.classification}`).join(',');
    const resetDraft = () => {
        if (!saved) return;

        const nextRows = capacityDraftRows(saved, types);

        setEnabled(saved.enabled);
        setRows(nextRows);
        setScopes(
            Object.fromEntries(
                nextRows.map((row) => [
                    row.wardShiftTypeId,
                    {
                        mode: row.groups.length > 0 ? 'GROUP' : 'TEAM',
                        includeTeam: row.teamMax !== '',
                    },
                ]),
            ),
        );
        setErrorKey(null);
    };

    useEffect(resetDraft, [saved, typeSignature]);

    const effectiveRows = rows.map((row) => {
        const scope = scopes[row.wardShiftTypeId];

        return scope?.mode === 'GROUP' ? {...row, teamMax: scope.includeTeam ? row.teamMax : ''} : {...row, groups: []};
    });
    const rules = capacityDraftRules(effectiveRows);
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

        if (
            nextRules === null ||
            (enabled && (nextRules.length === 0 || effectiveRows.some((row) => !capacityDraftRules([row])?.length)))
        ) {
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
    const updateScope = (typeId: number, scope: TCapacityScope) => {
        setScopes((previous) => ({...previous, [typeId]: scope}));

        if (errorKey !== 'stale') setErrorKey(null);
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
        <section ref={sectionRef} className="mt-6 overflow-hidden rounded-2xl bg-white" aria-label={t('requestCapacity.title')}>
            <div className="px-5 pt-6 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-[#242633]">{t('requestCapacity.title')}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#626573]">{t('requestCapacity.description')}</p>
                    </div>
                    {saved && !stateContent ? (
                        <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={t('requestCapacity.enabled')}
                            disabled={saving}
                            onClick={() => setEnabled((value) => !value)}
                            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm text-[#505464] disabled:opacity-50 ${FOCUS_CLASS}`}
                        >
                            <span className="hidden sm:inline forced-colors:inline">
                                {t(enabled ? 'requestCapacity.on' : 'requestCapacity.off')}
                            </span>
                            <span
                                aria-hidden="true"
                                className={`inline-flex h-6 w-10 items-center rounded-full px-0.5 ${enabled ? 'bg-[#6242D9]' : 'bg-[#B1B3BD]'}`}
                            >
                                <span className={`size-5 rounded-full bg-white ${enabled ? 'translate-x-4' : ''}`} />
                            </span>
                        </button>
                    ) : null}
                </div>
                {stateContent ? (
                    <div className="py-6">{stateContent}</div>
                ) : (
                    <>
                        {teams.length > 1 ? (
                            <div className="mt-5 flex flex-wrap items-center gap-3" role="group" aria-label={t('requestCapacity.team')}>
                                <p className="text-xs font-medium text-[#626573]">{t('requestCapacity.team')}</p>
                                <div className="flex flex-wrap gap-1">
                                    {teams.map((team) => (
                                        <button
                                            key={team.shiftTeamId}
                                            type="button"
                                            aria-pressed={teamId === team.shiftTeamId}
                                            disabled={saving}
                                            className={`min-h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-50 ${teamId === team.shiftTeamId ? 'bg-[#EEEAFB] text-[#5532C8] forced-colors:underline' : 'text-[#626573] hover:bg-[#F1F1F6]'} ${FOCUS_CLASS}`}
                                            onClick={() => {
                                                if (teamId === team.shiftTeamId) return;

                                                if (dirty && !window.confirm(t('requestCapacity.unsaved'))) return;

                                                setSelectedTeamId(team.shiftTeamId);
                                            }}
                                        >
                                            {team.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <div className="py-6">
                            {enabled ? (
                                <>
                                    <div className="grid grid-cols-1 gap-8">
                                        {rows.map((row) => (
                                            <RequestCapacityRule
                                                key={row.wardShiftTypeId}
                                                row={row}
                                                type={types.find((type) => type.wardShiftTypeId === row.wardShiftTypeId)}
                                                groups={saved?.groups ?? []}
                                                scope={scopes[row.wardShiftTypeId] ?? {mode: 'TEAM', includeTeam: row.teamMax !== ''}}
                                                disabled={saving}
                                                canRemove={rows.length > 1}
                                                showErrors={errorKey === 'invalid'}
                                                onChange={(patch) => patchRow(row.wardShiftTypeId, patch)}
                                                onScopeChange={(scope) => updateScope(row.wardShiftTypeId, scope)}
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
                                        <label className="mt-5 inline-flex max-w-full items-center gap-2 text-sm text-[#505464]">
                                            <span aria-hidden="true" className="text-lg">
                                                ＋
                                            </span>
                                            <span className="sr-only">{t('requestCapacity.addType')}</span>
                                            <select
                                                value=""
                                                disabled={saving}
                                                className={`min-h-11 max-w-full min-w-0 rounded-lg bg-[#F7F7FA] px-3 text-sm ${FOCUS_CLASS}`}
                                                onChange={(event) => {
                                                    const typeId = Number(event.target.value);

                                                    setRows((previous) => [
                                                        ...previous,
                                                        {wardShiftTypeId: typeId, teamMax: '', groups: []},
                                                    ]);
                                                    updateScope(typeId, {mode: 'TEAM', includeTeam: true});
                                                }}
                                            >
                                                <option value="" disabled>
                                                    {t('requestCapacity.addType')}
                                                </option>
                                                {unusedTypes.map((type) => (
                                                    <option key={type.wardShiftTypeId} value={type.wardShiftTypeId}>
                                                        {type.shortName} · {type.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    ) : null}
                                </>
                            ) : (
                                <p className="rounded-lg bg-[#F7F7FA] px-4 py-5 text-sm leading-6 text-[#626573]">
                                    {t('requestCapacity.offHint')}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
            {!stateContent ? (
                <>
                    {overflows.length > 0 ? (
                        <div className="mx-5 mb-5 rounded-lg bg-orange-50 p-4 text-sm text-orange-900 sm:mx-7" role="status">
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
                        <div className="mx-5 mb-5 text-sm text-[#BA3830] sm:mx-7" role="alert">
                            <p>{t(`requestCapacity.${errorKey}`)}</p>
                            {errorKey === 'stale' ? (
                                <button type="button" className={ACTION_CLASS} onClick={() => void reload()}>
                                    {t('requestCapacity.retry')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F7FA] px-5 py-4 sm:px-7">
                        <p className="min-w-0 text-xs leading-5 text-[#626573]">
                            {currentTeam?.name} · {t('requestCapacity.allDates')}
                        </p>
                        <div className="flex items-center gap-2">
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
                                className={`min-h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-50 ${dirty ? 'bg-[#6242D9] text-white hover:bg-[#5434C5]' : 'text-[#626573]'} ${FOCUS_CLASS}`}
                                disabled={saving || !dirty || settingsQuery.isFetching || errorKey === 'stale'}
                                onClick={() => void save()}
                            >
                                {t(saving ? 'requestCapacity.saving' : dirty ? 'requestCapacity.save' : 'requestCapacity.savedLabel')}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </section>
    );
}
