import {cn} from '@dutying/utils/style';
import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {ChevronDown, Pencil, Plus} from 'lucide-react';
import {SixDotsIcon} from '@/shared/assets/svg';
import {Input} from '@/shared/ui/primitives/input';
import type {TOnboardingNurseDraft, TOnboardingStep, TOnboardingWardDraft} from '../../model';
import type {TSortMode} from '../../types';
import {ShiftBadge, SkillBadge} from './Badges';
import TeamTabs from './TeamTabs';

interface INurseStepProps {
    step: TOnboardingStep;
    draft: TOnboardingWardDraft;
    selectedTeamId: string;
    sortMode: TSortMode;
    onSortModeChange: (sortMode: TSortMode) => void;
    onSelectTeam: (teamId: string) => void;
    onAddTeam: () => void;
    onAddNurse: () => void;
    onNurseChange: (nurseId: string, updater: Partial<TOnboardingNurseDraft>) => void;
    onDragEnd: (result: DropResult) => void;
    onOpenSkillModal: () => void;
}

function NurseStep({
    step,
    draft,
    selectedTeamId,
    sortMode,
    onSortModeChange,
    onSelectTeam,
    onAddTeam,
    onAddNurse,
    onNurseChange,
    onDragEnd,
    onOpenSkillModal,
}: INurseStepProps) {
    const activeShiftTypes = draft.shiftTypes.filter((shiftType) => shiftType.shortName);
    const currentNurses = draft.nurses.filter((nurse) => nurse.teamId === selectedTeamId);
    const sortedNurses =
        sortMode === 'employmentDate'
            ? [...currentNurses].sort((left, right) => left.employmentDate.localeCompare(right.employmentDate))
            : currentNurses;

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <div />
                <div className="space-y-3">
                    {step === 3 ? (
                        <div className="rounded-[15px] bg-main-light px-4 py-3">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-main-1 text-white"
                                    onClick={onOpenSkillModal}
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <div>
                                    <p className="font-apple text-[22px] font-bold text-main-1">간호사 숙련도 설정하기</p>
                                    <p className="font-apple text-[16px] text-gray-3">
                                        근무표 작성시, 숙련도에 따라 자동으로 배정할 수 있어요
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <button
                        type="button"
                        className="ml-auto flex h-11 items-center rounded-[10px] bg-main-light px-5 font-apple text-[20px] font-semibold text-main-1"
                        onClick={onOpenSkillModal}
                    >
                        숙련도 설정
                    </button>
                </div>
            </div>

            <TeamTabs teams={draft.teams} nurses={draft.nurses} currentTeamId={selectedTeamId} onSelect={onSelectTeam} onAdd={onAddTeam} />

            <div className="flex items-center justify-end gap-3">
                <div className="flex h-8 items-center rounded-[5px] bg-gray-6 px-2">
                    <select
                        aria-label="간호사 정렬"
                        value={sortMode}
                        onChange={(event) => onSortModeChange(event.target.value as TSortMode)}
                        className="bg-transparent pr-4 font-apple text-[16px] text-gray-3 outline-none"
                    >
                        <option value="manual">수동 정렬</option>
                        <option value="employmentDate">연차순</option>
                    </select>
                    <ChevronDown className="h-4 w-4 text-gray-3" />
                </div>
            </div>

            <div
                className={cn(
                    'grid items-center gap-6 px-2 font-apple text-[16px] text-gray-3',
                    step === 4 ? 'grid-cols-[40px_180px_90px_260px_1fr_100px]' : 'grid-cols-[40px_180px_260px_1fr_100px]',
                )}
            >
                <div />
                <span>이름</span>
                {step === 4 ? <span>숙련도</span> : null}
                <span>가능 근무</span>
                <span>비고</span>
                <span>근무 투입</span>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId={selectedTeamId}>
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                            {sortedNurses.map((nurse, index) => (
                                <Draggable key={nurse.id} draggableId={nurse.id} index={index} isDragDisabled={sortMode !== 'manual'}>
                                    {(dragProvided) => (
                                        <div
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            className={cn(
                                                'grid min-h-[52px] items-center gap-6 rounded-[10px] border border-gray-7 bg-white px-3 py-3',
                                                step === 4
                                                    ? 'grid-cols-[40px_180px_90px_260px_1fr_100px]'
                                                    : 'grid-cols-[40px_180px_260px_1fr_100px]',
                                            )}
                                        >
                                            <button
                                                type="button"
                                                aria-label="드래그하여 순서 변경"
                                                {...dragProvided.dragHandleProps}
                                                className={cn(
                                                    'flex h-6 w-6 items-center justify-center text-gray-4',
                                                    sortMode !== 'manual' && 'cursor-not-allowed opacity-40',
                                                )}
                                            >
                                                <SixDotsIcon className="h-5 w-5" />
                                            </button>
                                            <Input
                                                value={nurse.name}
                                                onChange={(event) => onNurseChange(nurse.id, {name: event.target.value})}
                                                variant="flush"
                                                fieldSize="md"
                                                className="font-apple text-[20px] font-medium text-sub-1"
                                            />
                                            {step === 4 ? <SkillBadge level={nurse.level} config={draft.skillLevelConfig} /> : null}
                                            <div className="flex flex-wrap gap-2">
                                                {activeShiftTypes.map((shiftType) => {
                                                    const selected = nurse.possibleShiftTypeIds.includes(shiftType.id);

                                                    return (
                                                        <button
                                                            key={shiftType.id}
                                                            type="button"
                                                            onClick={() =>
                                                                onNurseChange(nurse.id, {
                                                                    possibleShiftTypeIds: selected
                                                                        ? nurse.possibleShiftTypeIds.filter(
                                                                              (value) => value !== shiftType.id,
                                                                          )
                                                                        : [...nurse.possibleShiftTypeIds, shiftType.id],
                                                                })
                                                            }
                                                            className={cn('rounded-[5px] transition-opacity', !selected && 'opacity-30')}
                                                        >
                                                            <ShiftBadge shiftType={shiftType} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <Input
                                                value={nurse.memo}
                                                onChange={(event) => onNurseChange(nurse.id, {memo: event.target.value})}
                                                variant="flush"
                                                fieldSize="md"
                                                className="font-apple text-[20px] font-medium text-sub-1"
                                                placeholder="비고"
                                            />
                                            <div className="flex justify-center">
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'relative h-4 w-8 rounded-full transition-colors',
                                                        nurse.isWorker ? 'bg-main-1' : 'bg-sub-4',
                                                    )}
                                                    onClick={() => onNurseChange(nurse.id, {isWorker: !nurse.isWorker})}
                                                >
                                                    <span
                                                        className={cn(
                                                            'absolute top-[1px] h-[14px] w-[14px] rounded-full bg-white transition-transform',
                                                            nurse.isWorker ? 'translate-x-[17px]' : 'translate-x-[1px]',
                                                        )}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <div className="flex justify-end">
                <button
                    type="button"
                    className="flex items-center gap-1 font-apple text-[16px] font-medium text-gray-3"
                    onClick={onAddNurse}
                >
                    <Plus className="h-4 w-4" />
                    간호사 추가하기
                </button>
            </div>
        </div>
    );
}

export default NurseStep;
