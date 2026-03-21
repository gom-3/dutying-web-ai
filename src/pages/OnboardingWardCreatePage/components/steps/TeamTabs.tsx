import {Plus} from 'lucide-react';
import {cn} from '@/shared/util/style';
import type {TOnboardingNurseDraft, TOnboardingTeamDraft} from '../../model';

interface ITeamTabsProps {
    teams: TOnboardingTeamDraft[];
    nurses: TOnboardingNurseDraft[];
    currentTeamId: string;
    onSelect: (teamId: string) => void;
    onAdd: () => void;
}

function TeamTabs({teams, nurses, currentTeamId, onSelect, onAdd}: ITeamTabsProps) {
    return (
        <div className="bg-gray-2 flex h-[46px] items-center justify-between rounded-[10px] px-2 py-1.5">
            <div className="flex items-center gap-4">
                {teams.map((team) => {
                    const count = nurses.filter((nurse) => nurse.teamId === team.id).length;
                    const isActive = team.id === currentTeamId;

                    return (
                        <button
                            key={team.id}
                            type="button"
                            className={cn(
                                'flex items-center gap-2 rounded-[10px] px-4 py-1.5 font-apple text-[16px] font-medium',
                                isActive ? 'bg-white text-text-1' : 'text-gray-5',
                            )}
                            onClick={() => onSelect(team.id)}
                        >
                            <span>{team.name}</span>
                            <span className="font-poppins text-[14px]">{count}</span>
                        </button>
                    );
                })}
            </div>
            <button type="button" className="flex items-center gap-1 font-apple text-[16px] font-medium text-gray-5" onClick={onAdd}>
                <Plus className="h-4 w-4" />팀 추가하기
            </button>
        </div>
    );
}

export default TeamTabs;
