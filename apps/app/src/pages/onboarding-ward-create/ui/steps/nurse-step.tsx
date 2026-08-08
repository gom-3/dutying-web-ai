import {cn} from '@dutying/utils/style';
import {DragDropContext, Draggable, Droppable, type DropResult} from '@hello-pangea/dnd';
import {Check, ChevronDown, Info, Plus, UsersRound, X} from 'lucide-react';
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {PersonIcon, SixDotsIcon} from '@/shared/assets/svg';
import {useTypedTranslation, type TI18nKey} from '@/shared/hook/use-typed-translation';
import {Input} from '@/shared/ui/primitives/input';
import {Switch} from '@/shared/ui/primitives/switch';
import {
    isOnboardingShiftTypeActive,
    groupItemsByDivision,
    MAX_ONBOARDING_NURSE_NAME_LENGTH,
    sortNursesByMode,
    type TOnboardingNurseDraft,
    type TOnboardingWardDraft,
    type TSortMode,
} from '../../model';
import {ShiftBadge} from './badges';
import {OnboardingAddDivisionButton, OnboardingDivisionHeader} from './division-controls';
import TeamTabs from './team-tabs';

interface INurseStepProps {
    draft: TOnboardingWardDraft;
    selectedTeamId: string;
    sortMode: TSortMode;
    onSortModeChange: (sortMode: TSortMode) => void;
    onSelectTeam: (teamId: string) => void;
    onAddTeam: () => void;
    canAddTeam: boolean;
    onAddNurse: () => void;
    onDeleteNurse: (nurseId: string) => void;
    onNurseChange: (nurseId: string, updater: Partial<TOnboardingNurseDraft>) => void;
    onTeamNameChange: (teamId: string, teamName: string) => void;
    onDivisionNameChange: (teamId: string, divisionNum: number, divisionName: string | null) => void;
    onAddDivisionAfterNurse: (nurseId: string, orderedNurseIds: string[]) => void;
    onDeleteDivision: (teamId: string, divisionNum: number, orderedNurseIds: string[]) => void;
    onDragEnd: (result: DropResult) => void;
}

const SORT_OPTIONS: {value: TSortMode; labelKey: TI18nKey}[] = [
    {value: 'manual', labelKey: 'page.onboardingWardCreate.nurse.sort.manual'},
    {value: 'name', labelKey: 'page.onboardingWardCreate.nurse.sort.name'},
];
const NURSE_GRID_PADDING_X = 'px-6';
const NURSE_GRID_GAP_CLASS = 'gap-x-3';
const NURSE_GRID_COLS_STEP_3 =
    'grid-cols-[32px_minmax(168px,1.08fr)_minmax(220px,1.48fr)_minmax(84px,0.58fr)_minmax(84px,0.58fr)_minmax(96px,0.68fr)_40px]';
const limitNurseNameInput = (value: string) => value.slice(0, MAX_ONBOARDING_NURSE_NAME_LENGTH);
const getOnboardingDivisionDroppableId = (teamId: string, divisionNum: number) => `${teamId},${divisionNum}`;

type TNurseRoleHelp = 'preceptor' | 'preceptee';

const NURSE_ROLE_HELP: Record<TNurseRoleHelp, {labelKey: TI18nKey; descriptionKey: TI18nKey}> = {
    preceptor: {
        labelKey: 'page.member.roleHelp.preceptor.label',
        descriptionKey: 'page.member.roleHelp.preceptor.description',
    },
    preceptee: {
        labelKey: 'page.member.roleHelp.preceptee.label',
        descriptionKey: 'page.member.roleHelp.preceptee.description',
    },
};

