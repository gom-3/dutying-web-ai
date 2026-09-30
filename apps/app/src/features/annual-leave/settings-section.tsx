import type {TAnnualLeaveInitialization, TAnnualLeaveSettings} from '@dutying/api/ward';
import {Check, X} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import type {TShiftTeam, TWardShiftType} from '@/entities';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import ShiftClassificationDropdown from '@/shared/ui/ShiftClassificationDropdown';
import {showActionErrorFeedback, showValidationFeedback} from '@/shared/util/feedback';
import {AnnualLeaveActionsMenu} from './actions-menu';
import {canGrant, type TGrantMode} from './bulk-grant';
import {AnnualLeaveBulkGrantDialog} from './bulk-grant-dialog';
import {annualLeaveDate, annualLeaveUnits, canConfigureLeaveDeduction} from './model';
import {AnnualLeavePersonDialog, type TAnnualLeavePersonView} from './person-dialog';
import {useAnnualLeave, useRefreshAnnualLeave} from './queries';
import {AnnualLeaveSelectionCheckbox} from './selection-checkbox';
import {
    AnnualLeaveCalculationNotes,
    AnnualLeaveDialog,
    AnnualLeavePersonActions,
    annualButtonClass,
    annualInputClass,
    annualSecondaryClass,
    useAnnualLeaveRequestId,
} from './ui';

