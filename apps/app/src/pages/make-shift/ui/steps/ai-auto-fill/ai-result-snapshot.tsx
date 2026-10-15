import * as Dialog from '@radix-ui/react-dialog';
import {useState} from 'react';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

/** Captured data only: viewing a past result never reads or writes the live editor. */
export function AiResultSnapshot({doc}: {doc: TDutyDoc}) {
    const [open, setOpen] = useState(false);
    const {t} = useTypedTranslation();
    const month = doc.columns[0]?.slice(0, 7) ?? '';
    const table = (preview: boolean) => (
        <table className="w-full border-collapse text-center text-xs" aria-label={t('aiAdjust.snapshot.title')}>
            <thead>
                <tr>
                    <th className="border border-gray-6 p-2">{t('aiAdjust.snapshot.name')}</th>
                    {(preview ? doc.columns.slice(0, 7) : doc.columns).map((date) => (
                        <th key={date} className="min-w-8 border border-gray-6 p-1">
                            {Number(date.slice(-2))}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {(preview ? doc.rows.slice(0, 4) : doc.rows).map((row) => (
                    <tr key={row.workerId}>
                        <th className="border border-gray-6 p-2 font-normal whitespace-nowrap">
                            {doc.workerMeta[row.workerId]?.name ?? row.workerId}
                        </th>
                        {(preview ? doc.columns.slice(0, 7) : doc.columns).map((date, index) => (
                            <td key={date} className="border border-gray-6 bg-main-light/30 p-1">
                                {row.cells[index] ?? '—'}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <div className="ml-8 overflow-hidden rounded-xl border border-gray-5 bg-white p-3">
                <p className="mb-2 text-sm font-medium">
                    {month} · {t('aiAdjust.snapshot.title')}
                </p>
                <div aria-hidden="true" className="pointer-events-none overflow-hidden">
                    {table(true)}
                </div>
                <p className="mt-2 text-xs text-gray-4">{t('aiAdjust.snapshot.note')}</p>
                <Dialog.Trigger asChild>
                    <button
                        type="button"
                        className="mt-2 min-h-11 w-full rounded-lg bg-main-light px-3 py-2 text-sm font-medium text-main-1"
                    >
                        {t('aiAdjust.snapshot.open')}
                    </button>
                </Dialog.Trigger>
            </div>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[1500] bg-black/20" />
                <Dialog.Content
                    className="fixed inset-4 z-[1501] flex flex-col rounded-xl bg-white p-5 shadow-xl"
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <Dialog.Title className="text-lg font-semibold">
                                {month} · {t('aiAdjust.snapshot.title')}
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-gray-4">{t('aiAdjust.snapshot.readonly')}</Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button type="button" className="min-h-11 rounded-lg border border-gray-5 px-4">
                                {t('aiAdjust.snapshot.close')}
                            </button>
                        </Dialog.Close>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">{table(false)}</div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
