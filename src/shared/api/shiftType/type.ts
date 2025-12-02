import {type WardShiftType} from '@/shared/types/ward';

export interface IShiftTypeAPI {
    // GET
    getShiftTypes: (wardId: number) => Promise<WardShiftType[]>;
    // POST
    createShiftType: (wardId: number, createShiftTypeDTO: CreateShiftTypeDTO) => Promise<WardShiftType>;
    // PUT
    updateShiftType: (wardId: number, shiftTypeId: number, createShiftTypeDTO: CreateShiftTypeDTO) => Promise<WardShiftType>;
    // DELETE
    deleteShiftType: (wardId: number, shiftTypeId: number) => Promise<void>;
}

export type CreateShiftTypeDTO = Pick<
    WardShiftType,
    'name' | 'shortName' | 'color' | 'startTime' | 'endTime' | 'isOff' | 'isDefault' | 'isCounted' | 'classification'
>;
