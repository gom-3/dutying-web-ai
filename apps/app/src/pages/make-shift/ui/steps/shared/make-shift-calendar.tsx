import {cn} from '@dutying/utils/style';
import {type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {type TShift, type TWardShiftType} from '@/entities';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {
    type TCellPos,
    type TCellValue,
    type TDutyDoc,
    type TViolation,
    useShiftEditorCommands,
    useShiftEditorStore,
} from '@/features/shift-editor/model';
import {getDutyCellLockKey, isDutyCellPositionInBounds} from '@/features/shift-editor/model/duty-doc-cells';
import {normalizeSelection} from '@/features/shift-editor/model/selection';
import {type TSkillLevelConfig, type TSkillLevelValue} from '@/features/ward-skill/model/skill-level';
import SkillBadge from '@/features/ward-skill/ui/skill-badge';
import i18n from '@/i18n';
import type {TRestCheckSummary} from '@/pages/make-shift/model/rest-target-days';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import {formatNurseDisplayName} from './format-nurse-display-name';

type TViolationMap = Map<string, TViolation>;
type TSkillColumnConfig = {
    config: TSkillLevelConfig;
    levelsByNurseId: Record<number, TSkillLevelValue>;
};

type TMakeShiftCalendarProps = {
    shift: TShift;
    doc: TDutyDoc;
    violationMap: TViolationMap;
    teamViolations?: TViolation[];
    showFaults: boolean;
    /**
     * default: 이름·전달·일자·우측 행 합계·하단 일자별 통계.
     * simplified: 이름·일자만 (전달 근무·합계·통계 제외) — 신청 근무 단계 등.
     */
    variant?: 'default' | 'simplified';
    /**
     * 클릭 후 부가 동작(예: 부모의 editor 영역에 focus 주기) — 선택 저장은 캘린더 내부에서 처리하므로 별도 호출 불필요.
     */
    onCellClick?: (rowIndex: number, colIndex: number) => void;
    tutorialCellId?: string;
    /**
     * true면 클릭으로 셀 선택을 갱신하지 않는다 (편집 불가).
     */
    readonly?: boolean;
    /**
     * true이면 기본 (0,0) 셀 선택을 한 번 지워 /duty 등에서 초기 포커스 링을 숨긴다.
     */
    disableInitialSelection?: boolean;
    /**
     * true면 "전달 근무" 4칸도 일반 캘린더 셀처럼 선택/입력할 수 있다.
     */
    editableLastShifts?: boolean;
    /**
     * true면 캘린더 위에 자동 채우기 진행 shimmer를 표시한다.
     */
    isShimmering?: boolean;
    skillColumn?: TSkillColumnConfig;
    restCheckByShiftNurseId?: Record<number, TRestCheckSummary>;
};

/**
 * 근무 만들기·/duty 공용 일자 캘린더. 스케일(transform)·내부 가로 스크롤 없음, 레이아웃은 `cqw`+`@container`.
 * 열: 이름 / 전달 / N일 / 우측 D·E·N·O·WO 합계.
 */
const VIOLATION_TONE: Record<TViolation['level'], {border: string; surface: string; rail: string; markerBg: string; markerText: string}> = {
    error: {
        border: 'rgba(217,45,32,0.74)',
        surface: 'rgba(217,45,32,0.07)',
        rail: 'rgba(217,45,32,0.88)',
        markerBg: '#D92D20',
        markerText: '#FFFFFF',
    },
    warning: {
        border: 'rgba(245,158,11,0.32)',
        surface: 'transparent',
        rail: 'rgba(245,158,11,0.62)',
        markerBg: 'rgba(245,158,11,0.76)',
        markerText: '#FFFFFF',
    },
};
const VIOLATION_CONTEXT_TONE: Record<TViolation['level'], {surface: string; activeSurface: string; rail: string}> = {
    error: {
        surface: 'rgba(217,45,32,0.035)',
        activeSurface: 'rgba(217,45,32,0.08)',
        rail: 'rgba(217,45,32,0.22)',
    },
    warning: {
        surface: 'rgba(245,158,11,0.045)',
        activeSurface: 'rgba(245,158,11,0.09)',
        rail: 'rgba(245,158,11,0.22)',
    },
};
const VIOLATION_LEVEL_PRIORITY: Record<TViolation['level'], number> = {error: 2, warning: 1};
const NAME_COL = 'clamp(64px,4.4cqw,76px)';
const MIN_SKILL_COL = '40px';
const CARRY_COL = 'clamp(26px,1.8cqw,32px)';
const REST_CHECK_COL = 'clamp(36px,2.5cqw,42px)';
const LAST_COL = 'clamp(64px,4.5cqw,84px)';
const ROW_SKILL_BADGE_CLASS = 'make-shift-calendar__row-skill-badge min-h-[18px] min-w-10 px-1.5 text-[10px] whitespace-nowrap';
/**
 * 행의 좌측(카드 안에 들어가는) 그리드.
 * 사진처럼 division 카드는 이 좌측만 감싸고, 우측 합계(row-summary-counts)는
 * 카드 밖에 별도로 배치된다.
 */
const getLeftGridTemplateColumns = (showSkillColumn: boolean, showCarryColumn: boolean, skillColumnWidth: string) =>
    `${NAME_COL} ${showSkillColumn ? `${skillColumnWidth} ` : ''}${showCarryColumn ? `${CARRY_COL} ` : ''}${LAST_COL} minmax(0,1fr)`;
/** 전달·통계 열 없이 이름 + 일자만 */
const LEFT_GRID_TEMPLATE_COLUMNS_SIMPLIFIED = `${NAME_COL} minmax(0,1fr)`;
const ROW_GAP_X = 'clamp(2px,0.24cqw,5px)';
/**
 * division card ↔ division-summary 사이 간격.
 * 너무 좁으면 카드·합계가 붙어 보이므로 최소 여백을 둔다. (헤더·body 행·daily-summary에서 동일 값으로 정렬 유지.)
 */
const DIVISION_TO_SUMMARY_GAP = 'clamp(8px,0.65cqw,14px)';
/**
 * 우측 합계 영역(type-summary-header / row-summary / daily-summary__spacer)의 좌우 패딩.
 * 합계 열 내부는 좁게 두고, 카드와의 간격은 DIVISION_TO_SUMMARY_GAP으로 맞춘다.
 */
const SUMMARY_PADDING_X = 'clamp(0px,0.1cqw,2px)';
/**
 * type-summary-header(헤더 우측 D/E/N/O/WO 라벨) ·
 * row-summary(각 행의 합계 숫자) ·
 * daily-summary__spacer(footer spacer) 세 곳에 동시에 사용된다.
 * 사진처럼 컬럼들이 가깝게 붙도록 작은 값으로 둔다.
 */
const SUMMARY_GAP = 'clamp(2px,0.22cqw,6px)';
/**
 * 우측 합계 셀(D/E/N/O/WO 칸)의 크기.
 * - 기존: 정사각형 22px → 한~두 자리 숫자 표시에 비해 폭이 과도하게 큼.
 * - 변경: 높이는 유지(행 높이 정렬), 폭만 좁혀서 summary 컬럼 전체 폭을 줄인다.
 *   "19" 같은 2자리 숫자도 들어가야 하므로 너무 좁히면 안 됨 → clamp 하한 14px.
 *
 * type-summary-header / row-summary / daily-summary__spacer 셋 모두 동일 값을 사용해야 컬럼이 어긋나지 않는다.
 */
const SUMMARY_CELL_HEIGHT = 'h-[clamp(16px,1.4cqw,22px)]';
const SUMMARY_CELL_WIDTH = 'w-[clamp(14px,1.05cqw,18px)]';
/** 우측 row-summary 행 · footer daily-summary 행 공통 높이 */
const ROW_SUMMARY_HEIGHT = 'h-[clamp(28px,2.4cqw,40px)]';
/** row-summary 우측 합계 숫자 · daily-summary 일자별 셀 — 동일 글자 크기·색 */
const SUMMARY_COUNT_TEXT_CLASS = 'font-poppins text-[clamp(12px,1.02cqw,18px)] leading-none text-center text-gray-4 tabular-nums';
/**
 * 일자 셀 내부 좌우 패딩.
 * - 최소값을 둬서 사이드바 등으로 컨테이너만 좁아졌을 때도 셀·배지 사이에 숨통이 남게 한다.
 * - 배지는 래퍼(SHIFT_BADGE_CELL_WRAP)로 가용 폭을 넘지 않게 하고, 내부는 ShiftBadge에 size-full.
 */
const DAY_CELL_PADDING_X = 'clamp(1px,0.18cqw,3px)';
const getDayGridTemplateColumns = (dayCount: number) => `repeat(${dayCount}, minmax(0, 1fr))`;
const getShimmerInsetLeft = (isSimplified: boolean, showSkillColumn: boolean, showCarryColumn: boolean, skillColumnWidth: string) =>
    isSimplified
        ? `calc(${DIVISION_PADDING_X} + ${NAME_COL} + ${ROW_GAP_X})`
        : `calc(${DIVISION_PADDING_X} + ${NAME_COL} + ${ROW_GAP_X}${showSkillColumn ? ` + ${skillColumnWidth} + ${ROW_GAP_X}` : ''}${showCarryColumn ? ` + ${CARRY_COL} + ${ROW_GAP_X}` : ''} + ${LAST_COL} + ${ROW_GAP_X})`;

function estimateLabelWidthCh(label: string) {
    return Array.from(label).reduce((width, char) => {
        const isAscii = /^[\u0020-\u007E]$/.test(char);

        return width + (isAscii ? 1 : 2);
    }, 0);
}

function getSkillLevelLabel(config: TSkillLevelConfig, level: number) {
    return config.levelLabels?.[level] ?? `LV. ${level}`;
}

function getSkillColumnWidth(config: TSkillLevelConfig | undefined) {
    if (!config) return MIN_SKILL_COL;

    const longestLabelWidth = Array.from({length: config.levelCount}, (_, index) => getSkillLevelLabel(config, index + 1)).reduce(
        (maxWidth, label) => Math.max(maxWidth, estimateLabelWidthCh(label)),
        1,
    );

    return `minmax(${MIN_SKILL_COL}, calc(${longestLabelWidth}ch + 18px))`;
}

function formatSignedDays(value: number | undefined) {
    if (value === undefined) return '-';

    return value > 0 ? `+${value}` : String(value);
}

const LAST_SHIFTS_GAP = 'clamp(1px,0.12cqw,2px)';
const DUTY_CELL_SELECTOR = '[data-duty-cell="true"]';
const SELECTED_CELL_BACKGROUND_CLASS = 'bg-main-4/70';
const ABSOLUTE_SELECTION_BACKGROUND_LAYER_CLASS = cn(
    'make-shift-calendar__selection-bg pointer-events-none absolute inset-0 z-0',
    SELECTED_CELL_BACKGROUND_CLASS,
);
const GRID_SELECTION_BACKGROUND_LAYER_CLASS = cn(
    'make-shift-calendar__selection-bg pointer-events-none z-[1]',
    SELECTED_CELL_BACKGROUND_CLASS,
);
const SELECTED_DAY_HEADER_BASE_CLASS = 'text-white font-semibold';
const SELECTED_DAY_HEADER_PURPLE_CLASS = cn(SELECTED_DAY_HEADER_BASE_CLASS, 'bg-[#8D7CF6]');
const SELECTED_DAY_HEADER_RED_CLASS = cn(SELECTED_DAY_HEADER_BASE_CLASS, 'bg-[#FF8491]');
const SELECTED_DAY_HEADER_BLUE_CLASS = cn(SELECTED_DAY_HEADER_BASE_CLASS, 'bg-[#6EA8FF]');
const SELECTED_ROW_LABEL_CLASS = 'text-main-1 font-semibold';
const SELECTED_LAST_SHIFT_BADGE_CLASS = 'ring-2 ring-inset ring-main-1';
/** 위반 박스 — 네 면 동일 여백 (좌우와 같은 규칙으로 상하도 맞춤) */
const VIOLATION_INSET = 'clamp(1px,0.1cqw,2px)';
/**
 * division-card 행 래퍼·헤더·푸터 좌측에 쓰는 미세 인셋.
 * 일자 열은 카드 우측까지 칠해지므로 수평은 좌측만 인셋(paddingRight 0).
 * Y: 카드·division-summary 첫·끝에만 넣어 상하 숨통 — 행 안에서는 items-stretch로 주말 배경이 행 높이를 꽉 채움.
 */
const DIVISION_PADDING_X = 'clamp(2px,0.2cqw,4px)';
const DIVISION_PADDING_Y = '0px';
/**
 * 셀 안의 색상 배지(D/E/N/O 등) 크기.
 *
 * ⚠️ 불변 규칙: 색상 shift-badge는 어떤 viewport에서도 **정사각형**이어야 한다.
 *   - `size-` 단축을 쓰는 경우(예: SHIFT_BADGE_SUMMARY_ROW, SHIFT_BADGE_SMALL_BASE)는 width=height가 한 클래스에 묶인다.
 *   - 일자 셀은 SHIFT_BADGE_CELL_WRAP(aspect-square) + 자식 !w/h-full 로 정사각형을 만든다.
 *   - 부모가 `flex`인 경우 기본 shrink 때문에 배지가 찌그러질 수 있으므로 SMALL/라벨 계열에는 `shrink-0`을 둔다.
 *   - summary 텍스트 셀(SUMMARY_CELL_*)과 혼동하지 않도록 주의 — 그쪽은 폭만 좁힌 직사각형.
 *
 * 사용처 / 크기 분리:
 *   - SHIFT_BADGE_CELL_WRAP / SHIFT_BADGE_CELL_BADGE: division-card 일자 셀. 래퍼 한 변은 min(셀 폭, clamp 상한).
 *     글자만 키울 때는 CELL_BADGE의 text·leading-none만 조정(행 높이·래퍼 크기 불변).
 *   - SHIFT_BADGE_SMALL_BASE: division-card 전달 근무 4칸 — LAST_COL 안에 들어가도록 size 상한 유지, 글자는 leading-none·큰 text.
 *   - SHIFT_BADGE_SUMMARY_ROW: daily-summary__label-badge(D/E/N pill) 전용.
 */
/** footer daily-summary D/E/N pill — row-summary 숫자 셀(SUMMARY_CELL_*)과 동일 스케일, 행 안에서 중앙 정렬 */
const SHIFT_BADGE_SUMMARY_ROW =
    'shrink-0 size-[clamp(16px,1.4cqw,22px)] text-[clamp(10px,0.82cqw,14px)] leading-none rounded-[clamp(3px,0.35cqw,6px)]';
/** 일자 그리드 셀 래퍼: 한 변 = min(셀 안쪽 폭, cqw 기반 clamp 상한). */
/** violation 오버레이(z-[5]~[8])보다 위 — 배지 배경색이 위반 하이라이트에 가리지 않도록 */
const SHIFT_BADGE_CELL_WRAP =
    'make-shift-calendar__shift-badge-wrap relative z-[20] flex size-[clamp(16px,1.45vw,26px)] min-w-0 shrink-0 items-center justify-center';
const SHIFT_BADGE_CELL_BADGE =
    'make-shift-calendar__shift-badge relative z-[20] !h-full !w-full min-h-0 min-w-0 rounded-[.375rem] text-[clamp(9px,0.82vw,18px)] leading-none';
/**
 * 전달 근무 컬럼(LAST_COL)에 4개가 동시에 들어가는 좁은 영역용 배지.
 * 큰 화면에서도 LAST_COL을 넘지 않도록 max를 22px로 제한.
 * `shrink-0`로 정사각형 불변 유지(폭 부족 시 overflow-hidden 컨테이너에서 잘리는 편이 낫다).
 */
const SHIFT_BADGE_SMALL_BASE =
    'shrink-0 size-[clamp(14px,1.05cqw,19px)] text-[clamp(10px,0.78cqw,14px)] leading-none rounded-[clamp(3px,0.35cqw,6px)]';
/**
 * footer daily-summary 행 높이 — 배지·숫자 셀(SUMMARY_CELL_HEIGHT)에 맞춤.
 * row-summary 본문 행(28–40px)과 달리 footer는 콤팩트하게 두고,
 * D/E/N 행 사이 세로 간격만 SUMMARY_GAP(우측 합계 열 가로 gap)으로 맞춘다.
 */
const DAILY_SUMMARY_ROW_HEIGHT = SUMMARY_CELL_HEIGHT;
const LEGACY_TITLE_MIN_OFF_AFTER_NIGHT = '\uC57C\uAC04 \uD6C4 \uD734\uBB34 \uBD80\uC871';
const LEGACY_TITLE_MIN_STAFF_SHORTAGE = '\uD544\uC694 \uC778\uC6D0 \uBD80\uC871';
const LEGACY_HOLIDAY_DAY_TYPES = new Set(['\uACF5\uD734\uC77C', '\uB300\uCCB4\uACF5\uD734\uC77C', '\uD734\uC77C']);
const LEGACY_TITLE_KEY_BY_TITLE = new Map([
    [LEGACY_TITLE_MIN_OFF_AFTER_NIGHT, 'feature.shiftEditor.validation.title.minOffAfterNight'],
    [LEGACY_TITLE_MIN_STAFF_SHORTAGE, 'feature.shiftEditor.validation.title.minStaffShortage'],
]);
const KOREAN_NURSE_SUBJECT_PATTERN = /^[^\s:]+\uB2D8\uC740\s+/;
const LEGACY_OFF_AFTER_NIGHT_PATTERN =
    /^\uC57C\uAC04 \uD6C4 \uD734\uBB34\uAC00 (\d+)\uC77C\uC774\uC5D0\uC694\.?\s*(\d+)\uC77C \uD544\uC694\uD574\uC694\.?$/;
const KOREAN_DAY_CONTEXT_PATTERN = /(?:\d{1,2}\uC77C|\d{1,2}\/\d{1,2})/;
const MIN_NIGHT_INTERVAL_TEMPLATE_PATTERN = /MIN_(?:NIGHT|N)_INTERVAL/i;
const MIN_NIGHT_INTERVAL_RULE_PATTERN = /minNightInterval|MIN_(?:NIGHT|N)_INTERVAL/i;
const MIN_NIGHT_INTERVAL_MESSAGE_PATTERNS = [
    /N\s*\uADFC\uBB34\s*\uAC04\uACA9/,
    /N\s*\uADFC\uBB34\s*\uC0AC\uC774/,
    /\uB098\uC774\uD2B8\s*\uAC04\uACA9/,
    /between\s+N\s+shifts/i,
    /N\s*\u52E4\u52D9.*\u9593\u9694/,
    /\u591C\u52E4.*\u9593\u9694/,
];
const MIN_NIGHT_INTERVAL_EXPECTED_PATTERNS = [
    /(?:\uCD5C\uC18C\s*)?(\d+)\s*\uC77C(?:\s*\uC774\uC0C1)?/,
    /at\s+least\s+(\d+)/i,
    /(\d+)\s*day/i,
    /\u6700\u4F4E\s*(\d+)\s*\u65E5/,
    /(\d+)\s*\u65E5/,
];
const VIOLATION_POPOVER_WIDTH = 360;
const VIOLATION_POPOVER_VIEWPORT_PADDING = 8;
const VIOLATION_POPOVER_MAX_ESTIMATED_HEIGHT = 360;
const VIOLATION_POPOVER_HOVER_DELAY_MS = 450;

type TViolationPopover = {
    title: string;
    violations: TViolation[];
    left: number;
    top: number;
    width: number;
    arrowLeft: number;
    placement: 'top' | 'bottom';
};

type TShiftTypeDropdownPosition = {
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    placement: 'top' | 'bottom';
};

type TShiftTypeDropdownState = {
    target: HTMLElement;
    rowIndex: number;
    colIndex: number;
    currentValue: TCellValue;
    position: TShiftTypeDropdownPosition;
};

type TViolationReasonPopoverProps = {
    popover: TViolationPopover | null;
    activeViolationKey: string | null;
    onActiveViolationChange: (violationKey: string | null) => void;
    onClose: () => void;
};

function getCellColSpans(cells: TCellPos[], rowIndex: number): {startCol: number; span: number}[] {
    if (cells.length === 0) return [];

    const cols = [...new Set(cells.filter((cell) => cell.row === rowIndex).map((cell) => cell.col))].sort((a, b) => a - b);

    if (cols.length === 0) return [];

    const spans: {startCol: number; span: number}[] = [];

    let startCol = cols[0]!;
    let endCol = cols[0]!;

    for (const col of cols.slice(1)) {
        if (col === endCol + 1) {
            endCol = col;

            continue;
        }

        spans.push({startCol, span: endCol - startCol + 1});
        startCol = col;
        endCol = col;
    }

    spans.push({startCol, span: endCol - startCol + 1});

    return spans;
}

function getViolationColSpans(violation: TViolation, rowIndex: number): {startCol: number; span: number}[] {
    return getCellColSpans(violation.cells, rowIndex);
}

function getViolationDisplayContextColSpans(violation: TViolation, rowIndex: number): {startCol: number; span: number}[] {
    return getCellColSpans(violation.displayContext?.cells ?? [], rowIndex);
}

function sortViolationsForDisplay(violations: TViolation[]): TViolation[] {
    return [...violations].sort((a, b) => {
        const priority = VIOLATION_LEVEL_PRIORITY[b.level] - VIOLATION_LEVEL_PRIORITY[a.level];

        if (priority !== 0) return priority;

        return a.message.localeCompare(b.message, getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language));
    });
}

