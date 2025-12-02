import {type WaitingNurse} from '@/shared/types/nurse';
import {type Ward, type WardConstraint, type WardShiftType} from '@/shared/types/ward';

export interface IWardAPI {
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
}

export type CreateWardDTO = {
    name: string;
    hospitalName: string;
    wardShiftTypes: Omit<WardShiftType, 'wardShiftTypeId' | 'isCounted'>[];
    shiftTeams: {nurseNames: string[]}[];
};

export type EditWardDTO = Pick<Ward, 'name' | 'hospitalName'>;
