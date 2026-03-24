import {cn} from '@dutying/utils/style';
import {type ComponentProps, type RefObject} from 'react';
import {type TShift} from '@/entities';
import {type TDutyDoc} from '@/features/shift-editor/model';
import CountDutyByDay from './count-duty-by-day';
import ShiftCalendar from './shift-calendar';

type TShiftEditorCanvasProps = {
    shift: TShift;
    doc: TDutyDoc;
    className?: string;
    showCountByDay?: boolean;
    stickyBottom?: boolean;
    exportMode?: boolean;
    exportRef?: RefObject<HTMLDivElement | null>;
    calendarProps?: Omit<ComponentProps<typeof ShiftCalendar>, 'shift' | 'doc' | 'exportMode'>;
};

export function ShiftEditorCanvas({
    shift,
    doc,
    className,
    showCountByDay = true,
    stickyBottom = true,
    exportMode = false,
    exportRef,
    calendarProps,
}: TShiftEditorCanvasProps) {
    const countedShiftTypeCount = shift.wardShiftTypes.filter((x) => x.isCounted).length;
    const bottomHeight = `${countedShiftTypeCount * 2.5 + 2.5}rem`;

    return (
        <div ref={exportRef} className={cn('mx-auto flex w-fit flex-col', className)}>
            <ShiftCalendar shift={shift} doc={doc} exportMode={exportMode} {...calendarProps} />
            {showCountByDay && (
                <div
                    className={cn('z-20 flex items-stretch gap-5 py-5 pl-55.25', stickyBottom && !exportMode && 'sticky bottom-0')}
                    style={{
                        height: bottomHeight,
                    }}
                >
                    <CountDutyByDay shift={shift} doc={doc} />
                </div>
            )}
        </div>
    );
}
