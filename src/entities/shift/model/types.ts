import {type TShiftNurse, type TWardShiftType} from '@/entities/ward';

/** 근무표 타입 */
export type TShift = {
    /** 지난달 근무표의 날짜들 */
    lastDays: Array<TDay>;
    /** 이번달 근무표의 날짜들 */
    days: Array<TDay>;
    /** 해당 근무표의 근무유형 리스트 */
    wardShiftTypes: TWardShiftType[];
    /** 구분된 근무 데이터 */
    divisionShiftNurses: TRow[][];
};

/** 근무표 날짜의 타입 | 평일, 주말, 공휴일 구분이 필요하다 */
export type TDay = {day: number; dayType: 'saturday' | 'sunday' | 'holiday' | 'workday'};

/** 근무표 한줄에 해당하는 데이터 */
export type TRow = {
    shiftNurse: TShiftNurse;
    lastWardShiftList: (number | null)[];
    lastWardReqShiftList: (number | null)[];
    wardShiftList: (number | null)[];
    wardReqShiftList: (number | null)[];
};

/** 신청 근무표 타입 */
export type TRequestShift = {
    /** 이번달 근무표의 날짜들 */
    days: Array<TDay>;
    /** 해당 근무표의 근무유형 리스트 */
    wardShiftTypes: TWardShiftType[];
    /** 구분된 근무 데이터 */
    divisionShiftNurses: {
        shiftNurse: TShiftNurse;
        /** 이월 @example 1 */
        carry: number;
        /** 이번달 근무 정보, 근무 유형의 index 배열 형식이다. */
        wardReqShiftList: (number | null)[];
    }[][];
};
