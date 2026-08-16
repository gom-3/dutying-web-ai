import {type TShiftRotationSystem} from '@dutying/domain/ward';
import {type TWardConstraint, type TWardShiftClassification} from '@/entities';
import type {TScheduleViolationPersisted} from './schedule-violations';

export type TCellValue = string | null;
export type TWorkKeyMap = Record<string, TCellValue>;

export type TDateKey = string; // YYYY-MM-DD

export type TDutyRuleKey =
    | 'maxContinuousWork'
    | 'minNightInterval'
    | 'maxContinuousNight'
    | 'minContinuousNight'
    | 'minOffAssignAfterNight'
    | 'excludeCertainWorkTypes'
    | 'excludeNightBeforeReqOff';

export type TDutyRow = {
    workerId: string;
    /** Current-month context from the previous schedule, shown as the "전달 근무" cells. */
    lastCells?: TCellValue[];
    cells: TCellValue[];
};

export type TDutyShiftTypeRef = {
    wardShiftTypeId: number;
    shortName: string;
    classification: TWardShiftClassification;
    rotationSystem?: TShiftRotationSystem;
    isDefault: boolean;
};

export type TDutyDoc = {
    columns: TDateKey[];
    rows: TDutyRow[];
    /** 임시저장 당시 약자를 안정적인 근무유형 ID로 다시 연결하기 위한 카탈로그. 구 드래프트에는 없을 수 있다. */
    shiftTypeRefs?: TDutyShiftTypeRef[];
    workerMeta: Record<string, {name: string; nurseId?: number; priority?: number; divisionNum?: number; divisionName?: string | null}>;
    fixedCells: Record<string /* `${workerId}|${date}` */, true>;
    requestCells: Record<string /* `${workerId}|${date}` */, true>;
};

export type TPersisted = {
    doc: TDutyDoc;
    history: string;
    /** 서버 validation 스냅샷 — doc·history와 함께 드래프트로 보관 */
    scheduleViolations?: TScheduleViolationPersisted;
    /** @deprecated scheduleViolations 사용 */
    llmViolations?: TViolation[];
    savedAt: number;
};

export type TCellPos = {row: number; col: number};

export type TSelection = {type: 'single'; anchor: TCellPos} | {type: 'range'; from: TCellPos; to: TCellPos};

export type TDirection = 'up' | 'down' | 'left' | 'right';

export type TTxSource = 'user' | 'ai' | 'system';

export type TSetCellsOp = {
    kind: 'setCells';
    cells: Array<{
        row: number;
        col: number;
        prev: TCellValue;
        next: TCellValue;
    }>;
    fixedDelta?: Array<{
        key: string; // `${workerId}|${date}`
        prev: boolean;
        next: boolean;
    }>;
};

export type TReorderRowsOp = {
    kind: 'reorderRows';
    prevOrder: number[];
    nextOrder: number[];
};

export type TOperation = TSetCellsOp | TReorderRowsOp;

export type TTransaction<Op> = {
    ops: Op[];
    source: TTxSource;
    timestamp: number;
};

export type TViolationScope = 'nurse' | 'team';

export type TViolationAffectedCell = {
    cellKey?: string;
    shiftNurseId?: number;
    nurseId?: number;
    nurseName?: string;
    date: string;
    wardShiftTypeId?: number | null;
    shiftCode?: string | null;
};

export type TViolationPeriod = {
    startDate?: string;
    endDate?: string;
    dates?: string[];
};

export type TViolationDisplayContext = {
    cells: TCellPos[];
    affectedCells?: TViolationAffectedCell[];
    period?: TViolationPeriod | null;
};

export type TViolation = {
    ruleId: string;
    /** Spring violationId — 특정 위반 수정(repair) 요청에 사용 */
    violationId?: string;
    templateCode?: string;
    message: string;
    cells: TCellPos[];
    level: 'warning' | 'error';
    /** team: division 일자 열 전체. nurse(기본): 해당 간호사 행만 */
    scope?: TViolationScope;
    period?: TViolationPeriod;
    affectedCells?: TViolationAffectedCell[];
    displayContext?: TViolationDisplayContext;
    fixable?: boolean;
};

export type TDutyRuleLevel = TViolation['level'];

export type TDutyRuleBoardBucket = 'error' | 'warning' | 'excluded';

export type TDutyRuleBoard = Record<TDutyRuleBoardBucket, TDutyRuleKey[]>;

export type TDutyRuleLevelByKey = Partial<Record<TDutyRuleKey, TDutyRuleLevel>>;

export type TClipboardPayload = {
    width: number;
    height: number;
    cells: TCellValue[][];
};

export type THistoryEntry = {
    tx: TTransaction<TOperation>;
    inverseOps: TOperation[];
    selectionBefore?: TSelection | null;
    selectionAfter?: TSelection | null;
};

export type THistoryState = {
    past: THistoryEntry[];
    future: THistoryEntry[];
    maxDepth: number;
};

export type TValidator<Doc> = (doc: Doc) => TViolation[];

export type TDutyValidationMode = {
    /**
     * 신청 OFF 등 "요청" 정보를 함께 표기하고 싶을 때 사용.
     * - true면 해당 날짜는 'O'(대문자)로 간주되어 excludeNightBeforeReqOff 규칙이 동작한다.
     * - 제공하지 않으면(기본) 규칙은 사실상 비활성처럼 동작한다.
     */
    requestedOffByRow?: boolean[][];
};

export type TDutyValidationInput = {
    wardConstraint: TWardConstraint;
    mode?: TDutyValidationMode;
    /**
     * UI에서 "강/약"으로 분류(드래그)한 결과를 반영하기 위한 레벨 오버라이드.
     * - 지정하지 않으면 기본 rule definition의 level을 따른다.
     */
    ruleLevelByKey?: TDutyRuleLevelByKey;
};
