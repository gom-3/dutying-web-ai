import NurseEditDrawer from './ui/NurseEditDrawer';
import ShiftTeamList from './ui/ShiftTeamList';
import WardInfo from './ui/WardInfo';

function MemberPage() {
    return (
        <div className="flex h-screen w-full flex-col pt-17.5 pl-13.75">
            <WardInfo />
            <ShiftTeamList />
            <NurseEditDrawer />
        </div>
    );
}

export default MemberPage;