function NurseRoleHeaderHelp({
    type,
    openedType,
    onToggle,
}: {
    type: TNurseRoleHelp;
    openedType: TNurseRoleHelp | null;
    onToggle: (type: TNurseRoleHelp) => void;
}) {
    const {t} = useTypedTranslation();
    const help = NURSE_ROLE_HELP[type];
    const label = t(help.labelKey);
    const isOpen = openedType === type;

    return (
        <span className="group relative inline-flex items-center justify-center gap-1">
            <span>{label}</span>
            <button
                type="button"
                aria-label={t('page.member.roleHelp.aria', {label})}
                aria-expanded={isOpen}
                className="flex h-4 w-4 items-center justify-center rounded-full text-gray-4 transition-colors hover:bg-gray-6 hover:text-main-1 focus-visible:outline-2 focus-visible:outline-main-1"
                onClick={() => onToggle(type)}
            >
                <Info className="h-3 w-3" />
            </button>
            <span
                role="tooltip"
                className={cn(
                    'pointer-events-none absolute top-full left-1/2 z-30 mt-2 w-[218px] -translate-x-1/2 rounded-[8px] bg-[#242428] px-3 py-2 text-left font-apple text-[12px] leading-5 text-white opacity-0 shadow-[0px_10px_24px_rgba(23,23,28,0.18)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100',
                    isOpen && 'opacity-100',
                )}
            >
                {t(help.descriptionKey)}
            </span>
        </span>
    );
}

