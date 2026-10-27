import type {TScheduleViolationDto} from '@dutying/api/ward';
import {useTranslation} from 'react-i18next';
import {localizeScheduleValidationMessage} from '@/features/shift-editor/model/schedule-violations/format-validation-message';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {scheduleWarningRows} from '../../../model/schedule-warning-presentation';

export function AiScheduleWarningList({
    violations,
    nurseName,
}: {
    violations: readonly TScheduleViolationDto[];
    nurseName?: (id: number) => string;
}) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();

    return (
        <ul className="list-disc space-y-1 pl-4">
            {scheduleWarningRows(violations).map((row, index) => {
                const issue = row.violations[0]!;
                const staffing = row.staffing;

                return (
                    <li key={`${issue.violationId}:${index}`}>
                        {staffing ? (
                            t('aiConversationSidebar.authoring.staffingShortage', {
                                date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
                                    month: 'long',
                                    day: 'numeric',
                                    timeZone: 'UTC',
                                }).format(new Date(`${staffing.date}T00:00:00Z`)),
                                shift: staffing.shift,
                                actual: staffing.actual,
                                required: staffing.required,
                            })
                        ) : (
                            <>
                                {localizeScheduleValidationMessage(issue)}
                                {issue.affectedCells?.length > 0 && (
                                    <span>
                                        {' '}
                                        ·{' '}
                                        {issue.affectedCells
                                            .map((cell) => {
                                                const name = nurseName ? nurseName(cell.shiftNurseId) : cell.nurseName;

                                                return `${name ? `${name} ` : ''}${cell.date} ${cell.shiftCode ?? ''}`;
                                            })
                                            .join(', ')}
                                    </span>
                                )}
                            </>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
