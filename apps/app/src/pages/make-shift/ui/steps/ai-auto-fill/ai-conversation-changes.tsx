import type {TSnapshotCellDTO} from '@dutying/api/ward';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import type {TWardShiftType} from '@/entities/ward';
import type {TResultVersion} from '../../../model/schedule-conversation-api';

type TChangeShiftType = Pick<TWardShiftType, 'wardShiftTypeId' | 'shortName' | 'name' | 'color'>;

const FALLBACK_SHIFT_COLORS: Record<string, string> = {
    D: '#4DC2AD',
    E: '#FF8BA5',
    N: '#3580FF',
    O: '#465B7A',
};

function ChangeShiftChip({cell, shiftTypes}: {cell?: TSnapshotCellDTO; shiftTypes: TChangeShiftType[]}) {
    const {t} = useTranslation();
    const shiftType = shiftTypes.find((type) => type.wardShiftTypeId === cell?.wardShiftTypeId);
    const savedCode = cell?.shiftCode?.trim();
    const code = savedCode?.length ? savedCode : (shiftType?.shortName ?? '—');
    const color = shiftType?.color ?? FALLBACK_SHIFT_COLORS[code] ?? '#939BA9';
    const label = code === '—' ? t('aiAutofillUi.conversationResult.emptyShift') : (shiftType?.name ?? code);

    return (
        <ShiftBadge
            shiftType={code === '—' ? null : {shortName: code, color}}
            borderless
            title={label}
            className="mx-auto h-auto min-h-6 w-fit max-w-16 min-w-6 shrink-0 px-0.5 py-0.5 text-xs leading-4 break-all"
        />
    );
}

