import type {RequestShift, Shift} from '@/shared/types/shift';

export function findNurse(shift: Shift | RequestShift, shiftNurseId: number) {
    return (
        shift.divisionShiftNurses
            .flatMap<{shiftNurse: {shiftNurseId: number; name: string}}>((x) => x)
            .find((x) => x.shiftNurse.shiftNurseId === shiftNurseId)?.shiftNurse ?? null
    );
}
