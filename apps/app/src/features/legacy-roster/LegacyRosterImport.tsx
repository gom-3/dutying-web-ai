import {isAxiosError} from 'axios';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/shared/ui/primitives/button';
import {legacyRosterApi, parseRosterFile, type TImportResult, type TLegacyRosterApi, type TRosterFile} from './api';
import {legacyRosterCopy} from './copy';

type TPreview = {result: TImportResult; year?: number; hash?: string; file?: TRosterFile};
type TProps = {accountId: number; linked: boolean; onImported?: () => void; api?: TLegacyRosterApi};

/** Remount for a different account; never retain another account's preview. */
export function LegacyRosterImport(props: TProps) {
    return <ImportFlow key={props.accountId} {...props} />;
}

function ImportFlow({accountId, linked, onImported, api = legacyRosterApi}: TProps) {
    const {i18n} = useTranslation();
    const c = legacyRosterCopy(i18n.resolvedLanguage ?? i18n.language ?? 'ko');
    const [years, setYears] = useState<number[]>([]);
    const [year, setYear] = useState<number | undefined>();
    const [preview, setPreview] = useState<TPreview>();
    const [completed, setCompleted] = useState<TImportResult>();
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const active = useRef(true);

    useEffect(() => {
        active.current = true;

        return () => {
            active.current = false;
        };
    }, []);

    const reset = () => {
        setPreview(undefined);
        setCompleted(undefined);
        setError('');
    };
    const run = async (action: () => Promise<void>) => {
        if (lock.current || linked) return;

        lock.current = true;
        setBusy(true);
        setError('');

        try {
            await action();
        } catch (e) {
            if (active.current) {
                const status = isAxiosError(e) ? e.response?.status : undefined;

                setError(
                    status === 401 || status === 403
                        ? c.signIn
                        : status === 400
                          ? c.invalid
                          : e instanceof Error && !isAxiosError(e)
                            ? c.invalid
                            : c.failed,
                );

                if (status === 400) setPreview(undefined);
            }
        } finally {
            lock.current = false;

            if (active.current) setBusy(false);
        }
    };
    const find = () =>
        run(async () => {
            const data = await api.source(accountId);

            if (!active.current) return;

            reset();
            setYears(data.years);
            setYear(data.years[0]);
            setNotice(!data.available ? c.unavailable : data.years.length === 0 ? c.empty : c.found);
        });
    const sourcePreview = () =>
        run(async () => {
            if (year === undefined) return;

            const data = await api.previewSource(accountId, year);

            if (active.current) {
                reset();
                setPreview({year, hash: data.sourceHash, result: data.result});
            }
        });
    const choose = (file?: File) => {
        if (!file) return;

        return run(async () => {
            reset();

            const payload = await parseRosterFile(file);
            const data = await api.previewFile(accountId, payload);

            if (active.current) setPreview({file: payload, result: data});
        });
    };
    const commit = () =>
        run(async () => {
            if (!preview || preview.result.alreadyImported) return;

            const data = preview.file
                ? await api.commitFile(accountId, preview.file)
                : await api.commitSource(accountId, preview.year!, preview.hash!);

            if (active.current) {
                setCompleted(data);
                onImported?.();
            }
        });

    return (
        <section
            aria-label={c.title}
            className="space-y-4 rounded-2xl border border-gray-6 bg-white p-5 [&_button]:min-h-11"
            aria-busy={busy}
        >
            <h2 className="font-semibold text-sub-1">{c.title}</h2>
            <p className="text-sm text-sub-2">{c.description}</p>
            {linked ? (
                <p role="status">{c.linked}</p>
            ) : (
                <>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void find()}>
                        {c.find}
                    </Button>
                    {notice && (
                        <p role="status" className="text-sm">
                            {notice}
                        </p>
                    )}
                    {years.length > 0 && (
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="grid gap-1 text-sm">
                                {c.year}
                                <select
                                    className="min-h-11 rounded-lg border border-gray-6 px-3"
                                    value={year}
                                    disabled={busy}
                                    onChange={(e) => {
                                        setYear(Number(e.target.value));
                                        reset();
                                    }}
                                >
                                    {years.map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <Button type="button" variant="outline" disabled={busy} onClick={() => void sourcePreview()}>
                                {c.preview}
                            </Button>
                        </div>
                    )}
                    <label className="grid gap-2 text-sm">
                        {c.file}
                        <input
                            className="min-h-11 w-full"
                            type="file"
                            accept=".json,application/json"
                            disabled={busy}
                            onChange={(e) => {
                                const file = e.target.files?.[0];

                                e.target.value = '';
                                void choose(file);
                            }}
                        />
                    </label>
                    {busy && <p role="status">{c.busy}</p>}
                    {error && (
                        <p role="alert" className="text-sm text-red">
                            {error}
                        </p>
                    )}
                    {preview && !completed && (
                        <div className="space-y-3 rounded-xl bg-gray-7 p-4">
                            <p>{preview.year ? `${preview.year}년` : `${preview.file!.startDate} – ${preview.file!.endDate}`}</p>
                            <p>{c.summary(preview.result.importedShifts, preview.result.skippedShifts)}</p>
                            <p className="text-sm">{c.types(preview.result.createdShiftTypes, preview.result.reusedShiftTypes)}</p>
                            {preview.result.alreadyImported ? (
                                <p role="status">{c.already}</p>
                            ) : (
                                <Button type="button" disabled={busy} onClick={() => void commit()}>
                                    {c.commit}
                                </Button>
                            )}
                        </div>
                    )}
                    {completed && (
                        <p role="status">
                            {completed.alreadyImported ? c.already : c.complete}{' '}
                            {c.summary(completed.importedShifts, completed.skippedShifts)}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
