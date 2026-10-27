import type {TAutofillResponse, TScheduleViolationDto} from '@dutying/api/ward';
import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {scheduleWarningRows} from '../../../model/schedule-warning-presentation';

type TReview = NonNullable<TAutofillResponse['conflictReview']>;

function validDate(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value
    );
}

function issueDates(issue: TScheduleViolationDto, fullContext: boolean): string[] {
    const context = fullContext ? issue.displayContext : undefined;
    const period = context?.period ?? issue.period;
    const dates = period?.dates?.filter(validDate);

    if (dates?.length) return [...new Set(dates)].sort();

    if (validDate(period?.startDate) && validDate(period?.endDate)) {
        return period.startDate === period.endDate ? [period.startDate] : [period.startDate, period.endDate];
    }

    return [...new Set((context?.affectedCells ?? issue.affectedCells ?? []).map((cell) => cell.date).filter(validDate))].sort();
}

function periodLabel(issue: TScheduleViolationDto, fullContext: boolean): string {
    const dates = issueDates(issue, fullContext);

    if (dates.length < 2) return dates.join('');

    // A range is only shorthand when every intervening date is present.
    const contiguous = dates.every((date, index) => index === 0 || Date.parse(date) - Date.parse(dates[index - 1]!) === 86400000);

    return contiguous ? `${dates[0]} – ${dates[dates.length - 1]}` : dates.join(', ');
}

function staffingInfo(issue: TScheduleViolationDto) {
    const args = issue.messageArgs;
    const operator =
        issue.templateCode === 'EXACT_STAFF_BY_SHIFT'
            ? 'EXACT'
            : issue.templateCode === 'MAX_STAFF_BY_SHIFT'
              ? 'MAX'
              : issue.templateCode === 'STAFF_COUNT_BY_SHIFT'
                ? args?.operator
                : ['MIN_STAFF_BY_SHIFT', 'L3_ZERO_CORE_COVERAGE'].includes(issue.templateCode)
                  ? 'MIN'
                  : undefined;

    if (
        !['MIN', 'MAX', 'EXACT'].includes(String(operator)) ||
        typeof args?.shift !== 'string' ||
        !args.shift.trim() ||
        typeof args.actual !== 'number' ||
        !Number.isSafeInteger(args.actual) ||
        args.actual < 0 ||
        typeof args.expected !== 'number' ||
        !Number.isSafeInteger(args.expected) ||
        args.expected < 0
    )
        return;

    return {operator, shift: args.shift, actual: args.actual, expected: args.expected};
}

