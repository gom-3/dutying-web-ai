import type {TSnapshotSummaryDto} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {CheckCircle2, ChevronRight, Clock, Loader2, PanelRightClose, RotateCcw} from 'lucide-react';
import {useMemo} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TValidationSummary = {hardCount: number; softCount: number; totalCount: number};

type TAiSnapshotSidebarProps = {
    open: boolean;
    onClose: () => void;
    snapshots: TSnapshotSummaryDto[];
    isLoading: boolean;
    isError: boolean;
    activeSnapshotId: number | null;
    loadingSnapshotId: number | null;
    activeValidationSummary: TValidationSummary | null;
    onSelectSnapshot: (snapshotId: number) => void;
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

function getSnapshotDisplay(index: number, title: string, fallbackTitle: string) {
    const version = `V${index}`;
    const trimmedTitle = title.trim();
    const titleWithoutVersion = trimmedTitle.replace(new RegExp(`^${version}\\s*(?:·|-)?\\s*`), '').trim();

    return {
        version,
        title: titleWithoutVersion || fallbackTitle,
    };
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
        <aside
            id="make_ai_snapshot_sidebar"
            className="ai-snapshot-sidebar fixed top-0 right-0 z-[998] flex h-screen w-[304px] animate-in flex-col overflow-hidden border-l border-gray-6 bg-[#FBFCFF] shadow-[-10px_0_30px_rgba(61,70,88,0.08)] duration-200 fade-in slide-in-from-right-4"
            role="complementary"
            aria-label={t('page.makeShift.aiRefill.snapshotSidebar.title')}
        >
            <div className="border-b border-gray-6 bg-white px-5 pt-5 pb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="inline-flex h-7 items-center rounded-full bg-main-light px-3 font-apple text-[12px] font-bold text-main-1">
                            {t('page.makeShift.aiRefill.snapshotSidebar.savedCount', {count: orderedSnapshots.length})}
                        </div>
                        <h2 className="mt-3 truncate font-apple text-[20px] leading-7 font-bold text-sub-1">
                            {t('page.makeShift.aiRefill.snapshotSidebar.title')}
                        </h2>
                        <p className="mt-1 font-apple text-[13px] leading-5 font-medium text-gray-3">
                            {t('page.makeShift.aiRefill.snapshotSidebar.description')}
                        </p>
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
                            const summary = isActive ? activeValidationSummary : null;
                            const display = getSnapshotDisplay(
                                versionIndex,
                                snapshot.title,
                                t('page.makeShift.aiRefill.snapshotSidebar.defaultTitle'),
                            );

                            return (
                                <li key={snapshot.snapshotId}>
                                    <button
                                        type="button"
                                        onClick={() => onSelectSnapshot(snapshot.snapshotId)}
                                        disabled={isLoadingItem}
                                        className={cn(
                                            'group flex w-full cursor-pointer flex-col items-stretch rounded-[14px] bg-white p-4 text-left ring-1 transition-[background-color,box-shadow,transform] duration-150 disabled:cursor-wait',
                                            'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(61,70,88,0.10)] focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:outline-none',
                                            isActive ? 'bg-main-light/60 ring-main-2' : 'ring-gray-6 hover:ring-main-3',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className={cn(
                                                            'inline-flex h-6 shrink-0 items-center rounded-[8px] px-2.5 font-poppins text-[12px] leading-none font-bold',
                                                            isActive ? 'bg-white text-main-1' : 'bg-gray-7 text-sub-2',
                                                        )}
                                                    >
                                                        {display.version}
                                                    </span>
                                                    {isActive && (
                                                        <span className="min-w-0 truncate font-apple text-[11px] leading-none font-bold text-main-1">
                                                            {t('page.makeShift.aiRefill.snapshotSidebar.active')}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-2 truncate font-apple text-[15px] leading-5 font-bold text-sub-1">
                                                    {display.title}
                                                </p>
                                            </div>

                                            <span
                                                className={cn(
                                                    'grid size-8 shrink-0 place-items-center rounded-[10px] transition-colors',
                                                    isActive ? 'bg-white text-main-1' : 'bg-gray-7 text-gray-4 group-hover:text-main-1',
                                                )}
                                            >
                                                {isLoadingItem ? (
                                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                                ) : isActive ? (
                                                    <CheckCircle2 className="size-4" aria-hidden />
                                                ) : (
                                                    <ChevronRight className="size-4" aria-hidden />
                                                )}
                                            </span>
                                        </div>

                                        <div className="mt-3 flex items-center gap-1.5 font-apple text-[12px] font-medium text-gray-4">
                                            <Clock className="size-3.5 shrink-0" aria-hidden />
                                            <span className="truncate">{formatSnapshotTime(snapshot.updatedAt)}</span>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <SnapshotMetric
                                                label={t('page.makeShift.aiRefill.snapshotSidebar.filledCells', {
                                                    count: snapshot.cellCount,
                                                })}
                                            />
                                            <SnapshotMetric
                                                label={t('page.makeShift.aiRefill.snapshotSidebar.emptyCells', {
                                                    count: snapshot.emptyCellCount,
                                                })}
                                            />
                                        </div>

                                        <div className="mt-3 border-t border-gray-6/80 pt-3">
                                            {summary ? (
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <ValidationBadge
                                                        tone="hard"
                                                        label={t('page.makeShift.aiRefill.snapshotSidebar.hardViolations', {
                                                            count: summary.hardCount,
                                                        })}
                                                    />
                                                    <ValidationBadge
                                                        tone="soft"
                                                        label={t('page.makeShift.aiRefill.snapshotSidebar.softViolations', {
                                                            count: summary.softCount,
                                                        })}
                                                    />
                                                    <ValidationBadge
                                                        tone="total"
                                                        label={t('page.makeShift.aiRefill.snapshotSidebar.totalViolations', {
                                                            count: summary.totalCount,
                                                        })}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-[8px] bg-gray-7 px-2 font-apple text-[12px] font-bold text-sub-2">
                                                    <RotateCcw className="size-3.5" aria-hidden />
                                                    {t('page.makeShift.aiRefill.snapshotSidebar.restore')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </aside>
    );
}

function SnapshotMetric({label}: {label: string}) {
    return (
        <span className="inline-flex min-w-0 items-center justify-center truncate rounded-[9px] bg-gray-7 px-2 py-2 font-apple text-[12px] leading-none font-bold text-sub-2">
            {label}
        </span>
    );
}

function ValidationBadge({tone, label}: {tone: 'hard' | 'soft' | 'total'; label: string}) {
    const styles =
        tone === 'hard'
            ? {bg: 'bg-[#FFF1F5]', dot: 'bg-red', text: 'text-[#D92D55]'}
            : tone === 'soft'
              ? {bg: 'bg-[#FFF8EA]', dot: 'bg-[#F59E0B]', text: 'text-[#B54708]'}
              : {bg: 'bg-main-light', dot: 'bg-main-1', text: 'text-main-1'};

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
