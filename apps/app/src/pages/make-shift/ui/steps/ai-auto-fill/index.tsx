import type {TSnapshotSummaryDto} from '@dutying/api/ward';
import type {TAutofillAdjustDto, TAutofillAdjustKnob, TScheduleMonthRequestItem, TScheduleMonthRequestRes} from '@dutying/api/ward';
import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {
    buildSaveSnapshotDTO,
    docToShift,
    fetchAndApplyScheduleValidation,
    isDutyDocInScheduleScope,
    snapshotDetailToDoc,
    useAsyncScheduleValidation,
    useShiftEditorCommands,
    useShiftEditorStore,
    type TCellPos,
    type TDutyDoc,
} from '@/features/shift-editor';
import {getDocCellKey, getEditedFilledCellsSinceBaseline} from '@/features/shift-editor/model/doc-diff';
import {adjustLockedCellKeys} from '@/features/shift-editor/model/schedule-authoring';
import {getCellsInSelection} from '@/features/shift-editor/model/selection';
import i18n from '@/i18n';
import {useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import WardAPI from '@/shared/api/ward';
import purpleWarnIcon from '@/shared/assets/images/purple-warn-icon.webp';
import {isAiAdjustEnabled} from '@/shared/config/feature-flags';
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
import {
    deriveAdjustKnobs,
    findActiveKnobRequests,
    markCarryOverAnswered,
    toChipRequestItem,
    toTextRequestItems,
    type TAdjustKnobs,
    type TInterpretCardItem,
} from '../../../model/schedule-month-requests';
import {useMakeShiftNurseOrder} from '../../../model/use-make-shift-nurse-order';
import {useScheduleCarryOverCandidates, useScheduleMonthRequests} from '../../../model/use-schedule-month-requests';
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
import AiAdjustChipBar from './ai-adjust-chip-bar';
import AiAdjustTextInput from './ai-adjust-text-input';
import {AiAutofillLoadingOverlay} from './ai-autofill-loading-overlay';
import {AiAutofillToolbar} from './ai-autofill-toolbar';
import AiCarryOverCard from './ai-carry-over-card';
import {AiFillDecisionDialog} from './ai-fill-decision-dialog';
import AiMonthRequestList from './ai-month-request-list';
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

function hasScheduleScopeShape(shift: NonNullable<Parameters<typeof isDutyDocInScheduleScope>[1]>) {
    return shift.days.length > 0 && shift.divisionShiftNurses.some((division) => division.some((row) => row.shiftNurse.isWorker));
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
    // 조절 칩 노출 여부. 서버가 사람 단위로 판정해 workspace 응답에 실어 준다 —
    // 프론트는 그것을 그대로 따른다(`isAiAdjustEnabled` 참고).
    const autofillAdjustEnabled = useShiftEditorStore((s) => s.autofillAdjustEnabled);
    const isAdjustEnabled = isAiAdjustEnabled(autofillAdjustEnabled);
    const useCase = useMakeShiftUseCase();
    const {currentTeamNurses, isReorderingRows, moveScheduleRow} = useMakeShiftNurseOrder();
    const divisionLabelByNum = useMemo(
        () =>
            new Map(
                (shiftTeams?.find((team) => team.shiftTeamId === currentShiftTeamId)?.divisions ?? []).map((division) => [
                    division.divisionNum,
                    division.name,
                ]),
            ),
        [currentShiftTeamId, shiftTeams],
    );
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
    // 칩 상태는 서버의 이번 달 요청 목록에서 유도한다. 누른 직후에는 목록을 다시 읽기 전이라
    // 잠깐 낙관적으로 덮어 두고(knobOverride), 목록이 돌아오면 그것을 따른다.
    const [knobOverride, setKnobOverride] = useState<TAdjustKnobs | null>(null);
    const [disablingRequestId, setDisablingRequestId] = useState<number | null>(null);
    const [isCarryingOver, setIsCarryingOver] = useState(false);
    const [lastAdjustChangedCount, setLastAdjustChangedCount] = useState<number | null>(null);
    // 로딩 문구를 가른다. 조절은 "채우는 중"이 아니라 "방향을 조절하는 중"이다.
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [isSnapshotSidebarOpen, setIsSnapshotSidebarOpen] = useState(false);
    const [loadingSnapshotId, setLoadingSnapshotId] = useState<number | null>(null);
    const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(null);
    const [snapshotLoadTarget, setSnapshotLoadTarget] = useState<TSnapshotSummaryDto | null>(null);
    const [snapshotDeleteTarget, setSnapshotDeleteTarget] = useState<TSnapshotSummaryDto | null>(null);
    const [snapshotLimitContext, setSnapshotLimitContext] = useState<TSnapshotLimitContext | null>(null);
    const [clearUnlockedCellsConfirmOpen, setClearUnlockedCellsConfirmOpen] = useState(false);
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
    const {requests: monthRequests, refetch: refetchMonthRequests} = useScheduleMonthRequests({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isAdjustEnabled && isCurrentShiftTeamReady && hasCompletedAiFill,
    });
    const carryOver = useScheduleCarryOverCandidates({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isAdjustEnabled && isCurrentShiftTeamReady,
    });
    const adjustKnobs = useMemo(() => knobOverride ?? deriveAdjustKnobs(monthRequests), [knobOverride, monthRequests]);
    const syncMonthRequests = useCallback(async () => {
        await refetchMonthRequests();
        setKnobOverride(null);
    }, [refetchMonthRequests]);
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
            isCurrentShiftTeamReady &&
            Boolean(orderedShift) &&
            !isHydratingEditor &&
            !isAiGenerating &&
            !isWorking &&
            !isSavingSnapshot &&
            !isReorderingRows,
        debounceMs: 1000,
    });
    const isScheduleValidationChecking = scheduleValidation.status === 'validating';

    useEffect(() => {
        setHasCompletedAiFill(false);
        setIsSnapshotSidebarOpen(false);
        setSnapshotLoadTarget(null);
        setSnapshotDeleteTarget(null);
        setSnapshotLimitContext(null);
        setClearUnlockedCellsConfirmOpen(false);
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
    const clearableUnlockedCellCount = unprotectedFilledCells.length;
    const editedFilledCellsSinceLastAi = useMemo(
        () => getEditedFilledCellsSinceBaseline(editorDoc, lastAiGeneratedDocRef.current),
        [editorDoc, lastAiGeneratedDocVersion],
    );
    const aiFillDecisionFixableCells = aiFillDecisionContext?.kind === 'regenerate' ? editedFilledCellsSinceLastAi : unprotectedFilledCells;
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

        if (hasScheduleScopeShape(orderedShift) && !isDutyDocInScheduleScope(docToSave, orderedShift, year, month)) return;

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

        if (hasScheduleScopeShape(orderedShift) && !isDutyDocInScheduleScope(docToPublish, orderedShift, year, month)) return;

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
            const requestContext = {wardId, shiftTeamId: currentShiftTeamId, year, month};
            const detail = await WardAPI.getSnapshot(wardId, currentShiftTeamId, snapshotId);
            const latestContext = currentAiContextRef.current;

            if (
                latestContext.wardId !== requestContext.wardId ||
                latestContext.shiftTeamId !== requestContext.shiftTeamId ||
                latestContext.year !== requestContext.year ||
                latestContext.month !== requestContext.month
            ) {
                return;
            }

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

        if (
            hasScheduleScopeShape(orderedShift) &&
            !isDutyDocInScheduleScope(useShiftEditorStore.getState().doc, orderedShift, year, month)
        ) {
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
    const runAiFill = async (readyContext = getAiFillReadyContext(), adjust?: TAutofillAdjustDto) => {
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
        setIsAdjusting(Boolean(adjust));
        setAiStatus('loading');

        let shouldKeepAiEffectVisible = false;

        try {
            const stateBeforeRequest = useShiftEditorStore.getState();
            // 조절은 고정·신청 셀에 더해 **마지막 자동완성 이후 사용자가 고친 칸**도 잠근다.
            // 손으로 맞춰 놓은 칸을 칩 하나가 다시 옮기면, 사용자는 방금 한 일이 사라지는 것을 본다.
            const adjustLocked = adjust
                ? adjustLockedCellKeys(
                      stateBeforeRequest.doc,
                      getEditedFilledCellsSinceBaseline(stateBeforeRequest.doc, lastAiGeneratedDocRef.current),
                  )
                : undefined;
            const result = await requestAiSchedule({
                wardId: requestContext.wardId,
                shiftTeamId: requestContext.shiftTeamId,
                year: requestContext.year,
                month: requestContext.month,
                doc: stateBeforeRequest.doc,
                originalShift: readyContext.originalShift,
                draftRevision: stateBeforeRequest.draftRevision,
                rulesHash: readyContext.rulesHash,
                adjust,
                lockedCellKeys: adjustLocked,
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

                // 실패했는데 칩이 켜진 채로 남으면, 사용자는 그 방향이 반영된 표를 보고 있다고
                // 믿는다. 낙관적 덮어쓰기를 걷고 서버 목록을 다시 읽는다 — 쿼터에 걸린 조절도
                // 요청 행은 남으므로(다음 실행에 적용된다) 목록이 진실이다.
                // 취소(canceled)는 위에서 먼저 빠져나가므로 여기 오지 않는다.
                if (adjust) {
                    setKnobOverride(null);
                    setLastAdjustChangedCount(null);
                    void refetchMonthRequests();
                }

                if (result.notAllowed) {
                    // 게이트에 막힌 것은 장애가 아니다. 빨간 토스트로 말하면 사용자는 다시 눌러 본다.
                    toast(t('page.makeShift.aiRefill.adjust.notAllowed'));
                } else {
                    toast.error(
                        result.message || t(adjust ? 'page.makeShift.aiRefill.adjust.failed' : 'page.makeShift.aiRefill.requestFailed'),
                    );
                }

                return;
            }

            if (result.response.draftRevision !== useShiftEditorStore.getState().draftRevision) return;

            commands.applyChangedCells(result.response.changedCells, readyContext.originalShift, 'ai');

            const docAfterApply = useShiftEditorStore.getState().doc;

            markLastAiGeneratedDoc(docAfterApply);
            setHasAiGeneratedUnsavedChanges(result.response.changedCells.length > 0);
            commands.setScheduleValidationFromApi(result.validation);

            if (adjust) {
                // 응답의 changedCells 를 그대로 센다. 서버가 고정·신청 칸을 이미 걸러 낸 "적용된
                // 칸"이고, 어드민 이력의 변경 칸 수도 같은 값이다 — 토스트와 지표가 어긋나면
                // "몇 칸 바뀌었나"를 두 숫자로 이야기하게 된다.
                const movedCount = result.response.changedCells.length;

                setLastAdjustChangedCount(movedCount);

                if (movedCount === 0) {
                    toast(t('page.makeShift.aiRefill.adjust.noChange'));
                }

                void syncMonthRequests();
            }

            shouldKeepAiEffectVisible = true;
            scheduleAiEffectDismiss();
            setAiStatus('success');
            setHasCompletedAiFill(true);

            if (!adjust) {
                // 요청은 서버 상태라 새로 생성해도 남는다(목록 문구로 그렇게 안내한다).
                // 바뀐 칸 수만 지난 조절의 것이므로 지운다.
                setLastAdjustChangedCount(null);
            }
        } finally {
            if (aiRequestSeqRef.current === requestSeq) {
                aiAbortControllerRef.current = null;
                setIsAiGenerating(false);
                setIsAdjusting(false);
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
    const canClearUnlockedCells =
        clearableUnlockedCellCount > 0 &&
        !isWorking &&
        !isSavingSnapshot &&
        !isAiGenerating &&
        !isAiLoadingOverlayFinishing &&
        !isReorderingRows &&
        !dutyQuery.isLoading &&
        !isHydratingEditor &&
        !dutyQuery.isError &&
        Boolean(orderedShift);
    const handleRequestClearUnlockedCells = () => {
        if (!canClearUnlockedCells) return;

        setClearUnlockedCellsConfirmOpen(true);
    };
    const handleConfirmClearUnlockedCells = () => {
        const changedCount = commands.clearUnlockedCells('user');

        setClearUnlockedCellsConfirmOpen(false);

        if (changedCount === 0) return;

        setIsAiBlankPreviewVisible(false);
        markLastAiGeneratedDoc(null);
        setHasCompletedAiFill(false);
        resetAiStatus();
        toast.success(t('page.makeShift.aiRefill.clearUnlockedCellsSuccess', {count: changedCount}));
    };
    /**
     * 요청을 끄고(PATCH DISABLED) 곧바로 다시 조절한다. 새 요청은 없으므로 서버는 남은
     * ACTIVE 요청만 합산한다 — 마지막 칩을 껐을 때 표가 조절된 채로 남는 문제를 이렇게 푼다.
     */
    const disableRequestsAndReadjust = async (
        targets: TScheduleMonthRequestRes[],
        readyContext: NonNullable<ReturnType<typeof getAiFillReadyContext>>,
    ) => {
        setLastAdjustChangedCount(null);

        if (targets.length > 0) {
            setDisablingRequestId(targets[0]!.id);

            try {
                for (const target of targets) {
                    await WardAPI.updateScheduleMonthRequest(readyContext.wardId, readyContext.shiftTeamId, target.id, {
                        status: 'DISABLED',
                    });
                }
            } catch {
                setKnobOverride(null);
                toast.error(t('page.makeShift.aiRefill.adjust.failed'));

                return;
            } finally {
                setDisablingRequestId(null);
            }
        }

        await runAiFill(readyContext, {strength: 'NORMAL'});
    };
    /**
     * 칩 토글. 켜면 그 축의 요청을 만들어 바로 다시 풀고, 끄면 그 요청을 끄고 다시 푼다.
     *
     * "적용" 버튼을 따로 두지 않는 이유: 버튼이 있으면 칩 상태와 화면의 근무표가 어긋나는
     * 순간이 생기고, 사용자는 지금 보이는 표가 어느 설정의 결과인지 알 수 없게 된다.
     */
    const handleToggleAdjustKnob = (knob: TAutofillAdjustKnob, value: number, label: string) => {
        const readyContext = getAiFillReadyContext();

        if (!readyContext) return;

        // 같은 축의 살아 있는 요청. 끌 때는 이것을 끄고, 반대 값으로 켤 때(뭉치기↔흩기)도 먼저 끈다 —
        // 두 값이 같이 살아 있으면 서버가 합산해 0 이 되고, 화면은 그것을 설명할 수 없다.
        const sameKnobRequests = findActiveKnobRequests(monthRequests, knob);
        const remaining = monthRequests.filter((request) => !sameKnobRequests.some((target) => target.id === request.id));
        const nextKnobs = deriveAdjustKnobs(remaining);

        if (adjustKnobs[knob] === value) {
            setKnobOverride(nextKnobs);
            void disableRequestsAndReadjust(sameKnobRequests, readyContext);

            return;
        }

        setKnobOverride({...nextKnobs, [knob]: value});
        setLastAdjustChangedCount(null);

        void (async () => {
            if (sameKnobRequests.length > 0) {
                setDisablingRequestId(sameKnobRequests[0]!.id);

                try {
                    for (const target of sameKnobRequests) {
                        await WardAPI.updateScheduleMonthRequest(readyContext.wardId, readyContext.shiftTeamId, target.id, {
                            status: 'DISABLED',
                        });
                    }
                } catch {
                    setKnobOverride(null);
                    toast.error(t('page.makeShift.aiRefill.adjust.failed'));

                    return;
                } finally {
                    setDisablingRequestId(null);
                }
            }

            await runAiFill(readyContext, {strength: 'NORMAL', requests: [toChipRequestItem(knob, value, label)]});
        })();
    };
    const handleDisableMonthRequest = (request: TScheduleMonthRequestRes) => {
        const readyContext = getAiFillReadyContext();

        if (!readyContext) return;

        setKnobOverride(deriveAdjustKnobs(monthRequests.filter((entry) => entry.id !== request.id)));
        void disableRequestsAndReadjust([request], readyContext);
    };
    const interpretAdjustText = async (text: string) => {
        if (wardId == null || currentShiftTeamId == null) throw new Error('not ready');

        return WardAPI.interpretScheduleAdjust(wardId, currentShiftTeamId, {
            text,
            language: (i18n.resolvedLanguage ?? i18n.language ?? 'ko').split('-')[0],
            year,
            month,
        });
    };
    const handleApplyTextRequests = (items: TInterpretCardItem[], requestText: string) => {
        const requests: TScheduleMonthRequestItem[] = toTextRequestItems(items, requestText);

        if (requests.length === 0) return;

        const readyContext = getAiFillReadyContext();

        if (!readyContext) return;

        setLastAdjustChangedCount(null);
        void runAiFill(readyContext, {strength: 'NORMAL', requests});
    };
    const handleCarryOverApply = async (requestIds: number[]) => {
        if (wardId == null || currentShiftTeamId == null || requestIds.length === 0) return;

        setIsCarryingOver(true);

        try {
            await WardAPI.carryOverScheduleMonthRequests(wardId, currentShiftTeamId, {year, month, requestIds});
            markCarryOverAnswered({wardId, shiftTeamId: currentShiftTeamId, year, month});
            carryOver.dismiss();
            toast.success(t('page.makeShift.aiRefill.adjust.carryOver.applied', {count: requestIds.length}));
            void refetchMonthRequests();
        } catch {
            toast.error(t('page.makeShift.aiRefill.adjust.carryOver.failed'));
        } finally {
            setIsCarryingOver(false);
        }
    };
    const handleCarryOverSkip = () => {
        if (wardId != null && currentShiftTeamId != null) {
            markCarryOverAnswered({wardId, shiftTeamId: currentShiftTeamId, year, month});
        }

        carryOver.dismiss();
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
    const handleFixAllAiFillDecisionCells = () => {
        if (!aiFillDecisionContext || aiFillDecisionFixableCells.length === 0) return;

        const changedCount = commands.setCellsFixed(aiFillDecisionFixableCells, true);

        if (changedCount > 0) {
            toast.success(t('page.makeShift.aiRefill.prefillDecision.fixAllSuccess', {count: changedCount}));
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
                    canClearUnlockedCells={canClearUnlockedCells}
                    onRequestClearUnlockedCells={handleRequestClearUnlockedCells}
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

                {isAdjustEnabled && carryOver.isVisible && (
                    <AiCarryOverCard
                        candidates={carryOver.candidates}
                        isApplying={isCarryingOver}
                        onApply={(requestIds) => void handleCarryOverApply(requestIds)}
                        onSkip={handleCarryOverSkip}
                    />
                )}

                {isAdjustEnabled && hasCompletedAiFill && (
                    <>
                        <AiAdjustChipBar
                            knobs={adjustKnobs}
                            strength="NORMAL"
                            disabled={isAiGenerating || disablingRequestId !== null}
                            lastChangedCount={lastAdjustChangedCount}
                            onToggle={handleToggleAdjustKnob}
                        />
                        <AiAdjustTextInput
                            disabled={isAiGenerating || disablingRequestId !== null}
                            interpret={interpretAdjustText}
                            onApply={handleApplyTextRequests}
                        />
                        <AiMonthRequestList
                            requests={monthRequests}
                            disabled={isAiGenerating}
                            disablingRequestId={disablingRequestId}
                            onDisable={handleDisableMonthRequest}
                        />
                    </>
                )}

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
                        nurseNameMaxChars={5}
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
                        showDivisionHeaders
                        divisionLabelByNum={divisionLabelByNum}
                        stickyHeader
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
                onFixAll={handleFixAllAiFillDecisionCells}
                onEdit={handleEditAiFillDecision}
                onConfirm={aiFillDecisionContext?.kind === 'regenerate' ? handleCancelAiFillDecision : handleConfirmAiFillDecision}
                fixableCellCount={aiFillDecisionFixableCells.length}
                cancelLabel={t('shared.confirmActionDialog.cancel')}
                confirmLabel={
                    aiFillDecisionContext?.kind === 'regenerate'
                        ? t('page.makeShift.aiRefill.regenerateDecision.cancel')
                        : t('page.makeShift.aiRefill.prefillDecision.confirm')
                }
            />
            <ConfirmActionDialog
                open={clearUnlockedCellsConfirmOpen}
                title={t('page.makeShift.aiRefill.clearUnlockedCellsDialog.title')}
                description={t('page.makeShift.aiRefill.clearUnlockedCellsDialog.description', {
                    count: clearableUnlockedCellCount,
                })}
                confirmLabel={t('page.makeShift.aiRefill.clearUnlockedCellsDialog.confirm')}
                cancelLabel={t('page.makeShift.aiRefill.clearUnlockedCellsDialog.cancel')}
                tone="danger"
                onClose={() => setClearUnlockedCellsConfirmOpen(false)}
                onConfirm={handleConfirmClearUnlockedCells}
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
                icon={<img src={purpleWarnIcon} alt="" className="h-12 w-12 object-contain" />}
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
                icon={<img src={purpleWarnIcon} alt="" className="h-12 w-12 object-contain" />}
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
                    isAdjusting={isAdjusting}
                    isFinishing={isAiLoadingOverlayFinishing}
                    startedAt={aiStartedAt}
                    onFinish={handleAiLoadingOverlayFinish}
                />
            ) : null}
        </div>
    );
}
