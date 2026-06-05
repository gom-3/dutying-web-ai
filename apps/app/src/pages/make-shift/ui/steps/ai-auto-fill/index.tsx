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
import PageState from '@/shared/ui/PageState';
import {useNavigationBarFoldStore} from '@/widgets/navigation-bar/navigation-bar-fold-store';
import {canConfirmAiAutofill, type TAiAutofillStatus} from '../../../model/ai-autofill-state';
import {requestAiSchedule} from '../../../model/ai-schedule-provider';
import {useMakeShiftStore} from '../../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../../model/make-shift-use-case';
import {prependSnapshotToListCache, useInvalidateScheduleSnapshots, useScheduleSnapshots} from '../../../model/use-schedule-snapshots';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';
import {maskDutyDocNonFixedCells} from '../shared/mask-duty-doc-non-fixed';
import {useDutyEditorStep} from '../shared/use-duty-editor-step';
import {AiAutofillToolbar} from './ai-autofill-toolbar';
import {AiSnapshotSidebar} from './ai-snapshot-sidebar';

const AI_SNAPSHOT_SIDEBAR_WIDTH = 304;

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
    const activeValidationSummary = useShiftEditorStore((s) => s.scheduleValidationSnapshot?.validation.summary ?? null);
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
    const [activeSnapshotId, setActiveSnapshotId] = useState<number | null>(null);
    const [loadingSnapshotId, setLoadingSnapshotId] = useState<number | null>(null);
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
        setActiveSnapshotId(null);
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
    const handleSaveSnapshot = async () => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data || isSavingSnapshot) return;

        setIsSavingSnapshot(true);

        const progressToastId = 'make-shift-snapshot-save-progress';

        toast.loading(t('page.makeShift.aiRefill.savingSnapshot'), {id: progressToastId});

        try {
            const versionLabel = (snapshotsQuery.data?.length ?? 0) + 1;
            const saved = await WardAPI.saveSnapshot(
                wardId,
                currentShiftTeamId,
                buildSaveSnapshotDTO({
                    title: `V${versionLabel}`,
                    year,
                    month,
                    doc: editorDoc,
                    originalShift: dutyQuery.data,
                }),
            );

            prependSnapshotToListCache(queryClient, wardId, currentShiftTeamId, year, month, saved);
            invalidateSnapshots(wardId, currentShiftTeamId, year, month);
            setActiveSnapshotId(saved.snapshotId);
            toast.success(t('page.makeShift.aiRefill.saveSnapshotSuccess'), {id: progressToastId});
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveSnapshotFailed'), {id: progressToastId});
        } finally {
            setIsSavingSnapshot(false);
        }
    };
    const handleLoadSnapshot = async (snapshotId: number) => {
        if (!wardId || !currentShiftTeamId || !dutyQuery.data || loadingSnapshotId != null) return;

        setLoadingSnapshotId(snapshotId);

        try {
            const detail = await WardAPI.getSnapshot(wardId, currentShiftTeamId, snapshotId);
            const nextDoc = snapshotDetailToDoc(detail, dutyQuery.data, year, month, {
                fixedCells: editorDoc.fixedCells,
                requestCells: editorDoc.requestCells,
            });

            commands.init(nextDoc);
            setActiveSnapshotId(snapshotId);
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

            toast.success(t('page.makeShift.aiRefill.snapshotSidebar.loadSuccess'));
        } catch {
            toast.error(t('page.makeShift.aiRefill.snapshotSidebar.loadFailed'));
        } finally {
            setLoadingSnapshotId(null);
        }
    };
    const handleConfirm = async () => {
        if (!wardId || !dutyQuery.data || !canConfirm) return;

        setIsWorking(true);

        const progressToastId = 'make-shift-confirm-progress';

        toast.loading(t('page.makeShift.navigation.saving'), {id: progressToastId});

        try {
            // 스냅샷 저장 후 바로 게시(Publish)하는 시나리오로 간주
            const snapshot = await WardAPI.saveSnapshot(
                wardId,
                currentShiftTeamId ?? -1,
                buildSaveSnapshotDTO({
                    title: `${month}월 최종 확정본`,
                    year,
                    month,
                    doc: editorDoc,
                    originalShift: dutyQuery.data,
                }),
            );

            await WardAPI.publishSnapshot(wardId, currentShiftTeamId ?? -1, snapshot.snapshotId, {
                overwriteWardShift: true,
                applyRowOrder: true,
            });

            const nextShift = docToShift(editorDoc, dutyQuery.data);
            const queryKey = wardQueryOptions.duty(wardId, currentShiftTeamId ?? -1, year, month).queryKey;

            useCase.confirm(nextShift);
            queryClient.setQueryData(queryKey, nextShift);
            void queryClient.invalidateQueries({queryKey});
            toast.success(t('page.makeShift.aiRefill.publishSuccess'), {id: progressToastId});
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveFailed'));
            toast.dismiss(progressToastId);
        } finally {
            setIsWorking(false);
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
                activeSnapshotId={activeSnapshotId}
                loadingSnapshotId={loadingSnapshotId}
                activeValidationSummary={activeValidationSummary}
                onSelectSnapshot={handleLoadSnapshot}
                onRetry={() => void snapshotsQuery.refetch()}
            />
        </div>
    );
}
