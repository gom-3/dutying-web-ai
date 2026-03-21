import type {TAiScheduleResponse} from '@/shared/types/ai-schedule';
import {type TNurseResponse, type TUpdateNurseDTO} from '../nurse/type';

export type TWaitingNurseResponse = {
    waitingNurseId: number;
    nurseId: number;
    name: string;
    gender: string;
    phoneNum: string;
    employmentDate: string;
    profileImgBase64?: string;
    profileImgUrl: string;
};

export type TWardConstraintResponse = {
    maxContinuousWork: boolean;
    maxContinuousWorkVal: number;
    minNightInterval: boolean;
    minNightIntervalVal: number;
    maxContinuousNight: boolean;
    maxContinuousNightVal: number;
    minContinuousNight: boolean;
    minContinuousNightVal: number;
    minOffAssignAfterNight: boolean;
    minOffAssignAfterNightVal: number;
    excludeCertainWorkTypes: boolean;
    excludeNightBeforeReqOff: boolean;
};

export type TWardShiftTypeResponse = {
    wardShiftTypeId: number;
    name: string;
    shortName: string;
    startTime: string;
    endTime: string;
    color: string;
    isDefault: boolean;
    isOff: boolean;
    isCounted: boolean;
    classification: 'DAY' | 'EVENING' | 'NIGHT' | 'OTHER_WORK' | 'OFF' | 'OTHER_LEAVE';
};

export type TShiftTeamResponse = {
    shiftTeamId: number;
    name: string;
    nurseCnt: number;
    nurses: TNurseResponse[];
};

export type TWardResponse = {
    wardId: number;
    name: string;
    code: string;
    hospitalName: string;
    nurseCnt: number;
    wardShiftTypes: TWardShiftTypeResponse[];
    shiftTeams: TShiftTeamResponse[];
};

export type TShiftNurseResponse = {
    shiftNurseId: number;
    name: string;
    carried: number;
    divisionNum: number;
    priority: number;
    isWorker: true;
    nurseId: number;
};

export type TDayResponse = {day: number; dayType: 'saturday' | 'sunday' | 'holiday' | 'workday'};

export type TShiftResponse = {
    lastDays: Array<TDayResponse>;
    days: Array<TDayResponse>;
    wardShiftTypes: TWardShiftTypeResponse[];
    divisionShiftNurses: {
        shiftNurse: TShiftNurseResponse;
        lastWardShiftList: (number | null)[];
        lastWardReqShiftList: (number | null)[];
        wardShiftList: (number | null)[];
        wardReqShiftList: (number | null)[];
    }[][];
};

export type TRequestShiftResponse = {
    days: Array<TDayResponse>;
    wardShiftTypes: TWardShiftTypeResponse[];
    divisionShiftNurses: {
        shiftNurse: TShiftNurseResponse;
        carry: number;
        wardReqShiftList: (number | null)[];
    }[][];
};

export type TDutyRequestResponse = {
    wardReqShiftId: number;
    nurseId: number;
    nurseName: string;
    date: number;
    requestDate: string;
    wardShiftTypeId: number;
    wardShiftTypeShortName: string;
    wardShiftTypeColor: string;
    isRead: boolean;
    isAccepted: boolean | null;
};

export type TGenerateAiAutofillScheduleDTO = {
    year: number;
    month: number;
    schedule: Record<string, string[]>;
};

export interface IWardAPI {
    // Ward APIs
    // GET
    getWard: (wardId: number) => Promise<TWardResponse>;
    getWardConstraint: (wardId: number, shiftTeamId: number) => Promise<TWardConstraintResponse>;
    getWardByCode: (code: string) => Promise<TWardResponse>;
    getWatingNurses: (wardId: number) => Promise<TWaitingNurseResponse[]>;
    // POST
    createWard: (createWardDTO: TCreateWardDTO) => Promise<TWardResponse>;
    addMeToWatingNurses: (wardId: number) => Promise<void>;
    connectWatingNurses: (wardId: number, waitingNurseId: number, targetNurseId: number) => Promise<void>;
    approveWatingNurses: (wardId: number, waitingNurseId: number, shiftTeamId: number) => Promise<void>;
    // PATCH
    editWard: (wardId: number, ward: TEditWardDTO) => Promise<TWardResponse>;
    updateWardConstraint: (wardId: number, shiftTeamId: number, constraint: TWardConstraintDTO) => Promise<TWardConstraintResponse>;
    // DELETE
    deleteWatingNurses: (wardId: number, nurseId: number) => Promise<void>;
    quitWard: (wardId: number) => Promise<void>;

