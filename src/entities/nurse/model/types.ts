import type {TDay} from '@/entities/shift';

export type TDayShift = {
    /** 날짜 */
    day: TDay;
    /** 근무 형태종류 */
    shiftId: number;
};

export type TNurse = {
    /** 간호사 id */
    nurseId: number;
    /** 계정 id */
    accountId: number | null;
    /** 간호 팀 아이디 */
    shiftTeamId: number | null;
    /** 병동 id */
    wardId: number;
    /** 간호사 이름 */
    name: string;
    /** 간호사 전화번호 */
    phoneNum: string;
    /** 간호사 연동 여부 */
    isConnected: boolean;
    /** 근무 리스트 */
    nurseShiftTypes: {
        nurseShiftTypeId: number;
        name: string;
        shortName: string;
        isPossible: boolean;
        isPreferred: boolean;
    }[];
    /**근무표에 들어가는 사람인가? */
    isWorker: boolean;
    /**근무표 제작 권한 */
    isDutyManager: boolean;
    /**병동 관리 권한 */
    isWardManager: boolean;
    /**성별 */
    gender: string;
    /**입사날짜 */
    employmentDate: string;
    memo: string;
    isDeleted: boolean;
    /** 구분 인덱스 */
    divisionNum: number;
    /** 구분 내 인덱스 */
    priority: number;
};

export type TWaitingNurse = {
    waitingNurseId: number;
    nurseId: number;
    name: string;
    gender: string;
    phoneNum: string;
    employmentDate: boolean;
    /** @deprecated use profileImgUrl */
    profileImgBase64?: string;
    profileImgUrl: string;
};
