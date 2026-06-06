import type {TSnapshotSummaryDto} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {CheckCircle2, ChevronRight, Clock, Loader2, PanelRightClose, RotateCcw, Trash2} from 'lucide-react';
import {useMemo, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TAiSnapshotSidebarProps = {
    open: boolean;
    onClose: () => void;
    snapshots: TSnapshotSummaryDto[];
    isLoading: boolean;
    isError: boolean;
    activeSnapshotId: number | null;
    loadingSnapshotId: number | null;
    deletingSnapshotId: number | null;
    onSelectSnapshot: (snapshotId: number) => void;
    onRenameSnapshot: (snapshotId: number, title: string) => Promise<void>;
    onRequestDeleteSnapshot: (snapshot: TSnapshotSummaryDto) => void;
    onRetry: () => void;
};

function formatSnapshotTime(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return iso;

    const now = new Date();
    const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
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

function getSnapshotTitle(index: number, title: string, defaultTitle: string) {
    const fallbackTitle = `V${index}`;
    const trimmedTitle = title.trim();

    if (!trimmedTitle || trimmedTitle === defaultTitle) return fallbackTitle;

    return trimmedTitle;
}

export function AiSnapshotSidebar({
    open,
    onClose,
    snapshots,
    isLoading,
    isError,
    activeSnapshotId,
    loadingSnapshotId,
    deletingSnapshotId,
    onSelectSnapshot,
    onRenameSnapshot,
    onRequestDeleteSnapshot,
    onRetry,
}: TAiSnapshotSidebarProps) {
    const {t} = useTypedTranslation();
    const orderedSnapshots = useMemo(() => snapshots, [snapshots]);
    const [draftTitles, setDraftTitles] = useState<Record<number, string>>({});
    const [renamingSnapshotId, setRenamingSnapshotId] = useState<number | null>(null);
    const commitTitle = async (snapshotId: number, currentTitle: string, nextTitle: string) => {
        const trimmedTitle = nextTitle.trim() || currentTitle;

        if (trimmedTitle === currentTitle) {
            setDraftTitles((prev) => ({...prev, [snapshotId]: currentTitle}));

            return;
        }

        setRenamingSnapshotId(snapshotId);

        try {
            await onRenameSnapshot(snapshotId, trimmedTitle);
            setDraftTitles((prev) => ({...prev, [snapshotId]: trimmedTitle}));
        } catch {
            setDraftTitles((prev) => ({...prev, [snapshotId]: currentTitle}));
        } finally {
            setRenamingSnapshotId(null);
        }
    };

    if (!open) return null;

    return (
        <aside
            id="make_ai_snapshot_sidebar"
            className="ai-snapshot-sidebar fixed top-0 right-0 z-[998] flex h-screen w-[304px] animate-in flex-col overflow-hidden border-l border-gray-6 bg-[#FBFCFF] shadow-[-10px_0_30px_rgba(61,70,88,0.08)] duration-200 fade-in slide-in-from-right-4"
            role="complementary"
            aria-label={t('page.makeShift.aiRefill.snapshotSidebar.title')}
        >
            <div className="border-b border-gray-6 bg-white px-5 pt-5 pb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate font-apple text-[20px] leading-7 font-bold text-sub-1">
                            {t('page.makeShift.aiRefill.snapshotSidebar.title')}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[10px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:outline-none"
                        aria-label={t('page.makeShift.aiRefill.snapshotSidebar.close')}
                    >
                        <PanelRightClose className="size-[18px]" aria-hidden />
                    </button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-5">
                {isLoading && (
                    <div className="flex items-center justify-center gap-2 rounded-[12px] bg-white px-4 py-8 text-gray-3 ring-1 ring-gray-6">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        <span className="font-apple text-[13px] font-medium">{t('page.makeShift.aiRefill.snapshotSidebar.loading')}</span>
                    </div>
                )}

                {isError && !isLoading && (
                    <div className="rounded-[12px] bg-white px-4 py-5 text-center ring-1 ring-gray-6">
                        <p className="font-apple text-[13px] leading-5 font-medium text-gray-3">
                            {t('page.makeShift.aiRefill.snapshotSidebar.error')}
                        </p>
                        <button
                            type="button"
                            onClick={onRetry}
                            className="mt-3 inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] bg-main-light px-3 font-apple text-[13px] font-bold text-main-1 transition-colors hover:bg-main-4 focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:outline-none"
                        >
                            <RotateCcw className="size-3.5" aria-hidden />
                            {t('page.state.retry')}
                        </button>
                    </div>
                )}

                {!isLoading && !isError && orderedSnapshots.length === 0 && (
                    <div className="rounded-[14px] border border-dashed border-gray-6 bg-white px-5 py-8 text-center">
                        <p className="font-apple text-[14px] leading-6 font-semibold text-sub-2">
                            {t('page.makeShift.aiRefill.snapshotSidebar.empty')}
                        </p>
                    </div>
                )}

                {!isLoading && !isError && orderedSnapshots.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {orderedSnapshots.map((snapshot, index) => {
                            const versionIndex = orderedSnapshots.length - index;
                            const isActive = activeSnapshotId === snapshot.snapshotId;
                            const isLoadingItem = loadingSnapshotId === snapshot.snapshotId;
                            const isDeletingItem = deletingSnapshotId === snapshot.snapshotId;
                            const isRenamingItem = renamingSnapshotId === snapshot.snapshotId;
                            const currentTitle = getSnapshotTitle(
                                versionIndex,
                                snapshot.title,
                                t('page.makeShift.aiRefill.snapshotSidebar.defaultTitle'),
                            );
                            const draftTitle = draftTitles[snapshot.snapshotId] ?? currentTitle;
                            const hardViolationCount = snapshot.hardCount ?? 0;
                            const softViolationCount = snapshot.softCount ?? 0;
                            const hasHardViolations = hardViolationCount > 0;
                            const hasSoftViolations = softViolationCount > 0;
                            const hasViolations = hasHardViolations || hasSoftViolations;

                            return (
                                <li key={snapshot.snapshotId}>
                                    <article
                                        className={cn(
                                            'group flex w-full flex-col items-stretch rounded-[14px] bg-white p-4 text-left ring-1 transition-[background-color,box-shadow,transform] duration-150',
                                            'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(61,70,88,0.10)]',
                                            isActive ? 'bg-main-light/60 ring-main-2' : 'ring-gray-6 hover:ring-main-3',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={draftTitle}
                                                        disabled={isRenamingItem}
                                                        onChange={(event) =>
                                                            setDraftTitles((prev) => ({
                                                                ...prev,
                                                                [snapshot.snapshotId]: event.target.value,
                                                            }))
                                                        }
                                                        onBlur={(event) =>
                                                            void commitTitle(snapshot.snapshotId, currentTitle, event.currentTarget.value)
                                                        }
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.currentTarget.blur();
                                                            }

                                                            if (event.key === 'Escape') {
                                                                setDraftTitles((prev) => ({
                                                                    ...prev,
                                                                    [snapshot.snapshotId]: currentTitle,
                                                                }));
                                                                event.currentTarget.blur();
                                                            }
                                                        }}
                                                        aria-label={t('page.makeShift.aiRefill.snapshotSidebar.renameTitleAria')}
                                                        className={cn(
                                                            'min-w-0 flex-1 rounded-[8px] bg-transparent px-1 py-1 font-apple text-[15px] leading-5 font-bold text-sub-1 transition-colors outline-none',
                                                            'hover:bg-gray-7 focus:bg-white focus:ring-2 focus:ring-main-2 disabled:opacity-70',
                                                        )}
                                                    />
                                                    {isActive && (
                                                        <span className="shrink-0 font-apple text-[11px] leading-none font-bold text-main-1">
                                                            {t('page.makeShift.aiRefill.snapshotSidebar.active')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectSnapshot(snapshot.snapshotId)}
                                                    disabled={isLoadingItem || isRenamingItem || isDeletingItem}
                                                    aria-label={t('page.makeShift.aiRefill.snapshotSidebar.restore')}
                                                    className={cn(
                                                        'grid size-8 cursor-pointer place-items-center rounded-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60',
                                                        isActive ? 'bg-white text-main-1' : 'bg-gray-7 text-gray-4 group-hover:text-main-1',
                                                    )}
                                                >
                                                    {isLoadingItem || isRenamingItem ? (
                                                        <Loader2 className="size-4 animate-spin" aria-hidden />
                                                    ) : isActive ? (
                                                        <CheckCircle2 className="size-4" aria-hidden />
                                                    ) : (
                                                        <ChevronRight className="size-4" aria-hidden />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onRequestDeleteSnapshot(snapshot)}
                                                    disabled={isLoadingItem || isRenamingItem || isDeletingItem}
                                                    aria-label={t('page.makeShift.aiRefill.snapshotSidebar.delete')}
                                                    className="grid size-8 cursor-pointer place-items-center rounded-[10px] bg-gray-7 text-gray-4 transition-colors hover:bg-[#FFF1F5] hover:text-[#D92D55] focus-visible:ring-2 focus-visible:ring-[#FCA5A5] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                                                >
                                                    {isDeletingItem ? (
                                                        <Loader2 className="size-4 animate-spin" aria-hidden />
                                                    ) : (
                                                        <Trash2 className="size-4" aria-hidden />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-1.5 font-apple text-[12px] font-medium text-gray-4">
                                            <Clock className="size-3.5 shrink-0" aria-hidden />
                                            <span className="truncate">{formatSnapshotTime(snapshot.updatedAt)}</span>
                                        </div>

                                        {hasViolations && (
                                            <div className="mt-3 border-t border-gray-6/80 pt-3">
                                                <div
                                                    className={cn(
                                                        'grid gap-2',
                                                        hasHardViolations && hasSoftViolations ? 'grid-cols-2' : 'grid-cols-1',
                                                    )}
                                                >
                                                    {hasHardViolations && (
                                                        <ValidationBadge
                                                            tone="hard"
                                                            label={t('page.makeShift.aiRefill.snapshotSidebar.hardViolations', {
                                                                count: hardViolationCount,
                                                            })}
                                                        />
                                                    )}
                                                    {hasSoftViolations && (
                                                        <ValidationBadge
                                                            tone="soft"
                                                            label={t('page.makeShift.aiRefill.snapshotSidebar.softViolations', {
                                                                count: softViolationCount,
                                                            })}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </aside>
    );
}

function ValidationBadge({tone, label}: {tone: 'hard' | 'soft'; label: string}) {
    const styles =
        tone === 'hard'
            ? {bg: 'bg-[#FFF1F5]', dot: 'bg-red', text: 'text-[#D92D55]'}
            : {bg: 'bg-[#FFF8EA]', dot: 'bg-[#F59E0B]', text: 'text-[#B54708]'};

    return (
        <span
            className={cn(
                'inline-flex min-w-0 items-center justify-center gap-1 rounded-[8px] px-1.5 py-2 font-apple text-[11px] leading-none font-bold',
                styles.bg,
                styles.text,
            )}
        >
            <span className={cn('size-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
        </span>
    );
}
