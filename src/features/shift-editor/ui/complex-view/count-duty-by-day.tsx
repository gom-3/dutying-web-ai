import {useMemo} from 'react';
import {type TShift, type TWardShiftType} from '@/entities';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import {type TDutyDoc, useShiftEditorStore} from '@/features/shift-editor/model';

interface ICountDutyByDayProps {
    shift: TShift;
    doc: TDutyDoc;
    focusDay?: number | null;
    className?: string;
}

function CountDutyByDay({shift, doc, focusDay = null, className}: ICountDutyByDayProps) {
    const selection = useShiftEditorStore((s) => s.selection);
    const {shiftTypeColorStyle} = useUIConfigStore();
    const effectiveFocusDay = useMemo(() => {
        if (typeof focusDay === 'number') return focusDay;

        if (selection?.type !== 'single') return null;

        return selection.anchor.col;
    }, [focusDay, selection]);
    const countedShiftTypes = useMemo(() => shift.wardShiftTypes.filter((x) => x.isCounted), [shift.wardShiftTypes]);
    const shortNameToType = useMemo(() => {
        const map = new Map<string, TWardShiftType>();

        for (const t of shift.wardShiftTypes) {
            map.set(t.shortName, t);
        }

        return map;
    }, [shift.wardShiftTypes]);
    const getCountByDay = (dayIndex: number, wardShiftTypeId: number) =>
        doc.rows.filter((row) => {
            const cell = row.cells[dayIndex] ?? null;

            if (!cell) return false;

            return shortNameToType.get(cell)?.wardShiftTypeId === wardShiftTypeId;
        }).length;

    return (
        <div id="count_by_day" className={`rounded-[1.25rem] bg-[#FDFCFE] shadow-[0rem_-0.25rem_2.125rem_0rem_#EDE9F5] ${className ?? ''}`}>
            {countedShiftTypes.map((wardShiftType, index) => (
                <div
                    key={wardShiftType.wardShiftTypeId}
                    className="flex h-10 items-center justify-center gap-5 border-b-[.0625rem] border-[#E0E0E0] last:border-none"
                >
                    <div
                        className={`flex h-full w-12.5 items-center justify-center font-poppins text-[1.5rem] ${
                            index === 0 && 'rounded-tl-[1.25rem]'
                        } ${index === countedShiftTypes.length - 1 && 'rounded-bl-[1.25rem]'} `}
                        style={
                            shiftTypeColorStyle === 'background'
                                ? {backgroundColor: wardShiftType.color, color: 'white'}
                                : {color: wardShiftType.color, backgroundColor: 'white'}
                        }
                    >
                        {wardShiftType.shortName}
                    </div>
                    <div className="flex h-full px-4 text-center">
                        {shift.days.map((_date, i) => (
                            <p
                                key={i}
                                className={`flex w-9 flex-1 items-center justify-center font-poppins text-[1.25rem] text-sub-2 ${
                                    effectiveFocusDay === i ? 'bg-main-4' : ''
                                }`}
                            >
                                {getCountByDay(i, wardShiftType.wardShiftTypeId)}
                            </p>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default CountDutyByDay;
