import type {TSnapshotSummaryDto} from '@dutying/api/ward';
import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {
    buildSaveSnapshotDTO,
    docToShift,
    fetchAndApplyScheduleValidation,
    snapshotDetailToDoc,
    useAsyncScheduleValidation,
    useShiftEditorCommands,
    useShiftEditorStore,
} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import PageState from '@/shared/ui/PageState';
import {useNavigationBarFoldStore} from '@/widgets/navigation-bar/navigation-bar-fold-store';
import {canConfirmAiAutofill, type TAiAutofillStatus} from '../../../model/ai-autofill-state';
import {requestAiSchedule} from '../../../model/ai-schedule-provider';
import {useMakeShiftStore} from '../../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../../model/make-shift-use-case';
import {
    MAX_SCHEDULE_SNAPSHOT_COUNT,
    normalizeScheduleSnapshots,
    prependSnapshotToListCache,
    removeSnapshotFromListCache,
    scheduleSnapshotsQueryKey,
    updateSnapshotTitleInListCache,
    useInvalidateScheduleSnapshots,
    useScheduleSnapshots,
} from '../../../model/use-schedule-snapshots';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';
import {maskDutyDocNonFixedCells} from '../shared/mask-duty-doc-non-fixed';
import {useDutyEditorStep} from '../shared/use-duty-editor-step';
import {AiAutofillToolbar} from './ai-autofill-toolbar';
import {AiSnapshotSidebar} from './ai-snapshot-sidebar';

const AI_SNAPSHOT_SIDEBAR_WIDTH = 304;

type TSnapshotLimitContext = {
    snapshots: TSnapshotSummaryDto[];
    oldestSnapshot: TSnapshotSummaryDto;
    intent: 'save' | 'confirm';
};

function getSnapshotTimeValue(snapshot: TSnapshotSummaryDto) {
    const updatedAt = new Date(snapshot.updatedAt).getTime();

    if (!Number.isNaN(updatedAt)) return updatedAt;

    const createdAt = new Date(snapshot.createdAt).getTime();

    return Number.isNaN(createdAt) ? 0 : createdAt;
}

function getOldestSnapshot(snapshots: TSnapshotSummaryDto[]): TSnapshotSummaryDto | null {
    return snapshots.reduce<TSnapshotSummaryDto | null>((oldest, snapshot) => {
        if (!oldest) return snapshot;

        return getSnapshotTimeValue(snapshot) < getSnapshotTimeValue(oldest) ? snapshot : oldest;
    }, null);
}

function getNextSnapshotTitle(snapshots: TSnapshotSummaryDto[]): string {
    const maxVersion = snapshots.reduce((max, snapshot) => {
        const match = /^V(\d+)$/i.exec(snapshot.title.trim());

        if (!match) return max;

        return Math.max(max, Number(match[1]));
    }, 0);

    return `V${Math.max(maxVersion + 1, snapshots.length + 1)}`;
}

function resolveHistoryTitle(title: string | undefined, fallbackTitle: string): string {
    const trimmedTitle = title?.trim() ?? '';

    if (trimmedTitle.length > 0) return trimmedTitle;

    return fallbackTitle;
}

function resolveSnapshotDisplayTitle(params: {
    snapshotId: number;
    snapshots: TSnapshotSummaryDto[];
    detailTitle: string | undefined;
    defaultTitle: string;
    fallbackTitle: string;
}) {
    const {snapshotId, snapshots, detailTitle, defaultTitle, fallbackTitle} = params;
    const snapshotIndex = snapshots.findIndex((snapshot) => snapshot.snapshotId === snapshotId);

    if (snapshotIndex >= 0) {
        const snapshot = snapshots[snapshotIndex]!;
        const trimmedTitle = snapshot.title.trim();

        if (trimmedTitle.length > 0 && trimmedTitle !== defaultTitle) return trimmedTitle;

        return `V${snapshots.length - snapshotIndex}`;
    }

    return resolveHistoryTitle(detailTitle, fallbackTitle);
}

