import {type RefObject} from 'react';
import {type TDutyRequest, type TRequestShift} from '@/entities/shift';
import ShiftBadge from '@/entities/shift/ui/shift-badge';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from '@/features/request-shift/model/types';
import {createRequestCalendarCellFocus, getDayCellClass, getRequestCalendarCellState} from './utils';

type TRequestCalendarGridCellProps = {
    day: number;
    isSampleCell: boolean;
    dayType: TRequestShift['days'][number]['dayType'];
    shiftNurseId: number;
    shiftNurseName: string;
    currentShiftTypeId: number | null;
    requestDutyRequest: TDutyRequest | null;
    focus: TFocus | null;
    readonly: boolean;
    separateWeekendColor: boolean;
    wardShiftTypeMap: Map<number, TWardShiftType>;
    focusedCellRef: RefObject<HTMLDivElement | null>;
    onSelectCell: (focus: TFocus) => void;
};

export default function RequestCalendarGridCell({
    day,
    isSampleCell,
    dayType,
    shiftNurseId,
    shiftNurseName,
    currentShiftTypeId,
    requestDutyRequest,
    focus,
    readonly,
    separateWeekendColor,
    wardShiftTypeMap,
    focusedCellRef,
    onSelectCell,
}: TRequestCalendarGridCellProps) {
    const cellState = getRequestCalendarCellState({
        currentShiftTypeId,
        requestDutyRequest,
        focus,
        shiftNurseId,
        day,
        wardShiftTypeMap,
    });

    return (
        <div
            className={`group relative flex h-full w-9 flex-1 items-center justify-center px-[.25rem] ${getDayCellClass(
                dayType,
                day === focus?.day,
                separateWeekendColor,
            )}`}
        >
            <ShiftBadge
                id={isSampleCell ? 'cell_sample' : undefined}
                onClick={() => {
                    if (readonly) return;

                    onSelectCell(createRequestCalendarCellFocus({shiftNurseName, shiftNurseId, day}));
                }}
                shiftType={cellState.shiftType}
                isOnlyRequest={cellState.isOnlyRequest}
                className={`z-10 ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
                    cellState.isFocused && 'outline-[.125rem] outline-main-1'
                }`}
                forwardRef={cellState.isFocused ? focusedCellRef : null}
            />
        </div>
    );
}
