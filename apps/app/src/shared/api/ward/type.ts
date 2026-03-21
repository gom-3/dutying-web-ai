import type {
    TDay,
    TDutyRequest,
    TRequestShift,
    TShift,
    TShiftNurse,
    TShiftTeam,
    TWaitingNurse,
    TWard,
    TWardConstraint,
    TWardShiftClassification,
    TWardShiftType,
} from '@dutying/domain';
import type {TAiScheduleResponse} from '@/shared/types/ai-schedule';
import {type TNurseResponse, type TUpdateNurseDTO} from '../nurse/type';

export type TWaitingNurseResponse = TWaitingNurse;
export type TWardConstraintResponse = TWardConstraint;
export type TWardShiftTypeResponse = TWardShiftType;
export type TShiftTeamResponse = TShiftTeam;
export type TWardResponse = TWard;
export type TShiftNurseResponse = TShiftNurse;
export type TDayResponse = TDay;
export type TShiftResponse = TShift;
export type TRequestShiftResponse = TRequestShift;
export type TDutyRequestResponse = TDutyRequest;

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
    classification: TWardShiftClassification;
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
    classification: TWardShiftClassification;
};
