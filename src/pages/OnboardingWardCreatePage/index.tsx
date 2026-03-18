import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {Info, Upload, ChevronDown, Plus, Pencil, X} from 'lucide-react';
import {useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes} from 'react';
import toast from 'react-hot-toast';
import {FullLogo, LogoSymbolFill, SixDotsIcon} from '@/shared/assets/svg';
import ROUTE from '@/shared/constant/path';
import {Button} from '@/shared/ui/primitives/button';
import {Input} from '@/shared/ui/primitives/input';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import {cn} from '@/shared/util/style';
import {
    applyMockUpload,
    applySkillLevels,
    createEmptyNurse,
    createEmptyShiftType,
    createInitialDraft,
    getSkillPalette,
    serializeDraft,
    skillPalettes,
    type TOnboardingNurseDraft,
    type TOnboardingTeamDraft,
    type TOnboardingWardDraft,
    type TOnboardingWardShiftType,
    type TOnboardingStep,
    type TSkillLevelConfig,
} from './model';

type TSortMode = 'manual' | 'employmentDate';

const STEP_LABELS: Record<TOnboardingStep, {title: string; description: string}> = {
    1: {
        title: '이전 근무표 파일이 있다면 업로드해 주세요',
        description: '근무표를 분석해서 간호사 정보와 근무 시간을 자동으로 채워 드릴게요',
    },
    2: {
        title: '병동의 근무 유형을 설정해 주세요',
        description: '나중에도 수정할 수 있어요',
    },
    3: {
        title: '간호사를 등록해 주세요',
        description: '매월 팀당 하나의 근무표를 만들 수 있어요. 언제든 수정, 추가 가능해요',
    },
    4: {
        title: '간호사를 등록해주세요',
        description: '매월 팀당 하나의 근무표를 만들 수 있어요. 언제든 수정, 추가 가능해요',
    },
};
const SHIFT_BADGE_TEXT_STYLE = 'font-poppins text-[14px] font-medium text-white';
const STEP_CARD_BASE_CLASS = 'rounded-[20px] border border-gray-6 bg-white p-8 shadow-[0_4px_34px_0_rgba(237,233,245,1)]';

function HeaderLogo() {
    return (
        <a href={ROUTE.ROOT} className="fixed top-7.5 left-12.5 flex items-center gap-4">
            <LogoSymbolFill className="h-8 w-8" />
            <FullLogo className="h-7.5 w-27.5" />
        </a>
    );
}

function WizardButton({
    children,
    variant = 'solid',
    className,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'solid' | 'secondary' | 'link'}) {
    return (
        <Button
            type="button"
            className={cn(
                'h-[42px] rounded-[10px] px-5 font-apple text-[20px] font-semibold',
                variant === 'solid' && 'bg-main-1 text-white hover:bg-main-2',
                variant === 'secondary' && 'bg-gray-6 text-gray-3 hover:bg-gray-5',
                variant === 'link' && 'px-0 text-gray-3 underline underline-offset-2 hover:bg-transparent',
                className,
            )}
            {...props}
        >
            {children}
        </Button>
    );
}

function ShiftBadge({shiftType}: {shiftType: TOnboardingWardShiftType}) {
    return (
        <div className="flex h-[23px] w-[21px] items-center justify-center rounded-[5px]" style={{backgroundColor: shiftType.color}}>
            <span className={SHIFT_BADGE_TEXT_STYLE}>{shiftType.shortName || '-'}</span>
        </div>
    );
}

function SkillBadge({level, config}: {level: number | null; config: TSkillLevelConfig}) {
    const palette = getSkillPalette(config.paletteId);
    const safeLevel = Math.max(1, Math.min(config.levelCount, level ?? config.levelCount));
    const color = palette.colors[safeLevel - 1] ?? palette.colors[palette.colors.length - 1];

    return (
        <div
            className="flex h-5 w-11 items-center justify-center rounded-[3px] font-poppins text-[14px] font-medium"
            style={{backgroundColor: color, color: '#C52F18'}}
        >
            LV. {safeLevel}
        </div>
    );
}

function SectionHeader({step}: {step: TOnboardingStep}) {
    const label = STEP_LABELS[step];

    return (
        <div className="mb-10 flex items-start justify-between">
            <div className="space-y-6">
                <h1 className="max-w-[541px] font-apple text-[32px] leading-[1.18] font-semibold whitespace-pre-line text-text-1">
                    {label.title}
                </h1>
                <p className="font-apple text-[20px] font-medium text-gray-3">{label.description}</p>
            </div>
        </div>
    );
}

