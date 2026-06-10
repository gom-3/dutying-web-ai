import {
    type TDutyDoc,
    type TValidator,
    type TDutyValidationInput,
    type TViolation,
    type TCellPos,
    type TDutyRuleKey,
    type TDutyRuleLevel,
} from './types';
import i18n from '@/i18n';

export type TDutyRuleDefinition = {
    key: TDutyRuleKey;
    isActive: boolean;
    regExp: RegExp;
    message: string;
    level: TViolation['level'];
};

/**
 * Legacy regex-based shift validation ported to the DutyDoc validator.
 * The editor remains permissive and only reports violations.
 */
export function createDutyValidator(input: TDutyValidationInput): TValidator<TDutyDoc> {
    const options = getDutyRuleDefinitions(input);

    return (doc) => {
        const violations: TViolation[] = [];

        for (let row = 0; row < doc.rows.length; row++) {
            const rowStr = '-' + buildRowString(doc, row, input.mode?.requestedOffByRow) + '-';

            for (const opt of options) {
                if (!opt.isActive) continue;

                // Global RegExp instances need a fresh cursor for every row.
                opt.regExp.lastIndex = 0;

                while (true) {
                    const match = opt.regExp.exec(rowStr);

                    if (!match) break;

                    const startCol = match.index - 1;
                    const endCol = startCol + match[0].length - 1;
                    const cells = rangeToCells(row, startCol, endCol, doc.columns.length);

                    if (cells.length === 0) continue;

                    violations.push({
                        ruleId: `duty.${opt.key}`,
                        message: opt.message,
                        level: opt.level,
                        cells,
                    });
                }
            }
        }

        return violations;
    };
}

export function getDutyRuleDefinitions(input: TDutyValidationInput): TDutyRuleDefinition[] {
    const c = input.wardConstraint;
    const levelByKey = input.ruleLevelByKey;

    return [
        {
            key: 'maxContinuousWork',
            isActive: c.maxContinuousWork,
            regExp: new RegExp(`[den][den]{${c.maxContinuousWorkVal - 1},}[den]`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.maxContinuousWork', {count: c.maxContinuousWorkVal}),
            level: levelByKey?.maxContinuousWork ?? 'error',
        },
        {
            key: 'minNightInterval',
            isActive: c.minNightInterval,
            regExp: new RegExp(`n[^n]{1,${c.minNightIntervalVal - 1}}n`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.minNightInterval', {count: c.minNightIntervalVal}),
            level: levelByKey?.minNightInterval ?? 'error',
        },
        {
            key: 'maxContinuousNight',
            isActive: c.maxContinuousNight,
            regExp: new RegExp(`n{${c.maxContinuousNightVal + 1},}`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.maxContinuousNight', {count: c.maxContinuousNightVal}),
            level: levelByKey?.maxContinuousNight ?? 'error',
        },
        {
            key: 'minContinuousNight',
            isActive: c.minContinuousNight,
            regExp: new RegExp(`[^n-]n{1,${c.minContinuousNightVal - 1}}[^n-]`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.minContinuousNight', {count: c.minContinuousNightVal}),
            level: levelByKey?.minContinuousNight ?? 'warning',
        },
        {
            key: 'minOffAssignAfterNight',
            isActive: c.minOffAssignAfterNight,
            regExp: new RegExp(`n([de]|o{1,${c.minOffAssignAfterNightVal - 1}}[den])`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.minOffAssignAfterNight', {
                count: c.minOffAssignAfterNightVal,
            }),
            level: levelByKey?.minOffAssignAfterNight ?? 'warning',
        },
        {
            key: 'excludeCertainWorkTypes',
            isActive: c.excludeCertainWorkTypes,
            regExp: new RegExp(`(ed|nd|ne|nod)`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.excludeCertainWorkTypes'),
            level: levelByKey?.excludeCertainWorkTypes ?? 'warning',
        },
        {
            key: 'excludeNightBeforeReqOff',
            isActive: c.excludeNightBeforeReqOff,
            regExp: new RegExp(`nO`, 'g'),
            message: i18n.t('feature.shiftEditor.validation.legacy.excludeNightBeforeReqOff'),
            level: levelByKey?.excludeNightBeforeReqOff ?? 'warning',
        },
    ];
}

function buildRowString(doc: TDutyDoc, row: number, requestedOffByRow?: boolean[][]): string {
    const rowData = doc.rows[row];

    if (!rowData) return '';

    return rowData.cells
        .map((value, col) => {
            if (requestedOffByRow?.[row]?.[col] === true) return 'O';

            if (value === null) return '-';

            // Rules are based on d/e/n/o, so normalize to the first character.
            const str = value.trim();

            if (str.length === 0) return '-';

            return str[0]!.toLowerCase();
        })
        .join('');
}

function rangeToCells(row: number, startCol: number, endCol: number, colCount: number): TCellPos[] {
    const from = Math.max(0, startCol);
    const to = Math.min(colCount - 1, endCol);

    if (to < from) return [];

    const cells: TCellPos[] = [];

    for (let col = from; col <= to; col++) {
        cells.push({row, col});
    }

    return cells;
}

/* ------------------------------------------------------------------ */
/*  Violation[] to Map                                                 */
/* ------------------------------------------------------------------ */

const LEVEL_PRIORITY: Record<TDutyRuleLevel, number> = {error: 1, warning: 0};

/**
 * Convert store `TViolation[]` to the `Map<string, TViolation>` shape
 * expected by ShiftCalendar. key: `${workerId},${col}`.
 *
 * ViolationLayer draws spans across the day grid, so the map stores
 * only the first cell of each violation. When multiple violations share
 * the same start cell, the higher severity wins.
 */
export function buildViolationMap(violations: TViolation[], doc: TDutyDoc): Map<string, TViolation> {
    const map = new Map<string, TViolation>();

    for (const v of violations) {
        const startCell = v.cells[0];

        if (!startCell) continue;

        const workerId = doc.rows[startCell.row]?.workerId;

        if (!workerId) continue;

        const key = `${workerId},${startCell.col}`;
        const existing = map.get(key);

        if (!existing || LEVEL_PRIORITY[v.level] > LEVEL_PRIORITY[existing.level]) {
            map.set(key, v);
        }
    }

    return map;
}

/**
 * Show all server validation violations on the calendar.
 * key: `${workerId},${startCol},${ruleId}`.
 */
export function buildViolationMapAll(violations: TViolation[], doc: TDutyDoc): Map<string, TViolation> {
    const map = new Map<string, TViolation>();

    for (const v of violations) {
        if (v.scope === 'team') continue;

        const startCell = v.cells[0];

        if (!startCell) continue;

        const workerId = doc.rows[startCell.row]?.workerId;

        if (!workerId) continue;

        map.set(`${workerId},${startCell.col},${v.ruleId}`, v);
    }

    return map;
}
