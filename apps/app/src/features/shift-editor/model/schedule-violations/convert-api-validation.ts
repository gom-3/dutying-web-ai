import type {TAiConstraintViolation, TAiValidation} from '@dutying/api/ward';
import i18n from '@/i18n';
import type {TCellPos, TDutyDoc, TViolation} from '../types';
import {formatScheduleValidationMessage} from './format-validation-message';

const KOREAN_TEXT_PATTERN = /[\u3131-\uD7A3]/;
const LEGACY_TITLE_MIN_OFF_AFTER_NIGHT = '\uC57C\uAC04 \uD6C4 \uD734\uBB34 \uBD80\uC871';
const LEGACY_TITLE_MIN_STAFF_SHORTAGE = '\uD544\uC694 \uC778\uC6D0 \uBD80\uC871';
const VALIDATION_I18N_KEY_PREFIX = 'feature.shiftEditor.validation.';
const LEGACY_TITLE_KEY_BY_TITLE = new Map([
    [LEGACY_TITLE_MIN_OFF_AFTER_NIGHT, `${VALIDATION_I18N_KEY_PREFIX}title.minOffAfterNight`],
    [LEGACY_TITLE_MIN_STAFF_SHORTAGE, `${VALIDATION_I18N_KEY_PREFIX}title.minStaffShortage`],
]);

function hasKoreanText(value: string): boolean {
    return KOREAN_TEXT_PATTERN.test(value);
}

function isEnglishLike(value: string): boolean {
    return /[A-Za-z]/.test(value) && !hasKoreanText(value);
}

function normalizeViolationTitle(title: string): string {
    const titleKey = LEGACY_TITLE_KEY_BY_TITLE.get(title);

    return titleKey ? i18n.t(titleKey) : title;
}

function translateKnownEnglishMessage(item: TAiConstraintViolation): string | null {
    const message = item.message.trim();
    const offAfterNightMatch = message.match(
        /^Nurse\s+\S+\s+has\s+(\d+)\s+off days after night shift,\s+but\s+(\d+)\s+(?:is|are)\s+required\.?$/i,
    );

    if (offAfterNightMatch) {
        const [, actualOffDays, requiredOffDays] = offAfterNightMatch;

        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}l2MinOffAfterNight`, {
            actual: actualOffDays,
            expected: requiredOffDays,
        });
    }

    if (/^off days after night shift are insufficient\.?$/i.test(message)) {
        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}title.minOffAfterNight`);
    }

    const staffingMatch = message.match(/^(.+?)\s+shift staffing is low\.?$/i);

    if (staffingMatch) {
        return i18n.t(`${VALIDATION_I18N_KEY_PREFIX}l3MinStaffShortage`, {shift: staffingMatch[1]});
    }

    return null;
}

function formatViolationMessage(item: TAiConstraintViolation): string {
    const title = item.title?.trim() ? normalizeViolationTitle(item.title.trim()) : undefined;
    const message = item.message.trim();
    const keyedMessage = formatScheduleValidationMessage(item);
    const translatedMessage = translateKnownEnglishMessage(item);

    if (keyedMessage) return keyedMessage;

    if (translatedMessage) return translatedMessage;

    if (title) return title;

    return isEnglishLike(message) ? i18n.t(`${VALIDATION_I18N_KEY_PREFIX}unknown`) : message;
}

function resolveDayRange(item: TAiConstraintViolation): {startDay: number; endDay: number} | null {
    if (item.period) {
        return {startDay: item.period.start_day, endDay: item.period.end_day};
    }

    const days = item.affected_days;

    if (!days || days.length === 0) return null;

    return {startDay: Math.min(...days), endDay: Math.max(...days)};
}

function dayRangeToCells(row: number, startDay: number, endDay: number, colCount: number): TCellPos[] {
    const cells: TCellPos[] = [];

    for (let day = startDay; day <= endDay; day += 1) {
        const col = day - 1;

        if (col < 0 || col >= colCount) continue;

        cells.push({row, col});
    }

    return cells;
}

function findRowIndexByNurseId(doc: TDutyDoc, nurseId: string): number | null {
    for (let row = 0; row < doc.rows.length; row += 1) {
        const workerId = doc.rows[row]?.workerId;

        if (!workerId) continue;

        const meta = doc.workerMeta[workerId];

        if (workerId === nurseId || String(meta?.nurseId ?? '') === nurseId) return row;
    }

    return null;
}

function toViolation(
    item: TAiConstraintViolation,
    level: TViolation['level'],
    cells: TCellPos[],
    scope: TViolation['scope'],
): TViolation | null {
    if (cells.length === 0) return null;

    return {
        ruleId: `llm.${item.id}`,
        message: formatViolationMessage(item),
        level,
        cells,
        scope,
    };
}

function violationFromApiItem(doc: TDutyDoc, item: TAiConstraintViolation, level: TViolation['level']): TViolation[] {
    const range = resolveDayRange(item);

    if (!range) return [];

    const nurseId = item.nurse_id?.trim();

    if (nurseId) {
        const row = findRowIndexByNurseId(doc, nurseId);

        if (row === null) return [];

        const cells = dayRangeToCells(row, range.startDay, range.endDay, doc.columns.length);
        const violation = toViolation(item, level, cells, 'nurse');

        return violation ? [violation] : [];
    }

    const cells = dayRangeToCells(0, range.startDay, range.endDay, doc.columns.length);
    const violation = toViolation(item, level, cells, 'team');

    return violation ? [violation] : [];
}

/** API validation → 캘린더 표시용 TViolation[] (현재 doc 행/열에 맞춰 매핑) */
export function violationsFromApiValidation(validation: TAiValidation, doc: TDutyDoc): TViolation[] {
    const hard = validation.hard_constraints_violated.flatMap((item) => violationFromApiItem(doc, item, 'error'));
    const soft = validation.soft_constraints_violated.flatMap((item) => violationFromApiItem(doc, item, 'warning'));

    return [...hard, ...soft];
}