function getPrimaryViolationLevel(violations: TViolation[]): TViolation['level'] | null {
    return sortViolationsForDisplay(getUniqueViolationsForDisplay(violations))[0]?.level ?? null;
}

function normalizeViolationTitle(title: string): string {
    const titleKey = LEGACY_TITLE_KEY_BY_TITLE.get(title);

    return titleKey ? i18n.t(titleKey) : title;
}

function isMinNightIntervalViolation(violation: TViolation, message: string): boolean {
    if (MIN_NIGHT_INTERVAL_RULE_PATTERN.test(violation.ruleId)) return true;

    if (violation.templateCode && MIN_NIGHT_INTERVAL_TEMPLATE_PATTERN.test(violation.templateCode)) return true;

    return MIN_NIGHT_INTERVAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function getMinNightIntervalExpectedDays(message: string): string | null {
    for (const pattern of MIN_NIGHT_INTERVAL_EXPECTED_PATTERNS) {
        const match = message.match(pattern);

        if (match?.[1]) return match[1];
    }

    return null;
}

function formatMinNightIntervalSentence(violation: TViolation, message: string): string | null {
    if (!isMinNightIntervalViolation(violation, message)) return null;

    const expectedDays = getMinNightIntervalExpectedDays(message);
    const expectedDayCount = expectedDays ? Number(expectedDays) : null;

    return expectedDayCount !== null && Number.isFinite(expectedDayCount)
        ? i18n.t('feature.shiftEditor.validation.legacy.minNightInterval', {count: expectedDayCount})
        : i18n.t('feature.shiftEditor.validation.legacy.minNightIntervalFallback');
}

function getViolationProblemSentence(violation: TViolation): string {
    const [rawTitle, ...detailParts] = violation.message.split(': ');
    const fallback = normalizeViolationTitle(rawTitle.trim() || violation.message.trim());
    const detail = detailParts.join(': ').trim();
    const source = detail || fallback || violation.message.trim();
    const withoutName = source.replace(KOREAN_NURSE_SUBJECT_PATTERN, '');
    const offAfterNightMatch = withoutName.match(LEGACY_OFF_AFTER_NIGHT_PATTERN);

    if (offAfterNightMatch) {
        const [, actualOffDays, requiredOffDays] = offAfterNightMatch;

        return i18n.t('feature.shiftEditor.validation.l2MinOffAfterNight', {
            actual: actualOffDays,
            expected: requiredOffDays,
        });
    }

    const minNightIntervalSentence = formatMinNightIntervalSentence(violation, withoutName);

    if (minNightIntervalSentence) return minNightIntervalSentence;

    return withoutName;
}

function getViolationDisplayKey(violation: TViolation): string {
    const problemSentence = getViolationProblemSentence(violation).replace(/\s+/g, ' ').trim();

    return `${violation.level}:${problemSentence}`;
}

function getViolationInstanceKey(violation: TViolation): string {
    const cellKey = violation.cells
        .map((cell) => `${cell.row}:${cell.col}`)
        .sort()
        .join(',');
    const periodKey = [violation.period?.startDate ?? '', violation.period?.endDate ?? '', ...(violation.period?.dates ?? [])]
        .filter(Boolean)
        .sort()
        .join(',');
    const affectedCellKey = (violation.affectedCells ?? [])
        .map((cell) => cell.cellKey ?? `${cell.shiftNurseId ?? ''}:${cell.date}:${cell.shiftCode ?? ''}:${cell.wardShiftTypeId ?? ''}`)
        .sort()
        .join(',');
    const contextCellKey = (violation.displayContext?.cells ?? [])
        .map((cell) => `${cell.row}:${cell.col}`)
        .sort()
        .join(',');
    const contextPeriodKey = [
        violation.displayContext?.period?.startDate ?? '',
        violation.displayContext?.period?.endDate ?? '',
        ...(violation.displayContext?.period?.dates ?? []),
    ]
        .filter(Boolean)
        .sort()
        .join(',');
    const contextAffectedCellKey = (violation.displayContext?.affectedCells ?? [])
        .map((cell) => cell.cellKey ?? `${cell.shiftNurseId ?? ''}:${cell.date}:${cell.shiftCode ?? ''}:${cell.wardShiftTypeId ?? ''}`)
        .sort()
        .join(',');

    return [
        getViolationDisplayKey(violation),
        violation.scope ?? '',
        violation.templateCode ?? '',
        cellKey,
        periodKey,
        affectedCellKey,
        contextCellKey,
        contextPeriodKey,
        contextAffectedCellKey,
    ].join('|');
}

function getUniqueViolationsForDisplay(violations: TViolation[]): TViolation[] {
    const seen = new Set<string>();
    const uniqueViolations: TViolation[] = [];

    for (const violation of violations) {
        const key = getViolationInstanceKey(violation);

        if (seen.has(key)) continue;

        seen.add(key);
        uniqueViolations.push(violation);
    }

    return uniqueViolations;
}

function ViolationMarker({
    violations,
    placement = 'cell',
    activeViolationKey,
}: {
    violations: TViolation[];
    placement?: 'header' | 'cell';
    activeViolationKey?: string | null;
}) {
    const displayViolations = getUniqueViolationsForDisplay(violations);
    const level = getPrimaryViolationLevel(displayViolations);

    if (!level) return null;

    const tone = VIOLATION_TONE[level];
    const label = displayViolations.length > 1 ? (displayViolations.length > 9 ? '9+' : String(displayViolations.length)) : '';
    const hasActiveViolation =
        activeViolationKey !== null &&
        activeViolationKey !== undefined &&
        displayViolations.some((violation) => getViolationInstanceKey(violation) === activeViolationKey);
    const isDimmed = activeViolationKey !== null && activeViolationKey !== undefined && !hasActiveViolation;
    const positionClass =
        placement === 'header'
            ? label
                ? '-top-[clamp(1px,0.1cqw,2px)] -right-[clamp(1px,0.1cqw,2px)] h-[clamp(9px,0.74cqw,12px)] min-w-[clamp(9px,0.74cqw,12px)] px-[1.5px] text-[clamp(7px,0.48cqw,8px)] leading-none'
                : 'top-0 right-0 size-[clamp(4px,0.4cqw,6px)] translate-x-1/2 -translate-y-1/2'
            : label
              ? 'top-[clamp(1px,0.12cqw,2px)] right-[clamp(1px,0.12cqw,2px)] h-[clamp(9px,0.74cqw,12px)] min-w-[clamp(9px,0.74cqw,12px)] px-[1.5px] text-[clamp(7px,0.48cqw,8px)] leading-none'
              : 'top-[clamp(2px,0.18cqw,3px)] right-[clamp(2px,0.18cqw,3px)] size-[clamp(4px,0.4cqw,6px)]';

    return (
        <span
            aria-hidden
            data-active-violation-marker={hasActiveViolation ? 'true' : undefined}
            data-dimmed-violation-marker={isDimmed ? 'true' : undefined}
            className={cn(
                'make-shift-calendar__violation-marker pointer-events-none absolute z-[30] grid place-items-center rounded-full font-poppins font-bold transition-[filter,opacity,transform] duration-150 ease-out',
                positionClass,
                level === 'warning' && !label && 'opacity-75',
                hasActiveViolation && 'z-[58] scale-110 drop-shadow-[0_4px_6px_rgba(15,23,42,0.2)]',
            )}
            style={{
                zIndex: hasActiveViolation ? 58 : undefined,
                backgroundColor: tone.markerBg,
                color: tone.markerText,
                opacity: isDimmed ? 0.28 : undefined,
                filter: isDimmed ? 'saturate(0.35)' : undefined,
            }}
        >
            {label}
        </span>
    );
}

function normalizeDayType(dayType: TShift['days'][number]['dayType'] | string): string {
    return String(dayType)
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, '');
}