/** The applied cell delta is more useful in the sidebar than a second full roster. */
export function AiConversationChanges({
    changedCells,
    sourceVersionId,
    loadVersion,
    nurseName,
    label,
    locale,
    inline = false,
    shiftTypes = [],
}: {
    changedCells: TSnapshotCellDTO[];
    sourceVersionId: string;
    loadVersion: (id: string) => Promise<TResultVersion>;
    nurseName: (id: number) => string;
    label: string;
    locale: string;
    inline?: boolean;
    shiftTypes?: TChangeShiftType[];
}) {
    const {t} = useTranslation();
    const [source, setSource] = useState<TResultVersion | null>(null);
    const [sourceError, setSourceError] = useState(false);

    useEffect(() => {
        let active = true;

        setSourceError(false);

        void loadVersion(sourceVersionId)
            .then((version) => {
                if (active) setSource(version);
            })
            .catch(() => {
                if (active) {
                    setSource(null);
                    setSourceError(true);
                }
            });

        return () => {
            active = false;
        };
    }, [loadVersion, sourceVersionId]);

    if (changedCells.length === 0) return null;

    if (!source)
        return inline ? (
            <section aria-label={label}>
                <p role="status" className="text-xs leading-5 text-[#667085]">
                    {t(
                        sourceError
                            ? 'aiAutofillUi.scheduleSnapshotViewer.theEarlierScheduleCouldNotBeLoaded'
                            : 'aiAutofillUi.scheduleSnapshotViewer.loadingEarlierSchedule',
                    )}
                </p>
            </section>
        ) : null;

    const beforeByKey = new Map(source.cells.map((cell) => [`${cell.shiftNurseId}:${cell.date}`, cell]));
    const byNurse = new Map<number, TSnapshotCellDTO[]>();

    for (const cell of changedCells) {
        const cells = byNurse.get(cell.shiftNurseId) ?? [];

        cells.push(cell);
        byNurse.set(cell.shiftNurseId, cells);
    }

    const summaryClass =
        'group/disclosure flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sub-1 transition-colors hover:text-main-1 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none motion-reduce:transition-none forced-colors:focus-visible:outline-auto [&::-webkit-details-marker]:hidden';
    const rowLabelClass =
        'left-0 z-10 min-w-12 bg-[#F8F7FC] px-1 text-left text-[0.6875rem] leading-4 font-medium whitespace-nowrap text-[#667085] group-focus-visible/changes:bg-main-1 group-focus-visible/changes:text-white @min-[12rem]:sticky';
    const changes = (
        <div className="space-y-1">
            {Array.from(byNurse, ([nurseId, cells]) => {
                const sortedCells = [...cells].sort((a, b) => a.date.localeCompare(b.date));
                const comparisonLabel = `${nurseName(nurseId)} · ${label}`;

                return (
                    <details key={nurseId} className="group/nurse min-w-0 rounded-xl open:bg-[#F8F7FC]">
                        <summary className={`${summaryClass} font-medium group-open/nurse:font-semibold`}>
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="size-3 shrink-0 transition-transform group-open/nurse:rotate-90 motion-reduce:transition-none"
                            >
                                <path d="m7 4 6 6-6 6V4Z" />
                            </svg>
                            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="min-w-0 break-words group-hover/disclosure:underline">{nurseName(nurseId)}</span>
                                <span className="ml-auto shrink-0 text-xs font-normal text-[#667085] group-focus-visible/disclosure:text-white">
                                    {t('aiAdjust.evidence.changedCount', {count: cells.length})}
                                </span>
                            </span>
                        </summary>
                        <div className="px-2 pb-3">
                            <div
                                role="region"
                                aria-label={comparisonLabel}
                                tabIndex={0}
                                className="group/changes navigation-scrollbar forced-colors:focus-visible:outline-auto @container overflow-x-auto rounded-lg focus-visible:outline-none [&::-webkit-scrollbar]:h-1.5"
                            >
                                <table className="w-max text-center text-[0.6875rem] leading-4">
                                    <caption className="sr-only">{comparisonLabel}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" className={`${rowLabelClass} py-1`}>
                                                {t('aiConversationSidebar.authoring.date')}
                                            </th>
                                            {sortedCells.map((cell) => {
                                                const [, month, day] = cell.date.split('-');
                                                const date = locale.startsWith('ko')
                                                    ? `${Number(month)}/${Number(day)}`
                                                    : new Intl.DateTimeFormat(locale, {month: 'numeric', day: 'numeric'}).format(
                                                          new Date(`${cell.date}T00:00:00`),
                                                      );

                                                return (
                                                    <th
                                                        scope="col"
                                                        key={cell.date}
                                                        className="min-w-9 px-1 py-1 font-medium whitespace-nowrap text-[#475467]"
                                                    >
                                                        <time dateTime={cell.date} title={cell.date}>
                                                            {date}
                                                        </time>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th scope="row" className={rowLabelClass}>
                                                {t('aiAutofillUi.scheduleSnapshotViewer.before')}
                                            </th>
                                            {sortedCells.map((cell) => (
                                                <td key={cell.date} className="px-1 pt-0.5">
                                                    <ChangeShiftChip
                                                        cell={beforeByKey.get(`${cell.shiftNurseId}:${cell.date}`)}
                                                        shiftTypes={shiftTypes}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                        <tr aria-hidden="true">
                                            <td className={rowLabelClass} />
                                            {sortedCells.map((cell) => (
                                                <td key={cell.date} className="px-1 text-[0.625rem] leading-3 text-[#667085]">
                                                    ↓
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <th scope="row" className={rowLabelClass}>
                                                {t('aiAutofillUi.scheduleSnapshotViewer.after')}
                                            </th>
                                            {sortedCells.map((cell) => (
                                                <td key={cell.date} className="px-1 pb-1">
                                                    <ChangeShiftChip cell={cell} shiftTypes={shiftTypes} />
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </details>
                );
            })}
        </div>
    );

    return (
        <section aria-label={label} className="text-[0.8125rem] leading-5">
            {inline ? (
                changes
            ) : (
                <details>
                    <summary className={`${summaryClass} flex-wrap font-semibold`}>
                        {label}
                        <span className="font-normal">
                            {t('aiAdjust.evidence.changedSummary', {people: byNurse.size, count: changedCells.length})}
                        </span>
                    </summary>
                    {changes}
                </details>
            )}
        </section>
    );
}