    // Shift APIs
    // GET
    getReqShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TRequestShiftResponse>;
    getShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TShiftResponse>;
    getRequestList: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TDutyRequestResponse[]>;
    // PATCH
    updateShift: (
        wardId: number,
        year: number,
        month: number,
        day: number,
        shiftNurseId: number,
        wardShiftTypeId: number | null,
    ) => Promise<null>;
    updateShifts: (wardId: number, wardShifts: TWardShiftsDTO) => Promise<void>;
    updateReqShift: (
        wardId: number,
        year: number,
        month: number,
        day: number,
        shiftNurseId: number,
        wardShiftTypeId: number | null,
    ) => Promise<void>;
    acceptRequestShift: (wardId: number, reqShiftId: number, isAccepted: boolean | null) => Promise<void>;
    generateAiAutofillSchedule: (
        wardId: number,
        shiftTeamId: number,
        payload: TGenerateAiAutofillScheduleDTO,
    ) => Promise<TAiScheduleResponse>;
    // POST
    postShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<void>;

    // ShiftTeam APIs
    // GET
    getShiftTeamNurses: (wardId: number, shiftTeamId: number) => Promise<TNurseResponse[]>;
    getShiftTeams: (wardId: number) => Promise<TShiftTeamResponse[]>;
    // POST
    addNurseIntoShiftTeam: (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: TUpdateNurseDTO) => Promise<TNurseResponse>;
    createShiftTeam: (wardId: number) => Promise<TShiftTeamResponse>;
    buildShiftTeam: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TShiftTeamResponse>;
    // PATCH
    updateShiftTeam: (wardId: number, shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) => Promise<TShiftTeamResponse>;
    // DELETE
    removeNurseFromShiftTeam: (wardId: number, shiftTeamId: number, nurseId: number) => Promise<TNurseResponse>;
    deleteShiftTeam: (wardId: number, shiftTeamId: number) => Promise<TShiftTeamResponse>;

    // ShiftType APIs
    // GET
    getShiftTypes: (wardId: number) => Promise<TWardShiftTypeResponse[]>;
    // POST
    createShiftType: (wardId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => Promise<TWardShiftTypeResponse>;
    // PUT
    updateShiftType: (wardId: number, shiftTypeId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => Promise<TWardShiftTypeResponse>;
    // DELETE
    deleteShiftType: (wardId: number, shiftTypeId: number) => Promise<void>;
}

export type TCreateWardShiftTypeDTO = {
    name: string;
    shortName: string;
    color: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
    isDefault: boolean;
    classification: TWardShiftTypeResponse['classification'];
};

export type TCreateWardDTO = {
    name: string;
    hospitalName: string;
    wardShiftTypes: TCreateWardShiftTypeDTO[];
    shiftTeams: {nurseNames: string[]}[];
};

export type TEditWardDTO = {
    name: string;
    hospitalName: string;
};

export type TWardConstraintDTO = TWardConstraintResponse;

export type TWardShiftsDTO = {
    shiftNurseId: number;
    date: string;
    wardShiftTypeId: number | null;
}[];

export type TUpdateShiftTeamDTO = {
    name: string;
};

export type TCreateShiftTypeDTO = {
    name: string;
    shortName: string;
    color: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
    isDefault: boolean;
    isCounted: boolean;
    classification: TWardShiftTypeResponse['classification'];
};
