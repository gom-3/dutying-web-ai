import type {TSnapshotCellDTO} from '@dutying/api/ward';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {TResultVersion} from '../../../model/schedule-conversation-api';

/** The applied cell delta is more useful in the sidebar than a second full roster. */
export function AiConversationChanges({
    changedCells,
    sourceVersionId,
    loadVersion,
    nurseName,
    label,
    locale,
}: {
    changedCells: TSnapshotCellDTO[];
    sourceVersionId: string;
    loadVersion: (id: string) => Promise<TResultVersion>;
    nurseName: (id: number) => string;
    label: string;
    locale: string;
}) {
    const {t} = useTranslation();
    const [source, setSource] = useState<TResultVersion | null>(null);

    useEffect(() => {
        let active = true;

        void loadVersion(sourceVersionId)
            .then((version) => {
                if (active) setSource(version);
            })
            .catch(() => {
                if (active) setSource(null);
            });

        return () => {
            active = false;
        };
    }, [loadVersion, sourceVersionId]);

    if (!source || changedCells.length === 0) return null;

    const beforeByKey = new Map(source.cells.map((cell) => [`${cell.shiftNurseId}:${cell.date}`, cell]));
    const byNurse = new Map<number, TSnapshotCellDTO[]>();

    for (const cell of changedCells) {
        const cells = byNurse.get(cell.shiftNurseId) ?? [];

        cells.push(cell);
        byNurse.set(cell.shiftNurseId, cells);
    }

    const summaryClass =
        'min-h-11 cursor-pointer rounded-lg py-3 marker:text-[#473285] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#473285]';

    return (
        <section aria-label={label} className="rounded-xl bg-[#F7F5FF] p-3 text-[13px] leading-5">
            <details>
                <summary className={`${summaryClass} font-semibold text-[#473285]`}>
                    {label}
                    <span className="ml-2 font-normal">
                        {t('aiAdjust.evidence.changedSummary', {people: byNurse.size, count: changedCells.length})}
                    </span>
                </summary>
                <div className="mt-1 space-y-1">
                    {Array.from(byNurse, ([nurseId, cells]) => (
                        <details key={nurseId} className="border-t border-[#E8E2F5]">
                            <summary className={`${summaryClass} font-medium break-words text-[#475467]`}>
                                {nurseName(nurseId)}
                                <span className="ml-2 font-normal">{t('aiAdjust.evidence.changedCount', {count: cells.length})}</span>
                            </summary>
                            <ul className="space-y-2 pb-3 pl-4">
                                {[...cells]
                                    .sort((a, b) => a.date.localeCompare(b.date))
                                    .map((cell) => {
                                        const before = beforeByKey.get(`${cell.shiftNurseId}:${cell.date}`);
                                        const [, month, day] = cell.date.split('-');
                                        const date = locale.startsWith('ko')
                                            ? `${Number(month)}월 ${Number(day)}일`
                                            : new Intl.DateTimeFormat(locale, {month: 'numeric', day: 'numeric'}).format(
                                                  new Date(`${cell.date}T00:00:00`),
                                              );

                                        return (
                                            <li
                                                key={`${cell.shiftNurseId}:${cell.date}`}
                                                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
                                            >
                                                <span className="min-w-0 break-keep text-[#475467]">{date}</span>
                                                <strong className="whitespace-nowrap text-[#333D4B]">
                                                    {before?.shiftCode ?? '—'} → {cell.shiftCode ?? '—'}
                                                </strong>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </details>
                    ))}
                </div>
            </details>
        </section>
    );
}
