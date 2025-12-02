import {type Nurse} from '@/shared/types/nurse';
import {type ShiftTeam} from '@/shared/types/ward';
import {type UpdateNurseDTO} from '../nurse/type';

export interface IShiftTeamAPI {
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
}

export type UpdateShiftTeamDTO = Pick<ShiftTeam, 'name'>;