export function SettingsForm({
    wardId,
    settings,
    shiftTypes,
    onDone,
    onPause,
    onBusyChange,
}: {
    wardId: number;
    settings: TAnnualLeaveSettings;
    shiftTypes: TWardShiftType[];
    onDone: () => void;
    onPause?: () => void;
    onBusyChange?: (busy: boolean) => void;
}) {
    const {t} = useTypedTranslation();
    const today = annualLeaveDate();
    const start = settings.enabled ? (settings.startedOn ?? today) : today;
    const [values, setValues] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState(false);
    const requestId = useAnnualLeaveRequestId();
    const refresh = useRefreshAnnualLeave(wardId);
    const availableTypes = shiftTypes.filter(canConfigureLeaveDeduction);
    const initialIds = availableTypes
        .filter(
            (type) =>
                type.classification === 'ANNUAL_LEAVE' || settings.unitRules.some((rule) => rule.shiftTypeId === type.wardShiftTypeId),
        )
        .map((type) => type.wardShiftTypeId);
    const [shownIds, setShownIds] = useState<number[]>(initialIds);
    const annualTypes = shownIds.flatMap((id) => availableTypes.filter((type) => type.wardShiftTypeId === id));
    const remainingTypes = availableTypes.filter((type) => !shownIds.includes(type.wardShiftTypeId));
    const removedIds = new Set(initialIds.filter((id) => !shownIds.includes(id)));
    const editedIds = new Set(annualTypes.filter((type) => values[type.wardShiftTypeId] !== undefined).map((type) => type.wardShiftTypeId));
    const valid = [...editedIds].every((id) => /^\d+(?:\.\d{1,3})?$/.test(values[id] ?? '') && Number(values[id]) <= 10);
    const changed =
        removedIds.size > 0 ||
        shownIds.some((id) => !initialIds.includes(id)) ||
        [...editedIds].some(
            (id) =>
                Number(values[id]) !==
                    annualLeaveUnits(
                        annualTypes.find((type) => type.wardShiftTypeId === id),
                        today,
                        settings.unitRules,
                    ) || settings.unitRules.some((rule) => rule.shiftTypeId === id && rule.effectiveFrom !== null),
        );
    const rules = [
        ...settings.unitRules.filter((rule) => !editedIds.has(rule.shiftTypeId) && !removedIds.has(rule.shiftTypeId)),
        ...[...editedIds].map((shiftTypeId) => ({shiftTypeId, days: Number(values[shiftTypeId]), effectiveFrom: null})),
    ];
    const save = async (event: FormEvent) => {
        event.preventDefault();

        if (busy || !valid || (settings.enabled && !changed)) return;

        setBusy(true);
        onBusyChange?.(true);

        try {
            const payload = {version: settings.version, enabled: true, startedOn: start, reviewOn: null, unitRules: rules};

            await WardAPI.updateAnnualLeaveSettings(wardId, {...payload, requestId: requestId(payload)});
            await refresh();
            onDone();
        } catch (error) {
            showActionErrorFeedback(error, t('annualLeave.saveError'));
            await refresh();
        } finally {
            setBusy(false);
            onBusyChange?.(false);
        }
    };

    return (
        <form onSubmit={(e) => void save(e)} className="flex flex-col">
            <p className="text-sm leading-5 break-keep text-sub-2">{t('annualLeave.settingsIntro')}</p>
            <section aria-label={t('annualLeave.units')} className="mt-6">
                <div className="mb-2 flex items-center justify-between px-3 text-xs text-gray-3" aria-hidden="true">
                    <span>{t('annualLeave.settingsTypeLabel')}</span>
                    <span className="mr-9">{t('annualLeave.deductionDays')}</span>
                </div>
                <div className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto">
                    {!annualTypes.length && <p className="py-4 text-center text-sm text-sub-2">{t('annualLeave.addTypeEmpty')}</p>}
                    {annualTypes.map((type) => {
                        const scheduled = settings.unitRules.some(
                            (rule) =>
                                rule.shiftTypeId === type.wardShiftTypeId && rule.effectiveFrom !== null && rule.effectiveFrom > today,
                        );
                        const value = values[type.wardShiftTypeId];
                        const invalid = value !== undefined && (!/^\d+(?:\.\d{1,3})?$/.test(value) || Number(value) > 10);

                        return (
                            <div key={type.wardShiftTypeId} className="rounded-xl bg-gray-7 px-3 py-2">
                                <div className="flex min-h-11 items-center gap-2">
                                    <label htmlFor={`deduct-${type.wardShiftTypeId}`} className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-sub-1">{type.name}</span>
                                        <span className="text-[11px] text-gray-3">
                                            {t(
                                                type.classification === 'ANNUAL_LEAVE'
                                                    ? 'feature.createShiftModal.classification.annualLeave'
                                                    : type.classification === 'OFF'
                                                      ? 'feature.createShiftModal.classification.off'
                                                      : 'feature.createShiftModal.classification.otherLeave',
                                            )}
                                        </span>
                                    </label>
                                    <div
                                        className={`flex h-11 w-24 shrink-0 items-center gap-1 rounded-lg px-2 focus-within:bg-main-4 focus-within:text-main-1 ${invalid ? 'bg-red/10 text-red' : 'bg-white text-sub-1'}`}
                                    >
                                        <input
                                            id={`deduct-${type.wardShiftTypeId}`}
                                            aria-label={`${type.name} ${t('annualLeave.deductionDays')}`}
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.001"
                                            required
                                            disabled={busy}
                                            aria-invalid={invalid}
                                            aria-describedby={invalid ? `annual-rule-error-${type.wardShiftTypeId}` : undefined}
                                            value={value ?? annualLeaveUnits(type, today, settings.unitRules)}
                                            onChange={(event) =>
                                                setValues((previous) => ({...previous, [type.wardShiftTypeId]: event.target.value}))
                                            }
                                            className="h-full min-w-0 flex-1 appearance-none bg-transparent text-right text-base font-semibold tabular-nums outline-none disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
                                        <span className="text-xs">{t('annualLeave.dayUnit')}</span>
                                    </div>
                                    {type.classification !== 'ANNUAL_LEAVE' ? (
                                        <button
                                            type="button"
                                            aria-label={`${type.name} ${t('annualLeave.remove')}`}
                                            disabled={busy}
                                            onClick={() => {
                                                setShownIds((ids) => ids.filter((id) => id !== type.wardShiftTypeId));
                                                setValues((previous) => {
                                                    const next = {...previous};

                                                    delete next[type.wardShiftTypeId];

                                                    return next;
                                                });
                                            }}
                                            className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg text-gray-3 hover:text-red focus-visible:bg-red/10 focus-visible:text-red focus-visible:outline-none"
                                        >
                                            <X aria-hidden size={16} />
                                        </button>
                                    ) : (
                                        <span className="w-8 shrink-0" />
                                    )}
                                </div>
                                {invalid && (
                                    <p id={`annual-rule-error-${type.wardShiftTypeId}`} className="mt-1 text-xs leading-5 text-red">
                                        {t('annualLeave.ruleInputError')}
                                    </p>
                                )}
                                {scheduled && <p className="mt-1 text-xs leading-5 text-amber-800">{t('annualLeave.scheduledRuleHint')}</p>}
                            </div>
                        );
                    })}
                </div>
                {remainingTypes.length > 0 && (
                    <div className="mt-3">
                        <ShiftClassificationDropdown
                            value=""
                            ariaLabel={t('annualLeave.addLeaveType')}
                            disabled={busy}
                            portalled={false}
                            options={[
                                {value: '', label: t('annualLeave.addLeaveType')},
                                ...remainingTypes.map((type) => ({
                                    value: String(type.wardShiftTypeId),
                                    label: `${type.name} · ${t(type.classification === 'OFF' ? 'feature.createShiftModal.classification.off' : 'feature.createShiftModal.classification.otherLeave')}`,
                                })),
                            ]}
                            onChange={(value) => {
                                if (!value) return;

                                const id = Number(value);

                                setShownIds((ids) => [...ids, id]);
                                setValues((previous) => ({
                                    ...previous,
                                    [id]: String(
                                        annualLeaveUnits(
                                            availableTypes.find((type) => type.wardShiftTypeId === id),
                                            today,
                                            settings.unitRules,
                                        ),
                                    ),
                                }));
                            }}
                            className="bg-transparent text-sm text-main-1 hover:bg-main-4"
                        />
                    </div>
                )}
            </section>
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-gray-7 px-3 py-3">
                <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-gray-3 font-serif text-xs font-bold text-white"
                >
                    i
                </span>
                <p className="text-xs leading-5 break-keep text-sub-2">{t('annualLeave.settingsApplyHint')}</p>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                    {onPause && settings.enabled && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onPause}
                            className="min-h-11 rounded-lg px-2 text-sm text-gray-3 hover:text-red focus-visible:bg-red/10 focus-visible:text-red focus-visible:outline-none disabled:opacity-50"
                        >
                            {t('annualLeave.pause')}
                        </button>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={busy || !valid || (settings.enabled && !changed)}
                    className={`${annualButtonClass} min-h-11 min-w-24 focus-visible:bg-sub-1 focus-visible:text-white focus-visible:outline-none`}
                >
                    {t(busy ? 'annualLeave.saving' : settings.enabled ? 'annualLeave.save' : 'annualLeave.start')}
                </button>
            </div>
        </form>
    );
}

