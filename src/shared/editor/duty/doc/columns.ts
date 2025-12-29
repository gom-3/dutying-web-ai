import {DateTime} from 'luxon';
import type {DateKey} from './types';

/**
 * year/month(1~12) 기반으로 해당 월의 모든 날짜를 YYYY-MM-DD로 생성한다.
 */
export function createColumnsByYearMonth(year: number, month: number): DateKey[] {
    const start = DateTime.fromObject({year, month, day: 1});
    const daysInMonth = start.daysInMonth ?? 0;
    const cols: DateKey[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
        cols.push(DateTime.fromObject({year, month, day}).toFormat('yyyy-MM-dd'));
    }

    return cols;
}