function isSaturday(dayType: TShift['days'][number]['dayType'] | string): boolean {
    return normalizeDayType(dayType) === 'saturday';
}

function isRedCalendarDay(dayType: TShift['days'][number]['dayType'] | string): boolean {
    const normalizedDayType = normalizeDayType(dayType);

    return normalizedDayType === 'sunday' || normalizedDayType.includes('holiday') || LEGACY_HOLIDAY_DAY_TYPES.has(normalizedDayType);
}

function getDayHeaderTextClass(dayType: TShift['days'][number]['dayType']): string {
    if (isSaturday(dayType)) return 'text-blue';

    if (isRedCalendarDay(dayType)) return 'text-red';

    return 'text-sub-2.5';
}

function getSelectedDayHeaderClass(dayType: TShift['days'][number]['dayType']): string {
    if (isSaturday(dayType)) return SELECTED_DAY_HEADER_BLUE_CLASS;

    if (isRedCalendarDay(dayType)) return SELECTED_DAY_HEADER_RED_CLASS;

    return SELECTED_DAY_HEADER_PURPLE_CLASS;
}

function getViolationLevelLabel(level: TViolation['level']): string {
    return i18n.t(level === 'error' ? 'page.makeShift.calendar.violationLevel.error' : 'page.makeShift.calendar.violationLevel.warning');
}

function getUniqueViolationDates(violation: TViolation): string[] {
    const dates = new Set<string>();

    for (const date of violation.period?.dates ?? []) {
        dates.add(date);
    }

    if (violation.period?.startDate) dates.add(violation.period.startDate);

    if (violation.period?.endDate) dates.add(violation.period.endDate);

    for (const cell of violation.affectedCells ?? []) {
        dates.add(cell.date);
    }

    for (const date of violation.displayContext?.period?.dates ?? []) {
        dates.add(date);
    }

    if (violation.displayContext?.period?.startDate) dates.add(violation.displayContext.period.startDate);

    if (violation.displayContext?.period?.endDate) dates.add(violation.displayContext.period.endDate);

    for (const cell of violation.displayContext?.affectedCells ?? []) {
        dates.add(cell.date);
    }

    return [...dates].sort();
}

function formatCompactDate(date: string): string {
    const [, month, day] = date.split('-');
    const monthNumber = Number(month);
    const dayNumber = Number(day);

    if (!Number.isFinite(monthNumber) || !Number.isFinite(dayNumber)) return date;

    return `${monthNumber}/${dayNumber}`;
}

function getViolationPeriodLabel(violation: TViolation): string | null {
    const dates = getUniqueViolationDates(violation);

    if (dates.length === 0) return null;

    if (isMinNightIntervalViolation(violation, violation.message) && dates.length >= 2) {
        return `${formatCompactDate(dates[0]!)} N ↔ ${formatCompactDate(dates[dates.length - 1]!)} N`;
    }

    if (dates.length === 1) return formatCompactDate(dates[0]!);

    const startDate = violation.period?.startDate ?? dates[0]!;
    const endDate = violation.period?.endDate ?? dates[dates.length - 1]!;

    if (startDate !== endDate) {
        return `${formatCompactDate(startDate)}–${formatCompactDate(endDate)}`;
    }

    if (dates.length <= 3) {
        return dates.map(formatCompactDate).join(', ');
    }

    return i18n.t('page.makeShift.calendar.dateOthers', {
        date: formatCompactDate(dates[0]!),
        count: dates.length - 1,
    });
}

function getViolationMetaLabel(violation: TViolation, options?: {hideSingleDate?: boolean}): string | null {
    const dates = getUniqueViolationDates(violation);

    if (dates.length === 0) return null;

    if (options?.hideSingleDate && dates.length === 1) return null;

    return getViolationPeriodLabel(violation);
}

function getViolationCountSummary(errorCount: number, warningCount: number): string {
    const parts = [
        errorCount > 0 ? i18n.t('page.makeShift.calendar.violationCount.error', {count: errorCount}) : null,
        warningCount > 0 ? i18n.t('page.makeShift.calendar.violationCount.warning', {count: warningCount}) : null,
    ].filter((part): part is string => part !== null);

    return parts.join(' · ');
}

function getViolationPopoverHeader(title: string): {title: string; context?: string} {
    const [primary, ...contextParts] = title.split(' · ');
    const normalizedTitle = primary?.trim();
    const context = contextParts.join(' · ').trim();

    return {
        title: normalizedTitle && normalizedTitle.length > 0 ? normalizedTitle : title,
        context: context.length > 0 ? context : undefined,
    };
}

function hasDateContext(value: string | undefined): boolean {
    if (!value) return false;

    return KOREAN_DAY_CONTEXT_PATTERN.test(value);
}

