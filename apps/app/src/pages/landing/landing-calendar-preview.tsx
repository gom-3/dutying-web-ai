import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getLocaleForLanguage, type TWebLanguage} from '@/shared/i18n/locale';

const weekdays = Array.from({length: 7}, (_, day) => new Date(Date.UTC(2026, 6, 5 + day)));
const calendarDays = Array.from({length: 35}, (_, index) => index - 2);
const shiftPattern = ['D', 'D', 'E', 'N', 'O', 'O'] as const;

export function LandingCalendarPreview({language}: {language: TWebLanguage}) {
    const {t} = useTypedTranslation();
    const locale = getLocaleForLanguage(language);
    const month = new Intl.DateTimeFormat(locale, {month: 'long', timeZone: 'UTC'}).format(new Date(Date.UTC(2026, 6, 1)));
    const weekdayFormat = new Intl.DateTimeFormat(locale, {weekday: 'narrow', timeZone: 'UTC'});

    return (
        <div className="landing-calendar-preview" role="img" aria-label={t('page.landing.imageAlt.appHome')}>
            <div className="landing-calendar-preview__content" aria-hidden="true">
                <p className="landing-calendar-preview__month">{month}</p>
                <div className="landing-calendar-preview__grid">
                    {weekdays.map((day) => (
                        <span className="landing-calendar-preview__weekday" key={day.getUTCDay()}>
                            {weekdayFormat.format(day)}
                        </span>
                    ))}
                    {calendarDays.map((day) => (
                        <span className="landing-calendar-preview__day" key={day}>
                            {day > 0 && day <= 31 && (
                                <span data-shift={shiftPattern[(day - 1) % shiftPattern.length]}>
                                    {day} <small>{shiftPattern[(day - 1) % shiftPattern.length]}</small>
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
