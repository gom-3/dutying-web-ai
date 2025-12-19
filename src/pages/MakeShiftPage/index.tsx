import useEditShift from '@/features/shift/useEditShift';
import CountDutyByDay from './ui/CountDutyByDay';
import NurseEditModal from './ui/NurseEditModal';
import Panel from './ui/Panel';
import ShiftCalendar from './ui/ShiftCalendar';
import Toolbar from './ui/Toolbar';

const MakeShiftPage = () => {
    const {
        state: {shift},
    } = useEditShift(true);

    return (
        <div className="mx-auto flex h-screen w-fit min-w-418.5 flex-col">
            <Toolbar />
            <ShiftCalendar />
            <div
                className="sticky bottom-0 z-20 flex items-stretch gap-5 bg-main-bg py-5 pl-63.75"
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
};

export default MakeShiftPage;
