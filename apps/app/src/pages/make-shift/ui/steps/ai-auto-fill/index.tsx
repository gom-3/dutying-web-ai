import type {TScheduleGoalResult, TSnapshotCellDTO, TSnapshotSummaryDto} from '@dutying/api/ward';
import type {
    TAutofillAdjustDto,
    TAutofillAdjustStrength,
    TAutofillResponse,
    TScheduleMonthRequestRes,
    TScheduleRequestRuleResult,
} from '@dutying/api/ward';
import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import type {TShift} from '@/entities/shift';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import {useAnnualLeaveSchedule} from '@/features/annual-leave/queries';
import {useAnnualLeaveScheduleColumns} from '@/features/annual-leave/schedule-columns';
import useAuth from '@/features/auth';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet} from '@/features/commercial/api';
import {batchCellsForReview, type CommercialBatchResult} from '@/features/commercial/batch-result';
import {AiPlanNotice} from '@/features/commercial/entry';
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
import {docToSnapshotCellsDTO} from '@/features/shift-editor/model/shift-adapter';
import i18n from '@/i18n';
import {useScheduleDisplay} from '@/pages/make-shift/model/use-schedule-display';
import {useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import {isScheduleRosterChangedApiError} from '@/shared/api/error';
import WardAPI from '@/shared/api/ward';
import purpleWarnIcon from '@/shared/assets/images/purple-warn-icon.webp';
import {isAiAdjustEnabled} from '@/shared/config/feature-flags';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';
import PageState from '@/shared/ui/PageState';
import {useNavigationBarFoldStore} from '@/widgets/navigation-bar/navigation-bar-fold-store';
import {hasEditableDutyDocChanges, useAiAutofillExitGuardStore} from '../../../model/ai-autofill-exit-guard';
import {describeAdjustChanges, mergeAdjustPatch, prepareAdjustDoc, type TAdjustApplyResult} from '../../../model/ai-adjust-conversation';
import {
    autofillCompletionKey,
    readAutofillCompletion,
    writeAutofillCompletion,
    canConfirmAiAutofill,
    isScheduleFullyProtected,
    type TAiAutofillStatus,
} from '../../../model/ai-autofill-state';
import {carryOverOptions} from '../../../model/ai-carry-over';
import {aiConversationFailure, type TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {aiExecutionFailure, isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import {requestAiSchedule} from '../../../model/ai-schedule-provider';
import {isMakeShiftTeamReadyForWard, useMakeShiftStore} from '../../../model/make-shift-store';
import {useMakeShiftUseCase} from '../../../model/make-shift-use-case';
import {sortScheduleByTeamNurseOrder} from '../../../model/nurse-order-sync';
import {syncNextMonthRestCarryOver} from '../../../model/rest-carry-over';
import {useRestTargetAdjustment} from '../../../model/rest-target-adjustment';
import {calculateRestCheckByShiftNurse} from '../../../model/rest-target-days';
import {
    markCarryOverAnswered,
    promotableRuleRequests,
    toTextRequestItems,
    type TInterpretCardItem,
    toInterpretCells,
} from '../../../model/schedule-month-requests';
import {useSchedulePublishSuccessStore} from '../../../model/schedule-publish-success-store';
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
import {ScheduleDisplayMenu} from '../shared/schedule-display-menu';
import {useDutyEditorStep} from '../shared/use-duty-editor-step';
import AiAdjustDialog from './ai-adjust-dialog';
import AiConversationSidebar from './ai-conversation-sidebar';
import AiAdjustResultNote from './ai-adjust-result-note';
import type {TAdjustTextInputHandle} from './ai-adjust-text-input';
import {AiAutofillLoadingOverlay} from './ai-autofill-loading-overlay';
import {AiAutofillPreparation, type TAutofillFlow, type TAutofillMessage} from './ai-autofill-preparation';
import {AiAutofillToolbar} from './ai-autofill-toolbar';
import AiCarryOverCard from './ai-carry-over-card';
import {AiGoalCandidateReview} from './ai-goal-candidate-review';
import AiPromoteRulesDialog from './ai-promote-rules-dialog';
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
type TAiFillDecisionContext = {cellCount: number};

type TSelectionFixedStats = {
    fixableFilledCount: number;
    fixedCount: number;
};

type TGoalCandidateResponse = Pick<TAutofillResponse, 'changedCells'> &
    Partial<Pick<TAutofillResponse, 'validation' | 'requestRuleResults' | 'adjustmentNotices'>> & {
        goalCandidate: NonNullable<TAutofillResponse['goalCandidate']>;
    };

type TGoalCandidateReview = {
    response: TGoalCandidateResponse;
    goalResult: TScheduleGoalResult;
    originalShift: TShift;
};

const goalCandidateStorageKey = (wardId: number, shiftTeamId: number, year: number, month: number) =>
    `dutying:goal-candidate:${wardId}:${shiftTeamId}:${year}:${month}`;

type TStoredGoalCandidate = {candidateId: string; applyEventId?: string};

type TCandidateCellState = 'APPLIED' | 'BASE' | 'MODIFIED';

const readStoredGoalCandidate = (key: string): TStoredGoalCandidate | null => {
    try {
        const value = window.localStorage.getItem(key);

        if (!value) return null;

        let parsed: Partial<TStoredGoalCandidate>;

        try {
            parsed = JSON.parse(value) as Partial<TStoredGoalCandidate>;
        } catch {
            return {candidateId: value};
        }

        return typeof parsed.candidateId === 'string'
            ? {candidateId: parsed.candidateId, applyEventId: parsed.applyEventId}
            : {candidateId: value};
    } catch {
        return null;
    }
};
const writeStoredGoalCandidate = (key: string, candidate: TStoredGoalCandidate | null) => {
    try {
        if (candidate) window.localStorage.setItem(key, JSON.stringify(candidate));
        else window.localStorage.removeItem(key);
    } catch {
        // private browsing 등 저장소를 쓸 수 없는 환경에서는 현재 탭의 검토만 제공한다.
    }
};

function candidateCellValue(cell: TSnapshotCellDTO, shiftCodeByTypeId: Map<number, string>) {
    if (cell.wardShiftTypeId != null) return shiftCodeByTypeId.get(cell.wardShiftTypeId) ?? null;

    return cell.shiftCode && cell.shiftCode.length > 0 ? cell.shiftCode : null;
}

/**
 * 새로고침 뒤에는 후보 출력이 브라우저의 미확정 draft에만 있던 경우가 있다. 후보가 이미
 * 반영됐는지, 실행 전 표인지, 또는 사람이 일부를 고쳤는지를 changed/revert 셀로 구분한다.
 * MODIFIED에는 절대 후보를 다시 덮어쓰지 않는다.
 */
function candidateCellState(
    doc: TDutyDoc,
    originalShift: TShift,
    changedCells: TSnapshotCellDTO[],
    revertCells: TSnapshotCellDTO[],
): TCandidateCellState {
    const revertByCell = new Map(revertCells.map((cell) => [`${cell.shiftNurseId}|${cell.date}`, cell]));
    const shiftCodeByTypeId = new Map(originalShift.wardShiftTypes.map((type) => [type.wardShiftTypeId, type.shortName]));

    let matchesApplied = true;
    let matchesBase = true;

    for (const changed of changedCells) {
        const row = doc.rows.find((entry) => entry.workerId === String(changed.shiftNurseId));
        const col = doc.columns.indexOf(changed.date);
        const reverted = revertByCell.get(`${changed.shiftNurseId}|${changed.date}`);

        if (!row || col < 0 || !reverted) return 'MODIFIED';

        const current = row.cells[col] ?? null;

        if (current !== candidateCellValue(changed, shiftCodeByTypeId)) matchesApplied = false;

        if (current !== candidateCellValue(reverted, shiftCodeByTypeId)) matchesBase = false;
    }

    if (matchesApplied) return 'APPLIED';

    if (matchesBase) return 'BASE';

    return 'MODIFIED';
}

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
    const [batchKey, setBatchKey] = useState(() => new URLSearchParams(window.location.search).get('commercialBatch'));
    const [loadingBatch, setLoadingBatch] = useState(false);
    const batchCopy = (ko: string, en: string) => (i18n.language.startsWith('ko') ? ko : en);
    const {t} = useTypedTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
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
    const accountId = useAuthStore((state) => state.accountId);
    const completionStorageKey =
        wardId != null && currentShiftTeamId != null ? autofillCompletionKey(accountId, wardId, currentShiftTeamId, year, month) : null;
    const commands = useShiftEditorCommands();
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const selection = useShiftEditorStore((s) => s.selection);
    const history = useShiftEditorStore((s) => s.history);
    const rulesHash = useShiftEditorStore((s) => s.rulesHash);
    // 조절 칩 노출 여부. 서버가 사람 단위로 판정해 workspace 응답에 실어 준다 —
    // 프론트는 그것을 그대로 따른다(`isAiAdjustEnabled` 참고).
    const autofillAdjustEnabled = useShiftEditorStore((s) => s.autofillAdjustEnabled);
    const isAdjustEnabled = isAiAdjustEnabled(autofillAdjustEnabled);
    const conversationEnabled = useShiftEditorStore((s) => s.conversationEnabled);
    const [conversationGenerationRequest, setConversationGenerationRequest] = useState(0);
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
    const [hasGeneratedSchedule, setHasGeneratedSchedule] = useState(false);
    const rememberGeneratedSchedule = useCallback(() => {
        setHasGeneratedSchedule(true);
        writeAutofillCompletion(completionStorageKey, true);
    }, [completionStorageKey]);
    const [hasGenerationNotice, setHasGenerationNotice] = useState(false);
    const [generationFailure, setGenerationFailure] = useState<TAiConversationFailure | null>(null);
    const [generationReviewMessage, setGenerationReviewMessage] = useState<string | null>(null);
    const generationNoticeShownRef = useRef(false);
    const autofillSequence = useRef(0);
    const conversationSequence = useRef(0);
    const pendingAdjustmentPreparation = useRef<{resolve: () => void; reject: (reason: Error) => void} | null>(null);
    const cancelPendingAdjustmentPreparation = () => {
        pendingAdjustmentPreparation.current?.reject(Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true}));
        pendingAdjustmentPreparation.current = null;
    };
    const autofillContext = useRef<string | null>(null);
    const [autofillFlow, setAutofillFlow] = useState<TAutofillFlow | null>(null);
    const appendAutofillMessage = (message: TAutofillMessage) =>
        setAutofillFlow((flow) => (flow ? {...flow, messages: [...flow.messages, message]} : flow));
    const appendAutofillPrompt = (message: TAutofillMessage) =>
        setAutofillFlow((flow) => {
            if (!flow) return flow;

            const last = flow.messages[flow.messages.length - 1];

            return last?.role === 'assistant' && last.text === message.text ? flow : {...flow, messages: [...flow.messages, message]};
        });
    const [disablingRequestId, setDisablingRequestId] = useState<number | null>(null);
    const [isCarryingOver, setIsCarryingOver] = useState(false);
    const [isReviewingCarryOver, setIsReviewingCarryOver] = useState(false);
    const [carryOverSelection, setCarryOverSelection] = useState<number[] | null>(null);
    const [carryOverError, setCarryOverError] = useState<string | null>(null);
    const carryingOver = useRef(false);
    const carryOverMounted = useRef(true);
    const preparationPaused = useRef(false);
    const [lastAdjustChangedCount, setLastAdjustChangedCount] = useState<number | null>(null);
    const [lastAdjustFailure, setLastAdjustFailure] = useState<string | null>(null);
    const [lastRuleResults, setLastRuleResults] = useState<TScheduleRequestRuleResult[]>([]);
    const [lastGoalResult, setLastGoalResult] = useState<TScheduleGoalResult | null>(null);
    const [lastAdjustmentNotices, setLastAdjustmentNotices] = useState<NonNullable<TAutofillResponse['adjustmentNotices']>>([]);
    const [lastOffGoal, setLastOffGoal] = useState<NonNullable<TAutofillResponse['engineResult']>['offGoal']>(null);
    const [lastAdjustStrength, setLastAdjustStrength] = useState<TAutofillAdjustStrength>('NORMAL');
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
    const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
    // 확정 직전에 고른 승격 대상. ref 인 이유는 확정 경로가 여럿이기 때문이다(스냅샷 한도에
    // 걸려 한 번 더 도는 경로 포함). 상태로 두면 그중 하나가 갱신 전 값을 읽는다.
    const promoteRequestIdsRef = useRef<number[]>([]);
    const [lastShiftBlankWarningIntent, setLastShiftBlankWarningIntent] = useState<TLastShiftBlankWarningIntent | null>(null);
    const [lastShiftBlankWarningAcknowledgedKey, setLastShiftBlankWarningAcknowledgedKey] = useState<string | null>(null);
    const [aiFillDecisionContext, setAiFillDecisionContext] = useState<TAiFillDecisionContext | null>(null);
    const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
    const [goalCandidateReview, setGoalCandidateReview] = useState<TGoalCandidateReview | null>(null);
    const [pendingGoalCandidateApplyEventId, setPendingGoalCandidateApplyEventId] = useState<string | null>(null);
    const restoringGoalCandidateKeyRef = useRef<string | null>(null);
    const aiFillDecisionFixedCellsRef = useRef<TDutyDoc['fixedCells'] | null>(null);
    const aiFillDecisionCellKeysRef = useRef<Set<string> | null>(null);
    const [bulkFixEntry, setBulkFixEntry] = useState<(typeof history.past)[number] | null>(null);
    const collapseNavigationBar = useNavigationBarFoldStore((s) => s.collapse);
    const invalidateSnapshots = useInvalidateScheduleSnapshots();
    const snapshotsQuery = useScheduleSnapshots({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isSnapshotSidebarOpen && isCurrentShiftTeamReady,
    });
    const {
        requests: monthRequests,
        refetch: refetchMonthRequests,
        isLoading: monthRequestsLoading,
        isError: monthRequestsError,
    } = useScheduleMonthRequests({
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isAdjustEnabled && isCurrentShiftTeamReady,
    });
    const carryOver = useScheduleCarryOverCandidates({
        accountId,
        wardId,
        shiftTeamId: currentShiftTeamId,
        year,
        month,
        enabled: isAdjustEnabled && isCurrentShiftTeamReady,
    });
    const carryOptions = useMemo(
        () => carryOverOptions(carryOver.candidates, monthRequests, editorDoc, year, month),
        [carryOver.candidates, monthRequests, editorDoc, year, month],
    );
    const carrySelectedIds = carryOptions
        .filter(({request, unavailable}) => !unavailable && (carryOverSelection === null || carryOverSelection.includes(request.id)))
        .map(({request}) => request.id);
    const syncMonthRequests = useCallback(async () => {
        await refetchMonthRequests();
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
    const hasNursesToConnect = connectedNurseCount === 0 || connectedNurseCount < currentTeamNurses.length;
    const {policy} = useRestLeavePolicy(wardId);
    const {adjustmentDays} = useRestTargetAdjustment({wardId, shiftTeamId: currentShiftTeamId, year, month});
    const promotableRules = useMemo(() => promotableRuleRequests(monthRequests), [monthRequests]);
    const aiRequestSeqRef = useRef(0);
    // The conversation keeps examples and revisions in the same input.
    const adjustTextInputRef = useRef<TAdjustTextInputHandle>(null);
    const adjustActionRef = useRef<{fingerprint: string; key: string} | null>(null);
    const interpretedRevisionRef = useRef<number | null>(null);
    const interpretSeqRef = useRef(0);
    useEffect(() => {
        if (!isAdjustDialogOpen || !isAdjustEnabled) return;

        collapseNavigationBar();
        setIsSnapshotSidebarOpen(false);
    }, [isAdjustDialogOpen, isAdjustEnabled, collapseNavigationBar]);
    useEffect(() => {
        if (isAdjustDialogOpen) void refetchMonthRequests();
    }, [isAdjustDialogOpen, refetchMonthRequests]);
    const aiAbortControllerRef = useRef<AbortController | null>(null);
    const aiEffectDismissTimerRef = useRef<number | null>(null);
    const currentAiContextRef = useRef({wardId, shiftTeamId: currentShiftTeamId, year, month});
    const savedEditableDocRef = useRef<TDutyDoc | null>(null);
    const savedEditableContextKeyRef = useRef<string | null>(null);
    const lastAiGeneratedDocRef = useRef<TDutyDoc | null>(null);
    // 마지막 근무 공란 경고를 거친 뒤에도, 조절에서 시작한 "고정 근무 확인" 단계를 잃지 않는다.
    const [savedEditableDocVersion, setSavedEditableDocVersion] = useState(0);
    const [hasAiGeneratedUnsavedChanges, setHasAiGeneratedUnsavedChanges] = useState(false);
    const setExitGuard = useAiAutofillExitGuardStore((s) => s.setExitGuard);
    const resetExitGuard = useAiAutofillExitGuardStore((s) => s.resetExitGuard);
    const currentContextKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}`;

    useEffect(() => {
        if (wardId == null || currentShiftTeamId == null || !orderedShift) return;

        const storageKey = goalCandidateStorageKey(wardId, currentShiftTeamId, year, month);
        const stored = readStoredGoalCandidate(storageKey);
        const restoringKey = stored ? `${storageKey}:${stored.candidateId}` : null;

        if (!stored || goalCandidateReview || restoringGoalCandidateKeyRef.current === restoringKey) return;

        restoringGoalCandidateKeyRef.current = restoringKey;

        let active = true;

        void WardAPI.getScheduleGoalCandidate(wardId, currentShiftTeamId, stored.candidateId)
            .then((detail) => {
                if (!active) return;

                if (
                    detail.candidate.applicationStatus === 'UNDONE' ||
                    detail.candidate.applicationStatus === 'CONFIRMED' ||
                    detail.candidate.applicationStatus === 'CONFIRMED_MODIFIED'
                ) {
                    writeStoredGoalCandidate(storageKey, null);
                    restoringGoalCandidateKeyRef.current = null;

                    return;
                }

                if (detail.candidate.applicationStatus === 'APPLIED') {
                    const state = candidateCellState(
                        useShiftEditorStore.getState().doc,
                        orderedShift,
                        detail.changedCells,
                        detail.revertCells,
                    );

                    // 새 탭·새로고침에서 후보 반영 전 표만 복원한다. 편집 history가 있거나
                    // 후보 셀 일부가 다르면 사람이 고친 표이므로 절대 덮어쓰지 않는다.
                    if (state === 'BASE' && useShiftEditorStore.getState().history.past.length === 0) {
                        commands.applyChangedCells(detail.changedCells, orderedShift, 'ai');
                    }
                }

                setGoalCandidateReview({
                    response: {
                        goalCandidate: detail.candidate,
                        changedCells: detail.changedCells,
                    },
                    goalResult: detail.goalResult,
                    originalShift: orderedShift,
                });
                setPendingGoalCandidateApplyEventId(stored.applyEventId ?? null);
            })
            .catch(() => {
                // 후보가 삭제되거나 다른 병동의 id인 경우 로컬 참조만 지운다. 표는 바꾸지 않는다.
                if (active) {
                    writeStoredGoalCandidate(storageKey, null);
                    restoringGoalCandidateKeyRef.current = null;
                }
            });

        return () => {
            active = false;
        };
    }, [currentShiftTeamId, goalCandidateReview, orderedShift, wardId, year, month]);

    currentAiContextRef.current = {wardId, shiftTeamId: currentShiftTeamId, year, month};

    const markEditableDocSaved = useCallback((doc: TDutyDoc = useShiftEditorStore.getState().doc) => {
        savedEditableDocRef.current = doc;
        setHasAiGeneratedUnsavedChanges(false);
        setSavedEditableDocVersion((version) => version + 1);
    }, []);
    const markLastAiGeneratedDoc = useCallback((doc: TDutyDoc | null) => {
        lastAiGeneratedDocRef.current = doc;
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
        isCarryingOver ||
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
        setGenerationReviewMessage(null);
        setHasGeneratedSchedule(readAutofillCompletion(completionStorageKey));
        setHasGenerationNotice(false);
        setGenerationFailure(null);
        setAutofillFlow(null);
        generationNoticeShownRef.current = false;
        conversationSequence.current += 1;
        cancelPendingAdjustmentPreparation();
        setConversationGenerationRequest(0);
        setIsReviewingCarryOver(false);
        setCarryOverSelection(null);
        setCarryOverError(null);
        setIsCarryingOver(false);
        preparationPaused.current = false;
        setIsAdjustDialogOpen(false);
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
        aiFillDecisionCellKeysRef.current = null;
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
    }, [wardId, currentShiftTeamId, year, month, completionStorageKey, hideAiEffect, markLastAiGeneratedDoc, resetAiStatus]);

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
    const annualLeave = useAnnualLeaveSchedule(wardId, currentShiftTeamId, year, month, orderedShift, editorDoc);
    const display = useScheduleDisplay(wardId);
    const annualColumns = useAnnualLeaveScheduleColumns(annualLeave, display.value.annualLeave);
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
                      language,
                      annualLeaveDays: annualLeave.data?.days ?? annualLeave.overview.data?.days,
                  })
                : undefined,
        [annualLeave.data?.days, annualLeave.overview.data?.days, adjustmentDays, hydratedDoc, language, month, orderedShift, policy, year],
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
    const isAutofillBlocked = isScheduleFullyProtected(editorDoc);
    const isAdjustAvailable = isAdjustEnabled || conversationEnabled;
    const clearableUnlockedCellCount = unprotectedFilledCells.length;
    const aiFillDecisionFixableCells = unprotectedFilledCells;
    const hasFilledPreparationCells = editorDoc.rows.some((row) => row.cells.some((cell) => cell != null));
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

        const publishResult = await WardAPI.publishSnapshot(wardId, currentShiftTeamId, snapshot.snapshotId, {
            overwriteWardShift: true,
            applyRowOrder: true,
            // 고른 것이 없으면 키를 넣지 않는다. 승격은 기본 미선택이고, 안 고른 확정의
            // 본문은 이 기능 도입 전과 같아야 한다.
            ...(promoteRequestIdsRef.current.length > 0 ? {promoteRequestIds: promoteRequestIdsRef.current} : {}),
            ...(goalCandidateReview?.response.goalCandidate?.applicationStatus === 'APPLIED'
                ? {goalCandidateId: goalCandidateReview.response.goalCandidate.candidateId}
                : {}),
        });

        setGoalCandidateReview((current) =>
            current?.response.goalCandidate?.applicationStatus === 'APPLIED'
                ? {
                      ...current,
                      response: {
                          ...current.response,
                          goalCandidate: {
                              ...current.response.goalCandidate,
                              applicationStatus: publishResult?.goalCandidateStatus ?? 'CONFIRMED',
                          },
                      },
                  }
                : current,
        );

        if (goalCandidateReview?.response.goalCandidate?.applicationStatus === 'APPLIED') {
            writeStoredGoalCandidate(goalCandidateStorageKey(wardId, currentShiftTeamId, year, month), null);
            setPendingGoalCandidateApplyEventId(null);
        }

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
            language,
        });
        const queryKey = wardQueryOptions.duty(wardId, currentShiftTeamId, year, month).queryKey;

        markEditableDocSaved(docToPublish);
        useCase.confirm(nextShift);
        void queryClient.invalidateQueries({queryKey: ['annualLeave', wardId]});
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
        } catch (error) {
            if (!isScheduleRosterChangedApiError(error)) {
                toast.error(t('page.makeShift.aiRefill.saveSnapshotFailed'), {id: 'make-shift-snapshot-save-progress'});
            }
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
            setHasGeneratedSchedule(false);
            writeAutofillCompletion(completionStorageKey, false);

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
            toast.dismiss(progressToastId);
            useSchedulePublishSuccessStore.getState().show({
                connectedNurseCount,
                showConnectionHint: hasNursesToConnect,
            });
        } catch (error) {
            if (!isScheduleRosterChangedApiError(error)) {
                toast.error(t('page.makeShift.aiRefill.saveFailed'), {id: progressToastId});
            }
        } finally {
            setIsWorking(false);
        }
    };
    /** 승격 질문을 지난 뒤의 확정. 수신자가 있으면 한 번 더 묻고, 없으면 바로 확정한다. */
    const continueConfirmAfterPromote = () => {
        if (connectedNurseCount === 0) {
            void confirmCurrentSchedule();

            return;
        }

        setPublishConfirmOpen(true);
    };
    const handleConfirm = () => {
        if (!isCurrentShiftTeamReady || !wardId || !currentShiftTeamId || !orderedShift || !canConfirm) return;

        if (requestLastShiftBlankWarning('confirm')) return;

        // 이번 달에 문장으로 건 규칙이 있으면 확정 전에 한 번 묻는다. 안 물으면 그 규칙은
        // 이번 달로 끝나고, 사용자는 다음 달에 같은 문장을 다시 써야 한다는 사실을 모른다.
        promoteRequestIdsRef.current = [];

        if (promotableRules.length > 0) {
            setPromoteDialogOpen(true);

            return;
        }

        continueConfirmAfterPromote();
    };
    const handlePromoteConfirm = (requestIds: number[]) => {
        promoteRequestIdsRef.current = requestIds;
        setPromoteDialogOpen(false);
        continueConfirmAfterPromote();
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
            } catch (error) {
                if (!isScheduleRosterChangedApiError(error)) {
                    toast.error(t('page.makeShift.aiRefill.saveSnapshotFailed'), {id: 'make-shift-snapshot-save-progress'});
                }
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
            toast.dismiss(progressToastId);
            useSchedulePublishSuccessStore.getState().show({
                connectedNurseCount,
                showConnectionHint: hasNursesToConnect,
            });
        } catch (error) {
            if (!isScheduleRosterChangedApiError(error)) {
                toast.error(t('page.makeShift.aiRefill.saveFailed'), {id: progressToastId});
            }
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
    const runAiFill = async (
        readyContext = getAiFillReadyContext(),
        adjust?: TAutofillAdjustDto,
        prompt?: string,
        action?: {doc: TDutyDoc; idempotencyKey: string},
    ) => {
        if (!readyContext) {
            setIsAiBlankPreviewVisible(false);

            return;
        }

        if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) return {error: t('aiAdjust.allFixed')};

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

        if (!adjust) setGenerationFailure(null);

        if (adjust) setLastAdjustFailure(null);

        let shouldKeepAiEffectVisible = false;

        try {
            const stateBeforeRequest = useShiftEditorStore.getState();
            const requestDoc = action?.doc ?? stateBeforeRequest.doc;
            // 조절은 고정·신청 근무와 자동완성 이후의 수동 편집을 보호한다.
            const adjustLocked = adjust
                ? adjustLockedCellKeys(
                      requestDoc,
                      getEditedFilledCellsSinceBaseline(stateBeforeRequest.doc, lastAiGeneratedDocRef.current),
                  )
                : undefined;
            const result = await requestAiSchedule({
                wardId: requestContext.wardId,
                shiftTeamId: requestContext.shiftTeamId,
                year: requestContext.year,
                month: requestContext.month,
                doc: requestDoc,
                ...(action ? {idempotencyKey: action.idempotencyKey} : {}),
                originalShift: readyContext.originalShift,
                draftRevision: stateBeforeRequest.draftRevision,
                rulesHash: readyContext.rulesHash,
                prompt,
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
                const failure =
                    result.failure ??
                    aiConversationFailure(
                        result.notAllowed ? {serverCode: 'SCHEDULE_AUTOFILL_ADJUST_NOT_ALLOWED'} : {message: result.message},
                        t(adjust ? 'page.makeShift.aiRefill.adjust.failed' : 'page.makeShift.aiRefill.requestFailed'),
                    );

                setAiStatus('error');

                if (!adjust) setGenerationFailure(failure);

                setIsAdjustDialogOpen(true);

                // 실패했는데 결과 문구가 남으면, 사용자는 그 방향이 반영된 표를 보고 있다고
                // 믿는다. 서버 목록을 다시 읽는다 — 쿼터에 걸린 조절도 요청 행은 남으므로
                // (다음 실행에 적용된다) 목록이 진실이다.
                // 취소(canceled)는 위에서 먼저 빠져나가므로 여기 오지 않는다.
                if (adjust) {
                    setLastAdjustChangedCount(null);
                    setLastAdjustFailure(result.message || t('page.makeShift.aiRefill.adjust.failed'));
                    setIsAdjustDialogOpen(true);
                    void refetchMonthRequests();
                }

                // Failure details and recovery remain in the chat; do not duplicate them in a transient toast.

                if (result.conflict) {
                    await queryClient.invalidateQueries({
                        queryKey: [
                            'ward',
                            requestContext.wardId,
                            'shift-team',
                            requestContext.shiftTeamId,
                            'schedule-workspace',
                            requestContext.year,
                            requestContext.month,
                        ],
                    });
                }
                return {
                    error: result.conflict ? t('aiAdjust.conflict') : failure.message,
                    failure,
                    requiresReinterpret: result.conflict,
                };
            }

            if (result.response.draftRevision !== useShiftEditorStore.getState().draftRevision) {
                const failure = {message: t('aiAdjust.stale'), blocked: false};

                if (!adjust) setGenerationFailure(failure);

                setIsAdjustDialogOpen(true);
                setAiStatus('error');

                return {error: failure.message, failure, requiresReinterpret: true};
            }
            if (adjust && result.response.operationType !== 'ADJUST') return {error: t('aiAdjust.unexpectedOperation')};

            const executionFailure = aiExecutionFailure(result.response);

            if (executionFailure) {
                setLastAdjustChangedCount(null);
                if (adjust) setLastAdjustFailure(executionFailure.message);
                else setGenerationFailure(executionFailure);
                setAiStatus('error');
                setIsAdjustDialogOpen(true);
                void refetchMonthRequests();
                return {error: executionFailure.message, failure: executionFailure};
            }

            const goalResult = result.response.goalResults?.[0];

            if (adjust && result.response.goalCandidate && goalResult) {
                // 목표 조절은 검토 전에는 표에 적용하지 않는다. candidate의 입력 판본을 함께
                // 보존해 두었다가 적용 버튼 순간에 다시 비교한다.
                setGoalCandidateReview({
                    response: {...result.response, goalCandidate: result.response.goalCandidate},
                    goalResult,
                    originalShift: readyContext.originalShift,
                });

                if (wardId != null && currentShiftTeamId != null) {
                    writeStoredGoalCandidate(goalCandidateStorageKey(wardId, currentShiftTeamId, year, month), {
                        candidateId: result.response.goalCandidate.candidateId,
                    });
                    setPendingGoalCandidateApplyEventId(null);
                }

                setIsAdjustDialogOpen(true);
                setLastGoalResult(goalResult);
                setAiStatus('success');
                void refetchMonthRequests();
                return {response: result.response, applied: false};
            }

            if (adjust && goalResult) {
                // 재검증이 필수 목표 미달을 보았거나 엔진이 시간 제한으로 후보를 확정하지
                // 못한 경우다. changedCells가 응답에 있어도 절대로 표에 반영하지 않는다.
                setLastGoalResult(goalResult);
                setLastAdjustChangedCount(null);
                setLastAdjustFailure(null);
                setAiStatus('error');
                toast.error(
                    goalResult.required
                        ? '필수 목표를 달성하지 못해 결과를 적용하지 않았어요.'
                        : '요청한 방향으로 조절한 근무표를 제공하지 못했어요. 기존 근무표는 그대로예요.',
                );

                void refetchMonthRequests();
                return {error: t('aiAdjust.reviewCandidate')};
            }

            if (adjust || action) {
                const nextDoc = mergeAdjustPatch(
                    requestDoc,
                    result.response.changedCells,
                    new Map(readyContext.originalShift.wardShiftTypes.map((type) => [type.wardShiftTypeId, type.shortName])),
                );
                commands.applyAdjustedDoc(nextDoc);
            } else {
                commands.applyChangedCells(result.response.changedCells, readyContext.originalShift, 'ai');
            }

            const docAfterApply = useShiftEditorStore.getState().doc;

            markLastAiGeneratedDoc(docAfterApply);
            setHasAiGeneratedUnsavedChanges(describeAdjustChanges(stateBeforeRequest.doc, docAfterApply).length > 0);
            commands.setScheduleValidationFromApi(result.validation);

            if (!adjust && result.response.operationType === 'GENERATE') {
                const review = isGenerateReviewDraft(result.response);

                setGenerationReviewMessage(review ? result.response.unmetInstructions[0] || '' : null);

                if (review) {
                    setShowFaults(true);
                    setGenerationFailure(null);
                    rememberGeneratedSchedule();
                }
            }

            // 월간 요청은 일반 자동완성에도 다시 적용된다. 병동 규칙 shadow 안내 역시
            // 조절 직후뿐 아니라 재생성 결과에서 계속 보여야 한다.
            setLastAdjustmentNotices(result.response.adjustmentNotices ?? []);

            if (adjust) {
                // Include accepted explicit cells and count only changes actually committed to the draft.
                const movedCount = describeAdjustChanges(stateBeforeRequest.doc, docAfterApply).length;

                setLastAdjustChangedCount(movedCount);
                setLastAdjustFailure(null);
                setLastRuleResults(result.response.requestRuleResults ?? []);
                setLastGoalResult(null);
                setLastOffGoal(result.response.engineResult?.offGoal ?? null);
                setLastAdjustStrength(adjust.strength);

                void syncMonthRequests();
            }

            shouldKeepAiEffectVisible = !adjust;
            if (!adjust) scheduleAiEffectDismiss();
            setAiStatus('success');
            setHasCompletedAiFill(true);

            if (!adjust) {
                const generationSucceeded =
                    result.response.operationType === 'GENERATE' &&
                    ['ACCEPTED', 'REPAIRED'].includes(result.response.engineResult?.status ?? '');

                if (generationSucceeded) {
                    rememberGeneratedSchedule();

                    if (isAdjustEnabled && !generationNoticeShownRef.current) {
                        generationNoticeShownRef.current = true;
                        setHasGenerationNotice(true);
                        setIsAdjustDialogOpen(true);
                    }
                }

                // 요청은 서버 상태라 새로 생성해도 남는다(목록 문구로 그렇게 안내한다).
                // 바뀐 칸 수와 잔여 위반만 지난 조절의 것이므로 지운다.
                setLastAdjustChangedCount(null);
                setLastRuleResults([]);
                setLastOffGoal(null);
            }
            return {response: result.response, applied: true};
        } catch (error) {
            if (abortController.signal.aborted || aiRequestSeqRef.current !== requestSeq) return;

            const failure = aiConversationFailure(error);

            setAiStatus('error');
            setIsAdjustDialogOpen(true);

            if (!adjust) setGenerationFailure(failure);

            return {error: failure.message, failure};
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
        setHasGeneratedSchedule(false);
        writeAutofillCompletion(completionStorageKey, false);
        resetAiStatus();
        toast.success(t('page.makeShift.aiRefill.clearUnlockedCellsSuccess', {count: changedCount}));
    };
    /**
     * 요청을 끈다(PATCH DISABLED). ✕는 설정만 바꾸는 액션이므로 여기서 자동완성을 다시
     * 실행하지 않는다. 바뀐 설정으로 표를 다시 풀고 싶을 때는 사용자가 "다시 생성"을 누른다.
     */
    const disableMonthRequests = async (
        targets: TScheduleMonthRequestRes[],
        readyContext: NonNullable<ReturnType<typeof getAiFillReadyContext>>,
    ) => {
        if (targets.length > 0) {
            setDisablingRequestId(targets[0]!.id);

            try {
                for (const target of targets) {
                    await WardAPI.updateScheduleMonthRequest(readyContext.wardId, readyContext.shiftTeamId, target.id, {
                        status: 'DISABLED',
                    });
                }
            } catch {
                toast.error(t('page.makeShift.aiRefill.adjust.failed'));

                return;
            } finally {
                setDisablingRequestId(null);
            }
        }

        void syncMonthRequests();
    };
    /** 목록의 ✕는 요청만 끈다. 자동채우기는 대화상자의 "다시 생성"에서만 시작한다. */
    const handleDisableMonthRequest = (request: TScheduleMonthRequestRes) => {
        const readyContext = getAiFillReadyContext();

        if (!readyContext) return;

        void disableMonthRequests([request], readyContext);
    };
    const interpretAdjustText = async (text: string) => {
        if (wardId == null || currentShiftTeamId == null) throw new Error(t('aiAdjust.failed'));
        const seq = ++interpretSeqRef.current;
        const revision = useShiftEditorStore.getState().draftRevision;
        const [result] = await Promise.all([
            WardAPI.interpretScheduleAdjust(wardId, currentShiftTeamId, {
                text,
                language: (i18n.resolvedLanguage ?? i18n.language ?? 'ko').split('-')[0],
                year,
                month,
            }),
            refetchMonthRequests(),
        ]);
        if (seq === interpretSeqRef.current) interpretedRevisionRef.current = revision;
        return result;
    };
    const handleApplyTextRequests = async (
        items: TInterpretCardItem[],
        requestText: string,
        strength: TAutofillAdjustStrength,
        llmPrompt?: string,
        actionKey?: string,
    ): Promise<TAdjustApplyResult> => {
        const conversation = conversationSequence.current;
        let readyContext = getAiFillReadyContext();
        if (!readyContext) throw new Error(t('page.makeShift.aiRefill.cannotAutofillYet'));

        let before = useShiftEditorStore.getState();
        if (interpretedRevisionRef.current !== before.draftRevision)
            throw Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true});
        const latestRequests = await refetchMonthRequests();
        if (conversationSequence.current !== conversation)
            throw Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true});
        if (!latestRequests) throw new Error(t('aiAdjust.requestsFailed'));
        const activeFingerprint = (requests: TScheduleMonthRequestRes[]) =>
            JSON.stringify(requests.filter((entry) => entry.status === 'ACTIVE'));
        if (activeFingerprint(latestRequests) !== activeFingerprint(monthRequests))
            throw Object.assign(new Error(t('aiAdjust.requestsChanged')), {requiresConfirmation: true});
        if (useShiftEditorStore.getState().draftRevision !== before.draftRevision)
            throw Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true});
        const currentScope = currentAiContextRef.current;
        if (
            currentScope.wardId !== readyContext.wardId ||
            currentScope.shiftTeamId !== readyContext.shiftTeamId ||
            currentScope.year !== year ||
            currentScope.month !== month
        )
            throw Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true});
        if (
            items.some(({item}) =>
                item.kind === 'CELL'
                    ? item.nurseId == null || !item.date || !item.shiftCode
                    : item.kind === 'CELL_SET' && (!item.nurseIds?.length || !item.dates?.length || !item.shiftCode),
            )
        )
            throw new Error(t('aiAdjust.invalidCell'));

        await prepareAdjustment();

        if (conversationSequence.current !== conversation)
            throw Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true});

        const attempt = autofillSequence.current;

        before = useShiftEditorStore.getState();

        const checkedRequests = await refetchMonthRequests();

        if (!checkedRequests || activeFingerprint(checkedRequests) !== activeFingerprint(latestRequests))
            throw Object.assign(new Error(t('aiAdjust.requestsChanged')), {requiresConfirmation: true});

        const scope = currentAiContextRef.current;

        if (
            attempt !== autofillSequence.current ||
            conversationSequence.current !== conversation ||
            scope.wardId !== readyContext.wardId ||
            scope.shiftTeamId !== readyContext.shiftTeamId ||
            scope.year !== year ||
            scope.month !== month ||
            before.draftRevision !== useShiftEditorStore.getState().draftRevision
        )
            throw Object.assign(new Error(t('aiAdjust.stale')), {requiresReinterpret: true});

        readyContext = getAiFillReadyContext();

        if (!readyContext) throw new Error(t('page.makeShift.aiRefill.cannotAutofillYet'));

        // The user has now reviewed the current previous-month cells and fixed shifts.
        interpretedRevisionRef.current = before.draftRevision;
        const requests = toTextRequestItems(items, requestText);
        let prepared: TDutyDoc;
        try {
            prepared = prepareAdjustDoc(
                before.doc,
                toInterpretCells(items),
                readyContext.originalShift.wardShiftTypes.map((type) => type.shortName),
            );
        } catch (error) {
            throw new Error(t(error instanceof Error && error.message === 'LOCKED_CELL' ? 'aiAdjust.lockedCell' : 'aiAdjust.invalidCell'));
        }
        const fingerprint = JSON.stringify({
            actionKey,
            requests,
            strength,
            llmPrompt,
            doc: prepared,
            revision: before.draftRevision,
            rulesHash: readyContext.rulesHash,
        });
        if (adjustActionRef.current?.fingerprint !== fingerprint) adjustActionRef.current = {fingerprint, key: crypto.randomUUID()};
        setLastAdjustChangedCount(null);

        const result = await runAiFill(readyContext, {strength, requests}, llmPrompt, {
            doc: prepared,
            idempotencyKey: adjustActionRef.current.key,
        });
        if (!result || 'error' in result)
            throw Object.assign(new Error(result?.error ?? t('aiAdjust.failed')), {
                requiresReinterpret: result?.requiresReinterpret,
                failure: result && 'failure' in result ? result.failure : undefined,
            });
        const after = useShiftEditorStore.getState();
        return {
            response: result.response,
            applied: result.applied,
            changes: result.applied ? describeAdjustChanges(before.doc, after.doc) : [],
            ...(result.applied && before.history !== after.history ? {undoRevision: after.draftRevision} : {}),
        };
    };
    const applyGoalCandidate = async () => {
        if (!goalCandidateReview?.response.goalCandidate || !goalCandidateReview.originalShift) return;

        const {response, goalResult, originalShift} = goalCandidateReview;
        const candidate = response.goalCandidate;

        if (!candidate) return;

        const currentRevision = useShiftEditorStore.getState().draftRevision;

        if (currentRevision !== candidate.baseDraftRevision) {
            toast.error('표가 변경되어 이전 조절 후보를 적용할 수 없어요. 다시 계산해 주세요.');

            return;
        }

        if (goalResult.required && goalResult.goalStatus !== 'SATISFIED') return;

        if (wardId == null || currentShiftTeamId == null) return;

        const applyEventId = pendingGoalCandidateApplyEventId ?? crypto.randomUUID();

        setPendingGoalCandidateApplyEventId(applyEventId);
        writeStoredGoalCandidate(goalCandidateStorageKey(wardId, currentShiftTeamId, year, month), {
            candidateId: candidate.candidateId,
            applyEventId,
        });

        let persisted;

        try {
            persisted = await WardAPI.applyScheduleGoalCandidate(wardId, currentShiftTeamId, candidate.candidateId, {
                eventId: applyEventId,
                draftRevision: currentRevision,
                cells: docToSnapshotCellsDTO(useShiftEditorStore.getState().doc, originalShift),
            });
        } catch {
            toast.error('표가 변경되었거나 이미 처리된 후보라 적용할 수 없어요.');

            return;
        }

        if (persisted.candidate.applicationStatus !== 'APPLIED') return;

        setPendingGoalCandidateApplyEventId(null);
        writeStoredGoalCandidate(goalCandidateStorageKey(wardId, currentShiftTeamId, year, month), {
            candidateId: candidate.candidateId,
        });

        commands.applyChangedCells(persisted.changedCells, originalShift, 'ai');

        const docAfterApply = useShiftEditorStore.getState().doc;

        markLastAiGeneratedDoc(docAfterApply);
        setHasAiGeneratedUnsavedChanges(persisted.changedCells.length > 0);

        if (response.validation) commands.setScheduleValidationFromApi(response.validation);

        setLastAdjustChangedCount(persisted.changedCells.length);
        setLastRuleResults(response.requestRuleResults ?? []);
        setLastGoalResult(persisted.goalResult);
        setLastAdjustmentNotices(response.adjustmentNotices ?? []);
        setHasCompletedAiFill(true);
        setGoalCandidateReview((current) =>
            current?.response.goalCandidate
                ? {
                      ...current,
                      response: {
                          ...current.response,
                          goalCandidate: persisted.candidate,
                          changedCells: persisted.changedCells,
                          goalResults: [persisted.goalResult],
                      },
                  }
                : current,
        );
        void syncMonthRequests();
    };
    const undoWithGoalCandidate = async () => {
        const currentRevision = useShiftEditorStore.getState().draftRevision;
        const current = goalCandidateReview;

        if (current?.response.goalCandidate?.applicationStatus === 'APPLIED' && wardId != null && currentShiftTeamId != null) {
            try {
                const persisted = await WardAPI.undoScheduleGoalCandidate(
                    wardId,
                    currentShiftTeamId,
                    current.response.goalCandidate.candidateId,
                    {
                        eventId: crypto.randomUUID(),
                        draftRevision: currentRevision,
                        cells: docToSnapshotCellsDTO(useShiftEditorStore.getState().doc, current.originalShift),
                    },
                );

                if (persisted.candidate.applicationStatus !== 'UNDONE') return;

                // 페이지를 다시 열었어도 command history가 아니라 저장된 실행 직전 셀로 되돌린다.
                commands.applyChangedCells(persisted.revertCells, current.originalShift, 'ai');
                setGoalCandidateReview((latest) =>
                    latest ? {...latest, response: {...latest.response, goalCandidate: persisted.candidate}} : latest,
                );
                writeStoredGoalCandidate(goalCandidateStorageKey(wardId, currentShiftTeamId, year, month), null);
                setPendingGoalCandidateApplyEventId(null);
            } catch {
                toast.error('다른 편집이 있어 목표 조절 결과를 안전하게 되돌릴 수 없어요.');
            }

            return;
        }

        commands.undo();
    };
    const openAiFillDecision = (context: TAiFillDecisionContext) => {
        const doc = useShiftEditorStore.getState().doc;

        setBulkFixEntry(null);
        aiFillDecisionFixedCellsRef.current = {...doc.fixedCells};
        aiFillDecisionCellKeysRef.current = new Set(doc.rows.flatMap((row) => doc.columns.map((column) => `${row.workerId}|${column}`)));
        setAiFillDecisionContext(context);
    };
    const restoreAiFillDecisionFixedCells = () => {
        const snapshot = aiFillDecisionFixedCellsRef.current;
        const cellKeys = aiFillDecisionCellKeysRef.current;

        aiFillDecisionFixedCellsRef.current = null;
        aiFillDecisionCellKeysRef.current = null;

        if (!snapshot || !cellKeys) return;

        const currentDoc = useShiftEditorStore.getState().doc;
        const cellsToFix: TCellPos[] = [];
        const cellsToUnfix: TCellPos[] = [];

        for (let row = 0; row < currentDoc.rows.length; row += 1) {
            for (let col = 0; col < currentDoc.columns.length; col += 1) {
                const key = getDocCellKey(currentDoc, row, col);

                if (key === null || !cellKeys.has(key)) continue;

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
    const rollbackPreparationRef = useRef(restoreAiFillDecisionFixedCells);

    const resetAutofillConversation = () => {
        // Invalidate asynchronous work before returning to the entry choices. Keep the
        // current schedule and saved requests; only unconfirmed preparation is undone.
        conversationSequence.current += 1;
        autofillSequence.current += 1;
        autofillContext.current = null;
        interpretSeqRef.current += 1;
        interpretedRevisionRef.current = null;
        aiRequestSeqRef.current += 1;
        aiAbortControllerRef.current?.abort();
        aiAbortControllerRef.current = null;
        cancelPendingAdjustmentPreparation();
        restoreAiFillDecisionFixedCells();
        preparationPaused.current = false;
        setBulkFixEntry(null);
        setAiFillDecisionContext(null);
        setLastShiftBlankWarningIntent((intent) => (intent === 'aiFill' ? null : intent));
        setAutofillFlow(null);
        setIsReviewingCarryOver(false);
        setCarryOverSelection(null);
        setCarryOverError(null);
        setHasGenerationNotice(false);
        setGenerationFailure(null);
        generationNoticeShownRef.current = false;
        setIsAiGenerating(false);
        setIsAdjusting(false);
        setIsAiLoadingOverlayFinishing(false);
        setAiStartedAt(null);
        setIsAiBlankPreviewVisible(false);
        hideAiEffect();
        resetAiStatus();
    };

    rollbackPreparationRef.current = restoreAiFillDecisionFixedCells;
    useEffect(() => {
        carryOverMounted.current = true;

        return () => {
            carryOverMounted.current = false;
            rollbackPreparationRef.current();
            pendingAdjustmentPreparation.current?.reject(Object.assign(new Error('Conversation closed'), {requiresReinterpret: true}));
            pendingAdjustmentPreparation.current = null;
        };
    }, []);

    const startPreparedFill = () => {
        if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) return;
        const readyContext = getAiFillReadyContext();

        if (!readyContext) return;

        setAutofillFlow((flow) => (flow ? {...flow, status: 'running'} : flow));

        // Consume the attempt before dispatch so a second click cannot run it twice.
        aiFillDecisionFixedCellsRef.current = null;
        aiFillDecisionCellKeysRef.current = null;
        setAiFillDecisionContext(null);

        if (pendingAdjustmentPreparation.current) {
            const pending = pendingAdjustmentPreparation.current;

            pendingAdjustmentPreparation.current = null;
            pending.resolve();
        } else if (conversationEnabled) {
            setConversationGenerationRequest((count) => count + 1);
        } else {
            // Keep the visible draft intact until a new result succeeds.
            void runAiFill(readyContext, undefined, undefined, {
                doc: maskDutyDocCells(useShiftEditorStore.getState().doc, {hideUnlocked: true}),
                idempotencyKey: crypto.randomUUID(),
            });
        }
    };
    const showPreviousPreparation = () => {
        const hasBlanks = getBlankLastShiftCellsWarningKey(useShiftEditorStore.getState().doc) !== null;

        appendAutofillPrompt({
            role: 'assistant',
            text: t(hasBlanks ? 'aiAdjust.preparation.previous' : 'aiAdjust.preparation.previousReady'),
            ...(hasBlanks ? {help: t('aiAdjust.preparation.previousHelp')} : {}),
        });
        setLastShiftBlankWarningIntent('aiFill');
    };
    const showFixedPreparation = (skipWhenEmpty = true) => {
        const doc = useShiftEditorStore.getState().doc;
        const hasFilledCells = doc.rows.some((row) => row.cells.some((cell) => cell != null));

        if (!hasFilledCells && skipWhenEmpty) {
            startPreparedFill();
            return;
        }

        appendAutofillPrompt({
            role: 'assistant',
            text: t(hasFilledCells ? 'aiAdjust.preparation.fixed' : 'aiAdjust.preparation.empty'),
            ...(hasFilledCells ? {help: t('aiAdjust.preparation.fixedHelp')} : {}),
        });
        openAiFillDecision({cellCount: getUnprotectedFilledCells(doc).length});
    };
    const continueAfterCarryOver = () => {
        setIsReviewingCarryOver(false);
        setCarryOverError(null);

        const previous = getBlankLastShiftCellsWarningKey(useShiftEditorStore.getState().doc) !== null;

        if (preparationPaused.current) {
            setAutofillFlow((flow) => (flow ? {...flow, status: 'paused', resumeStep: previous ? 'previous' : 'fixed'} : flow));
        } else if (previous) showPreviousPreparation();
        else showFixedPreparation();
    };
    const confirmCarryOver = async () => {
        if (carryingOver.current || !isReviewingCarryOver || wardId == null || currentShiftTeamId == null) return;

        const flowId = autofillSequence.current;
        const scope = currentContextKey;
        const selected = carryOver.isError || monthRequestsError ? [] : carrySelectedIds;
        const labels = carryOptions.filter(({request}) => selected.includes(request.id)).map(({request}) => request.displayLabel);
        const isSameScope = () => {
            const current = currentAiContextRef.current;

            return (
                carryOverMounted.current &&
                current.wardId === wardId &&
                current.shiftTeamId === currentShiftTeamId &&
                current.year === year &&
                current.month === month
            );
        };
        const isCurrent = () => isSameScope() && autofillContext.current === scope && autofillSequence.current === flowId;

        carryingOver.current = true;
        setIsCarryingOver(true);
        setCarryOverError(null);

        try {
            if (selected.length) {
                await WardAPI.carryOverScheduleMonthRequests(wardId, currentShiftTeamId, {year, month, requestIds: selected});
                if (!isSameScope()) return;
                // A confirmed save can finish after a chat reset. Refresh the saved
                // requests without resuming that old preparation flow.
                await refetchMonthRequests();
            }

            if (!isCurrent()) return;

            markCarryOverAnswered({accountId, wardId, shiftTeamId: currentShiftTeamId, year, month});
            carryOver.dismiss();
            appendAutofillMessage({
                role: 'user',
                text: selected.length
                    ? `${t('aiAdjust.carryOver.thisMonth')}\n${labels.map((label) => `• ${label}`).join('\n')}\n${t('aiAdjust.carryOver.confirm')}`
                    : t('aiAdjust.carryOver.skip'),
            });
            continueAfterCarryOver();
        } catch {
            if (isCurrent()) setCarryOverError(t('aiAdjust.carryOver.failed'));
        } finally {
            carryingOver.current = false;

            if (isSameScope()) setIsCarryingOver(false);
        }
    };

    useEffect(() => {
        if (
            !isReviewingCarryOver ||
            !isAdjustDialogOpen ||
            isCarryingOver ||
            carryOver.isLoading ||
            monthRequestsLoading ||
            carryOver.isError ||
            monthRequestsError
        )
            return;

        if (!carryOptions.some((option) => !option.unavailable)) {
            carryOver.dismiss();
            continueAfterCarryOver();

            return;
        }

        if (carryOverSelection === null)
            setCarryOverSelection(carryOptions.filter((option) => !option.unavailable).map(({request}) => request.id));

        appendAutofillPrompt({role: 'assistant', text: t('aiAdjust.carryOver.question')});
    }, [
        isReviewingCarryOver,
        isAdjustDialogOpen,
        isCarryingOver,
        carryOver.isLoading,
        monthRequestsLoading,
        carryOver.isError,
        monthRequestsError,
        carryOptions,
    ]);

    const beginAutofillPreparation = (kind: 'generation' | 'adjustment') => {
        if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) return;

        if (!getAiFillReadyContext()) return;

        if (carryingOver.current) return;

        if (kind === 'generation') cancelPendingAdjustmentPreparation();

        preparationPaused.current = false;
        setCarryOverSelection(null);
        setCarryOverError(null);

        // Explicitly starting another generation creates a new attempt using the current draft.
        // An acknowledgement from a previous attempt must never skip this one.
        restoreAiFillDecisionFixedCells();
        setAiFillDecisionContext(null);
        setLastShiftBlankWarningIntent(null);
        setHasGenerationNotice(false);
        setGenerationFailure(null);
        generationNoticeShownRef.current = false;
        autofillContext.current = currentContextKey;
        setAutofillFlow({id: ++autofillSequence.current, kind, messages: [], status: 'preparing'});
        setIsSnapshotSidebarOpen(false);
        setIsAdjustDialogOpen(true);
        setIsAiBlankPreviewVisible(true);

        if (carryOver.needsReview) {
            setIsReviewingCarryOver(true);
        } else if (getBlankLastShiftCellsWarningKey(useShiftEditorStore.getState().doc) !== null) {
            showPreviousPreparation();
        } else {
            showFixedPreparation();
        }
    };
    const handleAiFill = () => beginAutofillPreparation('generation');
    const prepareAdjustment = () =>
        new Promise<void>((resolve, reject) => {
            if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) {
                reject(new Error(t('aiAdjust.allFixed')));
                return;
            }

            if (!getAiFillReadyContext()) {
                reject(new Error(t('page.makeShift.aiRefill.cannotAutofillYet')));

                return;
            }

            cancelPendingAdjustmentPreparation();
            pendingAdjustmentPreparation.current = {resolve, reject};
            beginAutofillPreparation('adjustment');
        });
    const resumeAutofillPreparation = () => {
        if (autofillContext.current !== currentContextKey || autofillFlow?.status !== 'paused') return false;

        preparationPaused.current = false;

        const previousWarningKey = getBlankLastShiftCellsWarningKey(useShiftEditorStore.getState().doc);
        const needsPreviousReview =
            autofillFlow.resumeStep === 'previous' ||
            (previousWarningKey !== null && previousWarningKey !== autofillFlow.previousWarningKey);

        setAutofillFlow((flow) => (flow ? {...flow, status: 'preparing', resumeStep: undefined} : flow));
        setIsSnapshotSidebarOpen(false);
        setIsAdjustDialogOpen(true);
        setIsAiBlankPreviewVisible(true);

        if (autofillFlow.resumeStep === 'carryOver') setIsReviewingCarryOver(true);
        else if (needsPreviousReview) showPreviousPreparation();
        // Reopening the sheet is never permission to start a generation by itself.
        else showFixedPreparation(false);

        return true;
    };
    const handleOpenAutofill = () => {
        if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) {
            toast(t('aiAdjust.allFixed'), {id: 'ai-autofill-all-fixed'});

            return;
        }

        if (!getAiFillReadyContext()) return;

        if (resumeAutofillPreparation()) return;

        const currentDoc = useShiftEditorStore.getState().doc;
        const hasResultCells = currentDoc.rows.some((row) =>
            row.cells.some((cell, column) => cell != null && !currentDoc.requestCells[`${row.workerId}|${currentDoc.columns[column]}`]),
        );

        if (isAdjustAvailable && hasGeneratedSchedule && hasResultCells) {
            setIsSnapshotSidebarOpen(false);
            setIsAdjustDialogOpen(true);

            return;
        }

        handleAiFill();
    };
    const handleRequestRegenerate = handleAiFill;
    const handleConfirmAiFillDecision = () => {
        if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) return;

        if (!aiFillDecisionContext || aiFillDecisionFixedCellsRef.current === null) return;

        appendAutofillMessage({
            role: 'user',
            text: t(aiFillDecisionFixableCells.length === 0 ? 'aiAdjust.autofill' : 'aiAdjust.preparation.fill'),
        });
        startPreparedFill();
    };
    const handleEditAiFillDecision = () => {
        restoreAiFillDecisionFixedCells();
        setAiFillDecisionContext(null);
        setIsAiBlankPreviewVisible(false);
        setIsAdjustDialogOpen(false);
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
            const {past} = useShiftEditorStore.getState().history;

            setBulkFixEntry(past[past.length - 1] ?? null);
            toast.success(t('page.makeShift.aiRefill.prefillDecision.fixAllSuccess', {count: changedCount}));
        }
    };
    const handleUndoFixAllAiFillDecisionCells = () => {
        const {past} = useShiftEditorStore.getState().history;

        // This action belongs to bulk fixing; never undo a later, unrelated edit.
        if (!aiFillDecisionContext || !bulkFixEntry || past[past.length - 1] !== bulkFixEntry) return;

        commands.undo();
    };
    const handleConfirmLastShiftBlankWarning = () => {
        const warningIntent = lastShiftBlankWarningIntent;

        setLastShiftBlankWarningIntent(null);

        if (warningIntent === 'aiFill') {
            appendAutofillMessage({
                role: 'user',
                text: t(
                    getBlankLastShiftCellsWarningKey(useShiftEditorStore.getState().doc) !== null
                        ? 'aiAdjust.preparation.continue'
                        : 'aiAdjust.preparation.next',
                ),
            });
            showFixedPreparation();

            return;
        }

        if (lastShiftBlankWarningKey !== null) {
            setLastShiftBlankWarningAcknowledgedKey(lastShiftBlankWarningKey);
        }

        if (warningIntent === 'confirm') {
            promoteRequestIdsRef.current = [];

            if (promotableRules.length > 0) {
                setPromoteDialogOpen(true);

                return;
            }

            continueConfirmAfterPromote();
        }
    };
    const handlePublishConfirm = () => {
        if (!canConfirm) return;

        setPublishConfirmOpen(false);
        void confirmCurrentSchedule();
    };
    const handleCancelLastShiftBlankWarning = () => {
        if (lastShiftBlankWarningIntent === 'aiFill') {
            appendAutofillMessage({role: 'user', text: t('aiAdjust.preparation.editPrevious')});
            setAutofillFlow((flow) => (flow ? {...flow, status: 'paused', resumeStep: 'previous'} : flow));
        }

        const firstBlankLastShiftCell = findFirstBlankLastShiftCell(useShiftEditorStore.getState().doc);

        setLastShiftBlankWarningIntent(null);
        setIsAiBlankPreviewVisible(false);
        setIsAdjustDialogOpen(false);

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
    const reviewBatchResult = async () => {
        const ready = getAiFillReadyContext();

        if (!ready || !batchKey || !wardId || !currentShiftTeamId) return;

        const requested = {wardId, teamId: currentShiftTeamId, year, month};

        setLoadingBatch(true);

        try {
            const batch = await commercialGet<CommercialBatchResult>(`/wards/${wardId}/ai-batches/${encodeURIComponent(batchKey)}`);
            const current = currentAiContextRef.current;

            if (
                current.wardId !== requested.wardId ||
                current.shiftTeamId !== requested.teamId ||
                current.year !== requested.year ||
                current.month !== requested.month
            )
                return;

            const cells = batchCellsForReview(batch, currentShiftTeamId, year, month, useShiftEditorStore.getState().doc);

            if (
                !window.confirm(
                    batchCopy(
                        `생성 결과 ${cells.length}칸을 현재 임시 근무표에 적용할까요? 직접 편집한 값은 바뀔 수 있습니다. 고정·신청 근무는 유지하며, 저장·확정은 검토 후 별도로 해주세요. 추가 횟수는 사용하지 않습니다.`,
                        `Apply ${cells.length} generated cells to this draft? Unsaved edits may change. Fixed and requested cells stay protected. Review before saving or confirming. No additional use is charged.`,
                    ),
                )
            )
                return;

            commands.applyChangedCells(cells, ready.originalShift, 'ai');
            markLastAiGeneratedDoc(useShiftEditorStore.getState().doc);
            setHasAiGeneratedUnsavedChanges(cells.length > 0);
            setHasCompletedAiFill(true);
            setAiStatus('success');
            setBatchKey(null);

            const after = useShiftEditorStore.getState();

            await fetchAndApplyScheduleValidation(
                {
                    wardId,
                    shiftTeamId: currentShiftTeamId,
                    year,
                    month,
                    doc: after.doc,
                    originalShift: ready.originalShift,
                    draftRevision: after.draftRevision,
                    rulesHash: ready.rulesHash,
                },
                commands.setScheduleValidationFromApi,
            );
        } catch {
            toast.error(
                batchCopy(
                    '결과의 팀·편성 월·명단 또는 검증 상태를 확인해 주세요. 저장·확정 전에 현재 규칙으로 다시 검증해야 합니다.',
                    'Check the result’s team, month, roster and validation status. Validate against current rules before saving or confirming.',
                ),
            );
        } finally {
            setLoadingBatch(false);
        }
    };
    const preparationStep = isReviewingCarryOver
        ? 'carryOver'
        : lastShiftBlankWarningIntent === 'aiFill'
          ? 'previous'
          : aiFillDecisionContext
            ? 'fixed'
            : null;
    const closePreparation = () => {
        preparationPaused.current = true;
        setIsReviewingCarryOver(false);
        setAutofillFlow((flow) =>
            flow
                ? {
                      ...flow,
                      status: 'paused',
                      resumeStep: preparationStep ?? undefined,
                      previousWarningKey: getBlankLastShiftCellsWarningKey(useShiftEditorStore.getState().doc),
                  }
                : flow,
        );

        if (aiFillDecisionContext) handleEditAiFillDecision();

        setLastShiftBlankWarningIntent((intent) => (intent === 'aiFill' ? null : intent));
        setIsAiBlankPreviewVisible(false);
        setIsAdjustDialogOpen(false);
    };
    const preparation =
        preparationStep === 'carryOver' ? (
            <AiCarryOverCard
                options={carryOptions}
                selectedIds={carrySelectedIds}
                isLoading={carryOver.isLoading || monthRequestsLoading}
                loadFailed={carryOver.isError || monthRequestsError}
                isApplying={isCarryingOver}
                error={carryOverError}
                onToggle={(id) => {
                    setCarryOverSelection(
                        carrySelectedIds.includes(id) ? carrySelectedIds.filter((selected) => selected !== id) : [...carrySelectedIds, id],
                    );
                    setCarryOverError(null);
                }}
                onConfirm={() => void confirmCarryOver()}
                onRetry={() => {
                    void carryOver.retry();
                    void refetchMonthRequests();
                }}
            />
        ) : preparationStep ? (
            <AiAutofillPreparation
                step={preparationStep}
                fixableCount={aiFillDecisionFixableCells.length}
                hasFilledCells={hasFilledPreparationCells}
                canAutofill={!isAutofillBlocked}
                previousHasBlanks={lastShiftBlankWarningKey !== null}
                disabled={isAiGenerating || isAiLoadingOverlayFinishing}
                onFixAll={handleFixAllAiFillDecisionCells}
                onUndoFixAll={
                    bulkFixEntry && history.past[history.past.length - 1] === bulkFixEntry ? handleUndoFixAllAiFillDecisionCells : undefined
                }
                onCancel={preparationStep === 'previous' ? handleCancelLastShiftBlankWarning : closePreparation}
                onConfirm={preparationStep === 'previous' ? handleConfirmLastShiftBlankWarning : handleConfirmAiFillDecision}
            />
        ) : undefined;
    const preparationSpotlight =
        preparationStep === 'previous'
            ? '.make-shift-calendar__header-label--last, .make-shift-calendar__row-last-shifts'
            : preparationStep === 'fixed'
              ? '.ai-autofill-toolbar, .ai-autofill-preparation-calendar'
              : undefined;
    const isConversationOpen =
        isAdjustDialogOpen &&
        (conversationEnabled || isAdjustEnabled || Boolean(preparationStep) || Boolean(generationFailure) || autofillFlow === null);
    const publishConfirmDescription =
        connectedNurseCount > 0
            ? t('page.makeShift.aiRefill.publishConfirm.description', {count: connectedNurseCount})
            : t('page.makeShift.aiRefill.publishConfirm.noConnectedDescription');
    const scheduleActions = {
        canConfirm,
        disabled: isAiGenerating || isWorking || disablingRequestId !== null,
        onConfirm: () => {
            if (!canConfirm) return;

            setIsAdjustDialogOpen(false);
            handleConfirm();
        },
    };

    return (
        <div id="make_ai_autofill_step" className="ai-autofill-root flex w-full min-w-0">
            <div
                className="ai-autofill-root__main flex min-w-0 flex-1 flex-col gap-3 pt-3 outline-none"
                ref={editorRef}
                onKeyDown={preparationStep ? undefined : onKeyDown}
                onPasteCapture={preparationStep ? undefined : onPasteCapture}
                tabIndex={0}
            >
                <AiPlanNotice hasResult={hasCompletedAiFill} />
                {batchKey && (
                    <div className="rounded-xl bg-purple-50 p-3 text-sm">
                        <p>
                            {batchCopy(
                                '여러 팀 전체 생성 결과가 준비되어 있습니다. 현재 명단과 보호할 근무를 확인한 뒤 불러옵니다.',
                                'Review the batch result against the current roster and protected shifts.',
                            )}
                        </p>
                        <button
                            type="button"
                            disabled={loadingBatch || isAiGenerating || !isCurrentShiftTeamReady || isHydratingEditor}
                            onClick={() => void reviewBatchResult()}
                            className="mt-2 rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50"
                        >
                            {batchCopy('결과 불러와 검토하기 · 추가 차감 없음', 'Load result for review · no extra use')}
                        </button>
                    </div>
                )}
                <AiAutofillToolbar
                    displaySettings={
                        <ScheduleDisplayMenu
                            display={display}
                            settings={
                                <RestLeavePolicySummaryButton
                                    wardId={wardId}
                                    shiftTeamId={currentShiftTeamId}
                                    year={year}
                                    month={month}
                                    variant="menu"
                                />
                            }
                        />
                    }
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
                    onUndo={() => (preparationStep === 'fixed' ? commands.undo() : void undoWithGoalCandidate())}
                    onRedo={() => commands.redo()}
                    onOpenSnapshotHistory={openSnapshotSidebar}
                    onAiFill={handleOpenAutofill}
                    onRegenerate={handleRequestRegenerate}
                    isAdjustEnabled={isAdjustEnabled}
                    hasGeneratedSchedule={hasGeneratedSchedule}
                    onAdjust={
                        isAdjustAvailable
                            ? () => {
                                  if (isScheduleFullyProtected(useShiftEditorStore.getState().doc)) return;

                                  if (resumeAutofillPreparation()) return;

                                  setIsSnapshotSidebarOpen(false);
                                  setIsAdjustDialogOpen(true);
                              }
                            : undefined
                    }
                    isAiGenerating={isAiGenerating}
                    isPreparing={Boolean(preparationStep)}
                    isAutofillBlocked={isAutofillBlocked}
                    aiStatus={aiStatus}
                    hasCompletedAiFill={hasCompletedAiFill}
                    scheduleValidationStatus={scheduleValidation.status}
                    onConfirm={handleConfirm}
                    isConfirming={isWorking}
                    canConfirm={canConfirm}
                    onSaveSnapshot={handleSaveSnapshot}
                    isSavingSnapshot={isSavingSnapshot}
                />

                {generationReviewMessage !== null && (
                    <div role="status" className="mx-4 my-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="font-semibold">
                            {batchCopy('초안을 만들었어요 · 확인할 규칙이 있어요', 'Draft created · some rules need review')}
                        </p>
                        <p className="mt-1">
                            {generationReviewMessage ||
                                batchCopy(
                                    '못 지킨 규칙은 근무표에 표시했어요. 표시된 칸에서 내용을 확인하고 수정할 수 있어요.',
                                    'Unmet rules are marked on the schedule. Review the marked cells and edit the draft.',
                                )}
                        </p>
                        <button type="button" className="mt-2 underline" onClick={() => setShowFaults(true)}>
                            {batchCopy('규칙 위반 표시 보기', 'Show rule violations')}
                        </button>
                        <button type="button" className="mt-2 ml-4 underline" onClick={() => setGenerationReviewMessage(null)}>
                            {batchCopy('안내 닫기', 'Dismiss notice')}
                        </button>
                    </div>
                )}

                {/* The latest result stays visible beside the schedule when the conversation is closed. */}
                {isAdjustAvailable && (
                    <AiAdjustResultNote
                        changedCount={lastAdjustChangedCount}
                        failure={isAdjustDialogOpen ? null : lastAdjustFailure}
                        onReviewFailure={() => setIsAdjustDialogOpen(true)}
                        ruleResults={lastRuleResults}
                        notices={lastAdjustmentNotices}
                        goalResult={lastGoalResult}
                        offGoal={lastOffGoal}
                        isStrongest={lastAdjustStrength === 'STRONG'}
                        disabled={isAiGenerating || disablingRequestId !== null || isAutofillBlocked}
                        onAdjustHarder={() => {
                            const readyContext = getAiFillReadyContext();

                            if (!readyContext) return;

                            void runAiFill(readyContext, {strength: 'STRONG'});
                        }}
                    />
                )}

                {goalCandidateReview?.response.goalCandidate && (
                    <AiGoalCandidateReview
                        candidate={goalCandidateReview.response.goalCandidate}
                        result={goalCandidateReview.goalResult}
                        changedCount={goalCandidateReview.response.changedCells.length}
                        changedCells={goalCandidateReview.response.changedCells}
                        stale={
                            goalCandidateReview.response.goalCandidate.applicationStatus === 'CREATED' &&
                            goalCandidateReview.response.goalCandidate.baseDraftRevision !== useShiftEditorStore.getState().draftRevision
                        }
                        applyRecoveryPending={pendingGoalCandidateApplyEventId !== null}
                        onApply={() => void applyGoalCandidate()}
                        onDiscard={() => {
                            if (wardId != null && currentShiftTeamId != null) {
                                writeStoredGoalCandidate(goalCandidateStorageKey(wardId, currentShiftTeamId, year, month), null);
                            }

                            setPendingGoalCandidateApplyEventId(null);
                            setGoalCandidateReview(null);
                        }}
                    />
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
                {!dutyQuery.isLoading && !isHydratingEditor && !dutyQuery.isError && orderedShift && (
                    <div className="ai-autofill-preparation-calendar">
                        <MakeShiftCalendar
                            shift={orderedShift}
                            doc={isAiFillDecisionPreviewOpen ? editorDoc : visibleCalendarDoc}
                            annualLeaveDays={annualLeave.data?.days ?? annualLeave.overview.data?.days}
                            annualLeaveColumns={annualColumns.columns}
                            showRestCheck={display.value.rest}
                            violationMap={violationMap}
                            teamViolations={teamViolations}
                            showFaults={showFaults}
                            nurseNameMaxChars={5}
                            onCellClick={
                                isAiFillDecisionPreviewOpen
                                    ? handleToggleAiFillDecisionCell
                                    : isCalendarReadonly || preparationStep
                                      ? undefined
                                      : focusEditor
                            }
                            readonly={isCalendarReadonly || Boolean(preparationStep)}
                            editableLastShifts={!isCalendarReadonly && !preparationStep}
                            staticPreview={isAiFillDecisionPreviewOpen}
                            interactivePreview={isAiFillDecisionPreviewOpen}
                            fixedCellPreview={isAiFillDecisionPreviewOpen}
                            disableInitialSelection={isAiFillDecisionPreviewOpen}
                            isShimmering={isAiEffectVisible}
                            showCellStatusPins
                            fixCellOnContextMenu
                            cellAttention={cellAttention}
                            tutorialCellId="make_fixed_shift_sample_cell"
                            restCheckByShiftNurseId={restCheckByShiftNurseId}
                            canReorderRows
                            rowReorderDisabled={isCalendarReadonly || isReorderingRows || Boolean(preparationStep)}
                            onRowDragEnd={(result) => {
                                void moveScheduleRow(orderedShift, result, {scheduleKind: 'duty', doc: editorDoc});
                            }}
                            showDivisionHeaders
                            showDivisionStatistics
                            divisionLabelByNum={divisionLabelByNum}
                            stickyHeader
                        />
                    </div>
                )}
                {!dutyQuery.isLoading && !isHydratingEditor && !dutyQuery.isError && !orderedShift && (
                    <PageState tone="empty" title={t('page.makeShift.aiRefill.empty')} description={t('page.state.emptyDescription')} />
                )}
            </div>

            {conversationEnabled && wardId && currentShiftTeamId && orderedShift ? (
                <AiConversationSidebar
                    key={`conversation:${wardId}:${currentShiftTeamId}:${year}:${month}`}
                    open={isConversationOpen}
                    onClose={preparationStep ? closePreparation : () => setIsAdjustDialogOpen(false)}
                    wardId={wardId}
                    teamId={currentShiftTeamId}
                    year={year}
                    month={month}
                    shift={orderedShift}
                    adjustEnabled={isAdjustEnabled}
                    generationRequest={conversationGenerationRequest}
                    rebuildRequest={0}
                    generationFillPolicy="REBUILD_UNLOCKED"
                    onPrepareGeneration={handleAiFill}
                    onPrepareAdjustment={prepareAdjustment}
                    preparation={preparation}
                    autofillFlow={autofillContext.current === currentContextKey ? autofillFlow : null}
                    onNewConversation={resetAutofillConversation}
                    spotlightSelector={preparationSpotlight}
                    spotlightInteractive={preparationStep === 'fixed'}
                    onGenerated={rememberGeneratedSchedule}
                    onBusyChange={setIsAiGenerating}
                    resultActions={scheduleActions}
                    onApplied={() => {
                        setHasAiGeneratedUnsavedChanges(true);
                        setHasCompletedAiFill(true);
                        rememberGeneratedSchedule();
                        setAiStatus('success');
                    }}
                />
            ) : (
                <AiAdjustDialog
                    key={`${wardId}:${currentShiftTeamId}:${year}:${month}`}
                    open={isConversationOpen}
                    onClose={preparationStep ? closePreparation : () => setIsAdjustDialogOpen(false)}
                    preparation={preparation}
                    autofillFlow={autofillContext.current === currentContextKey ? autofillFlow : null}
                    onNewConversation={resetAutofillConversation}
                    spotlightSelector={preparationSpotlight}
                    spotlightInteractive={preparationStep === 'fixed'}
                    onRegenerate={handleRequestRegenerate}
                    onGenerate={handleAiFill}
                    hasGeneratedSchedule={hasGeneratedSchedule}
                    generationCompleted={hasGenerationNotice}
                    generationFailure={generationFailure}
                    onDismissFailure={() => setGenerationFailure(null)}
                    disabled={isAiGenerating || isCarryingOver || disablingRequestId !== null || isAutofillBlocked}
                    modifyDisabled={!isAdjustEnabled}
                    textInputRef={adjustTextInputRef}
                    onPickExample={(sentence) => adjustTextInputRef.current?.fill(sentence)}
                    interpret={interpretAdjustText}
                    onApply={handleApplyTextRequests}
                    goalNurses={currentTeamNurses.map((nurse) => ({nurseId: nurse.nurseId, name: nurse.name}))}
                    requests={monthRequests}
                    requestsLoading={monthRequestsLoading}
                    requestsError={monthRequestsError}
                    onRetryRequests={() => void refetchMonthRequests()}
                    currentRevision={useShiftEditorStore.getState().draftRevision}
                    shiftCodes={orderedShift?.wardShiftTypes.map((type) => type.shortName)}
                    resultActions={scheduleActions}
                    onUndo={(revision) => {
                        if (useShiftEditorStore.getState().draftRevision !== revision || isAiGenerating) return false;
                        commands.undo();
                        commands.clearScheduleValidationFromApi();
                        setLastAdjustChangedCount(null);

                        return true;
                    }}
                    disablingRequestId={disablingRequestId}
                    onDisableRequest={handleDisableMonthRequest}
                />
            )}
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
            <AiPromoteRulesDialog
                open={promoteDialogOpen}
                candidates={promotableRules}
                onClose={() => setPromoteDialogOpen(false)}
                onConfirm={handlePromoteConfirm}
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
                open={lastShiftBlankWarningIntent === 'confirm'}
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
                spotlightSelector=".make-shift-calendar__header-label--last, .make-shift-calendar__row-last-shifts"
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
            {(isAiGenerating || isAiLoadingOverlayFinishing) && !isAdjusting ? (
                <AiAutofillLoadingOverlay
                    sidebarOpen={isConversationOpen}
                    isAdjusting={isAdjusting}
                    isFinishing={isAiLoadingOverlayFinishing}
                    startedAt={aiStartedAt}
                    onFinish={handleAiLoadingOverlayFinish}
                />
            ) : null}
        </div>
    );
}
