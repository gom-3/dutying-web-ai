import {CalendarFold, ChevronDown, ChevronLeft, ChevronRight} from 'lucide-react';
import {type KeyboardEvent, useEffect, useId, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage} from '@/shared/i18n/locale';
import styles from './schedule-month-picker.module.css';

type TScheduleMonth = {targetYear: number; targetMonth: number};

interface IScheduleMonthPickerProps {
    value: TScheduleMonth;
    onChange: (value: TScheduleMonth) => void;
    disabled: boolean;
}

const months = Array.from({length: 12}, (_, index) => index + 1);

function ScheduleMonthPicker({value, onChange, disabled}: IScheduleMonthPickerProps) {
    const {t} = useTypedTranslation();
    const {i18n} = useTranslation();
    const locale = getLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
    const label = t('page.onboardingWardCreate.upload.targetMonth');
    const id = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const monthsRef = useRef<HTMLDivElement>(null);
    const [browsingYear, setBrowsingYear] = useState<number | null>(null);
    const isOpen = browsingYear !== null && !disabled;
    const {targetYear, targetMonth} = value;
    const date = new Date(2000, targetMonth - 1, 1);

    date.setFullYear(targetYear);

    const selectedLabel = date.toLocaleDateString(locale, {year: 'numeric', month: 'long', calendar: 'gregory'});
    const monthFormat = new Intl.DateTimeFormat(locale, {month: 'short', calendar: 'gregory'});

    useEffect(() => {
        if (disabled) setBrowsingYear(null);
    }, [disabled]);

    useEffect(() => {
        if (!isOpen) return;

        monthsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({preventScroll: true});

        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setBrowsingYear(null);
        };

        document.addEventListener('pointerdown', closeOutside);

        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [isOpen]);

    const closeAndFocusTrigger = () => {
        setBrowsingYear(null);
        triggerRef.current?.focus({preventScroll: true});
    };
    const moveMonthFocus = (event: KeyboardEvent<HTMLButtonElement>, month: number) => {
        const next = {ArrowLeft: month - 1, ArrowRight: month + 1, ArrowUp: month - 4, ArrowDown: month + 4, Home: 1, End: 12}[event.key];

        if (next === undefined) return;

        event.preventDefault();
        monthsRef.current?.querySelectorAll('button')[Math.max(1, Math.min(next, 12)) - 1]?.focus();
    };

    return (
        <div
            className={styles.picker}
            ref={rootRef}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setBrowsingYear(null);
            }}
            onKeyDown={(event) => {
                if (isOpen && event.key === 'Escape') {
                    event.preventDefault();
                    closeAndFocusTrigger();
                }
            }}
        >
            <button
                type="button"
                className={styles.trigger}
                ref={triggerRef}
                aria-labelledby={id + '-label ' + id + '-value'}
                aria-expanded={isOpen}
                aria-controls={id}
                disabled={disabled}
                onClick={() => setBrowsingYear(isOpen ? null : targetYear)}
            >
                <span className={styles.label} id={id + '-label'}>
                    <CalendarFold className={styles.calendarIcon} size={24} strokeWidth={1.8} aria-hidden="true" />
                    {label}
                </span>
                <span className={styles.value} id={id + '-value'}>
                    {selectedLabel}
                    <ChevronDown size={16} aria-hidden="true" />
                </span>
            </button>
            {isOpen && (
                <div id={id} className={styles.panel} role="group" aria-label={label}>
                    <div className={styles.yearRow}>
                        <button
                            type="button"
                            disabled={browsingYear <= 1}
                            onClick={() => setBrowsingYear(browsingYear - 1)}
                            aria-label={t('page.onboardingWardCreate.scheduleEntry.previousYear')}
                        >
                            <ChevronLeft size={18} aria-hidden="true" />
                        </button>
                        <strong aria-live="polite">{new Intl.NumberFormat(locale, {useGrouping: false}).format(browsingYear)}</strong>
                        <button
                            type="button"
                            disabled={browsingYear >= 9999}
                            onClick={() => setBrowsingYear(browsingYear + 1)}
                            aria-label={t('page.onboardingWardCreate.scheduleEntry.nextYear')}
                        >
                            <ChevronRight size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <div className={styles.months} ref={monthsRef}>
                        {months.map((month) => (
                            <button
                                key={month}
                                type="button"
                                aria-pressed={browsingYear === targetYear && month === targetMonth}
                                onKeyDown={(event) => moveMonthFocus(event, month)}
                                onClick={() => {
                                    onChange({targetYear: browsingYear, targetMonth: month});
                                    closeAndFocusTrigger();
                                }}
                            >
                                {monthFormat.format(new Date(2000, month - 1, 1))}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScheduleMonthPicker;