function NurseStep({
    draft,
    selectedTeamId,
    sortMode,
    onSortModeChange,
    onSelectTeam,
    onAddTeam,
    canAddTeam,
    onAddNurse,
    onDeleteNurse,
    onNurseChange,
    onTeamNameChange,
    onDivisionNameChange,
    onAddDivisionAfterNurse,
    onDeleteDivision,
    onDragEnd,
}: INurseStepProps) {
    const {t} = useTypedTranslation();
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [openedRoleHelp, setOpenedRoleHelp] = useState<TNurseRoleHelp | null>(null);
    const [editingDivisionNum, setEditingDivisionNum] = useState<number | null>(null);
    const [editingDivisionName, setEditingDivisionName] = useState('');
    const sortMenuRef = useRef<HTMLDivElement | null>(null);
    const rowRefByNurseId = useRef<Record<string, HTMLDivElement | null>>({});
    const previousTopByNurseIdRef = useRef<Record<string, number>>({});
    const skipFlipAnimationOnceRef = useRef(false);
    const availableSortOptions = SORT_OPTIONS;
    const selectedSortOption = availableSortOptions.find((option) => option.value === sortMode) ?? availableSortOptions[0];
    const selectedSortOptionLabel = selectedSortOption ? t(selectedSortOption.labelKey) : '';
    const currentNurses = useMemo(() => draft.nurses.filter((nurse) => nurse.teamId === selectedTeamId), [draft.nurses, selectedTeamId]);
    const sortedNurses = useMemo(() => sortNursesByMode(currentNurses, sortMode), [currentNurses, sortMode]);
    const currentTeam = draft.teams.find((team) => team.id === selectedTeamId);
    const divisionGroups = useMemo(
        () => groupItemsByDivision(sortedNurses, currentTeam?.divisions),
        [currentTeam?.divisions, sortedNurses],
    );
    const renderedNurseIds = useMemo(() => divisionGroups.flatMap((group) => group.items.map((nurse) => nurse.id)), [divisionGroups]);
    const hasTeams = draft.teams.length > 0;
    const hasNursesInSelectedTeam = hasTeams && currentNurses.length > 0;
    const activeShiftTypes = useMemo(
        () => draft.shiftTypes.filter((shiftType) => isOnboardingShiftTypeActive(shiftType) && shiftType.shortName),
        [draft.shiftTypes],
    );
    const gridTemplateClass = NURSE_GRID_COLS_STEP_3;
    const handleDragEnd = (result: DropResult) => {
        skipFlipAnimationOnceRef.current = true;
        onDragEnd(result);

        requestAnimationFrame(() => {
            skipFlipAnimationOnceRef.current = false;
        });
    };
    const handleSubmitDivisionName = () => {
        if (!currentTeam || editingDivisionNum == null) {
            return;
        }

        onDivisionNameChange(currentTeam.id, editingDivisionNum, editingDivisionName.trim() || null);
        setEditingDivisionNum(null);
        setEditingDivisionName('');
    };
    const handleCancelDivisionName = () => {
        setEditingDivisionNum(null);
        setEditingDivisionName('');
    };

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;

            if (sortMenuRef.current?.contains(target)) {
                return;
            }

            setIsSortMenuOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
        };
    }, []);

    useEffect(() => {
        if (hasNursesInSelectedTeam) {
            return;
        }

        setIsSortMenuOpen(false);
    }, [hasNursesInSelectedTeam]);

    useEffect(() => {
        setEditingDivisionNum(null);
        setEditingDivisionName('');
    }, [selectedTeamId]);

    useLayoutEffect(() => {
        const nextTopByNurseId: Record<string, number> = {};
        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const shouldSkipFlipAnimation = skipFlipAnimationOnceRef.current;

        sortedNurses.forEach((nurse) => {
            const rowElement = rowRefByNurseId.current[nurse.id];

            if (!rowElement) {
                return;
            }

            const nextTop = rowElement.getBoundingClientRect().top;
            const previousTop = previousTopByNurseIdRef.current[nurse.id];

            nextTopByNurseId[nurse.id] = nextTop;

            if (previousTop == null) {
                return;
            }

            const deltaY = previousTop - nextTop;

            if (Math.abs(deltaY) < 1) {
                return;
            }

            if (prefersReducedMotion || shouldSkipFlipAnimation) {
                return;
            }

            rowElement.style.transition = 'none';
            rowElement.style.transform = `translateY(${deltaY}px)`;
            rowElement.style.willChange = 'transform';

            requestAnimationFrame(() => {
                rowElement.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
                rowElement.style.transform = 'translateY(0)';
            });

            rowElement.addEventListener(
                'transitionend',
                () => {
                    rowElement.style.transition = '';
                    rowElement.style.willChange = '';
                },
                {once: true},
            );
        });

        previousTopByNurseIdRef.current = nextTopByNurseId;
    }, [sortedNurses]);

    return (
        <div className="space-y-4">
            <TeamTabs
                teams={draft.teams}
                nurses={draft.nurses}
                currentTeamId={selectedTeamId}
                onSelect={onSelectTeam}
                onAdd={onAddTeam}
                canAdd={canAddTeam}
                onRename={onTeamNameChange}
            />

            {hasNursesInSelectedTeam ? (
                <div className="flex items-center justify-end gap-3">
                    <div ref={sortMenuRef} className="relative">
                        <button
                            type="button"
                            aria-haspopup="listbox"
                            aria-expanded={isSortMenuOpen}
                            aria-label={t('page.onboardingWardCreate.nurse.sortAria')}
                            className={cn(
                                'flex h-8 min-w-[112px] items-center justify-between gap-3 rounded-[5px] bg-gray-6 px-3 font-apple text-[16px] text-gray-3 transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                isSortMenuOpen ? 'bg-white shadow-[0px_10px_28px_rgba(95,100,135,0.16)]' : 'hover:bg-gray-7',
                            )}
                            onClick={() => setIsSortMenuOpen((prev) => !prev)}
                        >
                            <span>{selectedSortOptionLabel}</span>
                            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isSortMenuOpen && 'rotate-180')} />
                        </button>
                        {isSortMenuOpen ? (
                            <div
                                role="listbox"
                                aria-label={t('page.onboardingWardCreate.nurse.sortOptionsAria')}
                                className="absolute top-full right-0 z-20 mt-1 w-[150px] animate-in overflow-hidden rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 slide-in-from-top-1"
                            >
                                {availableSortOptions.map((option) => {
                                    const isSelected = sortMode === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            className={cn(
                                                'flex w-full items-center px-4 py-2.5 text-left font-apple text-[15px] transition-colors hover:bg-gray-7 focus-visible:outline-2 focus-visible:outline-main-1',
                                                isSelected ? 'bg-main-light font-semibold text-main-1' : 'text-sub-1',
                                            )}
                                            onClick={() => {
                                                onSortModeChange(option.value);
                                                setIsSortMenuOpen(false);
                                            }}
                                        >
                                            {t(option.labelKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {hasNursesInSelectedTeam ? (
                <div
                    className={cn(
                        'grid items-center font-apple text-[16px] text-gray-3',
                        NURSE_GRID_GAP_CLASS,
                        NURSE_GRID_PADDING_X,
                        gridTemplateClass,
                    )}
                >
                    <div />
                    <div className="flex h-8 w-full items-center justify-center">
                        <span
                            className="flex min-w-0 items-center justify-center gap-1.5"
                            aria-label={t('page.onboardingWardCreate.nurse.selectedTeamCountAria', {count: currentNurses.length})}
                        >
                            <span>{t('page.member.table.name')}</span>
                            <span className="inline-flex h-4 items-center gap-0.5 align-middle font-poppins text-[13px] leading-none font-semibold text-[#6B7280]">
                                <PersonIcon className="block h-3.5 w-3.5 shrink-0 text-[#7B8494]" aria-hidden="true" />
                                <span className="block leading-none tabular-nums">{currentNurses.length}</span>
                            </span>
                        </span>
                    </div>
                    <div className="flex h-8 w-full items-center justify-center">
                        <span className="block w-full text-center">{t('page.member.table.shiftTypes')}</span>
                    </div>
                    <div className="flex h-8 w-full items-center justify-center">
                        <NurseRoleHeaderHelp
                            type="preceptor"
                            openedType={openedRoleHelp}
                            onToggle={(type) => setOpenedRoleHelp((prev) => (prev === type ? null : type))}
                        />
                    </div>
                    <div className="flex h-8 w-full items-center justify-center">
                        <NurseRoleHeaderHelp
                            type="preceptee"
                            openedType={openedRoleHelp}
                            onToggle={(type) => setOpenedRoleHelp((prev) => (prev === type ? null : type))}
                        />
                    </div>
                    <div className="flex h-8 w-full items-center justify-center">
                        <span className="block w-full text-center">{t('page.member.table.isWorker')}</span>
                    </div>
                    <div />
                </div>
            ) : null}

            {hasNursesInSelectedTeam ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="space-y-1.5">
                        {divisionGroups.map((group, groupIndex) => {
                            const isEditingDivision = editingDivisionNum === group.divisionNum;
                            const canDeleteDivision = groupIndex > 0;

                            return (
                                <div key={`${selectedTeamId}:${group.divisionNum}`} className="flex flex-col">
                                    <OnboardingDivisionHeader
                                        divisionNum={group.divisionNum}
                                        divisionName={group.divisionName}
                                        itemCount={group.items.length}
                                        isEditing={isEditingDivision}
                                        draftName={editingDivisionName}
                                        canDelete={canDeleteDivision}
                                        onStartEdit={() => {
                                            setEditingDivisionNum(group.divisionNum);
                                            setEditingDivisionName(group.divisionName?.trim() ?? '');
                                        }}
                                        onDraftNameChange={setEditingDivisionName}
                                        onSubmit={handleSubmitDivisionName}
                                        onCancel={handleCancelDivisionName}
                                        onDelete={() => onDeleteDivision(selectedTeamId, group.divisionNum, renderedNurseIds)}
                                    />
                                    <Droppable droppableId={getOnboardingDivisionDroppableId(selectedTeamId, group.divisionNum)}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col">
                                                {group.items.map((nurse, index) => {
                                                    const isPreceptor = nurse.isPreceptor;
                                                    const isPreceptee = nurse.isPreceptee;
                                                    const fadedClass = nurse.isWorker ? '' : 'opacity-45';
                                                    const nurseNameForAria = nurse.name || t('page.member.common.nurseFallback');

                                                    return (
                                                        <div key={nurse.id} className="flex flex-col">
                                                            <Draggable draggableId={nurse.id} index={index}>
                                                                {(dragProvided) => (
                                                                    <div
                                                                        ref={(element) => {
                                                                            dragProvided.innerRef(element);
                                                                            rowRefByNurseId.current[nurse.id] = element;
                                                                        }}
                                                                        {...dragProvided.draggableProps}
                                                                        className={cn(
                                                                            'grid items-center rounded-[12px] bg-white py-1',
                                                                            NURSE_GRID_GAP_CLASS,
                                                                            NURSE_GRID_PADDING_X,
                                                                            gridTemplateClass,
                                                                            !nurse.isWorker && 'bg-[#FAFBFD]',
                                                                        )}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            aria-label={t('page.onboardingWardCreate.nurse.dragAria')}
                                                                            {...dragProvided.dragHandleProps}
                                                                            className={cn(
                                                                                'flex h-6 w-6 items-center justify-center text-gray-4 transition-colors hover:text-gray-3',
                                                                                fadedClass,
                                                                            )}
                                                                        >
                                                                            <SixDotsIcon className="h-4 w-4" />
                                                                        </button>

                                                                        <Input
                                                                            value={nurse.name}
                                                                            onChange={(event) =>
                                                                                onNurseChange(nurse.id, {
                                                                                    name: limitNurseNameInput(event.target.value),
                                                                                })
                                                                            }
                                                                            variant="flush"
                                                                            fieldSize="default"
                                                                            className={cn(
                                                                                'h-8 text-center text-[16px] font-medium',
                                                                                fadedClass,
                                                                            )}
                                                                            placeholder={t('page.member.table.name')}
                                                                            maxLength={MAX_ONBOARDING_NURSE_NAME_LENGTH}
                                                                        />

                                                                        <div
                                                                            className={cn(
                                                                                'flex flex-wrap items-center justify-center gap-1.5',
                                                                                fadedClass,
                                                                            )}
                                                                        >
                                                                            {activeShiftTypes.map((shiftType) => {
                                                                                const selected = nurse.possibleShiftTypeIds.includes(
                                                                                    shiftType.id,
                                                                                );

                                                                                return (
                                                                                    <button
                                                                                        key={shiftType.id}
                                                                                        type="button"
                                                                                        aria-pressed={selected}
                                                                                        className={cn(
                                                                                            'group relative cursor-pointer rounded-[7px] p-[1px] transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-main-1/35',
                                                                                            selected
                                                                                                ? 'opacity-100'
                                                                                                : 'opacity-55 hover:opacity-100',
                                                                                        )}
                                                                                        onClick={() => {
                                                                                            const nextPossibleShiftTypeIds = selected
                                                                                                ? nurse.possibleShiftTypeIds.filter(
                                                                                                      (value) => value !== shiftType.id,
                                                                                                  )
                                                                                                : [
                                                                                                      ...nurse.possibleShiftTypeIds,
                                                                                                      shiftType.id,
                                                                                                  ];

                                                                                            onNurseChange(nurse.id, {
                                                                                                possibleShiftTypeIds:
                                                                                                    nextPossibleShiftTypeIds,
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        <ShiftBadge
                                                                                            shiftType={shiftType}
                                                                                            selected={selected}
                                                                                        />
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        <div className={cn('flex items-center justify-center', fadedClass)}>
                                                                            <button
                                                                                type="button"
                                                                                role="checkbox"
                                                                                aria-checked={isPreceptor}
                                                                                aria-label={t('page.member.row.preceptorAria', {
                                                                                    nurseName: nurseNameForAria,
                                                                                })}
                                                                                className={cn(
                                                                                    'flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                                                                    isPreceptor
                                                                                        ? 'border-main-1 bg-main-1 text-white hover:bg-main-1-hover'
                                                                                        : 'border-sub-4 bg-white text-transparent hover:border-main-1 hover:bg-main-light',
                                                                                )}
                                                                                onClick={() =>
                                                                                    onNurseChange(nurse.id, {
                                                                                        isPreceptor: !isPreceptor,
                                                                                        isPreceptee: isPreceptor
                                                                                            ? nurse.isPreceptee
                                                                                            : false,
                                                                                    })
                                                                                }
                                                                            >
                                                                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                                            </button>
                                                                        </div>

                                                                        <div className={cn('flex items-center justify-center', fadedClass)}>
                                                                            <button
                                                                                type="button"
                                                                                role="checkbox"
                                                                                aria-checked={isPreceptee}
                                                                                aria-label={t('page.member.row.precepteeAria', {
                                                                                    nurseName: nurseNameForAria,
                                                                                })}
                                                                                className={cn(
                                                                                    'flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                                                                    isPreceptee
                                                                                        ? 'border-main-1 bg-main-1 text-white hover:bg-main-1-hover'
                                                                                        : 'border-sub-4 bg-white text-transparent hover:border-main-1 hover:bg-main-light',
                                                                                )}
                                                                                onClick={() =>
                                                                                    onNurseChange(nurse.id, {
                                                                                        isPreceptor: isPreceptee
                                                                                            ? nurse.isPreceptor
                                                                                            : false,
                                                                                        isPreceptee: !isPreceptee,
                                                                                    })
                                                                                }
                                                                            >
                                                                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                                            </button>
                                                                        </div>

                                                                        <div className={cn('flex items-center justify-center', fadedClass)}>
                                                                            <Switch
                                                                                checked={nurse.isWorker}
                                                                                aria-label={t('page.member.row.workerAria', {
                                                                                    nurseName: nurseNameForAria,
                                                                                })}
                                                                                className="relative h-5 w-9 justify-start border-0 bg-sub-4 p-0 shadow-none data-[state=checked]:bg-main-1 data-[state=unchecked]:bg-sub-4"
                                                                                thumbClassName="absolute top-0.5 left-0.5 h-4 w-4 translate-x-0 bg-white shadow-sm data-[state=checked]:translate-x-4"
                                                                                onCheckedChange={(checked) =>
                                                                                    onNurseChange(nurse.id, {isWorker: checked})
                                                                                }
                                                                            />
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            aria-label={t(
                                                                                'page.onboardingWardCreate.nurse.deleteNurseAria',
                                                                                {
                                                                                    nurseName: nurseNameForAria,
                                                                                },
                                                                            )}
                                                                            className={cn(
                                                                                'flex h-7 w-7 items-center justify-center rounded-[7px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1',
                                                                                fadedClass,
                                                                            )}
                                                                            onClick={() => onDeleteNurse(nurse.id)}
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                            {index < group.items.length - 1 ? (
                                                                <OnboardingAddDivisionButton
                                                                    onClick={() => onAddDivisionAfterNurse(nurse.id, renderedNurseIds)}
                                                                />
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            ) : null}

            {!hasTeams ? (
                <div className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-[16px] border border-dashed border-[#D3D8E2] bg-[#F8FAFC] px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#7B8494] shadow-[0_6px_18px_rgba(49,55,74,0.06)]">
                        <UsersRound className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
                    </div>
                    <p className="mt-4 font-apple text-[18px] font-semibold text-sub-1">
                        {t('page.onboardingWardCreate.nurse.emptyTeamsTitle')}
                    </p>
                    <p className="mt-1 font-apple text-[14px] leading-5 text-gray-3">
                        {t('page.onboardingWardCreate.nurse.emptyTeamsDescription')}
                    </p>
                    <button
                        type="button"
                        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#3D4658] px-4 font-apple text-[14px] font-semibold text-white transition-colors hover:bg-[#303848] focus-visible:outline-2 focus-visible:outline-main-1"
                        onClick={onAddTeam}
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                        {t('page.onboardingWardCreate.teamTabs.addTeam')}
                    </button>
                </div>
            ) : (
                <div className={cn('flex', hasNursesInSelectedTeam ? 'mt-2 justify-end' : 'mt-12 justify-center')}>
                    <button
                        type="button"
                        className="group flex items-center gap-2 font-apple text-[16px] font-medium text-gray-3 transition-colors hover:text-[#4E586C]"
                        onClick={onAddNurse}
                    >
                        <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[#657084] transition-colors group-hover:bg-[#4E586C]">
                            <Plus className="h-[11px] w-[11px] text-white" />
                        </span>
                        {t('page.member.addNurse')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default NurseStep;
