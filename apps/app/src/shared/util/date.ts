import {DateTime} from 'luxon';

export function getDaysInMonth(month?: number, year?: number) {
    const currentDate = new Date();

    month ??= currentDate.getMonth();
    month--;
    year ??= currentDate.getFullYear();

    const date = new Date(year, month, 1);
    const days = [];

    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }

    return days;
}

export function getDayName(date: Date) {
    const week = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = week[date.getDay()];

    return dayOfWeek;
}

export class DateUtil {
    public static locale: string = 'ko-KR';

    static setLocale(locale: string) {
        this.locale = locale;
    }

    // date를 받아서 받은 format에 맞는 문자열 형식을 반환
    // ex) 2025-11-24 이면 2025-11-24 을 반환
    static getDateString(date?: Date, format: string = 'yyyy-MM-dd'): string {
        return DateTime.fromJSDate(date ?? new Date())
            .setLocale(this.locale)
            .toFormat(format);
    }

    // date를 받아서 그 date의 month의 시작 날짜 문자열과 끝 날짜 문자열을 반환
    // ex) 2025-11-24 이면 2025-11-01 과 2025-11-30 을 반환
    static getMonthStartAndEndDates(date?: Date): {startDate: string; endDate: string} {
        return {
            startDate: DateTime.fromJSDate(date ?? new Date())
                .setLocale(this.locale)
                .startOf('month')
                .toFormat('yyyy-MM-dd'),
            endDate: DateTime.fromJSDate(date ?? new Date())
                .setLocale(this.locale)
                .endOf('month')
                .toFormat('yyyy-MM-dd'),
        };
    }

    // date를 받아서 그 date의 캘린더의 시작 날짜 문자열과 끝 날짜 문자열을 반환
    // ex) 2025-11-24 이면 2025-10-26 과 2025-12-06 을 반환
    static getCalendarStartAndEndDate(date?: Date): {startDate: string; endDate: string} {
        const dt = DateTime.fromJSDate(date ?? new Date()).setLocale(this.locale);
        const monthStart = dt.startOf('month');
        const monthEnd = dt.endOf('month');
        // Luxon
        //  weekday: 월요일=1, 화요일=2, ..., 토요일=6, 일요일=7
        // 월의 첫날이 일요일이라면 전 달 없음
        const startDate = monthStart.weekday === 7 ? monthStart : monthStart.minus({days: monthStart.weekday});
        // 월의 마지막날이 토요일이라면 다음 달 없음
        const endDate =
            monthEnd.weekday === 6
                ? monthEnd
                : monthEnd.weekday === 7
                  ? monthEnd.plus({days: 6})
                  : monthEnd.plus({days: 6 - monthEnd.weekday});

        return {
            startDate: startDate.toFormat('yyyy-MM-dd'),
            endDate: endDate.toFormat('yyyy-MM-dd'),
        };
    }
}