function UploadStep({draft, onUpload}: {draft: TOnboardingWardDraft; onUpload: (file: File) => void}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-6">
            <div
                className="flex min-h-[204px] flex-col items-center justify-center rounded-[20px] border border-dashed border-gray-5 bg-gray-7 px-10 py-[60px]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                    event.preventDefault();

                    const file = event.dataTransfer.files?.[0];

                    if (file) {
                        onUpload(file);
                    }
                }}
            >
                <p className="font-apple text-[20px] font-medium text-gray-3">근무표 파일을 여기에 드롭하세요</p>
                <input
                    ref={inputRef}
                    data-testid="upload-input"
                    hidden
                    type="file"
                    accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg,.pdf"
                    onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                            onUpload(file);
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="mt-5 h-10 rounded-[10px] border-gray-4 bg-gray-6 px-4 font-apple text-[20px] font-medium text-gray-3 hover:bg-gray-5"
                    onClick={() => inputRef.current?.click()}
                >
                    파일 업로드
                    <Upload className="h-5 w-5" />
                </Button>
            </div>
            {draft.uploadedFileName ? (
                <div className="rounded-[10px] border border-main-3 bg-main-light px-5 py-4 font-apple text-[18px] text-main-1">
                    업로드됨: {draft.uploadedFileName}
                </div>
            ) : null}
        </div>
    );
}

