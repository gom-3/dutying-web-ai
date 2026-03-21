export type TNurseResponse = {
    nurseId: number;
    accountId: number | null;
    shiftTeamId: number | null;
    wardId: number;
    name: string;
    phoneNum: string;
    isConnected: boolean;
    nurseShiftTypes: {
        nurseShiftTypeId: number;
        name: string;
        shortName: string;
        isPossible: boolean;
        isPreferred: boolean;
    }[];
    isWorker: boolean;
    isDutyManager: boolean;
    isWardManager: boolean;
    gender: string;
    employmentDate: string;
    memo: string;
    isDeleted: boolean;
    divisionNum: number;
    priority: number;
};

export interface INurseAPI {
    // GET
    getNurse: (nurseId: number) => Promise<TNurseResponse>;
    // POST
    createAccountNurse: (accountId: number, createNurse: TCreateNurseDTO) => Promise<TNurseResponse>;
    connectNurse: (nurseId: number) => Promise<void>;
    // PATCH
    updateNurse: (nurseId: number, updatedNurse: TUpdateNurseDTO) => Promise<TNurseResponse>;
    updateNurseStatus: (nurseId: number, status: string) => Promise<TNurseResponse>;
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

export type TCreateNurseDTO = {
    name: string;
    phoneNum: string;
    gender: string;
    isWorker: boolean;
    employmentDate: string;
};

export type TUpdateNurseDTO = {
    name: string;
    phoneNum: string;
    gender: string;
    isWorker: boolean;
    employmentDate: string;
    isDutyManager: boolean;
    isWardManager: boolean;
    memo: string;
};

export type TUpdateNurseShiftTypeRequest = {
    isPossible?: boolean;
    isPrefer?: boolean;
};