/**
 * AI 자동 채우기 — MakeShiftCalendar + 툴바. 가로 스크롤은 페이지(page-view)가 담당, 캘린더는 cqw 기반(스케일 없음).
 */
export function AiAutofill() {
    const {t} = useTypedTranslation();
    const queryClient = useQueryClient();
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const commands = useShiftEditorCommands();
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const history = useShiftEditorStore((s) => s.history);
    const draftRevision = useShiftEditorStore((s) => s.draftRevision);
    const rulesHash = useShiftEditorStore((s) => s.rulesHash);
    const useCase = useMakeShiftUseCase();
    /** true: AI·기타로 채운 표 포함 전체 표시. false: 고정 근무 칸만 표시. */
    const [autoFillEnabled, setAutoFillEnabled] = useState(true);
    const [showFaults, setShowFaults] = useState(true);
    const [isWorking, setIsWorking] = useState(false);
    const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiStatus, setAiStatus] = useState<TAiAutofillStatus>('idle');
    const [hasCompletedAiFill, setHasCompletedAiFill] = useState(false);
    const [isSnapshotSidebarOpen, setIsSnapshotSidebarOpen] = useState(false);
    const [loadingSnapshotId, setLoadingSnapshotId] = useState<number | null>(null);
    const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(null);
    const [snapshotLoadTarget, setSnapshotLoadTarget] = useState<TSnapshotSummaryDto | null>(null);
    const [snapshotDeleteTarget, setSnapshotDeleteTarget] = useState<TSnapshotSummaryDto | null>(null);
    const [snapshotLimitContext, setSnapshotLimitContext] = useState<TSnapshotLimitContext | null>(null);
    const collapseNavigationBar = useNavigationBarFoldStore((s) => s.collapse);
    const invalidateSnapshots = useInvalidateScheduleSnapshots();
    const snapshotsQuery = useScheduleSnapshots({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isSnapshotSidebarOpen,
    });
    const resetAiStatus = useCallback(() => setAiStatus('idle'), []);
    const openSnapshotSidebar = useCallback(() => {
        collapseNavigationBar();
        setIsSnapshotSidebarOpen(true);
    }, [collapseNavigationBar]);
    const {
        dutyQuery,
        editorRef,
        editorDoc: hydratedDoc,
        onKeyDown,
        onPasteCapture,
        violationMap,
        teamViolations,
        focusEditor,
    } = useDutyEditorStep({onContextChanged: resetAiStatus});
    const aiRequestSeqRef = useRef(0);
    const currentAiContextRef = useRef({wardId, shiftTeamId: currentShiftTeamId, year, month});

    currentAiContextRef.current = {wardId, shiftTeamId: currentShiftTeamId, year, month};

    // 비동기 실시간 검증 활성화
    useAsyncScheduleValidation({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        originalShift: dutyQuery.data,
        enabled: !isAiGenerating && !isWorking && !isSavingSnapshot,
    });

    useEffect(() => {
        setHasCompletedAiFill(false);
        setIsSnapshotSidebarOpen(false);
        setSnapshotLoadTarget(null);
        setSnapshotDeleteTarget(null);
        setSnapshotLimitContext(null);
    }, [wardId, currentShiftTeamId, year, month]);

    useEffect(() => {
        const root = document.documentElement;

        if (isSnapshotSidebarOpen) {
            root.style.setProperty('--make-ai-snapshot-sidebar-offset', `${AI_SNAPSHOT_SIDEBAR_WIDTH}px`);
        } else {
            root.style.removeProperty('--make-ai-snapshot-sidebar-offset');
        }

        return () => {
            root.style.removeProperty('--make-ai-snapshot-sidebar-offset');
        };
    }, [isSnapshotSidebarOpen]);

    const calendarDoc = useMemo(
        () => (autoFillEnabled ? hydratedDoc : maskDutyDocNonFixedCells(hydratedDoc)),
        [autoFillEnabled, hydratedDoc],
    );
    const canConfirm =
        !isWorking &&
        !isSavingSnapshot &&
        !isAiGenerating &&
        !dutyQuery.isLoading &&
        !dutyQuery.isError &&
        Boolean(dutyQuery.data) &&
        canConfirmAiAutofill(aiStatus);
    const saveSnapshotFromList = async (snapshots: TSnapshotSummaryDto[], snapshotToDelete?: TSnapshotSummaryDto) => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data) return;

        const progressToastId = 'make-shift-snapshot-save-progress';

        toast.loading(t('page.makeShift.aiRefill.savingSnapshot'), {id: progressToastId});

        try {
            if (snapshotToDelete) {
                setDeletingSnapshotId(snapshotToDelete.snapshotId);
                await WardAPI.deleteSnapshot(wardId, currentShiftTeamId, snapshotToDelete.snapshotId);
                removeSnapshotFromListCache(queryClient, wardId, currentShiftTeamId, year, month, snapshotToDelete.snapshotId);
            }

            const saved = await WardAPI.saveSnapshot(
                wardId,
                currentShiftTeamId,
                buildSaveSnapshotDTO({
                    title: getNextSnapshotTitle(snapshots),
                    year,
                    month,
                    doc: editorDoc,
                    originalShift: dutyQuery.data,
                }),
            );

            prependSnapshotToListCache(queryClient, wardId, currentShiftTeamId, year, month, saved);
            invalidateSnapshots(wardId, currentShiftTeamId, year, month);
            toast.success(t('page.makeShift.aiRefill.saveSnapshotSuccess'), {id: progressToastId});
        } finally {
            if (snapshotToDelete) {
                setDeletingSnapshotId(null);
            }
        }
    };
    const publishCurrentSchedule = async (snapshots: TSnapshotSummaryDto[], snapshotToDelete?: TSnapshotSummaryDto) => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data) return;

        if (snapshotToDelete) {
            setDeletingSnapshotId(snapshotToDelete.snapshotId);
            await WardAPI.deleteSnapshot(wardId, currentShiftTeamId, snapshotToDelete.snapshotId);
            removeSnapshotFromListCache(queryClient, wardId, currentShiftTeamId, year, month, snapshotToDelete.snapshotId);
        }

        const snapshot = await WardAPI.saveSnapshot(
            wardId,
            currentShiftTeamId,
            buildSaveSnapshotDTO({
                title: getNextSnapshotTitle(snapshots),
                year,
                month,
                doc: editorDoc,
                originalShift: dutyQuery.data,
            }),
        );

        prependSnapshotToListCache(queryClient, wardId, currentShiftTeamId, year, month, snapshot);
        invalidateSnapshots(wardId, currentShiftTeamId, year, month);

        await WardAPI.publishSnapshot(wardId, currentShiftTeamId, snapshot.snapshotId, {
            overwriteWardShift: true,
            applyRowOrder: true,
        });

        const nextShift = docToShift(editorDoc, dutyQuery.data);
        const queryKey = wardQueryOptions.duty(wardId, currentShiftTeamId, year, month).queryKey;

        useCase.confirm(nextShift);
        queryClient.setQueryData(queryKey, nextShift);
        void queryClient.invalidateQueries({queryKey});
    };
    const handleSaveSnapshot = async () => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data || isSavingSnapshot) return;

        setIsSavingSnapshot(true);

        try {
            const snapshotList = await WardAPI.getSnapshots(wardId, currentShiftTeamId, year, month);
            const snapshots = snapshotList.snapshots;

            queryClient.setQueryData(
                scheduleSnapshotsQueryKey(wardId, currentShiftTeamId, year, month),
                normalizeScheduleSnapshots(snapshots),
            );

            if (snapshots.length >= MAX_SCHEDULE_SNAPSHOT_COUNT) {
                const oldestSnapshot = getOldestSnapshot(snapshots);

                if (oldestSnapshot) {
                    setSnapshotLimitContext({snapshots, oldestSnapshot, intent: 'save'});
                } else {
                    toast.error(t('page.makeShift.aiRefill.snapshotLimitReached'));
                }

                return;
            }

            await saveSnapshotFromList(snapshots);
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveSnapshotFailed'), {id: 'make-shift-snapshot-save-progress'});
        } finally {
            setIsSavingSnapshot(false);
        }
    };
    const handleLoadSnapshot = async (snapshotId: number) => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data || loadingSnapshotId != null) return;

        setSnapshotLoadTarget(null);
        setLoadingSnapshotId(snapshotId);

        try {
            const detail = await WardAPI.getSnapshot(wardId, currentShiftTeamId, snapshotId);
            const nextDoc = snapshotDetailToDoc(detail, dutyQuery.data, year, month, {
                fixedCells: editorDoc.fixedCells,
                requestCells: editorDoc.requestCells,
            });

            commands.init(nextDoc);
            resetAiStatus();

            const stateAfterInit = useShiftEditorStore.getState();

            if (rulesHash) {
                await fetchAndApplyScheduleValidation(
                    {
                        wardId,
                        doc: stateAfterInit.doc,
                        originalShift: dutyQuery.data,
                        shiftTeamId: currentShiftTeamId,
                        year,
                        month,
                        draftRevision: stateAfterInit.draftRevision,
                        rulesHash,
                    },
                    commands.setScheduleValidationFromApi,
                );
            }

            const loadedSnapshotTitle = resolveSnapshotDisplayTitle({
                snapshotId,
                snapshots: snapshotsQuery.data ?? [],
                detailTitle: detail.title,
                defaultTitle: t('page.makeShift.aiRefill.snapshotSidebar.defaultTitle'),
                fallbackTitle: t('page.makeShift.aiRefill.snapshotSidebar.selectedHistory'),
            });

            setIsSnapshotSidebarOpen(false);
            toast.success(t('page.makeShift.aiRefill.snapshotSidebar.loadSuccess', {title: loadedSnapshotTitle}));
        } catch {
            toast.error(t('page.makeShift.aiRefill.snapshotSidebar.loadFailed'));
        } finally {
            setLoadingSnapshotId(null);
        }
    };
    const handleRequestLoadSnapshot = (snapshot: TSnapshotSummaryDto) => {
        if (loadingSnapshotId != null) return;

        setSnapshotLoadTarget(snapshot);
    };
    const handleConfirm = async () => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data || !canConfirm) return;

        setIsWorking(true);

        const progressToastId = 'make-shift-confirm-progress';

        toast.loading(t('page.makeShift.navigation.saving'), {id: progressToastId});

        try {
            const snapshotList = await WardAPI.getSnapshots(wardId, currentShiftTeamId, year, month);
            const snapshots = snapshotList.snapshots;
            const normalizedSnapshots = normalizeScheduleSnapshots(snapshotList.snapshots);

            queryClient.setQueryData(scheduleSnapshotsQueryKey(wardId, currentShiftTeamId, year, month), normalizedSnapshots);

            if (snapshots.length >= MAX_SCHEDULE_SNAPSHOT_COUNT) {
                const oldestSnapshot = getOldestSnapshot(snapshots);

                if (oldestSnapshot) {
                    toast.dismiss(progressToastId);
                    setSnapshotLimitContext({snapshots, oldestSnapshot, intent: 'confirm'});
                } else {
                    toast.error(t('page.makeShift.aiRefill.snapshotLimitReached'), {id: progressToastId});
                }

                return;
            }

            await publishCurrentSchedule(snapshots);
            toast.success(t('page.makeShift.aiRefill.publishSuccess'), {id: progressToastId});
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveFailed'), {id: progressToastId});
        } finally {
            setIsWorking(false);
        }
    };
    const handleRenameSnapshot = async (snapshotId: number, title: string) => {
        if (!wardId || !currentShiftTeamId) return;

        const nextTitle = title.trim();

        if (!nextTitle) return;

        try {
            const detail = await WardAPI.getSnapshot(wardId, currentShiftTeamId, snapshotId);
            const saved = await WardAPI.saveSnapshot(wardId, currentShiftTeamId, {
                snapshotId,
                title: nextTitle,
                year: detail.year,
                month: detail.month,
                cells: detail.cells,
                rowOrder: detail.rowOrder,
                ...(detail.prompt != null ? {prompt: detail.prompt} : {}),
                ...(detail.baseHash != null ? {baseHash: detail.baseHash} : {}),
            });

            updateSnapshotTitleInListCache(queryClient, wardId, currentShiftTeamId, year, month, saved);
            invalidateSnapshots(wardId, currentShiftTeamId, year, month);
            toast.success(t('page.makeShift.aiRefill.snapshotSidebar.renameSuccess'));
        } catch (error) {
            toast.error(t('page.makeShift.aiRefill.snapshotSidebar.renameFailed'));
            throw error;
        }
    };
    const handleConfirmDeleteSnapshot = async () => {
        if (!wardId || !currentShiftTeamId || !snapshotDeleteTarget) return;

        const deletingSnapshot = snapshotDeleteTarget;

        setDeletingSnapshotId(deletingSnapshot.snapshotId);

        try {
            await WardAPI.deleteSnapshot(wardId, currentShiftTeamId, deletingSnapshot.snapshotId);
            removeSnapshotFromListCache(queryClient, wardId, currentShiftTeamId, year, month, deletingSnapshot.snapshotId);
            invalidateSnapshots(wardId, currentShiftTeamId, year, month);

            setSnapshotDeleteTarget(null);
            toast.success(t('page.makeShift.aiRefill.snapshotSidebar.deleteSuccess'));
        } catch {
            toast.error(t('page.makeShift.aiRefill.snapshotSidebar.deleteFailed'));
        } finally {
            setDeletingSnapshotId(null);
        }
    };
    const handleConfirmDeleteOldestAndSave = async () => {
        if (!snapshotLimitContext) return;

        const {snapshots, oldestSnapshot, intent} = snapshotLimitContext;

        setSnapshotLimitContext(null);

        if (intent === 'save') {
            if (isSavingSnapshot) return;

            setIsSavingSnapshot(true);

            try {
                await saveSnapshotFromList(snapshots, oldestSnapshot);
            } catch {
                toast.error(t('page.makeShift.aiRefill.saveSnapshotFailed'), {id: 'make-shift-snapshot-save-progress'});
            } finally {
                setIsSavingSnapshot(false);
            }

            return;
        }

        if (isWorking) return;

        setIsWorking(true);

        const progressToastId = 'make-shift-confirm-progress';

        toast.loading(t('page.makeShift.navigation.saving'), {id: progressToastId});

        try {
            await publishCurrentSchedule(snapshots, oldestSnapshot);
            toast.success(t('page.makeShift.aiRefill.publishSuccess'), {id: progressToastId});
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveFailed'), {id: progressToastId});
        } finally {
            setIsWorking(false);
            setDeletingSnapshotId(null);
        }
    };
    const handleAiFill = async () => {
        if (isAiGenerating) return;

        if (wardId == null || currentShiftTeamId == null || !rulesHash || !dutyQuery.data) {
            toast.error(t('page.makeShift.aiRefill.cannotAutofillYet'));

            return;
        }

        const requestSeq = aiRequestSeqRef.current + 1;
        const requestContext = {wardId, shiftTeamId: currentShiftTeamId, year, month};

        aiRequestSeqRef.current = requestSeq;
        setIsAiGenerating(true);
        setAiStatus('loading');

        const progressToastId = 'make-shift-ai-fill-progress';

        toast.loading(t('page.makeShift.aiRefill.progressToast'), {id: progressToastId, duration: Infinity});

        try {
            const result = await requestAiSchedule({
                wardId: requestContext.wardId,
                shiftTeamId: requestContext.shiftTeamId,
                year: requestContext.year,
                month: requestContext.month,
                doc: editorDoc,
                originalShift: dutyQuery.data,
                draftRevision,
                rulesHash,
            });

            if (aiRequestSeqRef.current !== requestSeq) return;

            const currentContext = currentAiContextRef.current;

            if (
                currentContext.wardId !== requestContext.wardId ||
                currentContext.shiftTeamId !== requestContext.shiftTeamId ||
                currentContext.year !== requestContext.year ||
                currentContext.month !== requestContext.month
            ) {
                resetAiStatus();

                return;
            }

            if (!result.ok) {
                setAiStatus('error');

                return;
            }

            if (result.response.draftRevision !== useShiftEditorStore.getState().draftRevision) return;

            commands.applyChangedCells(result.response.changedCells, dutyQuery.data, 'ai');

            const stateAfterPatch = useShiftEditorStore.getState();

            await fetchAndApplyScheduleValidation(
                {
                    wardId: requestContext.wardId,
                    doc: stateAfterPatch.doc,
                    originalShift: dutyQuery.data,
                    shiftTeamId: currentShiftTeamId,
                    year: requestContext.year,
                    month: requestContext.month,
                    draftRevision: stateAfterPatch.draftRevision,
                    rulesHash,
                },
                commands.setScheduleValidationFromApi,
            );

            setAiStatus('success');
            setHasCompletedAiFill(true);
        } finally {
            toast.dismiss(progressToastId);

            if (aiRequestSeqRef.current === requestSeq) {
                setIsAiGenerating(false);
            }
        }
    };
    const fallbackHistoryTitle = t('page.makeShift.aiRefill.snapshotSidebar.selectedHistory');
    const snapshotLoadTargetTitle = snapshotLoadTarget
        ? resolveSnapshotDisplayTitle({
              snapshotId: snapshotLoadTarget.snapshotId,
              snapshots: snapshotsQuery.data ?? [],
              detailTitle: snapshotLoadTarget.title,
              defaultTitle: t('page.makeShift.aiRefill.snapshotSidebar.defaultTitle'),
              fallbackTitle: fallbackHistoryTitle,
          })
        : fallbackHistoryTitle;
    const snapshotDeleteTargetTitle = resolveHistoryTitle(snapshotDeleteTarget?.title, fallbackHistoryTitle);
    const limitOldestSnapshotTitle = resolveHistoryTitle(snapshotLimitContext?.oldestSnapshot.title, fallbackHistoryTitle);

    return (
        <div id="make_ai_autofill_step" className="ai-autofill-root flex min-h-0 w-full min-w-0 flex-1">
            <div
                className="ai-autofill-root__main flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden pt-3 outline-none"
                ref={editorRef}
                onKeyDown={onKeyDown}
                onPasteCapture={onPasteCapture}
                tabIndex={0}
            >
                <AiAutofillToolbar
                    autoFillEnabled={autoFillEnabled}
                    onToggleAutoFill={() => setAutoFillEnabled((prev) => !prev)}
                    showFaults={showFaults}
                    onToggleFaults={() => setShowFaults((prev) => !prev)}
                    canUndo={history.past.length > 0}
                    canRedo={history.future.length > 0}
                    onUndo={() => commands.undo()}
                    onRedo={() => commands.redo()}
                    onOpenSnapshotHistory={openSnapshotSidebar}
                    onAiFill={handleAiFill}
                    isAiGenerating={isAiGenerating}
                    aiStatus={aiStatus}
                    hasCompletedAiFill={hasCompletedAiFill}
                    onConfirm={handleConfirm}
                    isConfirming={isWorking}
                    canConfirm={canConfirm}
                    onSaveSnapshot={handleSaveSnapshot}
                    isSavingSnapshot={isSavingSnapshot}
                />

                {dutyQuery.isLoading && (
                    <PageState
                        tone="loading"
                        loadingColor="purple"
                        title={t('page.makeShift.aiRefill.loading')}
                        description={t('page.state.loadingDescription')}
                    />
                )}
                {dutyQuery.isError && (
                    <PageState
                        tone="error"
                        title={t('page.makeShift.aiRefill.error')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void dutyQuery.refetch()}}
                    />
                )}
                {!dutyQuery.isLoading && !dutyQuery.isError && dutyQuery.data && (
                    <MakeShiftCalendar
                        shift={dutyQuery.data}
                        doc={calendarDoc}
                        violationMap={violationMap}
                        teamViolations={teamViolations}
                        showFaults={showFaults}
                        onCellClick={focusEditor}
                    />
                )}
                {!dutyQuery.isLoading && !dutyQuery.isError && !dutyQuery.data && (
                    <PageState tone="empty" title={t('page.makeShift.aiRefill.empty')} description={t('page.state.emptyDescription')} />
                )}
            </div>

            <AiSnapshotSidebar
                open={isSnapshotSidebarOpen}
                onClose={() => setIsSnapshotSidebarOpen(false)}
                snapshots={snapshotsQuery.data ?? []}
                isLoading={snapshotsQuery.isLoading}
                isError={snapshotsQuery.isError}
                loadingSnapshotId={loadingSnapshotId}
                deletingSnapshotId={deletingSnapshotId}
                onSelectSnapshot={handleRequestLoadSnapshot}
                onRenameSnapshot={handleRenameSnapshot}
                onRequestDeleteSnapshot={setSnapshotDeleteTarget}
                onRetry={() => void snapshotsQuery.refetch()}
            />
            <ConfirmActionDialog
                open={snapshotLoadTarget != null}
                title={t('page.makeShift.aiRefill.snapshotSidebar.loadTitle')}
                description={t('page.makeShift.aiRefill.snapshotSidebar.loadDescription', {title: snapshotLoadTargetTitle})}
                confirmLabel={t('page.makeShift.aiRefill.snapshotSidebar.loadConfirm')}
                cancelLabel={t('page.makeShift.aiRefill.snapshotSidebar.loadCancel')}
                tone="danger"
                onClose={() => setSnapshotLoadTarget(null)}
                onConfirm={() => {
                    if (!snapshotLoadTarget) return;

                    void handleLoadSnapshot(snapshotLoadTarget.snapshotId);
                }}
            />
            <ConfirmActionDialog
                open={snapshotDeleteTarget != null}
                title={t('page.makeShift.aiRefill.snapshotSidebar.deleteTitle')}
                description={t('page.makeShift.aiRefill.snapshotSidebar.deleteDescription', {title: snapshotDeleteTargetTitle})}
                confirmLabel={t('page.makeShift.aiRefill.snapshotSidebar.deleteConfirm')}
                cancelLabel={t('page.makeShift.aiRefill.snapshotSidebar.deleteCancel')}
                tone="danger"
                onClose={() => setSnapshotDeleteTarget(null)}
                onConfirm={() => void handleConfirmDeleteSnapshot()}
            />
            <ConfirmActionDialog
                open={snapshotLimitContext != null}
                title={t('page.makeShift.aiRefill.snapshotLimitDialog.title')}
                description={t('page.makeShift.aiRefill.snapshotLimitDialog.description', {title: limitOldestSnapshotTitle})}
                confirmLabel={t('page.makeShift.aiRefill.snapshotLimitDialog.confirm')}
                cancelLabel={t('page.makeShift.aiRefill.snapshotLimitDialog.cancel')}
                tone="danger"
                onClose={() => setSnapshotLimitContext(null)}
                onConfirm={() => void handleConfirmDeleteOldestAndSave()}
            />
        </div>
    );
}
