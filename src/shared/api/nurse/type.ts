import {type TNurse} from '@/entities/nurse';

export interface INurseAPI {
    // GET
    getNurse: (nurseId: number) => Promise<TNurse>;
    // POST
    createAccountNurse: (accountId: number, createNurse: TCreateNurseDTO) => Promise<TNurse>;
    connectNurse: (nurseId: number) => Promise<void>;
    // PATCH
    updateNurse: (nurseId: number, updatedNurse: TUpdateNurseDTO) => Promise<TNurse>;
    updateNurseStatus: (nurseId: number, status: string) => Promise<TNurse>;
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
    updateNurseShiftType: (nurseId: number, nurseShiftTypeId: number, change: TUpdateNurseShiftTypeRequest) => Promise<void>;
    updateNurseCarry: (shiftNurseId: number, value: number) => Promise<null>;
    // DELETE
    unConnectNurse: (nurseId: number) => Promise<void>;
}

export type TCreateNurseDTO = Pick<TNurse, 'name' | 'phoneNum' | 'gender' | 'isWorker' | 'employmentDate'>;

export type TUpdateNurseDTO = Pick<
    TNurse,
    'name' | 'phoneNum' | 'gender' | 'isWorker' | 'employmentDate' | 'isDutyManager' | 'isWardManager' | 'memo'
>;

export type TUpdateNurseShiftTypeRequest = {
    isPossible?: boolean;
    isPrefer?: boolean;
};
