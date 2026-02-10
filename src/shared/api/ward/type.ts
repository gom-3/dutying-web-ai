import {type TWaitingNurse, type TNurse} from '@/entities/nurse';
import {type TDutyRequest, type TRequestShift, type TShift} from '@/entities/shift';
import {type TWard, type TWardConstraint, type TWardShiftType, type TShiftTeam} from '@/entities/ward';
import {type TUpdateNurseDTO} from '../nurse/type';

export interface IWardAPI {
    // Ward APIs
    // GET
    getWard: (wardId: number) => Promise<TWard>;
    getWardConstraint: (wardId: number, shiftTeamId: number) => Promise<TWardConstraint>;
    getWardByCode: (code: string) => Promise<TWard>;
    getWatingNurses: (wardId: number) => Promise<TWaitingNurse[]>;
    // POST
    createWard: (createWardDTO: TCreateWardDTO) => Promise<TWard>;
    addMeToWatingNurses: (wardId: number) => Promise<void>;
    connectWatingNurses: (wardId: number, waitingNurseId: number, targetNurseId: number) => Promise<void>;
    approveWatingNurses: (wardId: number, waitingNurseId: number, shiftTeamId: number) => Promise<void>;
    // PATCH
    editWard: (wardId: number, ward: TEditWardDTO) => Promise<TWard>;
    updateWardConstraint: (wardId: number, shiftTeamId: number, constraint: TWardConstraint) => Promise<TWardConstraint>;
    // DELETE
    deleteWatingNurses: (wardId: number, nurseId: number) => Promise<void>;
    quitWard: (wardId: number) => Promise<void>;

    // Shift APIs
    // GET
    getReqShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TRequestShift>;
    getShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TShift>;
    getRequestList: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TDutyRequest[]>;
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
    // POST
    postShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<void>;

    // ShiftTeam APIs
    // GET
    getShiftTeamNurses: (wardId: number, shiftTeamId: number) => Promise<TNurse[]>;
    getShiftTeams: (wardId: number) => Promise<TShiftTeam[]>;
    // POST
    addNurseIntoShiftTeam: (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: TUpdateNurseDTO) => Promise<TNurse>;
    createShiftTeam: (wardId: number) => Promise<TShiftTeam>;
    buildShiftTeam: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<TShiftTeam>;
    // PATCH
    updateShiftTeam: (wardId: number, shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) => Promise<TShiftTeam>;
    // DELETE
    removeNurseFromShiftTeam: (wardId: number, shiftTeamId: number, nurseId: number) => Promise<TNurse>;
    deleteShiftTeam: (wardId: number, shiftTeamId: number) => Promise<TShiftTeam>;

    // ShiftType APIs
    // GET
    getShiftTypes: (wardId: number) => Promise<TWardShiftType[]>;
    // POST
    createShiftType: (wardId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => Promise<TWardShiftType>;
    // PUT
    updateShiftType: (wardId: number, shiftTypeId: number, createShiftTypeDTO: TCreateShiftTypeDTO) => Promise<TWardShiftType>;
    // DELETE
    deleteShiftType: (wardId: number, shiftTypeId: number) => Promise<void>;
}

export type TCreateWardDTO = {
    name: string;
    hospitalName: string;
    wardShiftTypes: Omit<TWardShiftType, 'wardShiftTypeId' | 'isCounted'>[];
    shiftTeams: {nurseNames: string[]}[];
};

export type TEditWardDTO = Pick<TWard, 'name' | 'hospitalName'>;

export type TWardShiftsDTO = {
    shiftNurseId: number;
    date: string;
    wardShiftTypeId: number | null;
}[];

export type TUpdateShiftTeamDTO = Pick<TShiftTeam, 'name'>;

export type TCreateShiftTypeDTO = Pick<
    TWardShiftType,
    'name' | 'shortName' | 'color' | 'startTime' | 'endTime' | 'isOff' | 'isDefault' | 'isCounted' | 'classification'
>;
