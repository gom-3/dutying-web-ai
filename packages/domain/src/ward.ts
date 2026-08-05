import type {TNurse} from './nurse';

export type TWardShiftClassification = 'DAY' | 'EVENING' | 'NIGHT' | 'OTHER_WORK' | 'OFF' | 'OTHER_LEAVE';

export type TWard = {
    wardId: number;
    name: string;
    code: string;
    hospitalName: string;
    nurseCnt: number;
    setupStatus?: 'SETUP_IN_PROGRESS' | 'ACTIVE' | 'CANCELLED';
    wardShiftTypes: TWardShiftType[];
    shiftTeams: TShiftTeam[];
};

export type TWardConstraint = {
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

export type TWardShiftType = {
    wardShiftTypeId: number;
    displayOrder?: number;
    name: string;
    shortName: string;
    startTime: string;
    endTime: string;
    color: string;
    isDefault: boolean;
    isOff: boolean;
    isCounted: boolean;
    classification: TWardShiftClassification;
    isActive?: boolean;
    isUsed?: boolean;
};

export type TShiftNurse = {
    shiftNurseId: number;
    name: string;
    carried: number;
    divisionNum: number;
    divisionName?: string | null;
    priority: number;
    isWorker: true;
    nurseId: number;
};

export type TShiftTeamDivision = {
    shiftTeamDivisionId: number;
    divisionNum: number;
    name: string | null;
    displayOrder: number;
};

export type TShiftTeam = {
    shiftTeamId: number;
    name: string;
    nurseCnt: number;
    nurses: TNurse[];
    divisions?: TShiftTeamDivision[];
};
