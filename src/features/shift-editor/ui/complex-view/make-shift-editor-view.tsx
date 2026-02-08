import {type TDutyDoc} from '@/features/shift-editor/model';
import {type Shift} from '@/shared/types/shift';
import CountDutyByDay from './count-duty-by-day';
import NurseEditModal from './nurse-edit-modal';
import Panel from './panel';
import ShiftCalendar from './shift-calendar';
import Toolbar from './toolbar';

interface IMakeShiftEditorViewProps {
    shift: Shift;
    doc: TDutyDoc;
    showToolbar?: boolean;
    showCalendar?: boolean;
    showCountByDay?: boolean;
    showPanel?: boolean;
    showNurseEditModal?: boolean;
    stickyBottom?: boolean;
    className?: string;
    calendarProps?: Omit<Parameters<typeof ShiftCalendar>[0], 'shift' | 'doc'>;
}

export const MakeShiftEditorView = ({
    shift,
    doc,
    showToolbar = true,
    showCalendar = true,
    showCountByDay = true,
    showPanel = true,
    showNurseEditModal = true,
    stickyBottom = true,
    className,
    calendarProps,
}: IMakeShiftEditorViewProps) => {
    const countedShiftTypeCount = shift.wardShiftTypes.filter((x) => x.isCounted).length;
    const bottomHeight = shift ? `${countedShiftTypeCount * 2.5 + 2.5}rem` : '0';

    return (
        <div className={`mx-auto flex h-screen w-fit min-w-418.5 flex-col ${className ?? ''}`}>
            {showToolbar && <Toolbar />}
            {showCalendar && <ShiftCalendar shift={shift} doc={doc} {...calendarProps} />}
            {(showCountByDay || showPanel) && (
                <div
                    className={`${stickyBottom ? 'sticky bottom-0' : ''} z-20 flex items-stretch gap-5 bg-main-bg py-5 pl-63.75`}
                    style={{
                        height: bottomHeight,
                    }}
                >
                    {showCountByDay && <CountDutyByDay shift={shift} doc={doc} />}
                    {showPanel && <Panel />}
                </div>
            )}
            {showNurseEditModal && <NurseEditModal />}
        </div>
    );
};
