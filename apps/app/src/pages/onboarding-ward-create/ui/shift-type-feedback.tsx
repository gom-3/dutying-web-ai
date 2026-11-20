import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import styles from './steps/shift-type-step.module.css';

export type TShiftTypeFieldIssue = {
    id: string;
    label: string;
    message: string;
    required: boolean;
};

export function ShiftTypeFeedback({issues}: {issues: TShiftTypeFieldIssue[]}) {
    const {t} = useTypedTranslation();
    const missing = issues.filter((issue) => issue.required);
    const invalid = issues.filter((issue) => !issue.required);

    if (issues.length === 0) return null;

    return (
        <>
            {missing.map((issue) => (
                <span key={issue.id} id={issue.id} className="sr-only">
                    {issue.message}
                </span>
            ))}
            <div className={styles.feedback} role="alert">
                <span aria-hidden="true" className={`${styles.errorGlyph} ${styles.feedbackGlyph}`}>
                    !
                </span>
                <div className={styles.feedbackMessages}>
                    {missing.length > 0 ? (
                        <p>
                            {t('page.onboardingWardCreate.shiftType.validation.missingFields', {
                                fields: missing.map((issue) => issue.label).join(' · '),
                            })}
                        </p>
                    ) : null}
                    {invalid.map((issue) => (
                        <p key={issue.id} id={issue.id}>
                            {issue.message}
                        </p>
                    ))}
                </div>
            </div>
        </>
    );
}