function ShiftTypeStep({
    shiftTypes,
    onChange,
    onAdd,
    onDelete,
}: {
    shiftTypes: TOnboardingWardShiftType[];
    onChange: (shiftTypeId: string, updater: Partial<TOnboardingWardShiftType>) => void;
    onAdd: () => void;
    onDelete: (shiftTypeId: string) => void;
}) {
    return (
        <div className={STEP_CARD_BASE_CLASS}>
            <div className="mb-6 flex items-center justify-between">
                <p className="font-apple text-[20px] font-medium text-gray-3">근무 유형</p>
                <button type="button" className="flex items-center gap-2 font-apple text-[16px] font-medium text-main-1" onClick={onAdd}>
                    <Plus className="h-5 w-5" />
                    근무 추가하기
                </button>
            </div>
            <div className="rounded-[12px] bg-gray-7">
                <div className="grid grid-cols-[2fr_88px_110px_220px_80px_50px] items-center gap-4 px-6 py-4 text-center font-apple text-[16px] text-gray-3">
                    <span>근무명</span>
                    <span>약자</span>
                    <span>유형</span>
                    <span>근무 시간</span>
                    <span>색상</span>
                    <span />
                </div>
                {shiftTypes.map((shiftType) => (
                    <div
                        key={shiftType.id}
                        className="grid grid-cols-[2fr_88px_110px_220px_80px_50px] items-center gap-4 border-t border-gray-6 bg-white px-6 py-4"
                    >
                        <Input
                            value={shiftType.name}
                            onChange={(event) => onChange(shiftType.id, {name: event.target.value})}
                            className="h-11 rounded-[10px] border-gray-5 font-apple text-[18px] text-sub-1"
                            placeholder="근무명"
                        />
                        <Input
                            value={shiftType.shortName}
                            maxLength={2}
                            onChange={(event) => onChange(shiftType.id, {shortName: event.target.value.toUpperCase()})}
                            className="h-11 rounded-[10px] border-gray-5 text-center font-poppins text-[18px] text-sub-1"
                            placeholder="-"
                        />
                        <select
                            value={shiftType.isOff ? 'OFF' : 'WORK'}
                            onChange={(event) =>
                                onChange(shiftType.id, {
                                    isOff: event.target.value === 'OFF',
                                    classification: event.target.value === 'OFF' ? 'OTHER_LEAVE' : 'OTHER_WORK',
                                    startTime: event.target.value === 'OFF' ? '' : shiftType.startTime || '09:00',
                                    endTime: event.target.value === 'OFF' ? '' : shiftType.endTime || '18:00',
                                })
                            }
                            className="h-11 rounded-[10px] border border-gray-5 bg-white px-3 font-apple text-[16px] text-sub-1 outline-none"
                        >
                            <option value="WORK">근무</option>
                            <option value="OFF">휴무</option>
                        </select>
                        <div className="flex items-center gap-2">
                            <Input
                                value={shiftType.startTime}
                                disabled={shiftType.isOff}
                                onChange={(event) => onChange(shiftType.id, {startTime: event.target.value})}
                                className="h-11 rounded-[10px] border-gray-5 text-center font-poppins text-[18px]"
                                placeholder="07:00"
                            />
                            <span className="font-poppins text-[18px] text-gray-3">~</span>
                            <Input
                                value={shiftType.endTime}
                                disabled={shiftType.isOff}
                                onChange={(event) => onChange(shiftType.id, {endTime: event.target.value})}
                                className="h-11 rounded-[10px] border-gray-5 text-center font-poppins text-[18px]"
                                placeholder="15:00"
                            />
                        </div>
                        <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border border-gray-5 bg-white">
                            <input
                                className="sr-only"
                                type="color"
                                value={shiftType.color}
                                onChange={(event) => onChange(shiftType.id, {color: event.target.value})}
                            />
                            <span className="h-7 w-7 rounded-[8px]" style={{backgroundColor: shiftType.color}} />
                        </label>
                        <button
                            type="button"
                            aria-label={`${shiftType.name || '근무'} 삭제`}
                            onClick={() => onDelete(shiftType.id)}
                            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-gray-4 hover:bg-gray-7 hover:text-sub-1"
                            disabled={shiftType.isDefault}
                        >
                            {shiftType.isDefault ? <Pencil className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TeamTabs({
    teams,
    nurses,
    currentTeamId,
    onSelect,
    onAdd,
}: {
    teams: TOnboardingTeamDraft[];
    nurses: TOnboardingNurseDraft[];
    currentTeamId: string;
    onSelect: (teamId: string) => void;
    onAdd: () => void;
}) {
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

function SkillLevelModal({
    open,
    config,
    onClose,
    onSave,
}: {
    open: boolean;
    config: TSkillLevelConfig;
    onClose: () => void;
    onSave: (config: TSkillLevelConfig) => void;
}) {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    if (!open) {
        return null;
    }

    const palette = getSkillPalette(localConfig.paletteId);
    const levelItems = Array.from({length: localConfig.levelCount}, (_, index) => localConfig.levelCount - index);

    return (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/60 px-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-[710px] rounded-[20px] bg-white px-[42px] py-10">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="font-apple text-[32px] font-semibold text-text-1">숙련도 단계 설정</h2>
                        <p className="mt-2 font-apple text-[20px] font-medium text-gray-3">기준은 자유롭게 정할 수 있어요</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-4 hover:bg-gray-7">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-10 flex items-center gap-4">
                    <select
                        value={localConfig.levelCount}
                        onChange={(event) => setLocalConfig((prev) => ({...prev, levelCount: Number(event.target.value)}))}
                        className="h-9 rounded-[5px] border border-gray-6 bg-gray-7 px-3 font-apple text-[16px] text-sub-1 outline-none"
                    >
                        {[2, 3, 4, 5].map((levelCount) => (
                            <option key={levelCount} value={levelCount}>
                                {levelCount}단계
                            </option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        {skillPalettes.map((candidate) => (
                            <button
                                key={candidate.id}
                                type="button"
                                aria-label={`${candidate.id} palette`}
                                onClick={() => setLocalConfig((prev) => ({...prev, paletteId: candidate.id}))}
                                className={cn(
                                    'flex rounded-full border-2 p-1',
                                    candidate.id === localConfig.paletteId ? 'border-main-1' : 'border-transparent',
                                )}
                            >
                                {candidate.colors.slice(0, 4).map((color) => (
                                    <span
                                        key={color}
                                        className="h-4 w-4 rounded-full border border-white"
                                        style={{backgroundColor: color}}
                                    />
                                ))}
                            </button>
                        ))}
                        <span className="font-apple text-[20px] font-medium text-sub-2">색상</span>
                    </div>
                </div>

                <div className="mt-6 rounded-[10px] border border-gray-5">
                    <div className="grid grid-cols-[72px_1fr]">
                        <div className="from-gray-2 rounded-l-[10px] bg-gradient-to-b to-gray-5 px-4 py-6 text-center font-apple text-[20px] font-semibold text-white">
                            <div className="h-[176px]">
                                <p>높음</p>
                                <div className="flex h-full items-end justify-center">
                                    <p className="text-text-1">낮음</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-5 px-8 py-6">
                            <div className="grid grid-cols-[100px_1fr] text-center font-apple text-[16px] text-gray-3">
                                <span>숙련도</span>
                                <span>구분</span>
                            </div>
                            {levelItems.map((level) => (
                                <div key={level} className="grid grid-cols-[100px_1fr] items-center">
                                    <div className="flex justify-center">
                                        <SkillBadge level={level} config={{...localConfig, paletteId: palette.id}} />
                                    </div>
                                    <div className="rounded-[5px] bg-gray-6/70 px-4 py-1.5 font-apple text-[16px] text-gray-3">
                                        LV. {level}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <input
                        id="skill-auto-assign"
                        type="checkbox"
                        checked={localConfig.autoAssign}
                        onChange={(event) => setLocalConfig((prev) => ({...prev, autoAssign: event.target.checked}))}
                    />
                    <label htmlFor="skill-auto-assign" className="font-apple text-[16px] text-gray-3">
                        자동 배정
                    </label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-gray-4">
                                    <Info className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[220px] bg-gray-6 text-sub-1">
                                등록된 간호사 목록을 단계별로 분배해서 자동으로 1차 배정합니다.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="mt-10 flex items-center justify-between">
                    <button type="button" className="font-apple text-[20px] text-gray-4 underline underline-offset-2" onClick={onClose}>
                        임시 저장
                    </button>
                    <WizardButton
                        onClick={() => {
                            onSave(localConfig);
                            onClose();
                        }}
                    >
                        완료
                    </WizardButton>
                </div>
            </div>
        </div>
    );
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
}: {
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
}) {
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
                                                className="h-10 border-none bg-transparent px-0 font-apple text-[20px] font-medium text-sub-1 shadow-none"
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
                                                className="h-10 border-none bg-transparent px-0 font-apple text-[20px] font-medium text-sub-1 shadow-none"
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

function OnboardingWardCreatePage() {
    const [draft, setDraft] = useState<TOnboardingWardDraft>(() => createInitialDraft());
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [sortMode, setSortMode] = useState<TSortMode>('manual');
    const [showSkillModal, setShowSkillModal] = useState(false);
    const [completedPayload, setCompletedPayload] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedTeamId && draft.teams[0]) {
            setSelectedTeamId(draft.teams[0].id);
        }
    }, [draft.teams, selectedTeamId]);

    const selectedTeamExists = draft.teams.some((team) => team.id === selectedTeamId);
    const activeTeamId = selectedTeamExists ? selectedTeamId : (draft.teams[0]?.id ?? '');
    const goToStep = (step: TOnboardingStep) => {
        setDraft((prev) => ({...prev, currentStep: step}));
    };
    const updateShiftType = (shiftTypeId: string, updater: Partial<TOnboardingWardShiftType>) => {
        setDraft((prev) => ({
            ...prev,
            shiftTypes: prev.shiftTypes.map((shiftType) => (shiftType.id === shiftTypeId ? {...shiftType, ...updater} : shiftType)),
        }));
    };
    const updateNurse = (nurseId: string, updater: Partial<TOnboardingNurseDraft>) => {
        setDraft((prev) => ({
            ...prev,
            nurses: prev.nurses.map((nurse) => (nurse.id === nurseId ? {...nurse, ...updater} : nurse)),
        }));
    };
    const handleAddTeam = () => {
        const team = {
            id: `team-new-${draft.teams.length + 1}`,
            name: `간호사 ${draft.teams.length + 1}팀`,
        };

        setDraft((prev) => ({...prev, teams: [...prev.teams, team]}));
        setSelectedTeamId(team.id);
    };
    const handleAddNurse = () => {
        if (!activeTeamId) {
            return;
        }

        setDraft((prev) => ({
            ...prev,
            nurses: [...prev.nurses, createEmptyNurse(activeTeamId, prev.shiftTypes)],
        }));
    };
    const handleNurseDragEnd = ({destination, source}: DropResult) => {
        if (!destination || !activeTeamId || destination.index === source.index || sortMode !== 'manual') {
            return;
        }

        setDraft((prev) => {
            const teamNurses = prev.nurses.filter((nurse) => nurse.teamId === activeTeamId);
            const otherNurses = prev.nurses.filter((nurse) => nurse.teamId !== activeTeamId);
            const nextNurses = [...teamNurses];
            const [moved] = nextNurses.splice(source.index, 1);

            if (!moved) {
                return prev;
            }

            nextNurses.splice(destination.index, 0, moved);

            return {
                ...prev,
                nurses: [...otherNurses, ...nextNurses],
            };
        });
    };
    const handleSkillConfigSave = (config: TSkillLevelConfig) => {
        setDraft((prev) => ({
            ...prev,
            skillLevelConfig: config,
            nurses: applySkillLevels(prev.nurses, config),
        }));
    };
    const handleComplete = () => {
        const payload = serializeDraft(draft);
        const stringified = JSON.stringify(payload, null, 2);

        console.info('mockCreateWardPayload', payload);
        setCompletedPayload(stringified);
        toast.success('mock 병동 생성 payload를 만들었습니다.');
    };
    const stepContent = useMemo(() => {
        switch (draft.currentStep) {
            case 1:
                return (
                    <UploadStep
                        draft={draft}
                        onUpload={(file) => {
                            setDraft((prev) => applyMockUpload(prev, file.name));
                        }}
                    />
                );
            case 2:
                return (
                    <ShiftTypeStep
                        shiftTypes={draft.shiftTypes}
                        onChange={updateShiftType}
                        onAdd={() =>
                            setDraft((prev) => ({
                                ...prev,
                                shiftTypes: [...prev.shiftTypes, createEmptyShiftType()],
                            }))
                        }
                        onDelete={(shiftTypeId) =>
                            setDraft((prev) => ({
                                ...prev,
                                shiftTypes: prev.shiftTypes.filter((shiftType) => shiftType.id !== shiftTypeId),
                                nurses: prev.nurses.map((nurse) => ({
                                    ...nurse,
                                    possibleShiftTypeIds: nurse.possibleShiftTypeIds.filter((value) => value !== shiftTypeId),
                                })),
                            }))
                        }
                    />
                );
            case 3:
            case 4:
                return (
                    <NurseStep
                        step={draft.currentStep}
                        draft={draft}
                        selectedTeamId={activeTeamId}
                        sortMode={sortMode}
                        onSortModeChange={setSortMode}
                        onSelectTeam={setSelectedTeamId}
                        onAddTeam={handleAddTeam}
                        onAddNurse={handleAddNurse}
                        onNurseChange={updateNurse}
                        onDragEnd={handleNurseDragEnd}
                        onOpenSkillModal={() => setShowSkillModal(true)}
                    />
                );
        }
    }, [activeTeamId, draft, sortMode]);

    return (
        <div className="relative min-h-screen bg-main-bg">
            <HeaderLogo />
            <SkillLevelModal
                open={showSkillModal}
                config={draft.skillLevelConfig}
                onClose={() => setShowSkillModal(false)}
                onSave={handleSkillConfigSave}
            />
            <div className="mx-auto w-[1120px] pt-[140px] pb-20">
                <SectionHeader step={draft.currentStep} />
                {stepContent}
                <div className="mt-14 flex items-center justify-between">
                    <WizardButton
                        variant="link"
                        onClick={() =>
                            draft.currentStep === 4 ? handleComplete() : goToStep(Math.min(4, draft.currentStep + 1) as TOnboardingStep)
                        }
                    >
                        건너뛰기
                    </WizardButton>
                    <div className="flex items-center gap-[42px]">
                        {draft.currentStep > 1 ? (
                            <WizardButton variant="secondary" onClick={() => goToStep((draft.currentStep - 1) as TOnboardingStep)}>
                                이전
                            </WizardButton>
                        ) : null}
                        {draft.currentStep < 4 ? (
                            <WizardButton onClick={() => goToStep((draft.currentStep + 1) as TOnboardingStep)}>다음</WizardButton>
                        ) : (
                            <WizardButton onClick={handleComplete}>완료</WizardButton>
                        )}
                    </div>
                </div>
                {completedPayload ? (
                    <div className="mt-10 rounded-[20px] border border-gray-6 bg-white p-6">
                        <p className="mb-4 font-apple text-[20px] font-semibold text-text-1">Mock CreateWard Payload</p>
                        <pre
                            data-testid="mock-create-ward-payload"
                            className="overflow-auto rounded-[10px] bg-gray-7 p-4 text-sm text-sub-1"
                        >
                            {completedPayload}
                        </pre>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default OnboardingWardCreatePage;
