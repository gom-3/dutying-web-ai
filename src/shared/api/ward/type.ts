import {type TWaitingNurse, type TNurse} from '@/shared/types/nurse';
import {type DutyRequest} from '@/shared/types/request';
import {type RequestShift, type Shift} from '@/shared/types/shift';
import {type TWard, type TWardConstraint, type TWardShiftType, type TShiftTeam} from '@/shared/types/ward';
import {type TUpdateNurseDTO} from '../nurse/type';

export interface IWardAPI {
    // Ward APIs
    // GET
    getWard: (wardId: number) => Promise<TWard>;
    getWardConstraint: (wardId: number, shiftTeamId: number) => Promise<TWardConstraint>;
    getWardByCode: (code: string) => Promise<TWard>;
    getWatingNurses: (wardId: number) => Promise<TWaitingNurse[]>;
    // POST
    createWard: (createWardDTO: CreateWardDTO) => Promise<TWard>;
    addMeToWatingNurses: (wardId: number) => Promise<void>;
    connectWatingNurses: (wardId: number, waitingNurseId: number, targetNurseId: number) => Promise<void>;
    approveWatingNurses: (wardId: number, waitingNurseId: number, shiftTeamId: number) => Promise<void>;
    // PATCH
    editWard: (wardId: number, ward: EditWardDTO) => Promise<TWard>;
    updateWardConstraint: (wardId: number, shiftTeamId: number, constraint: TWardConstraint) => Promise<TWardConstraint>;
    // DELETE
    deleteWatingNurses: (wardId: number, nurseId: number) => Promise<void>;
    quitWard: (wardId: number) => Promise<void>;

    // Shift APIs
    // GET
    getReqShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<RequestShift>;
    getShift: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<Shift>;
    getRequestList: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<DutyRequest[]>;
    // PATCH
    updateShift: (
        wardId: number,
        year: number,
        month: number,
        day: number,
        shiftNurseId: number,
        wardShiftTypeId: number | null,
    ) => Promise<null>;
    updateShifts: (wardId: number, wardShifts: WardShiftsDTO) => Promise<void>;
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
    updateShiftTeam: (wardId: number, shiftTeamId: number, updateShiftTeamDTO: UpdateShiftTeamDTO) => Promise<TShiftTeam>;
    // DELETE
    removeNurseFromShiftTeam: (wardId: number, shiftTeamId: number, nurseId: number) => Promise<TNurse>;
    deleteShiftTeam: (wardId: number, shiftTeamId: number) => Promise<TShiftTeam>;

    // ShiftType APIs
    // GET
    getShiftTypes: (wardId: number) => Promise<TWardShiftType[]>;
    // POST
    createShiftType: (wardId: number, createShiftTypeDTO: CreateShiftTypeDTO) => Promise<TWardShiftType>;
    // PUT
    updateShiftType: (wardId: number, shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) => Promise<TWardShiftType>;
    // DELETE
    deleteShiftType: (wardId: number, shiftTypeId: number) => Promise<void>;
}

export type CreateWardDTO = {
    name: string;
    hospitalName: string;
    wardShiftTypes: Omit<TWardShiftType, 'wardShiftTypeId' | 'isCounted'>[];
    shiftTeams: {nurseNames: string[]}[];
};

export type EditWardDTO = Pick<TWard, 'name' | 'hospitalName'>;

export type WardShiftsDTO = {
    shiftNurseId: number;
    date: string;
    wardShiftTypeId: number | null;
}[];

export type UpdateShiftTeamDTO = Pick<TShiftTeam, 'name'>;

export type CreateShiftTypeDTO = Pick<
    TWardShiftType,
    'name' | 'shortName' | 'color' | 'startTime' | 'endTime' | 'isOff' | 'isDefault' | 'isCounted' | 'classification'
>;
