import {type WaitingNurse, type Nurse} from '@/entities/nurse';
import {type DutyRequest} from '@/entities/shift';
import {type RequestShift, type Shift} from '@/entities/shift';
import {type Ward, type WardConstraint, type WardShiftType, type ShiftTeam} from '@/entities/ward';
import {type UpdateNurseDTO} from '../nurse/type';

export interface IWardAPI {
    // Ward APIs
    // GET
    getWard: (wardId: number) => Promise<Ward>;
    getWardConstraint: (wardId: number, shiftTeamId: number) => Promise<WardConstraint>;
    getWardByCode: (code: string) => Promise<Ward>;
    getWatingNurses: (wardId: number) => Promise<WaitingNurse[]>;
    // POST
    createWard: (createWardDTO: CreateWardDTO) => Promise<Ward>;
    addMeToWatingNurses: (wardId: number) => Promise<void>;
    connectWatingNurses: (wardId: number, waitingNurseId: number, targetNurseId: number) => Promise<void>;
    approveWatingNurses: (wardId: number, waitingNurseId: number, shiftTeamId: number) => Promise<void>;
    // PATCH
    editWard: (wardId: number, ward: EditWardDTO) => Promise<Ward>;
    updateWardConstraint: (wardId: number, shiftTeamId: number, constraint: WardConstraint) => Promise<WardConstraint>;
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
    getShiftTeamNurses: (wardId: number, shiftTeamId: number) => Promise<Nurse[]>;
    getShiftTeams: (wardId: number) => Promise<ShiftTeam[]>;
    // POST
    addNurseIntoShiftTeam: (wardId: number, shiftTeamId: number, addShiftTeamNurseDTO: UpdateNurseDTO) => Promise<Nurse>;
    createShiftTeam: (wardId: number) => Promise<ShiftTeam>;
    buildShiftTeam: (wardId: number, shiftTeamId: number, year: number, month: number) => Promise<ShiftTeam>;
    // PATCH
    updateShiftTeam: (wardId: number, shiftTeamId: number, updateShiftTeamDTO: UpdateShiftTeamDTO) => Promise<ShiftTeam>;
    // DELETE
    removeNurseFromShiftTeam: (wardId: number, shiftTeamId: number, nurseId: number) => Promise<Nurse>;
    deleteShiftTeam: (wardId: number, shiftTeamId: number) => Promise<ShiftTeam>;

    // ShiftType APIs
    // GET
    getShiftTypes: (wardId: number) => Promise<WardShiftType[]>;
    // POST
    createShiftType: (wardId: number, createShiftTypeDTO: CreateShiftTypeDTO) => Promise<WardShiftType>;
    // PUT
    updateShiftType: (wardId: number, shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) => Promise<WardShiftType>;
    // DELETE
    deleteShiftType: (wardId: number, shiftTypeId: number) => Promise<void>;
}

export type CreateWardDTO = {
    name: string;
    hospitalName: string;
    wardShiftTypes: Omit<WardShiftType, 'wardShiftTypeId' | 'isCounted'>[];
    shiftTeams: {nurseNames: string[]}[];
};

export type EditWardDTO = Pick<Ward, 'name' | 'hospitalName'>;

export type WardShiftsDTO = {
    shiftNurseId: number;
    date: string;
    wardShiftTypeId: number | null;
}[];

export type UpdateShiftTeamDTO = Pick<ShiftTeam, 'name'>;

export type CreateShiftTypeDTO = Pick<
    WardShiftType,
    'name' | 'shortName' | 'color' | 'startTime' | 'endTime' | 'isOff' | 'isDefault' | 'isCounted' | 'classification'
>;
