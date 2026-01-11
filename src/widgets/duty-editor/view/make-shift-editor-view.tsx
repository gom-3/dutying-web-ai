import {useContext} from 'react';
import {DutyEditorContext} from '../model/provider';
import CountDutyByDay from './count-duty-by-day';
import NurseEditModal from './nurse-edit-modal';
import Panel from './panel';
import ShiftCalendar from './shift-calendar';
import Toolbar from './toolbar';

export const MakeShiftEditorView = () => {
    const deps = useContext(DutyEditorContext);

    if (!deps) throw new Error('MakeShiftContext is not provided.');

    const store = deps.store.editDutyStore;
    const {shift} = store;

    return (
        <div className="mx-auto flex h-full w-fit min-w-418.5 flex-col">
            <Toolbar />
            <ShiftCalendar />
            <div
                className="flex items-stretch gap-5 bg-main-bg py-5 pl-63.75"
                style={{
                    height: shift ? `${shift.wardShiftTypes.filter((x) => x.isCounted).length * 2.5 + 2.5}rem` : '0',
                }}
            >
                <CountDutyByDay />
                <Panel />
            </div>
            <NurseEditModal />
        </div>
    );
});