export function AnnualLeaveSettingsSection({
    wardId,
    shiftTypes,
    shiftTeams,
}: {
    wardId: number | null;
    shiftTypes: TWardShiftType[];
    shiftTeams: TShiftTeam[];
}) {
    const {t} = useTypedTranslation();
    const today = annualLeaveDate();
    const query = useAnnualLeave(wardId, today, today);
    const refresh = useRefreshAnnualLeave(wardId ?? -1);
    const [search, setSearch] = useState('');
    const [team, setTeam] = useState('');
    const [selected, setSelected] = useState<{nurseId: number; view: TAnnualLeavePersonView} | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [grantMode, setGrantMode] = useState<TGrantMode>('GRANT');
    const [showGrant, setShowGrant] = useState(false);
    const [grantSelected, setGrantSelected] = useState<number[]>([]);
    const [grantPending, setGrantPending] = useState(false);
    const [pause, setPause] = useState(false);
    const [busy, setBusy] = useState(false);
    const [bulkDays, setBulkDays] = useState<Record<number, string>>({});
    const requestId = useAnnualLeaveRequestId();
    const data = query.data;
    const selectedPerson = data?.people.find((person) => person.nurseId === selected?.nurseId);
    const eligible =
        data?.people.filter((person) => person.active && (person.openingDays == null || person.checks.includes('RESTART_REQUIRED'))) ?? [];

    if (wardId == null) return null;

    if (query.isPending) return <p className="p-6 text-gray-3">{t('annualLeave.loading')}</p>;

    if (query.isError || !data)
        return (
            <div role="alert" className="min-w-0 rounded-2xl bg-white p-4 sm:p-6">
                <p>{t('annualLeave.error')}</p>
                <button className={`${annualSecondaryClass} mt-4`} onClick={() => void query.refetch()}>
                    {t('annualLeave.retry')}
                </button>
            </div>
        );

    if (!data.settings.available) return <div className="rounded-2xl bg-white p-6 text-sm text-gray-3">{t('annualLeave.unavailable')}</div>;

    const changePaused = async () => {
        setBusy(true);

        try {
            const payload = {
                version: data.settings.version,
                enabled: false,
                startedOn: data.settings.startedOn!,
                reviewOn: null,
                unitRules: data.settings.unitRules,
            };

            await WardAPI.updateAnnualLeaveSettings(wardId, {...payload, requestId: requestId(payload)});
            await refresh();
            setPause(false);
        } catch (error) {
            showActionErrorFeedback(error, t('annualLeave.saveError'));
            await refresh();
        } finally {
            setBusy(false);
        }
    };
    const applyBulk = async () => {
        const entries: TAnnualLeaveInitialization[] = eligible
            .filter((person) => (bulkDays[person.nurseId] ?? '').trim() !== '')
            .map((person) => ({
                nurseId: person.nurseId,
                version: person.version,
                startedOn: annualLeaveDate(),
                remainingDays: Number(bulkDays[person.nurseId]),
                balanceBasis: 'TODAY_INCLUDED',
                includedPlannedDates: [],
                reviewOn: null,
                reason: t('annualLeave.bulk'),
            }));

        if (
            busy ||
            !entries.length ||
            entries.some((entry) => !Number.isFinite(entry.remainingDays) || Math.abs(entry.remainingDays!) > 99999)
        )
            return;

        setBusy(true);

        try {
            await WardAPI.initializeAnnualLeave(wardId, {requestId: requestId(entries), entries});
            await refresh();
            setShowBulk(false);
            setBulkDays({});
        } catch (error) {
            showActionErrorFeedback(error, t('annualLeave.saveError'));
            await refresh();
        } finally {
            setBusy(false);
        }
    };
    const people = data.people.filter(
        (person) =>
            person.active &&
            (!team || person.shiftTeamId === Number(team)) &&
            person.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    );
    const grantable = people.filter(canGrant);
    const allGrantedSelected = grantable.length > 0 && grantable.every((person) => grantSelected.includes(person.nurseId));

    return (
        <div className="flex w-full min-w-0 flex-col gap-4 font-apple">
            <div className="min-w-0 rounded-2xl bg-white p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-3">
                        {t(
                            data.settings.enabled
                                ? 'annualLeave.scope'
                                : data.settings.startedOn
                                  ? 'annualLeave.paused'
                                  : 'annualLeave.start',
                            {
                                today: data.today,
                            },
                        )}
                    </p>
                    {data.settings.startedOn && (
                        <div className="flex items-center gap-3">
                            {grantSelected.length > 0 && (
                                <span className="text-sm font-medium text-main-1">
                                    {t('annualLeave.bulkGrant.selection', {count: grantSelected.length})}
                                </span>
                            )}
                            <AnnualLeaveActionsMenu
                                items={[
                                    ...(data.settings.enabled
                                        ? [
                                              {
                                                  label: t('annualLeave.bulk'),
                                                  onSelect: () => {
                                                      setShowBulk(true);
                                                      setBulkDays({});
                                                  },
                                              },
                                              ...(grantPending
                                                  ? [{label: t('annualLeave.bulkGrant.resume'), onSelect: () => setShowGrant(true)}]
                                                  : []),
                                              {
                                                  label: t('annualLeave.bulkGrant.title'),
                                                  disabled: !grantSelected.length || grantPending,
                                                  onDisabledSelect:
                                                      !grantPending && !grantSelected.length
                                                          ? () => showValidationFeedback(t('annualLeave.bulkGrant.menuHint'))
                                                          : undefined,
                                                  onSelect: () => {
                                                      setGrantMode('GRANT');
                                                      setShowGrant(true);
                                                  },
                                              },
                                              {
                                                  label: t('annualLeave.bulkDeduct.title'),
                                                  disabled: !grantSelected.length || grantPending,
                                                  onDisabledSelect:
                                                      !grantPending && !grantSelected.length
                                                          ? () => showValidationFeedback(t('annualLeave.bulkGrant.menuHint'))
                                                          : undefined,
                                                  onSelect: () => {
                                                      setGrantMode('SETTLEMENT');
                                                      setShowGrant(true);
                                                  },
                                              },
                                          ]
                                        : []),
                                    {
                                        label: t(data.settings.enabled ? 'annualLeave.settings' : 'annualLeave.resume'),
                                        onSelect: () => setShowSettings(true),
                                    },
                                ]}
                            />
                        </div>
                    )}
                </div>
                {!data.settings.startedOn ? (
                    <>
                        <p className="mt-2 mb-6 text-sm leading-6 text-gray-3">{t('annualLeave.startHint')}</p>
                        <SettingsForm wardId={wardId} settings={data.settings} shiftTypes={shiftTypes} onDone={() => {}} />
                    </>
                ) : (
                    <>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            <input
                                aria-label={t('annualLeave.search')}
                                placeholder={t('annualLeave.search')}
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setGrantSelected([]);
                                }}
                                className={`${annualInputClass} h-10 max-w-48 rounded-[10px] py-0`}
                            />
                            <div className="w-40 shrink-0">
                                <ShiftClassificationDropdown
                                    ariaLabel={t('annualLeave.allTeams')}
                                    value={team}
                                    options={[
                                        {value: '', label: t('annualLeave.allTeams')},
                                        ...shiftTeams.map((item) => ({value: String(item.shiftTeamId), label: item.name})),
                                    ]}
                                    onChange={(value) => {
                                        setTeam(value);
                                        setGrantSelected([]);
                                    }}
                                    className="justify-start font-apple text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[600px] text-left text-sm">
                                <thead className="text-xs text-gray-3">
                                    <tr>
                                        {data.settings.enabled && (
                                            <th className="w-11 px-2">
                                                <AnnualLeaveSelectionCheckbox
                                                    label={t('annualLeave.bulkGrant.selectAll')}
                                                    indeterminate={
                                                        !allGrantedSelected &&
                                                        grantable.some((person) => grantSelected.includes(person.nurseId))
                                                    }
                                                    checked={allGrantedSelected}
                                                    disabled={!grantable.length}
                                                    onChange={(checked) =>
                                                        setGrantSelected(checked ? grantable.map((person) => person.nurseId) : [])
                                                    }
                                                />
                                            </th>
                                        )}
                                        {['name', 'current', 'used', 'planned', 'remaining', 'details'].map((key) => (
                                            <th
                                                className={`px-3 py-2 whitespace-nowrap ${key === 'name' ? 'text-left' : key === 'details' ? 'text-center' : 'text-right'} ${key === 'current' ? 'pr-12 font-semibold text-main-1' : ''}`}
                                                key={key}
                                            >
                                                {t(`annualLeave.${key}`)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {people.map((person) => (
                                        <tr
                                            key={person.nurseId}
                                            className={grantSelected.includes(person.nurseId) ? 'bg-main-4' : 'odd:bg-gray-7/50'}
                                        >
                                            {data.settings.enabled && (
                                                <td className="px-2">
                                                    <AnnualLeaveSelectionCheckbox
                                                        label={t('annualLeave.bulkGrant.select', {name: person.name})}
                                                        title={!canGrant(person) ? t('annualLeave.bulkGrant.unavailable') : undefined}
                                                        disabled={!canGrant(person)}
                                                        checked={grantSelected.includes(person.nurseId)}
                                                        onChange={(checked) =>
                                                            setGrantSelected((previous) =>
                                                                checked
                                                                    ? [...previous, person.nurseId]
                                                                    : previous.filter((id) => id !== person.nurseId),
                                                            )
                                                        }
                                                    />
                                                </td>
                                            )}
                                            <td className="px-3 py-1 font-medium">{person.name}</td>
                                            {[person.currentDays, person.usedDays, person.plannedDays, person.remainingDays].map(
                                                (value, index) => (
                                                    <td
                                                        key={index}
                                                        className={`px-3 py-1 text-right whitespace-nowrap tabular-nums ${index === 0 ? 'pr-12 text-base font-bold' : ''} ${value != null && value < 0 ? 'text-red' : index === 0 && value != null ? 'text-main-1' : 'text-sub-2'}`}
                                                    >
                                                        <span className="relative inline-block">
                                                            {value == null
                                                                ? t('annualLeave.notEntered')
                                                                : t('annualLeave.days', {count: value})}
                                                            {index === 0 &&
                                                                !selected &&
                                                                !showSettings &&
                                                                !showBulk &&
                                                                !showGrant &&
                                                                !pause && (
                                                                    <span className="absolute top-1/2 left-full inline-flex -translate-y-1/2">
                                                                        <AnnualLeaveCalculationNotes checks={person.checks} />
                                                                    </span>
                                                                )}
                                                        </span>
                                                    </td>
                                                ),
                                            )}
                                            <td className="px-3 py-1 [&>div]:justify-center">
                                                <AnnualLeavePersonActions
                                                    name={person.name}
                                                    onEdit={
                                                        data.settings.enabled
                                                            ? () => setSelected({nurseId: person.nurseId, view: 'edit'})
                                                            : undefined
                                                    }
                                                    onHistory={() => setSelected({nurseId: person.nurseId, view: 'history'})}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {!people.length && <p className="py-6 text-center text-sm text-gray-3">{t('annualLeave.empty')}</p>}
                    </>
                )}
            </div>
            <AnnualLeaveBulkGrantDialog
                key={wardId}
                wardId={wardId}
                open={showGrant}
                people={data.people}
                selectedIds={grantSelected}
                mode={grantMode}
                onClose={() => setShowGrant(false)}
                onComplete={() => setGrantSelected([])}
                onPendingChange={setGrantPending}
            />
            {showSettings && (
                <AnnualLeaveDialog compact title={t('annualLeave.settings')} onClose={() => setShowSettings(false)} busy={settingsBusy}>
                    <SettingsForm
                        wardId={wardId}
                        settings={data.settings}
                        shiftTypes={shiftTypes}
                        onDone={() => setShowSettings(false)}
                        onBusyChange={setSettingsBusy}
                        onPause={() => {
                            setShowSettings(false);
                            setPause(true);
                        }}
                    />
                </AnnualLeaveDialog>
            )}
            {selectedPerson && (
                <AnnualLeavePersonDialog
                    key={selectedPerson.nurseId}
                    wardId={wardId}
                    person={selectedPerson}
                    settings={data.settings}
                    initialView={selected?.view}
                    onClose={() => setSelected(null)}
                />
            )}
            {showBulk && (
                <AnnualLeaveDialog title={t('annualLeave.bulk')} onClose={() => setShowBulk(false)} busy={busy}>
                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void applyBulk();
                        }}
                    >
                        {eligible.length > 0 && (
                            <>
                                <p className="text-sm leading-5 break-keep text-sub-2">{t('annualLeave.bulkHint')}</p>
                                <p className="text-xs text-gray-3">{t('annualLeave.todayBasis', {date: today})}</p>
                            </>
                        )}
                        <div className="max-h-80 overflow-y-auto py-1">
                            {eligible.length === 0 && (
                                <div role="status" className="flex flex-col items-center px-4 py-7 text-center">
                                    <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-main-4 text-main-1">
                                        <Check size={24} aria-hidden="true" />
                                    </span>
                                    <h3 className="text-base font-semibold text-sub-1">{t('annualLeave.bulkEmptyTitle')}</h3>
                                    <p className="mt-2 text-sm leading-5 break-keep text-sub-2">{t('annualLeave.bulkEmpty')}</p>
                                </div>
                            )}
                            {eligible.map((person) => (
                                <label key={person.nurseId} className="flex items-center justify-between gap-4 px-2 py-2 text-sm">
                                    <span>{person.name}</span>
                                    <span className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            aria-label={`${person.name} ${t('annualLeave.current')}`}
                                            min="-99999"
                                            max="99999"
                                            step="0.001"
                                            disabled={busy}
                                            value={bulkDays[person.nurseId] ?? ''}
                                            onChange={(event) =>
                                                setBulkDays((previous) => ({...previous, [person.nurseId]: event.target.value}))
                                            }
                                            className="h-11 w-28 rounded-lg bg-main-4 px-3 text-right text-base font-semibold text-sub-1 tabular-nums transition-colors hover:bg-main-light focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
                                        />
                                        <span className="text-sub-2">{t('annualLeave.dayUnit')}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" className={annualSecondaryClass} disabled={busy} onClick={() => setShowBulk(false)}>
                                {t('annualLeave.close')}
                            </button>
                            {eligible.length > 0 && (
                                <button
                                    type="submit"
                                    className={annualButtonClass}
                                    disabled={busy || !eligible.some((person) => (bulkDays[person.nurseId] ?? '').trim() !== '')}
                                >
                                    {t(busy ? 'annualLeave.saving' : 'annualLeave.bulkRegister')}
                                </button>
                            )}
                        </div>
                    </form>
                </AnnualLeaveDialog>
            )}
            <ConfirmActionDialog
                open={pause}
                title={t('annualLeave.pauseTitle')}
                description={t('annualLeave.pauseHint')}
                confirmLabel={t(busy ? 'annualLeave.saving' : 'annualLeave.pause')}
                onClose={() => {
                    if (!busy) setPause(false);
                }}
                onConfirm={() => {
                    if (!busy) void changePaused();
                }}
            />
        </div>
    );
}
