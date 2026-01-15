import type {Shift} from '@/entities/shift';
import type {WardShiftType, WardConstraint, ShiftTeam} from '@/entities/ward';
import type {CheckFaultOptions, Faults, Focus} from './faults';

export type ShiftStatus = 'idle' | 'pending' | 'success' | 'error';
export type SaveStatus = 'idle' | 'pending' | 'success' | 'error';

export type EditDutyViewState = {
    year: number;
    month: number;
    shift: Shift | null;
    focus: Focus | null;
    faults: Faults;
    foldedLevels: boolean[] | null;
    checkFaultOptions: CheckFaultOptions | null;
    wardShiftTypeMap: Map<number, WardShiftType> | null;
    wardConstraint: WardConstraint | null;
    readonly: boolean;
    showLayer: {fault: boolean; check: boolean; slash: boolean};
    currentShiftTeam: ShiftTeam | undefined;
    shiftTeams: ShiftTeam[] | undefined;
    shiftStatus: ShiftStatus;
    saveStatus: SaveStatus;
};
