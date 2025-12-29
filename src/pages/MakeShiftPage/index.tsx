import {observer} from 'mobx-react-lite';
import {useEffect, useMemo} from 'react';
import useAuth from '@/features/auth/useAuth';
import {createEditDutyContainer} from '@/features/shift/editDuty/di';
import {EditDutyStore} from '@/features/shift/editDuty/store';
import {withDependencies} from '@/shared/hoc/with-dependencies';
import {useDependency} from '@/shared/hook/use-dependency';
import CountDutyByDay from './ui/CountDutyByDay';
import NurseEditModal from './ui/NurseEditModal';
import Panel from './ui/Panel';
import ShiftCalendar from './ui/ShiftCalendar';
import Toolbar from './ui/Toolbar';

const MakeShiftPageView = observer(() => {
    const store = useDependency(EditDutyStore);
    const {shift} = store.viewState;

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
});
const MakeShiftPage = () => {
    const {
        state: {wardId},
    } = useAuth();
    const container = useMemo(() => createEditDutyContainer(() => wardId), [wardId]);
    const View = useMemo(() => withDependencies(<MakeShiftPageView />, [EditDutyStore], container), [container]);

    // init (once per container)
    useEffect(() => {
        const store = container.resolve(EditDutyStore);

        void store.init(true);
    }, [container]);

    return <View />;
};

export default MakeShiftPage;