export function AiConflictViolationList({review}: {review: TReview}) {
    const {t} = useTypedTranslation();
    const groups = new Map<string, ReturnType<typeof scheduleWarningRows>>();

    for (const row of scheduleWarningRows(review.violations)) {
        const issue = row.violations[0]!;
        const key = JSON.stringify([issue.ruleId, issue.ruleIdentity, issue.templateCode]);
        const group = groups.get(key) ?? [];

        group.push(row);
        groups.set(key, group);
    }

    const renderRow = (row: ReturnType<typeof scheduleWarningRows>[number], index: number, asTable = false) => {
        const issue = row.violations[0]!;
        const args = issue.messageArgs;
        const staffing = staffingInfo(issue);
        const consecutive = ['MAX_CONSECUTIVE_WORK_DAYS', 'CORE_MAX_CONTINUOUS_WORK'].includes(issue.templateCode);
        const dates = periodLabel(issue, consecutive) || t('aiAutofillUi.conflictReview.dateUnavailable');
        const actual = args?.actual;
        const expected = args?.expected;
        const numeric =
            typeof actual === 'number' &&
            Number.isSafeInteger(actual) &&
            actual >= 0 &&
            typeof expected === 'number' &&
            Number.isSafeInteger(expected) &&
            expected >= 0;

        let message = localizeScheduleValidationMessage(issue);

        if (staffing) {
            const requirement = t(
                staffing.operator === 'EXACT'
                    ? 'aiAutofillUi.conflictReview.staffExact'
                    : staffing.operator === 'MAX'
                      ? 'aiAutofillUi.conflictReview.staffMaximum'
                      : 'aiAutofillUi.conflictReview.staffMinimum',
                {count: staffing.expected},
            );

            if (asTable)
                return (
                    <tr key={`${issue.violationId}:${index}`} className="border-t border-gray-200">
                        <td className="py-2 pr-2 align-top break-words">{dates}</td>
                        <td className="py-2 pr-2 align-top break-all">{staffing.shift}</td>
                        <td className="py-2 pr-2 align-top">{t('aiAutofillUi.conflictReview.people', {count: staffing.actual})}</td>
                        <td className="py-2 align-top">{requirement}</td>
                    </tr>
                );

            message = t('aiAutofillUi.conflictReview.staffing', {shift: staffing.shift, actual: staffing.actual, requirement});
        } else if (consecutive && numeric) {
            const names = [
                ...new Set(
                    (issue.displayContext?.affectedCells ?? issue.affectedCells ?? []).map((cell) => cell.nurseName).filter(Boolean),
                ),
            ];
            const subject = typeof args?.nurseName === 'string' ? args.nurseName : names.length === 1 ? names[0] : undefined;

            message = t('aiAutofillUi.conflictReview.consecutive', {
                subject: subject ?? t('aiAutofillUi.conflictReview.subjectUnavailable'),
                actual,
                expected,
            });
        } else if (issue.templateCode === 'SHIFT_COUNT_PER_PERIOD' && numeric && ['MIN', 'MAX', 'EXACT'].includes(String(args?.operator))) {
            const limit = t(
                args?.operator === 'MAX'
                    ? 'aiAutofillUi.conflictReview.maximum'
                    : args?.operator === 'MIN'
                      ? 'aiAutofillUi.conflictReview.minimum'
                      : 'aiAutofillUi.conflictReview.exact',
                {count: expected},
            );

            message = t('aiAutofillUi.conflictReview.countComparison', {
                subject: typeof args?.subject === 'string' ? `${args.subject} · ` : '',
                limit,
                actual,
            });
        }

        return (
            <li key={`${issue.violationId}:${index}`} className="text-sm leading-relaxed break-words">
                <span className="text-gray-600">
                    {consecutive ? `${t('aiAutofillUi.conflictReview.reportedDates')} · ` : ''}
                    {dates}
                </span>
                <br />
                {message}
            </li>
        );
    };
    const renderRows = (rows: ReturnType<typeof scheduleWarningRows>) =>
        rows.every((row) => staffingInfo(row.violations[0]!)) ? (
            <table
                className="w-full table-fixed text-left text-sm leading-relaxed"
                aria-label={t('aiAutofillUi.conflictReview.staffingTable')}
            >
                <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[14%]" />
                    <col className="w-[22%]" />
                    <col className="w-[30%]" />
                </colgroup>
                <thead>
                    <tr>
                        {(['date', 'shift', 'proposed', 'required'] as const).map((column) => (
                            <th key={column} scope="col" className="pr-2 pb-2 font-medium">
                                {t(`aiAutofillUi.conflictReview.${column}`)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{rows.map((row, index) => renderRow(row, index, true))}</tbody>
            </table>
        ) : (
            <ul className="space-y-2">{rows.map((row, index) => renderRow(row, index))}</ul>
        );

    return (
        <div className="space-y-3">
            {[...groups.entries()].map(([key, rows]) => {
                const issue = rows[0]!.violations[0]!;
                const label = review.ruleLabels?.[String(issue.ruleId)];

                return (
                    <div key={key} className="rounded-lg bg-white p-3">
                        {label && <p className="mb-2 text-sm leading-relaxed font-medium">{label}</p>}
                        {renderRows(rows.slice(0, 5))}
                        {rows.length > 5 && (
                            <details className="mt-2 text-sm">
                                <summary className="cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-main-1">
                                    {t('aiAutofillUi.conflictReview.moreIssues', {count: rows.length - 5})}
                                </summary>
                                {renderRows(rows.slice(5))}
                            </details>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
