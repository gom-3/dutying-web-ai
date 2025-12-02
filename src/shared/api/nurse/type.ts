import {type Nurse} from '@/shared/types/nurse';

export interface INurseAPI {
    // GET
    getNurse: (nurseId: number) => Promise<Nurse>;
    // POST
    createAccountNurse: (accountId: number, createNurse: CreateNurseDTO) => Promise<Nurse>;
    connectNurse: (nurseId: number) => Promise<void>;
    // PATCH
    updateNurse: (nurseId: number, updatedNurse: UpdateNurseDTO) => Promise<Nurse>;
    updateNurseStatus: (nurseId: number, status: string) => Promise<Nurse>;
    updateNurseOrder: (
        nurseId: number,
        shiftTeamId: number,
        nextShiftTeamId: number,
        divisionNum: number,
        prevPriority: number,
        nextPriority: number,
        patchYearMonth: string,
    ) => Promise<void>;
    updateShiftTeamDivision: (shiftTeamId: number, prevPriority: number, changeValue: number, patchYearMonth: string) => Promise<void>;
    updateNurseShiftType: (nurseId: number, nurseShiftTypeId: number, change: UpdateNurseShiftTypeRequest) => Promise<void>;
    updateNurseCarry: (shiftNurseId: number, value: number) => Promise<null>;
    // DELETE
    unConnectNurse: (nurseId: number) => Promise<void>;
}

export type CreateNurseDTO = Pick<Nurse, 'name' | 'phoneNum' | 'gender' | 'isWorker' | 'employmentDate'>;

export type UpdateNurseDTO = Pick<
    Nurse,
    'name' | 'phoneNum' | 'gender' | 'isWorker' | 'employmentDate' | 'isDutyManager' | 'isWardManager' | 'memo'
>;

export type UpdateNurseShiftTypeRequest = {
    isPossible?: boolean;
    isPrefer?: boolean;
};
