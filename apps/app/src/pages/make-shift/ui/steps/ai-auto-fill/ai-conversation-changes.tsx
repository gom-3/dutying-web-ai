import {useEffect, useState} from 'react';
import type {TSnapshotCellDTO} from '@dutying/api/ward';
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

    return (
        <section aria-label={label} className="rounded-xl bg-[#F7F5FF] p-3 text-[13px] leading-5">
            <p className="mb-2 font-semibold text-[#473285]">{label}</p>
            <ul className="space-y-2">
                {changedCells.map((cell) => {
                    const before = beforeByKey.get(`${cell.shiftNurseId}:${cell.date}`);
                    const [, month, day] = cell.date.split('-');
                    const date = locale.startsWith('ko')
                        ? `${Number(month)}월 ${Number(day)}일`
                        : new Intl.DateTimeFormat(locale, {month: 'numeric', day: 'numeric'}).format(new Date(`${cell.date}T00:00:00`));

                    return (
                        <li key={`${cell.shiftNurseId}:${cell.date}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="min-w-0 break-keep text-[#475467]">
                                {nurseName(cell.shiftNurseId)} · {date}
                            </span>
                            <strong className="whitespace-nowrap text-[#333D4B]">
                                {before?.shiftCode ?? '—'} → {cell.shiftCode ?? '—'}
                            </strong>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
