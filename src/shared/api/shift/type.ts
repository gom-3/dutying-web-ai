import {type DutyRequest} from '@/shared/types/request';
import {type RequestShift, type Shift} from '@/shared/types/shift';

export interface IShiftAPI {
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
}

export type WardShiftsDTO = {
    shiftNurseId: number;
    date: string;
    wardShiftTypeId: number | null;
}[];
