import {type TReqShiftCapacitySettings} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {isAxiosError} from 'axios';
import {Plus} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import ShiftClassificationDropdown from '@/shared/ui/ShiftClassificationDropdown';
import {capacityDraftRows, capacityDraftRules, type TCapacityDraftRow} from '../model/request-capacity';
import {RequestCapacityRule} from './request-capacity-rule';
import {RequestSettingsHelp} from './request-settings-help';

const FOCUS_CLASS =
    'focus-visible:bg-[#EDE7FF] focus-visible:text-[#45229E] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2';
const ACTION_CLASS = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#5833D6] hover:bg-[#F3F0FF] disabled:opacity-50 ${FOCUS_CLASS}`;

export function RequestCapacitySettings() {
    const sectionRef = useRef<HTMLElement>(null);
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
        <section
            ref={sectionRef}
            className="mt-6 min-w-0 rounded-xl bg-white p-4 sm:p-5 motion-reduce:[&_[role=listbox]]:animate-none [&_[role=option]]:min-h-11 [&_[role=option]]:whitespace-normal"
            aria-label={t('requestCapacity.title')}
        >
            {stateContent ?? (
                <>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="w-32 max-w-full">
                            <ShiftClassificationDropdown
                                value={String(teamId ?? '')}
                                options={teams.map((team) => ({value: String(team.shiftTeamId), label: team.name}))}
                                ariaLabel={t('requestCapacity.team')}
                                disabled={saving || teams.length === 1}
                                portalled={false}
                                className="h-11 min-h-11 font-apple text-sm font-semibold motion-reduce:transition-none"
                                onChange={(value) => {
                                    if (Number(value) === teamId) return;

                                    if (dirty && !window.confirm(t('requestCapacity.unsaved'))) return;

                                    setSelectedTeamId(Number(value));
                                }}
                            />
                        </div>
                        <div className="flex max-w-full min-w-0 items-center">
                            <RequestSettingsHelp label={t('requestCapacity.title')}>
                                {t('requestCapacity.capacityHelp')}
                            </RequestSettingsHelp>
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
                                className={`inline-flex min-h-11 max-w-full min-w-0 flex-wrap items-center gap-3 rounded-lg px-2 text-sm font-semibold text-[#36394B] disabled:opacity-50 ${FOCUS_CLASS}`}
                            >
                                <span className="min-w-0 text-left leading-5 break-words">{t('requestCapacity.limitLabel')}</span>
                                <span
                                    aria-hidden="true"
                                    className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 ${enabled ? 'bg-[#6242D9]' : 'bg-[#A0A4B3]'}`}
                                >
                                    <span className={`size-5 rounded-full bg-white ${enabled ? 'translate-x-4' : ''}`} />
                                </span>
                            </button>
                        </div>
                    </div>
                    {enabled ? (
                        <div className="mt-4">
                            <div className="grid grid-cols-1 gap-3">
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
                                <div className="mt-3 w-44 max-w-full">
                                    <ShiftClassificationDropdown
                                        value=""
                                        options={[
                                            {value: '', label: t('requestCapacity.addType')},
                                            ...unusedTypes.map((type) => ({
                                                value: String(type.wardShiftTypeId),
                                                label: `${type.shortName} · ${type.name}`,
                                            })),
                                        ]}
                                        ariaLabel={t('requestCapacity.addType')}
                                        disabled={saving}
                                        portalled={false}
                                        className="group h-auto min-h-11 justify-start gap-2 rounded-lg bg-transparent px-0 py-2 font-apple text-base font-medium text-gray-3 transition-colors hover:bg-transparent hover:text-[#4E586C] focus-visible:bg-[#F1F2F5] focus-visible:text-[#394153] focus-visible:ring-0 motion-reduce:transition-none"
                                        triggerContent={
                                            <>
                                                <span
                                                    aria-hidden="true"
                                                    className="flex size-[19px] shrink-0 items-center justify-center rounded-full bg-[#657084] transition-colors group-hover:bg-[#4E586C] group-focus-visible:bg-[#394153] motion-reduce:transition-none"
                                                >
                                                    <Plus className="size-[11px] text-white" />
                                                </span>
                                                <span className="text-left">{t('requestCapacity.addType')}</span>
                                            </>
                                        }
                                        onChange={(value) => {
                                            if (!value) return;

                                            const typeId = Number(value);

                                            newTypeFocusRef.current = typeId;
                                            setRows((previous) => [...previous, {wardShiftTypeId: typeId, teamMax: '', groups: []}]);

                                            if (errorKey !== 'stale') setErrorKey(null);
                                        }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {overflows.length > 0 ? (
                        <div className="mt-4 rounded-lg bg-orange-50 p-4 text-sm leading-6 text-orange-900" role="status">
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
                        <div className="mt-4 rounded-lg bg-[#FDECEB] p-4 text-sm leading-6 text-[#A52D26]" role="alert">
                            <p>{t(`requestCapacity.${errorKey}`)}</p>
                            {errorKey === 'stale' ? (
                                <button type="button" className={ACTION_CLASS} onClick={() => void reload()}>
                                    {t('requestCapacity.retry')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="mt-5 flex items-center justify-end gap-2">
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
                            disabled={saving || !dirty || settingsQuery.isFetching || errorKey === 'stale'}
                            className={`min-h-11 min-w-28 rounded-lg bg-[#6242D9] px-6 text-sm font-semibold text-white hover:bg-[#5434C5] disabled:bg-[#E8E8F0] disabled:text-[#626573] ${FOCUS_CLASS}`}
                            onClick={() => void save()}
                        >
                            {t(saving ? 'requestCapacity.saving' : dirty ? 'requestCapacity.save' : 'requestCapacity.savedLabel')}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