function ViolationReasonPopover({popover, activeViolationKey, onActiveViolationChange, onClose}: TViolationReasonPopoverProps) {
    useEffect(() => {
        if (!popover) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            if (target.closest('[data-violation-popover]')) return;

            onClose();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, popover]);

    if (!popover) return null;

    const sortedViolations = sortViolationsForDisplay(getUniqueViolationsForDisplay(popover.violations));
    const errorCount = sortedViolations.filter((violation) => violation.level === 'error').length;
    const warningCount = sortedViolations.length - errorCount;
    const countSummary = getViolationCountSummary(errorCount, warningCount);
    const header = getViolationPopoverHeader(popover.title);
    const headerSummary = [header.context, countSummary].filter((part): part is string => Boolean(part)).join(' · ');
    const headerHasDateContext = hasDateContext(header.title) || hasDateContext(header.context);

    return createPortal(
        <div
            data-violation-popover
            role="dialog"
            aria-label={i18n.t('page.makeShift.calendar.violationDialogAria', {count: sortedViolations.length})}
            className={cn(
                'fixed z-[99999] box-border max-w-[calc(100vw-1rem)] overflow-hidden rounded-[12px] border border-gray-6 bg-white text-left font-apple shadow-[0_16px_36px_rgba(15,23,42,0.18)]',
                popover.placement === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2',
            )}
            style={{left: popover.left, top: popover.top, width: popover.width}}
        >
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none absolute size-3 -translate-x-1/2 rotate-45 border-gray-6 bg-white',
                    popover.placement === 'top' ? '-bottom-[7px] border-r border-b' : '-top-[7px] border-t border-l',
                )}
                style={{left: popover.arrowLeft}}
            />
            <div className="border-b border-gray-7 px-3.5 py-3">
                <p className="truncate text-[13px] leading-none font-bold text-sub-1">{header.title}</p>
                {headerSummary && <p className="mt-1.5 text-[12px] leading-none font-semibold text-sub-3">{headerSummary}</p>}
            </div>
            <div className="max-h-[min(340px,calc(100vh-150px))] overflow-y-auto overscroll-contain">
                {sortedViolations.map((violation, index) => {
                    const tone = VIOLATION_TONE[violation.level];
                    const levelLabel = getViolationLevelLabel(violation.level);
                    const metaLabel = getViolationMetaLabel(violation, {hideSingleDate: headerHasDateContext});
                    const violationKey = getViolationInstanceKey(violation);
                    const isActive = activeViolationKey === violationKey;

                    return (
                        <div
                            key={`${getViolationInstanceKey(violation)}-${index}`}
                            data-violation-row="true"
                            data-active-violation-row={isActive || undefined}
                            tabIndex={0}
                            onPointerEnter={() => onActiveViolationChange(violationKey)}
                            onPointerLeave={() => onActiveViolationChange(null)}
                            onFocus={() => onActiveViolationChange(violationKey)}
                            onBlur={() => onActiveViolationChange(null)}
                            onClick={() => onActiveViolationChange(violationKey)}
                            className={cn(
                                'relative flex min-w-0 cursor-pointer gap-2.5 px-3.5 py-3 transition-colors outline-none',
                                'hover:bg-gray-7 focus-visible:bg-gray-7 focus-visible:ring-2 focus-visible:ring-main-1/35 focus-visible:ring-inset',
                                index > 0 && 'border-t border-gray-7',
                                isActive && (violation.level === 'error' ? 'bg-red/5' : 'bg-[#FFF8E8]'),
                            )}
                        >
                            {isActive && (
                                <span
                                    aria-hidden
                                    className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full"
                                    style={{backgroundColor: tone.markerBg}}
                                />
                            )}
                            <span
                                aria-hidden
                                className="mt-[7px] size-1.5 shrink-0 rounded-full"
                                style={{backgroundColor: tone.markerBg}}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-baseline gap-2">
                                    <span
                                        className={cn(
                                            'shrink-0 text-[11px] leading-none font-bold',
                                            violation.level === 'error' ? 'text-red' : 'text-[rgb(151,88,0)]',
                                        )}
                                    >
                                        {levelLabel}
                                    </span>
                                    <p className="min-w-0 flex-1 text-[13px] leading-[1.45] font-semibold whitespace-normal text-sub-1">
                                        {getViolationProblemSentence(violation)}
                                    </p>
                                </div>
                                {metaLabel && <p className="mt-1 text-[11px] leading-none font-medium text-sub-3">{metaLabel}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>,
        document.body,
    );
}

function getShiftTypeDropdownPosition(target: HTMLElement, optionCount: number): TShiftTypeDropdownPosition {
    const rect = target.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.max(148, rect.width);
    const estimatedHeight = Math.min(280, Math.max(44, optionCount * 40 + 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(viewportPadding, Math.min(centeredLeft, window.innerWidth - width - viewportPadding));

    return placement === 'top'
        ? {left, bottom: window.innerHeight - rect.top + 6, width, placement}
        : {left, top: rect.bottom + 6, width, placement};
}

function isSameShiftTypeDropdownPosition(a: TShiftTypeDropdownPosition, b: TShiftTypeDropdownPosition): boolean {
    return a.left === b.left && a.top === b.top && a.bottom === b.bottom && a.width === b.width && a.placement === b.placement;
}

function isEditableDutyCell(rowIndex: number, colIndex: number, readonly: boolean): boolean {
    if (readonly) return false;

    const {doc, editorMode} = useShiftEditorStore.getState();

    if (!isDutyCellPositionInBounds(doc, rowIndex, colIndex)) return false;

    if (colIndex < 0) return true;

    const key = getDutyCellLockKey(doc, rowIndex, colIndex);

    if (key === null) return false;

    if (doc.requestCells[key] === true) return false;

    if (editorMode !== 'fixed' && doc.fixedCells[key] === true) return false;

    return true;
}

function isSummaryShiftType(type: TWardShiftType | undefined): type is TWardShiftType {
    return type != null && (type.isCounted || type.isOff);
}

function isActiveShiftType(type: TWardShiftType) {
    return type.isActive !== false;
}

function orderSummaryShiftTypes(types: TWardShiftType[]) {
    const workTypes: TWardShiftType[] = [];
    const offTypes: TWardShiftType[] = [];

    for (const type of types) {
        if (type.isOff) {
            offTypes.push(type);
        } else {
            workTypes.push(type);
        }
    }

    return [...workTypes, ...offTypes];
}

function ShiftTypeDropdown({
    dropdown,
    shiftTypes,
    onClose,
    onSelect,
    onReposition,
}: {
    dropdown: TShiftTypeDropdownState | null;
    shiftTypes: TWardShiftType[];
    onClose: () => void;
    onSelect: (rowIndex: number, colIndex: number, value: TCellValue) => void;
    onReposition: () => void;
}) {
    const {t} = useTypedTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!dropdown) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (!(target instanceof Node)) return;

            if (dropdown.target.contains(target) || menuRef.current?.contains(target)) return;

            onClose();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [dropdown, onClose, onReposition]);

    if (!dropdown) return null;

    const selectableShiftTypes = shiftTypes.filter(isActiveShiftType);
    const menuStyle: CSSProperties = {
        left: dropdown.position.left,
        width: dropdown.position.width,
        ...(dropdown.position.placement === 'top' ? {bottom: dropdown.position.bottom} : {top: dropdown.position.top}),
    };
    const clearSelected = dropdown.currentValue === null;

    return createPortal(
        <div
            ref={menuRef}
            role="listbox"
            aria-label={t('page.makeShift.calendar.shiftTypeDropdownAria')}
            style={menuStyle}
            className={cn(
                'fixed z-[2147483647] max-h-[280px] overflow-y-auto rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0_16px_36px_rgba(15,23,42,0.18)]',
                'animate-in duration-150 fade-in-0 zoom-in-95',
                dropdown.position.placement === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1',
            )}
        >
            <button
                type="button"
                role="option"
                aria-selected={clearSelected}
                className={cn(
                    'flex min-h-10 w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                    clearSelected ? 'bg-main-light text-main-1' : 'text-sub-1',
                )}
                onClick={() => onSelect(dropdown.rowIndex, dropdown.colIndex, null)}
            >
                <ShiftBadge shiftType={null} className="size-6 shrink-0 text-[12px]" />
                <span className="min-w-0 truncate font-apple text-[13px] font-semibold">{t('page.makeShift.calendar.clearCell')}</span>
            </button>
            {selectableShiftTypes.map((shiftType) => {
                const isSelected = dropdown.currentValue === shiftType.shortName;

                return (
                    <button
                        key={shiftType.wardShiftTypeId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                            'flex min-h-10 w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                            isSelected ? 'bg-main-light text-main-1' : 'text-sub-1',
                        )}
                        onClick={() => onSelect(dropdown.rowIndex, dropdown.colIndex, shiftType.shortName)}
                    >
                        <ShiftBadge shiftType={shiftType} className="size-6 shrink-0 text-[12px]" />
                        <span className="min-w-0 flex-1 truncate font-poppins text-[13px] font-semibold" style={{color: shiftType.color}}>
                            {shiftType.shortName}
                        </span>
                    </button>
                );
            })}
        </div>,
        document.body,
    );
}

export function MakeShiftCalendar({
    shift,
    doc,
    violationMap,
    teamViolations = [],
    showFaults,
    variant = 'default',
    onCellClick,
    tutorialCellId,
    readonly = false,
    disableInitialSelection = false,
    editableLastShifts = false,
    isShimmering = false,
    skillColumn,
    restCheckByShiftNurseId,
}: TMakeShiftCalendarProps) {
    const {t} = useTypedTranslation();
    const commands = useShiftEditorCommands();
    const selection = useShiftEditorStore((s) => s.selection);
    const selectionRect = useMemo(() => (selection ? normalizeSelection(selection) : null), [selection]);
    const didClearInitialSelection = useRef(false);
    const dragSelectionRef = useRef<{from: TCellPos; pointerId: number} | null>(null);
    const violationHoverTimerRef = useRef<number | null>(null);
    const [violationPopover, setViolationPopover] = useState<TViolationPopover | null>(null);
    const [activeViolationKey, setActiveViolationKey] = useState<string | null>(null);
    const [shiftTypeDropdown, setShiftTypeDropdown] = useState<TShiftTypeDropdownState | null>(null);
    const selectableShiftTypes = useMemo(() => shift.wardShiftTypes.filter(isActiveShiftType), [shift.wardShiftTypes]);
    const cancelScheduledViolationPopover = useCallback(() => {
        if (violationHoverTimerRef.current === null) return;

        window.clearTimeout(violationHoverTimerRef.current);
        violationHoverTimerRef.current = null;
    }, []);
    const closeViolationPopover = useCallback(() => {
        setViolationPopover(null);
        setActiveViolationKey(null);
    }, []);
    const closeShiftTypeDropdown = useCallback(() => setShiftTypeDropdown(null), []);
    const showViolationPopover = useCallback((target: HTMLElement, violations: TViolation[], title: string) => {
        const displayViolations = getUniqueViolationsForDisplay(violations);

        if (displayViolations.length === 0) return;

        const rect = target.getBoundingClientRect();
        const viewportPadding = VIOLATION_POPOVER_VIEWPORT_PADDING;
        const width = Math.min(VIOLATION_POPOVER_WIDTH, window.innerWidth - viewportPadding * 2);
        const targetCenter = rect.left + rect.width / 2;
        const left = Math.min(Math.max(targetCenter, viewportPadding + width / 2), window.innerWidth - viewportPadding - width / 2);
        const actualLeft = left - width / 2;
        const arrowLeft = Math.min(Math.max(targetCenter - actualLeft, 18), width - 18);
        const estimatedHeight = Math.min(VIOLATION_POPOVER_MAX_ESTIMATED_HEIGHT, 64 + displayViolations.length * 64);
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const placement = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
        const preferredBottomTop = rect.bottom + 10;

        setActiveViolationKey(null);
        setViolationPopover({
            title,
            violations: sortViolationsForDisplay(displayViolations),
            left,
            top: placement === 'top' ? rect.top - 10 : preferredBottomTop,
            width,
            arrowLeft,
            placement,
        });
    }, []);
    const scheduleViolationPopover = useCallback(
        (target: HTMLElement, violations: TViolation[], title: string) => {
            cancelScheduledViolationPopover();

            if (dragSelectionRef.current !== null) return;

            violationHoverTimerRef.current = window.setTimeout(() => {
                violationHoverTimerRef.current = null;

                if (!target.isConnected) return;

                showViolationPopover(target, violations, title);
            }, VIOLATION_POPOVER_HOVER_DELAY_MS);
        },
        [cancelScheduledViolationPopover, showViolationPopover],
    );
    const repositionShiftTypeDropdown = useCallback(() => {
        setShiftTypeDropdown((prev) => {
            if (!prev) return prev;

            const nextPosition = getShiftTypeDropdownPosition(prev.target, selectableShiftTypes.length + 1);

            return isSameShiftTypeDropdownPosition(prev.position, nextPosition) ? prev : {...prev, position: nextPosition};
        });
    }, [selectableShiftTypes.length]);
    const openShiftTypeDropdown = useCallback(
        (target: HTMLElement, rowIndex: number, colIndex: number, currentValue: TCellValue) => {
            if (selectableShiftTypes.length === 0 || !isEditableDutyCell(rowIndex, colIndex, readonly)) return;

            closeViolationPopover();
            commands.select({row: rowIndex, col: colIndex});
            onCellClick?.(rowIndex, colIndex);
            setShiftTypeDropdown({
                target,
                rowIndex,
                colIndex,
                currentValue,
                position: getShiftTypeDropdownPosition(target, selectableShiftTypes.length + 1),
            });
        },
        [closeViolationPopover, commands, onCellClick, readonly, selectableShiftTypes.length],
    );
    const handleShiftTypeDropdownSelect = useCallback(
        (rowIndex: number, colIndex: number, value: TCellValue) => {
            if (!isEditableDutyCell(rowIndex, colIndex, readonly)) {
                closeShiftTypeDropdown();

                return;
            }

            commands.select({row: rowIndex, col: colIndex});
            commands.setCells([{row: rowIndex, col: colIndex}], value);
            closeShiftTypeDropdown();
            onCellClick?.(rowIndex, colIndex);
        },
        [closeShiftTypeDropdown, commands, onCellClick, readonly],
    );

    useEffect(() => {
        if (!disableInitialSelection || didClearInitialSelection.current) return;

        if (selection?.type === 'single' && selection.anchor.row === 0 && selection.anchor.col === 0) {
            commands.clearSelection();
            didClearInitialSelection.current = true;
        }
    }, [commands, disableInitialSelection, selection]);

    useEffect(() => {
        if (!showFaults) {
            cancelScheduledViolationPopover();
            closeViolationPopover();
        }
    }, [cancelScheduledViolationPopover, closeViolationPopover, showFaults]);

    useEffect(() => cancelScheduledViolationPopover, [cancelScheduledViolationPopover]);

    useEffect(() => {
        document.addEventListener('pointerdown', cancelScheduledViolationPopover);

        return () => {
            document.removeEventListener('pointerdown', cancelScheduledViolationPopover);
        };
    }, [cancelScheduledViolationPopover]);

    useEffect(() => {
        if (readonly) closeShiftTypeDropdown();
    }, [closeShiftTypeDropdown, readonly]);

    useEffect(() => {
        const finishDragSelection = () => {
            dragSelectionRef.current = null;
        };

        document.addEventListener('pointerup', finishDragSelection);
        document.addEventListener('pointercancel', finishDragSelection);

        return () => {
            document.removeEventListener('pointerup', finishDragSelection);
            document.removeEventListener('pointercancel', finishDragSelection);
        };
    }, []);

    useEffect(() => {
        if (readonly) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            if (target.closest(DUTY_CELL_SELECTOR)) return;

            if (useShiftEditorStore.getState().selection === null) return;

            commands.clearSelection();
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [commands, readonly]);

    /**
     * 셀 클릭 처리.
     * - readonly가 아니면 store selection을 갱신해서 키보드 입력이 해당 셀에 반영되도록 한다.
     * - 부모의 onCellClick은 부가 동작(주로 editor 영역 focus)으로만 사용된다.
     */
    const handleCellClick = (rowIndex: number, colIndex: number) => {
        if (!readonly) {
            commands.select({row: rowIndex, col: colIndex});
        }

        onCellClick?.(rowIndex, colIndex);
    };
    const handleCellPointerDown = (event: ReactPointerEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
        cancelScheduledViolationPopover();

        if (readonly || event.button !== 0) return;

        const cell = {row: rowIndex, col: colIndex};

        dragSelectionRef.current = {from: cell, pointerId: event.pointerId};
        commands.select(cell);
        closeShiftTypeDropdown();
        onCellClick?.(rowIndex, colIndex);
    };
    const handleCellPointerEnter = (event: ReactPointerEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
        if (readonly) return;

        const dragSelection = dragSelectionRef.current;

        if (!dragSelection || dragSelection.pointerId !== event.pointerId) return;

        commands.selectRange(dragSelection.from, {row: rowIndex, col: colIndex});
    };
    const shortNameToType = useMemo(() => {
        const map = new Map<string, TWardShiftType>();

        for (const t of shift.wardShiftTypes) map.set(t.shortName, t);

        return map;
    }, [shift.wardShiftTypes]);
    const idToType = useMemo(() => {
        const map = new Map<number, TWardShiftType>();

        for (const t of shift.wardShiftTypes) map.set(t.wardShiftTypeId, t);

        return map;
    }, [shift.wardShiftTypes]);
    const workerRowMap = useMemo(() => {
        const map = new Map<string, {row: TDutyDoc['rows'][number]; index: number}>();

        doc.rows.forEach((row, index) => map.set(row.workerId, {row, index}));

        return map;
    }, [doc]);
    const teamViolationsByDayCol = useMemo(() => {
        const byCol = new Map<number, TViolation[]>();

        for (const violation of teamViolations) {
            for (const cell of violation.cells) {
                const list = byCol.get(cell.col) ?? [];

                list.push(violation);
                byCol.set(cell.col, list);
            }
        }

        return byCol;
    }, [teamViolations]);
    const visibleSummaryShiftTypeIds = useMemo(() => {
        const usedTypeIds = new Set<number>();

        for (const row of doc.rows) {
            for (const cell of row.cells) {
                if (!cell) continue;

                const type = shortNameToType.get(cell);

                if (isSummaryShiftType(type)) {
                    usedTypeIds.add(type.wardShiftTypeId);
                }
            }
        }

        return Array.from(usedTypeIds);
    }, [doc.rows, shortNameToType]);
    const [stickySummaryShiftTypeIds, setStickySummaryShiftTypeIds] = useState<number[]>([]);

    useEffect(() => {
        if (visibleSummaryShiftTypeIds.length === 0) return;

        setStickySummaryShiftTypeIds((prev) => {
            const merged = new Set(prev);

            for (const typeId of visibleSummaryShiftTypeIds) merged.add(typeId);

            if (merged.size === prev.length) return prev;

            return Array.from(merged);
        });
    }, [visibleSummaryShiftTypeIds]);

    const summaryShiftTypes = useMemo(() => {
        const summaryTypeIds = new Set<number>([...stickySummaryShiftTypeIds, ...visibleSummaryShiftTypeIds]);
        const visibleTypes = shift.wardShiftTypes.filter((type) => isSummaryShiftType(type) && summaryTypeIds.has(type.wardShiftTypeId));

        return orderSummaryShiftTypes(visibleTypes);
    }, [shift.wardShiftTypes, stickySummaryShiftTypeIds, visibleSummaryShiftTypeIds]);
    const hasSummaryShiftTypes = summaryShiftTypes.length > 0;
    const isSimplified = variant === 'simplified';
    const showSkillColumn = !isSimplified && skillColumn?.config.enabled === true;
    const showRestCheckColumn = !isSimplified && restCheckByShiftNurseId !== undefined;
    const showCarryColumn = showRestCheckColumn;
    const hasRightColumns = hasSummaryShiftTypes || showRestCheckColumn;
    const skillColumnWidth = useMemo(
        () => (showSkillColumn ? getSkillColumnWidth(skillColumn?.config) : MIN_SKILL_COL),
        [showSkillColumn, skillColumn?.config],
    );
    const leftGridTemplateColumns = isSimplified
        ? LEFT_GRID_TEMPLATE_COLUMNS_SIMPLIFIED
        : getLeftGridTemplateColumns(showSkillColumn, showCarryColumn, skillColumnWidth);
    const shimmerInsetLeft = getShimmerInsetLeft(isSimplified, showSkillColumn, showCarryColumn, skillColumnWidth);

    let didAssignTutorialCell = false;

    return (
        <div
            // 캘린더는 가용 폭을 항상 100% 사용한다.
            // - 화면 폭이 줄면: 캘린더도 같이 줄어 우측 여백이 자연스럽게 함께 줄어든다.
            // - 화면 폭이 page-min(1280px) 미만이면: page-view가 페이지 전체 가로 스크롤로 처리.
            // 캘린더 자체는 절대 가로 스크롤을 갖지 않는다 (no overflow-x-*).
            //
            // 행 단위 구조:
            //   <row>
            //     <row-left>  (이름·전달근무·일자) — division 카드 내부에 들어감
            //     <row-summary>(D/E/N/O/WO 합계) — 카드 밖, 우측에 분리 배치
            //   </row>
            aria-busy={isShimmering || undefined}
            data-shimmer={isShimmering ? 'true' : undefined}
            className={cn(
                'make-shift-calendar @container relative isolate flex w-full min-w-0 flex-col gap-2',
                isShimmering && 'make-shift-calendar--shimmering',
            )}
        >
            {/* HEADER */}
            <div
                className="make-shift-calendar__header flex w-full min-w-0 items-center py-1"
                style={{gap: isSimplified || !hasRightColumns ? 0 : DIVISION_TO_SUMMARY_GAP}}
            >
                <div
                    className="make-shift-calendar__header-left grid min-w-0 flex-1 items-center"
                    // body와 동일: 좌측만 DIVISION_PADDING_X, 일자 영역은 우측까지.
                    style={{
                        gridTemplateColumns: leftGridTemplateColumns,
                        columnGap: ROW_GAP_X,
                        paddingLeft: DIVISION_PADDING_X,
                        paddingRight: 0,
                    }}
                >
                    <HeaderLabel className="make-shift-calendar__header-label--name">{t('page.makeShift.calendar.name')}</HeaderLabel>
                    {!isSimplified && (
                        <>
                            {showSkillColumn ? (
                                <HeaderLabel className="make-shift-calendar__header-label--carry">
                                    {t('page.request.calendar.skillColumn')}
                                </HeaderLabel>
                            ) : null}
                            {showCarryColumn ? (
                                <HeaderLabel
                                    className="make-shift-calendar__header-label--carried"
                                    title={t('page.makeShift.calendar.carried')}
                                >
                                    {t('page.makeShift.calendar.carried')}
                                </HeaderLabel>
                            ) : null}
                            <HeaderLabel className="make-shift-calendar__header-label--last">
                                {t('page.makeShift.calendar.previousShifts')}
                            </HeaderLabel>
                        </>
                    )}

                    <div
                        className="make-shift-calendar__day-header-pill grid min-w-0 rounded-[12px] bg-gray-7 px-0 py-1"
                        style={{gridTemplateColumns: getDayGridTemplateColumns(shift.days.length)}}
                    >
                        {shift.days.map((d, j) => {
                            const dayViolationList = showFaults ? teamViolationsByDayCol.get(j) : undefined;
                            const dayViolations = getUniqueViolationsForDisplay(dayViolationList ?? []);
                            const hasDayViolations = dayViolations.length > 0;
                            const dayViolationLevel = hasDayViolations ? getPrimaryViolationLevel(dayViolations) : null;
                            const dayViolationTone = dayViolationLevel ? VIOLATION_TONE[dayViolationLevel] : null;
                            const activeDayViolation =
                                activeViolationKey !== null
                                    ? dayViolations.find((violation) => getViolationInstanceKey(violation) === activeViolationKey)
                                    : undefined;
                            const activeDayViolationTone = activeDayViolation ? VIOLATION_TONE[activeDayViolation.level] : null;
                            const isDayViolationDimmed = activeViolationKey !== null && hasDayViolations && !activeDayViolation;
                            const isColumnSelected =
                                !readonly && selectionRect !== null && j >= selectionRect.left && j <= selectionRect.right;
                            const normalizedDayType = normalizeDayType(d.dayType);
                            const dayViolationPopoverTitle = t('page.makeShift.calendar.fullDayLabel', {day: d.day});

                            return (
                                <button
                                    key={j}
                                    type="button"
                                    tabIndex={hasDayViolations ? 0 : -1}
                                    data-day-header-index={j}
                                    data-day-type={normalizedDayType}
                                    data-selected-column={isColumnSelected || undefined}
                                    data-violation-trigger={hasDayViolations ? 'true' : undefined}
                                    data-active-violation={activeDayViolation ? 'true' : undefined}
                                    data-dimmed-violation={isDayViolationDimmed ? 'true' : undefined}
                                    onPointerEnter={(event) => {
                                        if (!hasDayViolations) {
                                            cancelScheduledViolationPopover();

                                            return;
                                        }

                                        scheduleViolationPopover(event.currentTarget, dayViolations, dayViolationPopoverTitle);
                                    }}
                                    onPointerLeave={cancelScheduledViolationPopover}
                                    onPointerCancel={cancelScheduledViolationPopover}
                                    onPointerDown={cancelScheduledViolationPopover}
                                    onClick={(event) => {
                                        if (!hasDayViolations) return;

                                        showViolationPopover(event.currentTarget, dayViolations, dayViolationPopoverTitle);
                                    }}
                                    className={cn(
                                        'make-shift-calendar__day-header-cell',
                                        'relative min-w-0 rounded-full text-center font-poppins tabular-nums',
                                        'text-[12px] leading-5 font-semibold transition-[box-shadow,transform,background-color] duration-150 ease-out',
                                        hasDayViolations ? 'cursor-pointer' : 'cursor-default',
                                        getDayHeaderTextClass(d.dayType),
                                        isColumnSelected && getSelectedDayHeaderClass(d.dayType),
                                        activeDayViolation && 'z-[48] bg-white',
                                    )}
                                    style={{
                                        zIndex: activeDayViolation ? 48 : undefined,
                                        transform: activeDayViolation ? 'translateY(-1px)' : undefined,
                                        boxShadow: activeDayViolationTone
                                            ? `0 8px 18px rgba(15,23,42,0.18), 0 0 0 2px ${activeDayViolationTone.border}, inset 0 -2px 0 ${activeDayViolationTone.rail}`
                                            : isDayViolationDimmed
                                              ? 'inset 0 -1px 0 rgba(148,163,184,0.24)'
                                              : dayViolationTone
                                                ? `inset 0 -${dayViolationLevel === 'warning' ? '1px' : '2px'} 0 ${dayViolationTone.rail}`
                                                : undefined,
                                    }}
                                >
                                    {d.day}
                                    {hasDayViolations && (
                                        <ViolationMarker
                                            violations={dayViolations}
                                            placement="header"
                                            activeViolationKey={activeViolationKey}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {!isSimplified && hasRightColumns && (
                    /*
                     * 사진 기준: 헤더 우측 D/E/N/O/WO 라벨은 박스 없이
                     * 모두 동일한 회색의 "컬럼 헤더" 텍스트 라벨이다.
                     * (footer의 daily-summary 배지와는 정반대 — 그쪽은 배경 채움.)
                     */
                    <div
                        className="make-shift-calendar__type-summary-header flex shrink-0 items-center"
                        style={{gap: SUMMARY_GAP, paddingInline: SUMMARY_PADDING_X}}
                    >
                        {hasSummaryShiftTypes &&
                            summaryShiftTypes.map((type) => (
                                <div
                                    key={type.wardShiftTypeId}
                                    className={cn(
                                        'make-shift-calendar__type-summary-badge',
                                        'grid place-items-center font-poppins text-[clamp(10px,0.82cqw,14px)] leading-none font-medium',
                                        SUMMARY_CELL_HEIGHT,
                                        SUMMARY_CELL_WIDTH,
                                    )}
                                    style={{color: type.color}}
                                >
                                    {type.shortName}
                                </div>
                            ))}
                        {showRestCheckColumn ? (
                            <div
                                className={cn(
                                    'make-shift-calendar__rest-check-header',
                                    'grid place-items-center font-apple text-[clamp(10px,0.78cqw,13px)] leading-none font-medium text-sub-3',
                                    SUMMARY_CELL_HEIGHT,
                                )}
                                style={{width: REST_CHECK_COL}}
                                title={t('page.makeShift.calendar.restCheck')}
                            >
                                {t('page.makeShift.calendar.restCheckCompact')}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* BODY: division-level별로 카드 + 우측 합계가 나란히 배치 */}
            <div className="make-shift-calendar__body flex w-full min-w-0 flex-col gap-2">
                {shift.divisionShiftNurses.map((division, level) => {
                    const rows = division.filter((r) => r.shiftNurse.isWorker);

                    if (rows.length === 0) return null;

                    return (
                        <div
                            key={level}
                            data-division-level={level}
                            className="make-shift-calendar__division flex w-full min-w-0 items-stretch"
                            style={{gap: isSimplified || !hasRightColumns ? 0 : DIVISION_TO_SUMMARY_GAP}}
                        >
                            {/*
                             * 카드 상·하만 DIVISION_PADDING_Y(첫·끝 행 래퍼). 좌는 이름 열만 인셋, 일자는 우측까지.
                             * 행 그리드는 items-stretch → 주말 셀이 행 높이 전체를 칠함(행 안에서 잘리지 않음).
                             */}
                            <div className="make-shift-calendar__division-card relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[16px] bg-white">
                                {isShimmering && (
                                    <div
                                        aria-hidden="true"
                                        data-shimmer-scope="duty-cells"
                                        className="make-shift-calendar__shimmer pointer-events-none absolute top-0 right-0 bottom-0 z-[80] overflow-hidden bg-main-light/25"
                                        style={{left: shimmerInsetLeft}}
                                    >
                                        <span className="absolute inset-0 bg-white/10" />
                                        <span className="make-shift-calendar__shimmer-sweep absolute top-0 bottom-0 w-[18%]" />
                                    </div>
                                )}
                                {rows.map((row, i) => {
                                    const workerId = String(row.shiftNurse.shiftNurseId);
                                    const docEntry = workerRowMap.get(workerId);

                                    if (!docEntry) return null;

                                    const rowTutorialCellId = tutorialCellId && !didAssignTutorialCell ? tutorialCellId : undefined;

                                    didAssignTutorialCell = didAssignTutorialCell || rowTutorialCellId !== undefined;

                                    return (
                                        <div
                                            key={row.shiftNurse.shiftNurseId}
                                            style={{
                                                paddingLeft: DIVISION_PADDING_X,
                                                paddingRight: 0,
                                                paddingTop: i === 0 ? DIVISION_PADDING_Y : 0,
                                                paddingBottom: i === rows.length - 1 ? DIVISION_PADDING_Y : 0,
                                            }}
                                        >
                                            <CalendarRowLeft
                                                nurseName={row.shiftNurse.name}
                                                skillLevel={skillColumn?.levelsByNurseId[row.shiftNurse.nurseId]}
                                                skillConfig={skillColumn?.config}
                                                carriedDays={restCheckByShiftNurseId?.[row.shiftNurse.shiftNurseId]?.carriedDays}
                                                lastShifts={row.lastWardShiftList.map((id) =>
                                                    id != null ? (idToType.get(id) ?? null) : null,
                                                )}
                                                lastShiftCells={docEntry.row.lastCells}
                                                days={shift.days}
                                                columns={doc.columns}
                                                cells={docEntry.row.cells}
                                                requestCells={doc.requestCells}
                                                rowIndex={docEntry.index}
                                                shiftNurseId={row.shiftNurse.shiftNurseId}
                                                shortNameToType={shortNameToType}
                                                idToType={idToType}
                                                wardReqShiftList={row.wardReqShiftList}
                                                violations={violationMap}
                                                showFaults={showFaults}
                                                activeViolationKey={activeViolationKey}
                                                simplified={isSimplified}
                                                showSkillColumn={showSkillColumn}
                                                showCarryColumn={showCarryColumn}
                                                leftGridTemplateColumns={leftGridTemplateColumns}
                                                readonly={readonly}
                                                editableLastShifts={editableLastShifts}
                                                selectionRect={selectionRect}
                                                tutorialCellId={rowTutorialCellId}
                                                onCellClick={handleCellClick}
                                                onCellPointerDown={handleCellPointerDown}
                                                onCellPointerEnter={handleCellPointerEnter}
                                                onCellDoubleClick={openShiftTypeDropdown}
                                                onViolationClick={showViolationPopover}
                                                onViolationHoverStart={scheduleViolationPopover}
                                                onViolationHoverEnd={cancelScheduledViolationPopover}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {!isSimplified && hasRightColumns && (
                                /* 우측 합계: 카드와 동일 DIVISION_PADDING_Y로 세로 정렬 */
                                <div
                                    className="make-shift-calendar__division-summary flex shrink-0 flex-col"
                                    style={{paddingBlock: DIVISION_PADDING_Y}}
                                >
                                    {rows.map((row) => {
                                        const workerId = String(row.shiftNurse.shiftNurseId);
                                        const docEntry = workerRowMap.get(workerId);

                                        if (!docEntry) return null;

                                        return (
                                            <CalendarRowSummary
                                                key={row.shiftNurse.shiftNurseId}
                                                cells={docEntry.row.cells}
                                                days={shift.days}
                                                shortNameToType={shortNameToType}
                                                summaryShiftTypes={summaryShiftTypes}
                                                restCheck={restCheckByShiftNurseId?.[row.shiftNurse.shiftNurseId]}
                                                showRestCheckColumn={showRestCheckColumn}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* FOOTER: 일자별 D / E / N 합계 — simplified 에서는 생략 */}
            {!isSimplified && hasSummaryShiftTypes && (
                <DailySummary
                    doc={doc}
                    shortNameToType={shortNameToType}
                    summaryShiftTypes={summaryShiftTypes}
                    leftGridTemplateColumns={leftGridTemplateColumns}
                    showSkillColumn={showSkillColumn}
                    showCarryColumn={showCarryColumn}
                    showRestCheckColumn={showRestCheckColumn}
                />
            )}
            <ShiftTypeDropdown
                dropdown={shiftTypeDropdown}
                shiftTypes={selectableShiftTypes}
                onClose={closeShiftTypeDropdown}
                onSelect={handleShiftTypeDropdownSelect}
                onReposition={repositionShiftTypeDropdown}
            />
            <ViolationReasonPopover
                popover={violationPopover}
                activeViolationKey={activeViolationKey}
                onActiveViolationChange={setActiveViolationKey}
                onClose={closeViolationPopover}
            />
        </div>
    );
}

function HeaderLabel({children, className, title}: {children: React.ReactNode; className?: string; title?: string}) {
    return (
        <div
            className={cn(
                'make-shift-calendar__header-label',
                'min-w-0 truncate text-center font-apple text-[clamp(10px,0.78cqw,14px)] font-medium text-sub-3',
                className,
            )}
            title={title}
        >
            {children}
        </div>
    );
}

type TCalendarRowLeftProps = {
    nurseName: string;
    skillLevel?: TSkillLevelValue;
    skillConfig?: TSkillLevelConfig;
    carriedDays?: number;
    lastShifts: (TWardShiftType | null)[];
    lastShiftCells?: TCellValue[];
    days: TShift['days'];
    columns: TDutyDoc['columns'];
    cells: TDutyDoc['rows'][number]['cells'];
    requestCells: TDutyDoc['requestCells'];
    rowIndex: number;
    shiftNurseId: number;
    shortNameToType: Map<string, TWardShiftType>;
    idToType: Map<number, TWardShiftType>;
    wardReqShiftList: (number | null)[];
    violations: TViolationMap;
    showFaults: boolean;
    activeViolationKey: string | null;
    simplified: boolean;
    showSkillColumn: boolean;
    showCarryColumn: boolean;
    leftGridTemplateColumns: string;
    readonly: boolean;
    editableLastShifts: boolean;
    selectionRect: {top: number; left: number; bottom: number; right: number} | null;
    tutorialCellId?: string;
    onCellClick?: (rowIndex: number, colIndex: number) => void;
    onCellPointerDown: (event: ReactPointerEvent<HTMLElement>, rowIndex: number, colIndex: number) => void;
    onCellPointerEnter: (event: ReactPointerEvent<HTMLElement>, rowIndex: number, colIndex: number) => void;
    onCellDoubleClick: (target: HTMLElement, rowIndex: number, colIndex: number, currentValue: TCellValue) => void;
    onViolationClick: (target: HTMLElement, violations: TViolation[], title: string) => void;
    onViolationHoverStart: (target: HTMLElement, violations: TViolation[], title: string) => void;
    onViolationHoverEnd: () => void;
};

/**
 * 행의 좌측 (이름·전달근무·일자) — division 카드 안에 들어간다.
 */
function CalendarRowLeft({
    nurseName,
    skillLevel,
    skillConfig,
    carriedDays,
    lastShifts,
    lastShiftCells,
    days,
    columns,
    cells,
    requestCells,
    rowIndex,
    shiftNurseId,
    shortNameToType,
    idToType,
    wardReqShiftList,
    violations,
    showFaults,
    activeViolationKey,
    simplified,
    showSkillColumn,
    showCarryColumn,
    leftGridTemplateColumns,
    readonly,
    editableLastShifts,
    selectionRect,
    tutorialCellId,
    onCellClick,
    onCellPointerDown,
    onCellPointerEnter,
    onCellDoubleClick,
    onViolationClick,
    onViolationHoverStart,
    onViolationHoverEnd,
}: TCalendarRowLeftProps) {
    const {t} = useTypedTranslation();
    const rowViolationPrefix = `${shiftNurseId},`;
    const displayNurseName = formatNurseDisplayName(nurseName);
    const violationsByDayCol = useMemo(() => {
        const byCol = new Map<number, TViolation[]>();

        for (const [key, v] of violations) {
            if (!key.startsWith(rowViolationPrefix)) continue;

            for (const c of v.cells) {
                if (c.row !== rowIndex) continue;

                const list = byCol.get(c.col) ?? [];

                list.push(v);
                byCol.set(c.col, list);
            }
        }

        return byCol;
    }, [violations, rowIndex, rowViolationPrefix]);
    const violationSpanList = useMemo(() => {
        const list: {startCol: number; span: number; violation: TViolation}[] = [];
        const seen = new Set<string>();

        for (const [key, v] of violations) {
            if (!key.startsWith(rowViolationPrefix)) continue;

            const spanInfos = getViolationColSpans(v, rowIndex);

            if (spanInfos.length === 0) continue;

            for (const spanInfo of spanInfos) {
                const spanKey = `${getViolationInstanceKey(v)}:${spanInfo.startCol}:${spanInfo.span}`;

                if (seen.has(spanKey)) continue;

                seen.add(spanKey);
                list.push({...spanInfo, violation: v});
            }
        }

        list.sort((a, b) => {
            const p = VIOLATION_LEVEL_PRIORITY[a.violation.level] - VIOLATION_LEVEL_PRIORITY[b.violation.level];

            if (p !== 0) return p;

            return a.startCol - b.startCol;
        });

        return list;
    }, [rowIndex, rowViolationPrefix, violations]);
    const violationContextSpanList = useMemo(() => {
        const list: {startCol: number; span: number; violation: TViolation}[] = [];
        const seen = new Set<string>();

        for (const [key, v] of violations) {
            if (!key.startsWith(rowViolationPrefix)) continue;

            const spanInfos = getViolationDisplayContextColSpans(v, rowIndex);

            if (spanInfos.length === 0) continue;

            for (const spanInfo of spanInfos) {
                const spanKey = `${getViolationInstanceKey(v)}:context:${spanInfo.startCol}:${spanInfo.span}`;

                if (seen.has(spanKey)) continue;

                seen.add(spanKey);
                list.push({...spanInfo, violation: v});
            }
        }

        list.sort((a, b) => a.startCol - b.startCol);

        return list;
    }, [rowIndex, rowViolationPrefix, violations]);
    const getCellShiftType = (j: number): TWardShiftType | null => {
        const cell = cells[j];

        if (!cell) return null;

        return shortNameToType.get(cell) ?? null;
    };
    const displayLastShiftCells = lastShiftCells?.length ? lastShiftCells : undefined;
    const displayLastShifts = displayLastShiftCells
        ? displayLastShiftCells.map((cell) => (cell ? (shortNameToType.get(cell) ?? null) : null))
        : lastShifts;
    const isRowSelected = !readonly && selectionRect !== null && rowIndex >= selectionRect.top && rowIndex <= selectionRect.bottom;
    const carriedLabel = formatSignedDays(carriedDays);
    const carriedTitle =
        carriedDays !== undefined
            ? t('page.makeShift.calendar.carriedDetail', {
                  count: carriedLabel,
              })
            : undefined;

    return (
        <>
            <div
                data-shift-nurse-id={shiftNurseId}
                data-row-index={rowIndex}
                className="make-shift-calendar__row make-shift-calendar__row-left grid h-[clamp(28px,2.4cqw,40px)] w-full min-w-0 items-stretch"
                style={{
                    gridTemplateColumns: leftGridTemplateColumns,
                    columnGap: ROW_GAP_X,
                }}
            >
                <div
                    data-selected-row-label={isRowSelected || undefined}
                    className={cn(
                        'make-shift-calendar__row-name flex min-h-0 min-w-0 items-center justify-center truncate rounded-[clamp(5px,0.55cqw,8px)] text-center font-apple text-[clamp(12px,1.05cqw,16px)] leading-none whitespace-nowrap text-sub-1',
                        isRowSelected && SELECTED_ROW_LABEL_CLASS,
                    )}
                    title={nurseName}
                >
                    {displayNurseName}
                </div>

                {!simplified && (
                    <>
                        {showSkillColumn ? (
                            <div className="make-shift-calendar__row-carry flex min-h-0 items-center justify-center">
                                {skillConfig ? (
                                    <SkillBadge level={skillLevel} config={skillConfig} className={ROW_SKILL_BADGE_CLASS} />
                                ) : null}
                            </div>
                        ) : null}
                        {showCarryColumn ? (
                            <div
                                className={cn(
                                    'make-shift-calendar__row-carried-value flex min-h-0 min-w-0 items-center justify-center rounded-[clamp(5px,0.55cqw,8px)] font-poppins text-[clamp(11px,0.9cqw,14px)] font-semibold whitespace-nowrap tabular-nums',
                                    carriedDays === undefined || carriedDays === 0
                                        ? 'text-sub-2'
                                        : carriedDays > 0
                                          ? 'text-red'
                                          : 'text-main-1',
                                )}
                                title={carriedTitle}
                            >
                                {carriedLabel}
                            </div>
                        ) : null}

                        <div
                            className="make-shift-calendar__row-last-shifts flex min-h-0 min-w-0 flex-nowrap items-center justify-center overflow-hidden"
                            style={{gap: LAST_SHIFTS_GAP}}
                        >
                            {displayLastShifts.map((t, i) => {
                                const colIndex = i - displayLastShifts.length;
                                const cellValue = displayLastShiftCells?.[i] ?? null;
                                const isSelected =
                                    editableLastShifts &&
                                    !readonly &&
                                    selectionRect !== null &&
                                    rowIndex >= selectionRect.top &&
                                    rowIndex <= selectionRect.bottom &&
                                    colIndex >= selectionRect.left &&
                                    colIndex <= selectionRect.right;

                                if (!editableLastShifts) {
                                    return (
                                        <ShiftBadge
                                            key={i}
                                            shiftType={t}
                                            className={cn('make-shift-calendar__row-last-shift-badge', SHIFT_BADGE_SMALL_BASE)}
                                        />
                                    );
                                }

                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        tabIndex={-1}
                                        data-last-shift-index={i}
                                        data-shift-col-index={colIndex}
                                        data-duty-cell="true"
                                        data-selected={isSelected || undefined}
                                        aria-haspopup={!readonly ? 'listbox' : undefined}
                                        onPointerDown={(event) => {
                                            onCellPointerDown(event, rowIndex, colIndex);
                                        }}
                                        onMouseDown={(event) => {
                                            if (!readonly) event.preventDefault();
                                        }}
                                        onPointerEnter={(event) => {
                                            onCellPointerEnter(event, rowIndex, colIndex);
                                        }}
                                        onClick={() => {
                                            onCellClick?.(rowIndex, colIndex);
                                        }}
                                        onDoubleClick={(event) => {
                                            onCellDoubleClick(event.currentTarget, rowIndex, colIndex, cellValue);
                                        }}
                                        className={cn(
                                            'make-shift-calendar__row-last-shift-cell',
                                            'relative flex min-h-0 min-w-0 items-center justify-center',
                                            readonly ? 'cursor-default' : 'cursor-pointer',
                                        )}
                                    >
                                        {isSelected && <span aria-hidden className={ABSOLUTE_SELECTION_BACKGROUND_LAYER_CLASS} />}
                                        <ShiftBadge
                                            shiftType={t}
                                            className={cn(
                                                'make-shift-calendar__row-last-shift-badge relative z-[10]',
                                                SHIFT_BADGE_SMALL_BASE,
                                                isSelected && SELECTED_LAST_SHIFT_BADGE_CLASS,
                                            )}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <div
                    className="make-shift-calendar__row-days grid h-full min-w-0 items-stretch px-0"
                    style={{gridTemplateColumns: getDayGridTemplateColumns(days.length)}}
                >
                    {!readonly &&
                        selectionRect !== null &&
                        rowIndex >= selectionRect.top &&
                        rowIndex <= selectionRect.bottom &&
                        days.map((_, j) => {
                            if (j < selectionRect.left || j > selectionRect.right) return null;

                            return (
                                <span
                                    key={`selected-${j}`}
                                    aria-hidden
                                    data-selection-layer="true"
                                    style={{gridRow: 1, gridColumn: j + 1}}
                                    className={GRID_SELECTION_BACKGROUND_LAYER_CLASS}
                                />
                            );
                        })}
                    {days.map((day, j) => {
                        const shiftType = getCellShiftType(j);
                        const date = columns[j];
                        const requestCellKey = date ? `${shiftNurseId}|${date}` : null;
                        const reqId = requestCellKey && requestCells[requestCellKey] === true ? (wardReqShiftList[j] ?? null) : null;
                        const reqType = reqId != null ? idToType.get(reqId) : null;
                        const cellViolationList = showFaults ? violationsByDayCol.get(j) : undefined;
                        const cellViolations = getUniqueViolationsForDisplay(cellViolationList ?? []);
                        const hasCellViolations = cellViolations.length > 0;
                        const activeCellViolation =
                            activeViolationKey !== null
                                ? cellViolations.find((violation) => getViolationInstanceKey(violation) === activeViolationKey)
                                : undefined;
                        const isCellViolationDimmed = activeViolationKey !== null && hasCellViolations && !activeCellViolation;
                        const normalizedDayType = normalizeDayType(day.dayType);
                        const weekendBg = isSaturday(day.dayType) ? 'bg-blue/5' : isRedCalendarDay(day.dayType) ? 'bg-red/5' : '';
                        const isSelected =
                            !readonly &&
                            selectionRect !== null &&
                            rowIndex >= selectionRect.top &&
                            rowIndex <= selectionRect.bottom &&
                            j >= selectionRect.left &&
                            j <= selectionRect.right;
                        const cellViolationPopoverTitle = t('page.makeShift.calendar.nurseDayLabel', {
                            name: displayNurseName,
                            day: day.day,
                        });

                        return (
                            <button
                                key={j}
                                type="button"
                                tabIndex={-1}
                                id={tutorialCellId && j === 0 ? tutorialCellId : undefined}
                                data-day-index={j}
                                data-day-type={normalizedDayType}
                                data-duty-cell="true"
                                data-selected={isSelected || undefined}
                                data-violation-trigger={hasCellViolations ? 'true' : undefined}
                                data-violation-count={hasCellViolations ? cellViolations.length : undefined}
                                data-active-violation-cell={activeCellViolation ? 'true' : undefined}
                                data-dimmed-violation-cell={isCellViolationDimmed ? 'true' : undefined}
                                aria-haspopup={!readonly ? 'listbox' : undefined}
                                onPointerDown={(event) => {
                                    onCellPointerDown(event, rowIndex, j);
                                }}
                                onMouseDown={(event) => {
                                    if (!readonly) event.preventDefault();
                                }}
                                onPointerEnter={(event) => {
                                    onCellPointerEnter(event, rowIndex, j);

                                    if (!hasCellViolations) {
                                        onViolationHoverEnd();

                                        return;
                                    }

                                    onViolationHoverStart(event.currentTarget, cellViolations, cellViolationPopoverTitle);
                                }}
                                onPointerLeave={hasCellViolations ? onViolationHoverEnd : undefined}
                                onPointerCancel={hasCellViolations ? onViolationHoverEnd : undefined}
                                onClick={(event) => {
                                    onCellClick?.(rowIndex, j);

                                    if (hasCellViolations) {
                                        onViolationClick(event.currentTarget, cellViolations, cellViolationPopoverTitle);
                                    }
                                }}
                                onDoubleClick={(event) => {
                                    onCellDoubleClick(event.currentTarget, rowIndex, j, cells[j] ?? null);
                                }}
                                style={{
                                    gridRow: 1,
                                    gridColumn: j + 1,
                                    zIndex: activeCellViolation ? 50 : undefined,
                                    paddingInline: DAY_CELL_PADDING_X,
                                }}
                                className={cn(
                                    'make-shift-calendar__day-cell',
                                    'group relative z-[10] flex h-full min-w-0 items-center justify-center',
                                    hasCellViolations || !readonly ? 'cursor-pointer' : 'cursor-default',
                                    activeCellViolation && 'z-[50]',
                                    weekendBg,
                                )}
                            >
                                {reqType && shiftType && reqType.wardShiftTypeId !== shiftType.wardShiftTypeId && (
                                    <span
                                        className="make-shift-calendar__request-outline pointer-events-none absolute inset-[clamp(1px,0.18cqw,3px)] rounded-[clamp(4px,0.5cqw,7px)] border-[1.5px] opacity-70"
                                        style={{borderColor: reqType.color}}
                                        aria-hidden
                                    />
                                )}
                                {hasCellViolations && (
                                    <ViolationMarker violations={cellViolations} activeViolationKey={activeViolationKey} />
                                )}
                                <span
                                    data-active-violation-shift-badge={activeCellViolation ? 'true' : undefined}
                                    className={cn(
                                        SHIFT_BADGE_CELL_WRAP,
                                        'transition-[filter,transform] duration-150 ease-out',
                                        activeCellViolation &&
                                            'z-[56] -translate-y-[1px] scale-[1.04] drop-shadow-[0_6px_8px_rgba(15,23,42,0.18)]',
                                    )}
                                >
                                    <ShiftBadge
                                        shiftType={shiftType}
                                        isOnlyRequest={shiftType === null && reqType !== null}
                                        className={SHIFT_BADGE_CELL_BADGE}
                                    />
                                </span>
                            </button>
                        );
                    })}
                    {showFaults &&
                        violationContextSpanList.map(({startCol, span, violation: v}) => {
                            const tone = VIOLATION_TONE[v.level];
                            const contextTone = VIOLATION_CONTEXT_TONE[v.level];
                            const isActive = activeViolationKey === getViolationInstanceKey(v);
                            const isDimmed = activeViolationKey !== null && !isActive;

                            return (
                                <span
                                    key={`vio-context-${getViolationInstanceKey(v)}-${startCol}`}
                                    aria-hidden
                                    data-violation-context="true"
                                    data-violation-level={v.level}
                                    data-active-violation-context={isActive ? 'true' : undefined}
                                    data-dimmed-violation-context={isDimmed ? 'true' : undefined}
                                    style={{
                                        gridRow: 1,
                                        gridColumn: `${startCol + 1} / span ${span}`,
                                        opacity: isDimmed ? 0.12 : undefined,
                                        filter: isDimmed ? 'saturate(0.35)' : undefined,
                                        borderColor: isActive ? tone.border : 'transparent',
                                        borderWidth: isActive ? '1px' : 0,
                                        backgroundColor: isActive ? contextTone.activeSurface : contextTone.surface,
                                        margin: VIOLATION_INSET,
                                        boxShadow: isActive ? `inset 0 0 0 1px ${tone.border}` : `inset 0 -1px 0 ${contextTone.rail}`,
                                    }}
                                    className="make-shift-calendar__violation-context pointer-events-none z-[4] rounded-[clamp(5px,0.55cqw,8px)] transition-[box-shadow,filter,opacity,background-color,border-color] duration-150 ease-out"
                                />
                            );
                        })}
                    {showFaults &&
                        violationSpanList.map(({startCol, span, violation: v}) => {
                            const tone = VIOLATION_TONE[v.level];
                            const isHard = v.level === 'error';
                            const isActive = activeViolationKey === getViolationInstanceKey(v);
                            const isDimmed = activeViolationKey !== null && !isActive;
                            const zByLevel = v.level === 'error' ? 'z-[6]' : 'z-[5]';

                            return (
                                <span
                                    key={`vio-${getViolationInstanceKey(v)}-${startCol}`}
                                    aria-label={v.message}
                                    data-violation-level={v.level}
                                    data-active-violation={isActive ? 'true' : undefined}
                                    data-dimmed-violation={isDimmed ? 'true' : undefined}
                                    style={{
                                        gridRow: 1,
                                        gridColumn: `${startCol + 1} / span ${span}`,
                                        zIndex: isActive ? 48 : undefined,
                                        transform: isActive ? 'translateY(-1px)' : undefined,
                                        opacity: isDimmed ? 0.18 : undefined,
                                        filter: isDimmed ? 'saturate(0.35)' : undefined,
                                        borderColor: isActive || isHard ? tone.border : 'transparent',
                                        borderWidth: isActive ? '1.5px' : isHard ? '1.5px' : 0,
                                        backgroundColor: isActive
                                            ? v.level === 'error'
                                                ? 'rgba(217,45,32,0.13)'
                                                : 'rgba(245,158,11,0.13)'
                                            : tone.surface,
                                        margin: VIOLATION_INSET,
                                        boxShadow: isActive
                                            ? `0 5px 12px rgba(15,23,42,0.14), inset 0 0 0 1px ${tone.border}`
                                            : isHard
                                              ? `inset 0 0 0 1px ${tone.border}`
                                              : `inset 0 -1px 0 ${tone.rail}`,
                                    }}
                                    className={cn(
                                        'make-shift-calendar__violation',
                                        `make-shift-calendar__violation--${v.level}`,
                                        'pointer-events-none rounded-[clamp(5px,0.55cqw,8px)] transition-[box-shadow,filter,opacity,transform,background-color,border-color] duration-150 ease-out',
                                        isActive ? 'z-[48]' : zByLevel,
                                    )}
                                />
                            );
                        })}
                </div>
            </div>
        </>
    );
}

type TCalendarRowSummaryProps = {
    cells: TDutyDoc['rows'][number]['cells'];
    days: TShift['days'];
    shortNameToType: Map<string, TWardShiftType>;
    summaryShiftTypes: TWardShiftType[];
    restCheck?: TRestCheckSummary;
    showRestCheckColumn: boolean;
};

/**
 * 행의 우측 합계 (D/E/N/O/WO) — division 카드 밖에 분리되어 배치된다.
 * 좌측 행과 동일한 height로 vertically 정렬된다.
 */
function CalendarRowSummary({cells, days, shortNameToType, summaryShiftTypes, restCheck, showRestCheckColumn}: TCalendarRowSummaryProps) {
    const {t} = useTypedTranslation();
    const countByType = (typeId: number) =>
        cells.filter((cell, j) => {
            const t = cell ? shortNameToType.get(cell) : null;
            const day = days[j];

            if (t?.wardShiftTypeId !== typeId) return false;

            return day != null;
        }).length;
    const restCheckLabel = formatSignedDays(restCheck?.differenceDays);
    const restCheckTitle =
        restCheck !== undefined
            ? t('page.makeShift.calendar.restCheckDetail', {
                  target: restCheck.targetDays,
                  assigned: restCheck.assignedDays,
                  carried: restCheck.carriedDays,
              })
            : undefined;

    return (
        <div
            className={cn('make-shift-calendar__row-summary flex shrink-0 items-center', ROW_SUMMARY_HEIGHT)}
            style={{gap: SUMMARY_GAP, paddingInline: SUMMARY_PADDING_X}}
        >
            {summaryShiftTypes.map((t) => (
                <div
                    key={t.wardShiftTypeId}
                    className={cn(
                        'make-shift-calendar__row-summary-count',
                        'grid place-items-center',
                        SUMMARY_COUNT_TEXT_CLASS,
                        SUMMARY_CELL_HEIGHT,
                        SUMMARY_CELL_WIDTH,
                    )}
                    style={{color: t.color}}
                >
                    {countByType(t.wardShiftTypeId)}
                </div>
            ))}
            {showRestCheckColumn ? (
                <div
                    className={cn(
                        'make-shift-calendar__row-rest-check grid min-h-0 place-items-center rounded-[clamp(5px,0.55cqw,8px)] font-poppins text-[clamp(11px,0.9cqw,14px)] font-semibold whitespace-nowrap tabular-nums',
                        SUMMARY_CELL_HEIGHT,
                        restCheck === undefined || restCheck.differenceDays === 0
                            ? 'text-sub-2'
                            : restCheck.differenceDays < 0
                              ? 'text-red'
                              : 'text-main-1',
                    )}
                    style={{width: REST_CHECK_COL}}
                    title={restCheckTitle}
                >
                    {restCheckLabel}
                </div>
            ) : null}
        </div>
    );
}

function DailySummary({
    doc,
    shortNameToType,
    summaryShiftTypes,
    leftGridTemplateColumns,
    showSkillColumn,
    showCarryColumn,
    showRestCheckColumn,
}: {
    doc: TDutyDoc;
    shortNameToType: Map<string, TWardShiftType>;
    summaryShiftTypes: TWardShiftType[];
    leftGridTemplateColumns: string;
    showSkillColumn: boolean;
    showCarryColumn: boolean;
    showRestCheckColumn: boolean;
}) {
    const countByDay = (j: number, typeId: number) =>
        doc.rows.filter((row) => {
            const cell = row.cells[j] ?? null;

            if (!cell) return false;

            return shortNameToType.get(cell)?.wardShiftTypeId === typeId;
        }).length;

    return (
        <div
            className="make-shift-daily-summary mt-[clamp(4px,0.35cqw,8px)] flex w-full min-w-0 items-stretch"
            style={{gap: DIVISION_TO_SUMMARY_GAP}}
        >
            <div
                className="make-shift-daily-summary__rows flex min-w-0 flex-1 flex-col"
                style={{paddingLeft: DIVISION_PADDING_X, paddingRight: 0, gap: SUMMARY_GAP}}
            >
                {summaryShiftTypes.map((type) => (
                    <div
                        key={type.wardShiftTypeId}
                        data-shift-type-id={type.wardShiftTypeId}
                        className={cn('make-shift-daily-summary__row grid w-full min-w-0 items-center', DAILY_SUMMARY_ROW_HEIGHT)}
                        style={{gridTemplateColumns: leftGridTemplateColumns, columnGap: ROW_GAP_X}}
                    >
                        <div />
                        {showSkillColumn ? <div /> : null}
                        {showCarryColumn ? <div /> : null}
                        <div className="make-shift-daily-summary__label flex items-center justify-end">
                            <div
                                className={cn(
                                    'make-shift-daily-summary__label-badge',
                                    'grid place-items-center font-poppins font-semibold',
                                    SHIFT_BADGE_SUMMARY_ROW,
                                )}
                                style={{color: type.color}}
                            >
                                {type.shortName}
                            </div>
                        </div>
                        <div
                            className="make-shift-daily-summary__cells grid h-full min-w-0 items-center px-0"
                            style={{gridTemplateColumns: getDayGridTemplateColumns(doc.columns.length)}}
                        >
                            {doc.columns.map((_d, j) => (
                                <div
                                    key={j}
                                    data-day-index={j}
                                    className={cn(
                                        'make-shift-daily-summary__cell grid h-full min-w-0 place-items-center',
                                        SUMMARY_COUNT_TEXT_CLASS,
                                    )}
                                    style={{color: type.color}}
                                >
                                    {countByDay(j, type.wardShiftTypeId)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <DailySummarySpacer count={summaryShiftTypes.length} showRestCheckColumn={showRestCheckColumn} />
        </div>
    );
}

/**
 * DailySummary의 우측 폭을 body의 row-summary 폭과 정확히 맞추는 spacer.
 * 보이지는 않지만 row-summary와 동일한 size의 placeholder를 그려서
 * 좌측 영역(carrier-card)의 width가 body division-card와 1px도 어긋나지 않도록 한다.
 *
 * row-summary와 daily-summary가 같은 summaryShiftTypes를 표시하므로 spacer도 동일 폭을 갖는다.
 */
function DailySummarySpacer({count, showRestCheckColumn}: {count: number; showRestCheckColumn: boolean}) {
    return (
        <div
            className="make-shift-daily-summary__spacer flex shrink-0 items-center"
            style={{gap: SUMMARY_GAP, paddingInline: SUMMARY_PADDING_X}}
            aria-hidden
        >
            {Array.from({length: count}).map((_, i) => (
                <div key={i} className={cn(SUMMARY_CELL_HEIGHT, SUMMARY_CELL_WIDTH)} />
            ))}
            {showRestCheckColumn ? <div className={cn(SUMMARY_CELL_HEIGHT)} style={{width: REST_CHECK_COL}} /> : null}
        </div>
    );
}
