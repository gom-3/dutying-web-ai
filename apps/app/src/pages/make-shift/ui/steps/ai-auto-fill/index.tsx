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
    type TCellPos,
    type TDutyDoc,
} from '@/features/shift-editor';
import {getCellsInSelection} from '@/features/shift-editor/model/selection';
import {useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import WardAPI from '@/shared/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import PageState from '@/shared/ui/PageState';
import {useNavigationBarFoldStore} from '@/widgets/navigation-bar/navigation-bar-fold-store';
import {hasEditableDutyDocChanges, useAiAutofillExitGuardStore} from '../../../model/ai-autofill-exit-guard';
import {canConfirmAiAutofill, type TAiAutofillStatus} from '../../../model/ai-autofill-state';
import {requestAiSchedule} from '../../../model/ai-schedule-provider';
import {isMakeShiftTeamReadyForWard, useMakeShiftStore} from '../../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../../model/make-shift-use-case';
import {sortScheduleByTeamNurseOrder} from '../../../model/nurse-order-sync';
import {syncNextMonthRestCarryOver} from '../../../model/rest-carry-over';
import {useRestTargetAdjustment} from '../../../model/rest-target-adjustment';
import {calculateRestCheckByShiftNurse} from '../../../model/rest-target-days';
import {useMakeShiftNurseOrder} from '../../../model/use-make-shift-nurse-order';
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
import {RestLeavePolicySummaryButton} from '../rest-leave-policy-summary-card';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';
import {MakeShiftCalendarSkeleton} from '../shared/make-shift-calendar-skeleton';
import {maskDutyDocCells} from '../shared/mask-duty-doc-non-fixed';
import {useDutyEditorStep} from '../shared/use-duty-editor-step';
import {AiAutofillLoadingOverlay} from './ai-autofill-loading-overlay';
import {AiAutofillToolbar} from './ai-autofill-toolbar';
import {AiFillDecisionDialog} from './ai-fill-decision-dialog';
import {AiSnapshotSidebar} from './ai-snapshot-sidebar';
import {findFirstBlankLastShiftCell, getBlankLastShiftCellsWarningKey} from './last-shift-warning';

const AI_SNAPSHOT_SIDEBAR_WIDTH = 304;
const AI_CALENDAR_EFFECT_SETTLE_MS = 900;

type TSnapshotLimitContext = {
    snapshots: TSnapshotSummaryDto[];
    oldestSnapshot: TSnapshotSummaryDto;
    intent: 'save' | 'confirm';
};
type TLastShiftBlankWarningIntent = 'aiFill' | 'confirm';
type TAiFillDecisionContext = {kind: 'initial'; cellCount: number} | {kind: 'regenerate'; cellCount: number};

type TSelectionFixedStats = {
    fixableFilledCount: number;
    fixedCount: number;
};

function getDocCellKey(doc: TDutyDoc, row: number, col: number): string | null {
    if (col < 0) return null;

    const workerId = doc.rows[row]?.workerId;
    const date = doc.columns[col];

    if (!workerId || !date) return null;

    return `${workerId}|${date}`;
}

function getUnprotectedFilledCells(doc: TDutyDoc): TCellPos[] {
    const cells: TCellPos[] = [];

    for (let row = 0; row < doc.rows.length; row += 1) {
        const dutyRow = doc.rows[row];

        if (!dutyRow) continue;

        for (let col = 0; col < doc.columns.length; col += 1) {
            const key = getDocCellKey(doc, row, col);

            if (key === null) continue;

            if (doc.fixedCells[key] === true || doc.requestCells[key] === true) continue;

            if (dutyRow.cells[col] == null) continue;

            cells.push({row, col});
        }
    }

    return cells;
}

function getSelectionFixedStats(doc: TDutyDoc, selectionCells: TCellPos[]): TSelectionFixedStats {
    let fixableFilledCount = 0;
    let fixedCount = 0;

    for (const {row, col} of selectionCells) {
        const key = getDocCellKey(doc, row, col);
        const dutyRow = doc.rows[row];

        if (key === null || !dutyRow) continue;

        if (doc.requestCells[key] === true) continue;

        if (doc.fixedCells[key] === true) {
            fixedCount += 1;
            continue;
        }

        if (dutyRow.cells[col] != null) {
            fixableFilledCount += 1;
        }
    }

    return {fixableFilledCount, fixedCount};
}

function getEditedFilledCellsSinceBaseline(currentDoc: TDutyDoc, baselineDoc: TDutyDoc | null): TCellPos[] {
    if (!baselineDoc) return [];

    const baselineValueByKey = new Map<string, string | null>();

    for (const row of baselineDoc.rows) {
        for (let col = 0; col < baselineDoc.columns.length; col += 1) {
            const date = baselineDoc.columns[col];

            if (!date) continue;

            baselineValueByKey.set(`${row.workerId}|${date}`, row.cells[col] ?? null);
        }
    }

    const cells: TCellPos[] = [];

    for (let row = 0; row < currentDoc.rows.length; row += 1) {
        const dutyRow = currentDoc.rows[row];

        if (!dutyRow) continue;

        for (let col = 0; col < currentDoc.columns.length; col += 1) {
            const key = getDocCellKey(currentDoc, row, col);

            if (key === null) continue;

            if (currentDoc.fixedCells[key] === true || currentDoc.requestCells[key] === true) continue;

            const currentValue = dutyRow.cells[col] ?? null;

            if (currentValue === null) continue;

            if (baselineValueByKey.get(key) === currentValue) continue;

            cells.push({row, col});
        }
    }

    return cells;
}

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
    const storeWardId = useMakeShiftStore((s) => s.wardId);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const shiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const isCurrentShiftTeamReady = isMakeShiftTeamReadyForWard(
        {wardId: storeWardId, shiftTeams, shiftTeamsStatus},
        wardId,
        currentShiftTeamId,
    );
    const commands = useShiftEditorCommands();
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const selection = useShiftEditorStore((s) => s.selection);
    const history = useShiftEditorStore((s) => s.history);
    const rulesHash = useShiftEditorStore((s) => s.rulesHash);
    const useCase = useMakeShiftUseCase();
    const {currentTeamNurses, isReorderingRows, moveScheduleRow} = useMakeShiftNurseOrder();
    const setStepNavigationBusy = useMakeShiftStore((s) => s.setStepNavigationBusy);
    const [cellAttention, setCellAttention] = useState<{target: 'fixed' | 'request'; nonce: number} | null>(null);
    const [showFaults, setShowFaults] = useState(true);
    const [isWorking, setIsWorking] = useState(false);
    const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [isAiLoadingOverlayFinishing, setIsAiLoadingOverlayFinishing] = useState(false);
    const [aiStartedAt, setAiStartedAt] = useState<number | null>(null);
    const [isAiEffectVisible, setIsAiEffectVisible] = useState(false);
    const [isAiBlankPreviewVisible, setIsAiBlankPreviewVisible] = useState(false);
    const [aiStatus, setAiStatus] = useState<TAiAutofillStatus>('idle');
    const [hasCompletedAiFill, setHasCompletedAiFill] = useState(false);
    const [isSnapshotSidebarOpen, setIsSnapshotSidebarOpen] = useState(false);
    const [loadingSnapshotId, setLoadingSnapshotId] = useState<number | null>(null);
    const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(null);
    const [snapshotLoadTarget, setSnapshotLoadTarget] = useState<TSnapshotSummaryDto | null>(null);
    const [snapshotDeleteTarget, setSnapshotDeleteTarget] = useState<TSnapshotSummaryDto | null>(null);
    const [snapshotLimitContext, setSnapshotLimitContext] = useState<TSnapshotLimitContext | null>(null);
    const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
    const [lastShiftBlankWarningIntent, setLastShiftBlankWarningIntent] = useState<TLastShiftBlankWarningIntent | null>(null);
    const [lastShiftBlankWarningAcknowledgedKey, setLastShiftBlankWarningAcknowledgedKey] = useState<string | null>(null);
    const [aiFillDecisionContext, setAiFillDecisionContext] = useState<TAiFillDecisionContext | null>(null);
    const aiFillDecisionFixedCellsRef = useRef<TDutyDoc['fixedCells'] | null>(null);
    const collapseNavigationBar = useNavigationBarFoldStore((s) => s.collapse);
    const invalidateSnapshots = useInvalidateScheduleSnapshots();
    const snapshotsQuery = useScheduleSnapshots({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isSnapshotSidebarOpen && isCurrentShiftTeamReady,
    });
    const resetAiStatus = useCallback(() => setAiStatus('idle'), []);
    const showCellAttention = useCallback((target: 'fixed' | 'request') => {
        setCellAttention((current) => (current?.target === target ? current : {target, nonce: Date.now()}));
    }, []);
    const clearCellAttention = useCallback(() => setCellAttention(null), []);
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
        isHydratingEditor,
    } = useDutyEditorStep({
        onContextChanged: resetAiStatus,
        hydratePreviousLastShifts: true,
        editorInputDisabled: isAiGenerating || isAiLoadingOverlayFinishing,
    });
    const orderedShift = useMemo(
        () => sortScheduleByTeamNurseOrder(dutyQuery.data, currentTeamNurses),
        [currentTeamNurses, dutyQuery.data],
    );
    const connectedNurseCount = useMemo(() => currentTeamNurses.filter((nurse) => nurse.isConnected).length, [currentTeamNurses]);
    const {policy} = useRestLeavePolicy(wardId);
    const {adjustmentDays} = useRestTargetAdjustment({wardId, shiftTeamId: currentShiftTeamId, year, month});
    const aiRequestSeqRef = useRef(0);
    const aiAbortControllerRef = useRef<AbortController | null>(null);
    const aiEffectDismissTimerRef = useRef<number | null>(null);
    const currentAiContextRef = useRef({wardId, shiftTeamId: currentShiftTeamId, year, month});
    const savedEditableDocRef = useRef<TDutyDoc | null>(null);
    const savedEditableContextKeyRef = useRef<string | null>(null);
    const lastAiGeneratedDocRef = useRef<TDutyDoc | null>(null);
    const [savedEditableDocVersion, setSavedEditableDocVersion] = useState(0);
    const [lastAiGeneratedDocVersion, setLastAiGeneratedDocVersion] = useState(0);
    const [hasAiGeneratedUnsavedChanges, setHasAiGeneratedUnsavedChanges] = useState(false);
    const setExitGuard = useAiAutofillExitGuardStore((s) => s.setExitGuard);
    const resetExitGuard = useAiAutofillExitGuardStore((s) => s.resetExitGuard);
    const currentContextKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}`;

    currentAiContextRef.current = {wardId, shiftTeamId: currentShiftTeamId, year, month};

    const markEditableDocSaved = useCallback((doc: TDutyDoc = useShiftEditorStore.getState().doc) => {
        savedEditableDocRef.current = doc;
        setHasAiGeneratedUnsavedChanges(false);
        setSavedEditableDocVersion((version) => version + 1);
    }, []);
    const markLastAiGeneratedDoc = useCallback((doc: TDutyDoc | null) => {
        lastAiGeneratedDocRef.current = doc;
        setLastAiGeneratedDocVersion((version) => version + 1);
    }, []);
    const clearAiEffectDismissTimer = useCallback(() => {
        if (aiEffectDismissTimerRef.current === null) return;

        window.clearTimeout(aiEffectDismissTimerRef.current);
        aiEffectDismissTimerRef.current = null;
    }, []);
    const hideAiEffect = useCallback(() => {
        clearAiEffectDismissTimer();
        setIsAiEffectVisible(false);
    }, [clearAiEffectDismissTimer]);
    const scheduleAiEffectDismiss = useCallback(() => {
        clearAiEffectDismissTimer();

        aiEffectDismissTimerRef.current = window.setTimeout(() => {
            aiEffectDismissTimerRef.current = null;
            setIsAiEffectVisible(false);
        }, AI_CALENDAR_EFFECT_SETTLE_MS);
    }, [clearAiEffectDismissTimer]);
    const handleAiLoadingOverlayFinish = useCallback(() => {
        setIsAiLoadingOverlayFinishing(false);
        setAiStartedAt(null);
    }, []);

    useEffect(() => () => clearAiEffectDismissTimer(), [clearAiEffectDismissTimer]);

    const isStepNavigationBusy =
        isWorking ||
        isSavingSnapshot ||
        isAiGenerating ||
        isAiLoadingOverlayFinishing ||
        isReorderingRows ||
        loadingSnapshotId !== null ||
        deletingSnapshotId !== null;

    useEffect(() => {
        setStepNavigationBusy(5, isStepNavigationBusy);

        return () => setStepNavigationBusy(5, false);
    }, [isStepNavigationBusy, setStepNavigationBusy]);

    // 비동기 실시간 검증 활성화
    const scheduleValidation = useAsyncScheduleValidation({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        originalShift: orderedShift,
        enabled:
            isCurrentShiftTeamReady && Boolean(orderedShift) && !isAiGenerating && !isWorking && !isSavingSnapshot && !isReorderingRows,
        debounceMs: 1000,
    });
    const isScheduleValidationChecking = scheduleValidation.status === 'validating';

    useEffect(() => {
        setHasCompletedAiFill(false);
        setIsSnapshotSidebarOpen(false);
        setSnapshotLoadTarget(null);
        setSnapshotDeleteTarget(null);
        setSnapshotLimitContext(null);
        setPublishConfirmOpen(false);
        setLastShiftBlankWarningIntent(null);
        setLastShiftBlankWarningAcknowledgedKey(null);
        setAiFillDecisionContext(null);
        aiFillDecisionFixedCellsRef.current = null;
        markLastAiGeneratedDoc(null);
        aiAbortControllerRef.current?.abort();
        aiAbortControllerRef.current = null;
        aiRequestSeqRef.current += 1;
        setIsAiGenerating(false);
        setIsAiLoadingOverlayFinishing(false);
        setAiStartedAt(null);
        setIsAiBlankPreviewVisible(false);
        hideAiEffect();
        resetAiStatus();
    }, [wardId, currentShiftTeamId, year, month, hideAiEffect, markLastAiGeneratedDoc, resetAiStatus]);

    useEffect(() => {
        savedEditableContextKeyRef.current = null;
        savedEditableDocRef.current = null;
        markLastAiGeneratedDoc(null);
        setHasAiGeneratedUnsavedChanges(false);
        setSavedEditableDocVersion((version) => version + 1);
    }, [currentContextKey, markLastAiGeneratedDoc]);

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

    const isCalendarReadonly = isAiGenerating;
    const visibleCalendarDoc = useMemo(
        () => (isAiBlankPreviewVisible ? maskDutyDocCells(hydratedDoc, {hideUnlocked: true}) : hydratedDoc),
        [hydratedDoc, isAiBlankPreviewVisible],
    );
    const restCheckByShiftNurseId = useMemo(
        () =>
            orderedShift
                ? calculateRestCheckByShiftNurse({
                      shift: orderedShift,
                      doc: hydratedDoc,
                      policy,
                      year,
                      month,
                      adjustmentDays,
                  })
                : undefined,
        [adjustmentDays, hydratedDoc, month, orderedShift, policy, year],
    );
    const canConfirm =
        !isWorking &&
        !isSavingSnapshot &&
        !isAiGenerating &&
        !isReorderingRows &&
        !dutyQuery.isLoading &&
        !isHydratingEditor &&
        !dutyQuery.isError &&
        Boolean(orderedShift) &&
        !isScheduleValidationChecking &&
        canConfirmAiAutofill(aiStatus);
    const selectedCells = useMemo(() => (selection ? getCellsInSelection(selection) : []), [selection]);
    const selectionFixedStats = useMemo(() => getSelectionFixedStats(editorDoc, selectedCells), [editorDoc, selectedCells]);
    const unprotectedFilledCells = useMemo(() => getUnprotectedFilledCells(editorDoc), [editorDoc]);
    const editedFilledCellsSinceLastAi = useMemo(
        () => getEditedFilledCellsSinceBaseline(editorDoc, lastAiGeneratedDocRef.current),
        [editorDoc, lastAiGeneratedDocVersion],
    );
    const isAiFillDecisionPreviewOpen = aiFillDecisionContext !== null;
    const hasUnsavedEditableChanges = useMemo(
        () => hasAiGeneratedUnsavedChanges || hasEditableDutyDocChanges(editorDoc, savedEditableDocRef.current),
        [editorDoc, hasAiGeneratedUnsavedChanges, savedEditableDocVersion],
    );
    const lastShiftBlankWarningKey = useMemo(() => getBlankLastShiftCellsWarningKey(editorDoc), [editorDoc]);
    const shouldShowLastShiftBlankWarning =
        lastShiftBlankWarningKey !== null && lastShiftBlankWarningAcknowledgedKey !== lastShiftBlankWarningKey;
    const requestLastShiftBlankWarning = useCallback(
        (intent: TLastShiftBlankWarningIntent) => {
            if (!shouldShowLastShiftBlankWarning) return false;

            setLastShiftBlankWarningIntent(intent);

            return true;
        },
        [shouldShowLastShiftBlankWarning],
    );

    useEffect(() => {
        if (isHydratingEditor || !orderedShift || editorDoc.columns.length === 0) return;

        if (savedEditableContextKeyRef.current === currentContextKey && savedEditableDocRef.current !== null) return;

        savedEditableContextKeyRef.current = currentContextKey;
        markEditableDocSaved(editorDoc);
    }, [currentContextKey, editorDoc, isHydratingEditor, markEditableDocSaved, orderedShift]);

    useEffect(() => {
        setExitGuard({hasUnsavedChanges: hasUnsavedEditableChanges, isAiGenerating});

        return () => resetExitGuard();
    }, [hasUnsavedEditableChanges, isAiGenerating, resetExitGuard, setExitGuard]);

    useEffect(() => {
        if (!hasUnsavedEditableChanges && !isAiGenerating) return;

        const message = isAiGenerating
            ? t('page.makeShift.aiRefill.exitGuard.aiGeneratingMessage')
            : t('page.makeShift.aiRefill.exitGuard.unsavedMessage');
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = message;

            return message;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedEditableChanges, isAiGenerating, t]);

    useEffect(() => {
        if (lastShiftBlankWarningKey === null && lastShiftBlankWarningAcknowledgedKey !== null) {
            setLastShiftBlankWarningAcknowledgedKey(null);
        }
    }, [lastShiftBlankWarningAcknowledgedKey, lastShiftBlankWarningKey]);

    useEffect(() => {
        if (!isAiBlankPreviewVisible) return;

        if (isAiGenerating || aiFillDecisionContext !== null || lastShiftBlankWarningIntent === 'aiFill') return;

        setIsAiBlankPreviewVisible(false);
    }, [aiFillDecisionContext, isAiBlankPreviewVisible, isAiGenerating, lastShiftBlankWarningIntent]);

    const saveSnapshotFromList = async (snapshots: TSnapshotSummaryDto[], snapshotToDelete?: TSnapshotSummaryDto) => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift) return;

        const progressToastId = 'make-shift-snapshot-save-progress';
        const docToSave = useShiftEditorStore.getState().doc;

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
                    doc: docToSave,
                    originalShift: orderedShift,
                }),
            );

            prependSnapshotToListCache(queryClient, wardId, currentShiftTeamId, year, month, saved);
            invalidateSnapshots(wardId, currentShiftTeamId, year, month);
            markEditableDocSaved(docToSave);
            toast.success(t('page.makeShift.aiRefill.saveSnapshotSuccess'), {id: progressToastId});
        } finally {
            if (snapshotToDelete) {
                setDeletingSnapshotId(null);
            }
        }
    };
    const publishCurrentSchedule = async (snapshots: TSnapshotSummaryDto[], snapshotToDelete?: TSnapshotSummaryDto) => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift) return;

        const docToPublish = useShiftEditorStore.getState().doc;

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
                doc: docToPublish,
                originalShift: orderedShift,
            }),
        );

        prependSnapshotToListCache(queryClient, wardId, currentShiftTeamId, year, month, snapshot);
        invalidateSnapshots(wardId, currentShiftTeamId, year, month);

        await WardAPI.publishSnapshot(wardId, currentShiftTeamId, snapshot.snapshotId, {
            overwriteWardShift: true,
            applyRowOrder: true,
        });

        const nextShift = {
            ...docToShift(docToPublish, orderedShift),
            workflowStatus: 'CONFIRMED' as const,
            workflowStep: 5,
        };
        const confirmedRestCheckByShiftNurseId = calculateRestCheckByShiftNurse({
            shift: nextShift,
            doc: docToPublish,
            policy,
            year,
            month,
            adjustmentDays,
        });
        const queryKey = wardQueryOptions.duty(wardId, currentShiftTeamId, year, month).queryKey;

        markEditableDocSaved(docToPublish);
        useCase.confirm(nextShift);
        queryClient.setQueryData(queryKey, nextShift);
        void queryClient.invalidateQueries({queryKey});

        try {
            await syncNextMonthRestCarryOver({
                wardId,
                shiftTeamId: currentShiftTeamId,
                year,
                month,
                shift: nextShift,
                policy,
                restCheckByShiftNurseId: confirmedRestCheckByShiftNurseId,
                queryClient,
            });
        } catch {
            toast.error(t('page.makeShift.aiRefill.restCarryOverSyncFailed'));
        }
    };
    const handleSaveSnapshot = async () => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift || isSavingSnapshot) return;

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
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift || loadingSnapshotId != null) return;

        setSnapshotLoadTarget(null);
        setLoadingSnapshotId(snapshotId);

        try {
            const detail = await WardAPI.getSnapshot(wardId, currentShiftTeamId, snapshotId);
            const nextDoc = snapshotDetailToDoc(detail, orderedShift, year, month, {
                fixedCells: editorDoc.fixedCells,
                requestCells: editorDoc.requestCells,
                lastCellsByWorkerId: Object.fromEntries(editorDoc.rows.map((row) => [row.workerId, row.lastCells ?? []])),
            });

            commands.init(nextDoc);
            markEditableDocSaved(nextDoc);
            markLastAiGeneratedDoc(null);
            resetAiStatus();
            setHasCompletedAiFill(false);

            const stateAfterInit = useShiftEditorStore.getState();

            if (rulesHash) {
                await fetchAndApplyScheduleValidation(
                    {
                        wardId,
                        doc: stateAfterInit.doc,
                        originalShift: orderedShift,
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
    const confirmCurrentSchedule = async () => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift || !canConfirm) return;

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
            toast.success(
                t(
                    connectedNurseCount > 0
                        ? 'page.makeShift.aiRefill.publishSuccessWithRecipients'
                        : 'page.makeShift.aiRefill.publishSuccessWithoutRecipients',
                    {count: connectedNurseCount},
                ),
                {id: progressToastId},
            );
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveFailed'), {id: progressToastId});
        } finally {
            setIsWorking(false);
        }
    };
    const handleConfirm = () => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift || !canConfirm) return;

        if (requestLastShiftBlankWarning('confirm')) return;

        if (connectedNurseCount === 0) {
            void confirmCurrentSchedule();

            return;
        }

        setPublishConfirmOpen(true);
    };
    const handleRenameSnapshot = async (snapshotId: number, title: string) => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId) return;

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
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !snapshotDeleteTarget) return;

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
            toast.success(
                t(
                    connectedNurseCount > 0
                        ? 'page.makeShift.aiRefill.publishSuccessWithRecipients'
                        : 'page.makeShift.aiRefill.publishSuccessWithoutRecipients',
                    {count: connectedNurseCount},
                ),
                {id: progressToastId},
            );
        } catch {
            toast.error(t('page.makeShift.aiRefill.saveFailed'), {id: progressToastId});
        } finally {
            setIsWorking(false);
            setDeletingSnapshotId(null);
        }
    };
    const getAiFillReadyContext = () => {
        if (isAiGenerating || isAiLoadingOverlayFinishing) return null;

        if (!isCurrentShiftTeamReady || wardId == null || currentShiftTeamId == null || !rulesHash || !orderedShift) {
            toast.error(t('page.makeShift.aiRefill.cannotAutofillYet'));

            return null;
        }

        return {
            originalShift: orderedShift,
            rulesHash,
            shiftTeamId: currentShiftTeamId,
            wardId,
        };
    };
    const runAiFill = async (readyContext = getAiFillReadyContext()) => {
        if (!readyContext) {
            setIsAiBlankPreviewVisible(false);

            return;
        }

        const requestSeq = aiRequestSeqRef.current + 1;
        const requestContext = {wardId: readyContext.wardId, shiftTeamId: readyContext.shiftTeamId, year, month};
        const abortController = new AbortController();

        aiAbortControllerRef.current?.abort();
        aiAbortControllerRef.current = abortController;
        aiRequestSeqRef.current = requestSeq;
        setIsAiGenerating(true);
        setIsAiLoadingOverlayFinishing(false);
        clearAiEffectDismissTimer();
        setAiStartedAt(Date.now());
        setIsAiEffectVisible(true);
        setAiStatus('loading');

        let shouldKeepAiEffectVisible = false;

        try {
            const stateBeforeRequest = useShiftEditorStore.getState();
            const result = await requestAiSchedule({
                wardId: requestContext.wardId,
                shiftTeamId: requestContext.shiftTeamId,
                year: requestContext.year,
                month: requestContext.month,
                doc: stateBeforeRequest.doc,
                originalShift: readyContext.originalShift,
                draftRevision: stateBeforeRequest.draftRevision,
                rulesHash: readyContext.rulesHash,
                signal: abortController.signal,
            });

            if (aiRequestSeqRef.current !== requestSeq) return;

            if (!result.ok && result.canceled) {
                resetAiStatus();

                return;
            }

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
                toast.error(result.message || t('page.makeShift.aiRefill.requestFailed'));

                return;
            }

            if (result.response.draftRevision !== useShiftEditorStore.getState().draftRevision) return;

            commands.applyChangedCells(result.response.changedCells, readyContext.originalShift, 'ai');
            markLastAiGeneratedDoc(useShiftEditorStore.getState().doc);
            setHasAiGeneratedUnsavedChanges(result.response.changedCells.length > 0);
            commands.setScheduleValidationFromApi(result.validation);

            shouldKeepAiEffectVisible = true;
            scheduleAiEffectDismiss();
            setAiStatus('success');
            setHasCompletedAiFill(true);
        } finally {
            if (aiRequestSeqRef.current === requestSeq) {
                aiAbortControllerRef.current = null;
                setIsAiGenerating(false);
                setIsAiLoadingOverlayFinishing(shouldKeepAiEffectVisible);

                if (!shouldKeepAiEffectVisible) {
                    setAiStartedAt(null);
                }

                setIsAiBlankPreviewVisible(false);

                if (!shouldKeepAiEffectVisible) hideAiEffect();
            }
        }
    };
    const handleFixSelection = () => {
        const changedCount = commands.setSelectionFixed(true);

        if (changedCount > 0) {
            toast.success(t('page.makeShift.aiRefill.fixSelectionSuccess', {count: changedCount}));
        }
    };
    const handleUnfixSelection = () => {
        const changedCount = commands.setSelectionFixed(false);

        if (changedCount > 0) {
            toast.success(t('page.makeShift.aiRefill.unfixSelectionSuccess', {count: changedCount}));
        }
    };
    const openAiFillDecision = (context: TAiFillDecisionContext) => {
        aiFillDecisionFixedCellsRef.current = {...useShiftEditorStore.getState().doc.fixedCells};
        setAiFillDecisionContext(context);
    };
    const restoreAiFillDecisionFixedCells = () => {
        const snapshot = aiFillDecisionFixedCellsRef.current;

        aiFillDecisionFixedCellsRef.current = null;

        if (!snapshot) return;

        const currentDoc = useShiftEditorStore.getState().doc;
        const cellsToFix: TCellPos[] = [];
        const cellsToUnfix: TCellPos[] = [];

        for (let row = 0; row < currentDoc.rows.length; row += 1) {
            for (let col = 0; col < currentDoc.columns.length; col += 1) {
                const key = getDocCellKey(currentDoc, row, col);

                if (key === null) continue;

                const wasFixed = snapshot[key] === true;
                const isFixed = currentDoc.fixedCells[key] === true;

                if (wasFixed === isFixed) continue;

                if (wasFixed) {
                    cellsToFix.push({row, col});
                } else {
                    cellsToUnfix.push({row, col});
                }
            }
        }

        if (cellsToFix.length > 0) commands.setCellsFixed(cellsToFix, true);

        if (cellsToUnfix.length > 0) commands.setCellsFixed(cellsToUnfix, false);
    };
    const runAiFillWithDecision = (readyContext = getAiFillReadyContext()) => {
        if (!readyContext) return;

        if (!hasCompletedAiFill) {
            if (unprotectedFilledCells.length > 0) {
                openAiFillDecision({kind: 'initial', cellCount: unprotectedFilledCells.length});

                return;
            }

            void runAiFill(readyContext);

            return;
        }

        if (editedFilledCellsSinceLastAi.length > 0) {
            openAiFillDecision({kind: 'regenerate', cellCount: editedFilledCellsSinceLastAi.length});

            return;
        }

        commands.resetAutofilled('user');
        void runAiFill(readyContext);
    };
    const handleAiFill = () => {
        const readyContext = getAiFillReadyContext();

        if (!readyContext) return;

        setIsAiBlankPreviewVisible(true);

        if (requestLastShiftBlankWarning('aiFill')) return;

        runAiFillWithDecision(readyContext);
    };
    const handleConfirmAiFillDecision = () => {
        const decisionContext = aiFillDecisionContext;

        aiFillDecisionFixedCellsRef.current = null;
        setAiFillDecisionContext(null);

        if (!decisionContext) return;

        if (decisionContext.kind === 'initial') {
            commands.resetAutofilled('user');
            void runAiFill();

            return;
        }

        commands.setCellsFixed(getEditedFilledCellsSinceBaseline(useShiftEditorStore.getState().doc, lastAiGeneratedDocRef.current), true);
        commands.resetAutofilled('user');
        void runAiFill();
    };
    const handleCancelAiFillDecision = () => {
        const decisionContext = aiFillDecisionContext;

        aiFillDecisionFixedCellsRef.current = null;
        setAiFillDecisionContext(null);

        if (!decisionContext) return;

        if (decisionContext.kind === 'initial') {
            setIsAiBlankPreviewVisible(false);

            return;
        }

        commands.resetAutofilled('user');
        void runAiFill();
    };
    const handleEditAiFillDecision = () => {
        restoreAiFillDecisionFixedCells();
        setAiFillDecisionContext(null);
        setIsAiBlankPreviewVisible(false);
    };
    const handleToggleAiFillDecisionCell = (rowIndex: number, colIndex: number) => {
        const currentDoc = useShiftEditorStore.getState().doc;
        const cellKey = getDocCellKey(currentDoc, rowIndex, colIndex);
        const cellValue = currentDoc.rows[rowIndex]?.cells[colIndex];

        if (cellKey === null || cellValue == null) return;

        if (currentDoc.requestCells[cellKey] === true) {
            toast.error(t('page.makeShift.aiRefill.prefillDecision.requestLocked'));

            return;
        }

        const nextFixed = currentDoc.fixedCells[cellKey] !== true;
        const changedCount = commands.setCellsFixed([{row: rowIndex, col: colIndex}], nextFixed);

        if (changedCount > 0) {
            toast.success(t(nextFixed ? 'page.makeShift.calendar.fixCellSuccess' : 'page.makeShift.calendar.unfixCellSuccess'));
        }
    };
    const handleConfirmLastShiftBlankWarning = () => {
        const warningIntent = lastShiftBlankWarningIntent;

        setLastShiftBlankWarningIntent(null);

        if (lastShiftBlankWarningKey !== null) {
            setLastShiftBlankWarningAcknowledgedKey(lastShiftBlankWarningKey);
        }

        if (warningIntent === 'aiFill') {
            runAiFillWithDecision();

            return;
        }

        if (warningIntent === 'confirm') {
            if (connectedNurseCount === 0) {
                void confirmCurrentSchedule();

                return;
            }

            setPublishConfirmOpen(true);
        }
    };
    const handlePublishConfirm = () => {
        if (!canConfirm) return;

        setPublishConfirmOpen(false);
        void confirmCurrentSchedule();
    };
    const handleCancelLastShiftBlankWarning = () => {
        const firstBlankLastShiftCell = findFirstBlankLastShiftCell(useShiftEditorStore.getState().doc);

        setLastShiftBlankWarningIntent(null);

        if (!firstBlankLastShiftCell) return;

        commands.select(firstBlankLastShiftCell);

        window.requestAnimationFrame(() => {
            focusEditor();

            document
                .querySelector<HTMLElement>(
                    `[data-row-index="${firstBlankLastShiftCell.row}"] [data-shift-col-index="${firstBlankLastShiftCell.col}"]`,
                )
                ?.scrollIntoView({block: 'center', inline: 'center', behavior: 'smooth'});
        });
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
    const lastShiftBlankDialogDescription = (
        <>
            <span>{t('page.makeShift.aiRefill.lastShiftBlankDialog.descriptionLead')}</span>
            <span className="mt-1 block font-semibold text-main-1">
                {t('page.makeShift.aiRefill.lastShiftBlankDialog.descriptionHighlight')}
            </span>
        </>
    );
    const publishConfirmDescription =
        connectedNurseCount > 0
            ? t('page.makeShift.aiRefill.publishConfirm.description', {count: connectedNurseCount})
            : t('page.makeShift.aiRefill.publishConfirm.noConnectedDescription');

    return (
        <div id="make_ai_autofill_step" className="ai-autofill-root flex w-full min-w-0">
            <div
                className="ai-autofill-root__main flex min-w-0 flex-1 flex-col gap-3 pt-3 outline-none"
                ref={editorRef}
                onKeyDown={onKeyDown}
                onPasteCapture={onPasteCapture}
                tabIndex={0}
            >
                <AiAutofillToolbar
                    onFixedShiftsAttentionStart={() => showCellAttention('fixed')}
                    onFixedShiftsAttentionEnd={clearCellAttention}
                    onRequestShiftsAttentionStart={() => showCellAttention('request')}
                    onRequestShiftsAttentionEnd={clearCellAttention}
                    canFixSelection={selectionFixedStats.fixableFilledCount > 0}
                    canUnfixSelection={selectionFixedStats.fixedCount > 0}
                    onFixSelection={handleFixSelection}
                    onUnfixSelection={handleUnfixSelection}
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
                    scheduleValidationStatus={scheduleValidation.status}
                    onConfirm={handleConfirm}
                    isConfirming={isWorking}
                    canConfirm={canConfirm}
                    onSaveSnapshot={handleSaveSnapshot}
                    isSavingSnapshot={isSavingSnapshot}
                />

                {(dutyQuery.isLoading || isHydratingEditor) && (
                    <MakeShiftCalendarSkeleton ariaLabel={t('page.makeShift.aiRefill.loading')} />
                )}
                {dutyQuery.isError && (
                    <PageState
                        tone="error"
                        title={t('page.makeShift.aiRefill.error')}
                        description={t('page.state.errorDescription')}
                        action={{label: t('page.state.retry'), onClick: () => void dutyQuery.refetch()}}
                    />
                )}
                {!dutyQuery.isLoading && !isHydratingEditor && !dutyQuery.isError && orderedShift && !isAiFillDecisionPreviewOpen && (
                    <MakeShiftCalendar
                        shift={orderedShift}
                        doc={visibleCalendarDoc}
                        violationMap={violationMap}
                        teamViolations={teamViolations}
                        showFaults={showFaults}
                        onCellClick={isCalendarReadonly ? undefined : focusEditor}
                        readonly={isCalendarReadonly}
                        editableLastShifts={!isCalendarReadonly}
                        isShimmering={isAiEffectVisible}
                        showCellStatusPins
                        fixCellOnContextMenu
                        cellAttention={cellAttention}
                        tutorialCellId="make_fixed_shift_sample_cell"
                        restCheckByShiftNurseId={restCheckByShiftNurseId}
                        canReorderRows
                        rowReorderDisabled={isCalendarReadonly || isReorderingRows}
                        onRowDragEnd={(result) => {
                            void moveScheduleRow(orderedShift, result, {scheduleKind: 'duty', doc: editorDoc});
                        }}
                        restPolicyControl={
                            <RestLeavePolicySummaryButton
                                wardId={wardId}
                                shiftTeamId={currentShiftTeamId}
                                year={year}
                                month={month}
                                days={orderedShift.days}
                            />
                        }
                    />
                )}
                {!dutyQuery.isLoading && !isHydratingEditor && !dutyQuery.isError && !orderedShift && (
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
            <AiFillDecisionDialog
                open={isAiFillDecisionPreviewOpen}
                kind={aiFillDecisionContext?.kind ?? 'initial'}
                shift={orderedShift ?? null}
                doc={editorDoc}
                violationMap={violationMap}
                teamViolations={teamViolations}
                onClose={handleEditAiFillDecision}
                onToggleCellFixed={handleToggleAiFillDecisionCell}
                onEdit={handleEditAiFillDecision}
                onConfirm={aiFillDecisionContext?.kind === 'regenerate' ? handleCancelAiFillDecision : handleConfirmAiFillDecision}
                cancelLabel={t('shared.confirmActionDialog.cancel')}
                confirmLabel={
                    aiFillDecisionContext?.kind === 'regenerate'
                        ? t('page.makeShift.aiRefill.regenerateDecision.cancel')
                        : t('page.makeShift.aiRefill.prefillDecision.confirm')
                }
            />
            <ConfirmActionDialog
                open={publishConfirmOpen}
                title={t('page.makeShift.aiRefill.publishConfirm.title')}
                description={publishConfirmDescription}
                confirmLabel={t(
                    connectedNurseCount > 0
                        ? 'page.makeShift.aiRefill.publishConfirm.confirm'
                        : 'page.makeShift.aiRefill.publishConfirm.confirmWithoutRecipients',
                )}
                onClose={() => setPublishConfirmOpen(false)}
                onConfirm={handlePublishConfirm}
            />
            <ConfirmActionDialog
                open={lastShiftBlankWarningIntent !== null}
                title={t('page.makeShift.aiRefill.lastShiftBlankDialog.title')}
                description={lastShiftBlankDialogDescription}
                confirmLabel={t(
                    lastShiftBlankWarningIntent === 'aiFill'
                        ? 'page.makeShift.aiRefill.lastShiftBlankDialog.confirmAiFill'
                        : 'page.makeShift.aiRefill.lastShiftBlankDialog.confirm',
                )}
                cancelLabel={t('page.makeShift.aiRefill.lastShiftBlankDialog.cancel')}
                onClose={() => setLastShiftBlankWarningIntent(null)}
                onCancel={handleCancelLastShiftBlankWarning}
                onConfirm={handleConfirmLastShiftBlankWarning}
                confirmButtonVariant={lastShiftBlankWarningIntent === 'aiFill' ? 'ai' : 'default'}
                spotlightSelector=".make-shift-calendar__header-label--last, .make-shift-calendar__row-last-shift-cell"
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
            {isAiGenerating || isAiLoadingOverlayFinishing ? (
                <AiAutofillLoadingOverlay
                    isFinishing={isAiLoadingOverlayFinishing}
                    startedAt={aiStartedAt}
                    onFinish={handleAiLoadingOverlayFinish}
                />
            ) : null}
        </div>
    );
}
