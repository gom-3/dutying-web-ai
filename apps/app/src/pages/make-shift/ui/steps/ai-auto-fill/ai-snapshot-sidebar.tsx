import {cn} from '@dutying/utils/style';
import {ChevronsRight, Loader2, Star} from 'lucide-react';
import {useMemo} from 'react';
import type {TSnapshotSummaryDto} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TAiSnapshotSidebarProps = {
    open: boolean;
    onClose: () => void;
    snapshots: TSnapshotSummaryDto[];
    isLoading: boolean;
    isError: boolean;
    activeSnapshotId: number | null;
    loadingSnapshotId: number | null;
    activeValidationSummary: {hardCount: number; softCount: number; totalCount: number} | null;
    onSelectSnapshot: (snapshotId: number) => void;
    onRetry: () => void;
};

function formatSnapshotTime(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return iso;

    const now = new Date();
    const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    const time = date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});

    if (isToday) {
        return `오늘 ${time}`;
    }

    return date.toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function SnapshotVersionLabel({index, title}: {index: number; title: string}) {
    const version = `V${index}`;

    if (title.startsWith(version)) return title;

    return `${version} · ${title}`;
}

export function AiSnapshotSidebar({
    open,
    onClose,
    snapshots,
    isLoading,
    isError,
    activeSnapshotId,
    loadingSnapshotId,
    activeValidationSummary,
    onSelectSnapshot,
    onRetry,
}: TAiSnapshotSidebarProps) {
    const {t} = useTypedTranslation();

    const orderedSnapshots = useMemo(() => snapshots, [snapshots]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60]"
            role="dialog"
            aria-modal="true"
            aria-label={t('page.makeShift.aiRefill.snapshotSidebar.title')}
        >
            <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/20"
                onClick={onClose}
                aria-label={t('page.makeShift.aiRefill.snapshotSidebar.close')}
            />
            <aside
                id="make_ai_snapshot_sidebar"
                className="absolute right-0 top-0 flex h-full w-[212px] flex-col overflow-hidden border-l border-gray-6 bg-white shadow-[-5px_0px_30px_#EDE9F5]"
            >
                <div className="relative px-[30px] pt-[60px]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute left-[30px] top-[60px] grid size-[30px] cursor-pointer place-items-center rounded-[8px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main-2"
                        aria-label={t('page.makeShift.aiRefill.snapshotSidebar.close')}
                    >
                        <ChevronsRight className="size-5" aria-hidden />
                    </button>
                    <h2 className="pt-[68px] font-apple text-[20px] font-semibold text-black">
                        {t('page.makeShift.aiRefill.snapshotSidebar.title')}
                    </h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-[30px] pb-[30px] pt-4">
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 py-10 text-gray-3">
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            <span className="font-apple text-[13px]">{t('page.makeShift.aiRefill.snapshotSidebar.loading')}</span>
                        </div>
                    )}

                    {isError && !isLoading && (
                        <div className="rounded-[12px] bg-gray-7 px-3 py-4 text-center">
                            <p className="font-apple text-[13px] text-gray-3">{t('page.makeShift.aiRefill.snapshotSidebar.error')}</p>
                            <button
                                type="button"
                                onClick={onRetry}
                                className="mt-2 cursor-pointer font-apple text-[13px] font-semibold text-main-1 underline-offset-2 hover:underline"
                            >
                                {t('page.state.retry')}
                            </button>
                        </div>
                    )}

                    {!isLoading && !isError && orderedSnapshots.length === 0 && (
                        <p className="px-2 py-8 text-center font-apple text-[13px] text-gray-3">
                            {t('page.makeShift.aiRefill.snapshotSidebar.empty')}
                        </p>
                    )}

                    {!isLoading && !isError && orderedSnapshots.length > 0 && (
                        <ul className="flex flex-col gap-4">
                            {orderedSnapshots.map((snapshot, index) => {
                                const versionIndex = orderedSnapshots.length - index;
                                const isActive = activeSnapshotId === snapshot.snapshotId;
                                const isLoadingItem = loadingSnapshotId === snapshot.snapshotId;
                                const summary = isActive ? activeValidationSummary : null;

                                return (
                                    <li key={snapshot.snapshotId}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectSnapshot(snapshot.snapshotId)}
                                            disabled={isLoadingItem}
                                            className={cn(
                                                'flex w-full flex-col items-stretch cursor-pointer rounded-[10px] bg-white p-[14px] text-left outline outline-1 outline-offset-[-1px] transition-colors hover:bg-gray-7 disabled:cursor-wait',
                                                isActive ? 'bg-[#FAF8FB] outline-main-1' : 'outline-gray-5',
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div
                                                    className={cn(
                                                        'min-w-0 truncate font-apple text-[20px] font-semibold',
                                                        isActive ? 'text-main-1' : 'text-black',
                                                    )}
                                                >
                                                    <SnapshotVersionLabel index={versionIndex} title={snapshot.title} />
                                                </div>
                                                <div className="grid size-6 shrink-0 place-items-center">
                                                    {isLoadingItem ? (
                                                        <Loader2 className="size-4 animate-spin text-main-1" aria-hidden />
                                                    ) : (
                                                        <Star className="size-4 text-gray-6" aria-hidden />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-1 font-apple text-[12px] font-medium text-gray-4">
                                                {formatSnapshotTime(snapshot.updatedAt)}
                                            </div>

                                            <div className="mt-4 flex flex-col items-stretch gap-2">
                                                <CountBadge
                                                    tone="red"
                                                    label={t('page.makeShift.aiRefill.snapshotSidebar.hardViolations', {
                                                        count: summary?.hardCount ?? 0,
                                                    })}
                                                />
                                                <CountBadge
                                                    tone="green"
                                                    label={t('page.makeShift.aiRefill.snapshotSidebar.softViolations', {
                                                        count: summary?.softCount ?? 0,
                                                    })}
                                                />
                                                <CountBadge
                                                    tone="blue"
                                                    label={t('page.makeShift.aiRefill.snapshotSidebar.totalViolations', {
                                                        count: summary?.totalCount ?? 0,
                                                    })}
                                                />
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </aside>
        </div>
    );
}

function CountBadge({tone, label}: {tone: 'red' | 'green' | 'blue'; label: string}) {
    const styles =
        tone === 'red'
            ? {bg: 'bg-[#FFE0E0]', dot: 'bg-[#FF0000]', text: 'text-[#FF0000]'}
            : tone === 'green'
              ? {bg: 'bg-[#D2F9CF]', dot: 'bg-[#1EE30D]', text: 'text-[#1DA811]'}
              : {bg: 'bg-[#CCD4FD]', dot: 'bg-[#0027F4]', text: 'text-[#0027F4]'};

    return (
        <span
            className={cn(
                'inline-flex w-full items-center gap-2 rounded-[7px] px-[10px] py-[5px] font-apple text-[12px] font-medium',
                styles.bg,
                styles.text,
            )}
        >
            <span className={cn('size-3 rounded-full', styles.dot)} aria-hidden />
            <span className="leading-none">{label}</span>
        </span>
    );
}
