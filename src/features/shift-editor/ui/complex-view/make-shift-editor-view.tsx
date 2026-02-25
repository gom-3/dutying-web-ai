import {type ComponentProps} from 'react';
import {type TShift} from '@/entities';
import {type TDutyDoc} from '@/features/shift-editor/model';
import CountDutyByDay from './count-duty-by-day';
import NurseEditModal from './nurse-edit-modal';
import Panel from './panel';
import ShiftCalendar from './shift-calendar';
import Toolbar from './toolbar';

interface IMakeShiftEditorViewProps {
    shift: TShift;
    doc: TDutyDoc;
    readonly?: boolean;
    showToolbar?: boolean;
    showCalendar?: boolean;
    showCountByDay?: boolean;
    showPanel?: boolean;
    showNurseEditModal?: boolean;
    stickyBottom?: boolean;
    className?: string;
    calendarProps?: Omit<ComponentProps<typeof ShiftCalendar>, 'shift' | 'doc'>;
    toolbarProps?: Omit<ComponentProps<typeof Toolbar>, 'shift'>;
}

export const MakeShiftEditorView = ({
    shift,
    doc,
    readonly = false,
    showToolbar = true,
    showCalendar = true,
    showCountByDay = true,
    showPanel = true,
    showNurseEditModal = true,
    stickyBottom = true,
    className,
    calendarProps,
    toolbarProps,
}: IMakeShiftEditorViewProps) => {
    const countedShiftTypeCount = shift.wardShiftTypes.filter((x) => x.isCounted).length;
    const bottomHeight = shift ? `${countedShiftTypeCount * 2.5 + 2.5}rem` : '0';

    return (
        <div className={`mx-auto flex w-fit flex-col ${className ?? ''}`}>
            {showToolbar && toolbarProps && <Toolbar shift={shift} {...toolbarProps} />}
            {showCalendar && <ShiftCalendar shift={shift} doc={doc} {...calendarProps} />}
            {(showCountByDay || showPanel) && (
                <div
                    className={`${stickyBottom ? 'sticky bottom-0' : ''} z-20 flex items-stretch gap-5 py-5 pl-55.25`}
                    style={{
                        height: bottomHeight,
                    }}
                >
                    {showCountByDay && <CountDutyByDay shift={shift} doc={doc} />}
                    {showPanel && <Panel shift={shift} readonly={readonly} />}
                </div>
            )}
            {showNurseEditModal && <NurseEditModal />}
        </div>
    );
};
