import {useEffect, useState} from 'react';
import {Link} from 'react-router';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AnnualLeavePersonDialog, type TAnnualLeavePersonView} from './person-dialog';
import type {useAnnualLeaveSchedule} from './queries';
import {AnnualLeaveCalculationNotes, AnnualLeavePersonActions} from './ui';

export function AnnualLeaveSchedulePanel({
    wardId,
    state,
    confirmed = false,
}: {
    wardId: number | null;
    state: ReturnType<typeof useAnnualLeaveSchedule>;
    confirmed?: boolean;
}) {
    const {t} = useTypedTranslation();
    const storageKey = `annual-leave-display:${wardId}`;
    const [visible, setVisible] = useState(false);
    const [selected, setSelected] = useState<{nurseId: number; view: TAnnualLeavePersonView} | null>(null);

    useEffect(() => {
        try {
            setVisible(localStorage.getItem(storageKey) === 'true');
        } catch {
            setVisible(false);
        }
    }, [storageKey]);

    const toggle = (next: boolean) => {
        setVisible(next);

        try {
            localStorage.setItem(storageKey, String(next));
        } catch {
            /* Display is still available without storage. */
        }
    };
    const selectedPerson = state.overview.data?.people.find((person) => person.nurseId === selected?.nurseId);
    const people = state.overview.data?.people ?? [];
    const requestIds = new Set(state.request?.cells.map((cell) => cell.nurseId) ?? []);
    const rowIds = [...state.counts.keys()];
    const previewById = new Map(state.data?.people.map((person) => [person.nurseId, person]) ?? []);
    const names = new Map(people.map((person) => [person.nurseId, person.name]));

    return (
        <section data-private-annual-leave className="my-2 w-full min-w-0 rounded-xl bg-white px-4 py-3 font-apple">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-sub-2">
                    <input type="checkbox" checked={visible} onChange={(e) => toggle(e.target.checked)} />
                    {t('annualLeave.show')}
                </label>
                {visible && (
                    <Link className="text-xs font-medium text-main-1" to="/ward-settings?tab=annualLeave">
                        {t('annualLeave.manage')}
                    </Link>
                )}
            </div>
            {visible && (
                <>
                    <p className="mt-3 text-xs leading-5 text-gray-3">
                        {t(confirmed ? 'annualLeave.confirmed' : 'annualLeave.preview')} ·{' '}
                        {t(
                            !state.managed
                                ? 'annualLeave.usageOnlyHint'
                                : confirmed
                                  ? 'annualLeave.confirmedHint'
                                  : 'annualLeave.previewHint',
                        )}
                    </p>
                    {(state.overview.isError || state.preview.isError) && (
                        <p role="alert" className="mt-2 text-xs text-red">
                            {t('annualLeave.error')}{' '}
                            <button
                                onClick={() => {
                                    void state.overview.refetch();

                                    if (state.managed) void state.preview.refetch();
                                }}
                            >
                                {t('annualLeave.retry')}
                            </button>
                        </p>
                    )}
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left text-sm">
                            <thead className="text-xs text-gray-3">
                                <tr>
                                    <th className="py-2">{t('annualLeave.name')}</th>
                                    <th>{t('annualLeave.month')}</th>
                                    {state.managed && <th>{t('annualLeave.remaining')}</th>}
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {rowIds
                                    .filter((id) => requestIds.has(id))
                                    .map((id) => {
                                        const person = previewById.get(id);
                                        const count = person?.monthDays ?? state.counts.get(id) ?? 0;

                                        return (
                                            <tr key={id} className="odd:bg-gray-7/50">
                                                <td className="py-2.5">{names.get(id) ?? state.names.get(id) ?? `#${id}`}</td>
                                                <td>{t('annualLeave.days', {count})}</td>
                                                {state.managed && (
                                                    <td
                                                        className={
                                                            person?.remainingDays != null && person.remainingDays < 0
                                                                ? 'text-red'
                                                                : 'text-sub-2'
                                                        }
                                                    >
                                                        {state.pending
                                                            ? t('annualLeave.calculating')
                                                            : person?.remainingDays == null
                                                              ? t('annualLeave.notEntered')
                                                              : t('annualLeave.days', {count: person.remainingDays})}
                                                        {!state.pending && person && !selected && (
                                                            <AnnualLeaveCalculationNotes checks={person.checks} />
                                                        )}
                                                    </td>
                                                )}
                                                <td>
                                                    {people.some((item) => item.nurseId === id) && (
                                                        <AnnualLeavePersonActions
                                                            name={names.get(id) ?? `#${id}`}
                                                            onEdit={
                                                                state.overview.data?.settings.enabled
                                                                    ? () => setSelected({nurseId: id, view: 'edit'})
                                                                    : undefined
                                                            }
                                                            onHistory={() => setSelected({nurseId: id, view: 'history'})}
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {state.data?.people.some(
                        (person) => requestIds.has(person.nurseId) && person.remainingDays != null && person.remainingDays < 0,
                    ) && <p className="mt-3 text-xs text-amber-800">{t('annualLeave.negative')}</p>}
                </>
            )}
            {wardId != null && selectedPerson && state.overview.data && (
                <AnnualLeavePersonDialog
                    wardId={wardId}
                    person={selectedPerson}
                    settings={state.overview.data.settings}
                    initialView={selected?.view}
                    onClose={() => setSelected(null)}
                />
            )}
        </section>
    );
}
