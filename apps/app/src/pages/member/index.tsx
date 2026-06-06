import {DateUtil} from '@dutying/utils/date';
import {cn} from '@dutying/utils/style';
import {
    DragDropContext,
    Draggable,
    Droppable,
    type DraggableProvidedDragHandleProps,
    type DraggableProvidedDraggableProps,
    type DropResult,
} from '@hello-pangea/dnd';
import {Check, ChevronDown, Copy, Info, Link2, Plus, Settings2, Trash2, X} from 'lucide-react';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {useSearchParams} from 'react-router';
import {events, sendEvent} from '@/analytics';
import {getWardDisplayCode, getWardDisplayTitle, type TNurse, type TWardShiftType} from '@/entities';
import useEditShiftTeam, {type TUpdateNurseShiftMeta} from '@/features/edit-shift-team';
import useEditWard from '@/features/edit-ward';
import {
    createWardSkillSettings,
    getWardSkillSettings,
    resolveWardSkillLevels,
    saveWardSkillSettings,
    type TWardSkillSettings,
} from '@/features/ward-skill/model/skill-level';
import SkillBadge from '@/features/ward-skill/ui/skill-badge';
import {MAX_ONBOARDING_NURSES, MAX_ONBOARDING_TEAMS} from '@/pages/onboarding-ward-create/model/draft';
import {LinkedIcon, PersonIcon, SixDotsIcon, UnlinkedIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Input} from '@/shared/ui/primitives/input';
import {Switch} from '@/shared/ui/primitives/switch';
import WardCodeGuideModal from '@/widgets/ward-code-guide-modal';
import {NURSE_ROLE_HELP, hasPrecepteeMemo, setPrecepteeMemo, type TNurseRoleHelpType} from './model/nurse-role';
import {resolveNurseShiftTypeOptions} from './model/nurse-shift-types';
import {createMoveNurseToTeamPayload} from './model/shift-team-list';
import ConnectionManage from './ui/connection-manage';
import MemberSkillLevelModal from './ui/member-skill-level-modal';
import NurseDetailPanel from './ui/nurse-detail-panel';

type TMemberNurseSortMode = 'manual' | 'name' | 'skill';
type TManualOrderByTeamId = Record<number, number[]>;
type TNurseDraftActions = {save: () => Promise<boolean>; discard: () => void};

const getMemberManualOrderStorageKey = (wardId: number | null) => `member:manual-order:${wardId ?? 'unknown'}`;
const parsePositiveInt = (value: string | null): number | null => {
    if (!value) return null;

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const parseManualOrderByTeamId = (value: string | null): TManualOrderByTeamId => {
    if (!value) return {};

    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        const entries = Object.entries(parsed).flatMap(([teamId, nurseIds]) => {
            if (!Array.isArray(nurseIds)) return [];
            const numericTeamId = Number.parseInt(teamId, 10);

            if (Number.isNaN(numericTeamId)) return [];

            const normalizedNurseIds = nurseIds.map((nurseId) => Number(nurseId)).filter((nurseId) => Number.isInteger(nurseId));

            return [[numericTeamId, normalizedNurseIds]] as const;
        });

        return Object.fromEntries(entries);
    } catch {
        return {};
    }
};

const TEAM_NAME_MAX_LENGTH = 12;
const MEMBER_GRID_PADDING_X = 'px-4';
const MEMBER_GRID_GAP_CLASS = 'gap-x-2';
const MEMBER_GRID_COLS_WITH_SKILL =
    'grid-cols-[24px_minmax(72px,0.9fr)_minmax(56px,0.66fr)_minmax(176px,1.75fr)_minmax(76px,0.78fr)_minmax(76px,0.78fr)_minmax(60px,0.64fr)_minmax(56px,0.58fr)_44px]';
const MEMBER_GRID_COLS_WITHOUT_SKILL =
    'grid-cols-[24px_minmax(72px,0.9fr)_minmax(176px,1.75fr)_minmax(76px,0.78fr)_minmax(76px,0.78fr)_minmax(60px,0.64fr)_minmax(56px,0.58fr)_44px]';
const MEMBER_SORT_OPTIONS: {value: TMemberNurseSortMode; label: string}[] = [
    {value: 'manual', label: '임의순'},
    {value: 'name', label: '가나다순'},
    {value: 'skill', label: '숙련도 순'},
];
const compareMemberNurseName = (left: TNurse, right: TNurse) => {
    const byName = left.name.localeCompare(right.name, 'ko-KR', {sensitivity: 'base'});

    if (byName !== 0) {
        return byName;
    }

    return left.nurseId - right.nurseId;
};
const compareMemberNurseSkill = (left: TNurse, right: TNurse, levelsByNurseId: Record<number, number>) => {
    const leftLevel = levelsByNurseId[left.nurseId] ?? Number.NEGATIVE_INFINITY;
    const rightLevel = levelsByNurseId[right.nurseId] ?? Number.NEGATIVE_INFINITY;

    if (rightLevel !== leftLevel) {
        return rightLevel - leftLevel;
    }

    return compareMemberNurseName(left, right);
};
const rgbToHex = ({red, green, blue}: {red: number; green: number; blue: number}) =>
    `#${[red, green, blue]
        .map((channel) =>
            Math.max(0, Math.min(255, Math.round(channel)))
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
const hexToRgb = (hexColor: string) => {
    const normalized = hexColor.replace('#', '');

    if (normalized.length !== 6) return null;

    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);

    if ([red, green, blue].some((channel) => Number.isNaN(channel))) return null;

    return {red, green, blue};
};
const interpolateHexColor = (from: string, to: string, ratio: number) => {
    const start = hexToRgb(from);
    const end = hexToRgb(to);

    if (!start || !end) return from;

    return rgbToHex({
        red: start.red + (end.red - start.red) * ratio,
        green: start.green + (end.green - start.green) * ratio,
        blue: start.blue + (end.blue - start.blue) * ratio,
    });
};
const tintHexColor = (hexColor: string, whiteRatio: number) => interpolateHexColor(hexColor, '#ffffff', whiteRatio);
const getWorkerBoundaryIndex = (orderedNurseIds: number[], isWorkerByNurseId: Map<number, boolean>) => {
    const firstOffIndex = orderedNurseIds.findIndex((nurseId) => !isWorkerByNurseId.get(nurseId));

    return firstOffIndex === -1 ? orderedNurseIds.length : firstOffIndex;
};

function MemberRoleHeaderHelp({
    type,
    openedType,
    onToggle,
}: {
    type: TNurseRoleHelpType;
    openedType: TNurseRoleHelpType | null;
    onToggle: (type: TNurseRoleHelpType) => void;
}) {
    const help = NURSE_ROLE_HELP[type];
    const isOpen = openedType === type;

    return (
        <span className="group relative inline-flex items-center justify-center gap-1">
            <span>{help.label}</span>
            <button
                type="button"
                aria-label={`${help.label} 설명`}
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
                {help.description}
            </span>
        </span>
    );
}

function MemberPage() {
    const {t} = useTypedTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        state: {watingNurses},
    } = useEditWard();
    const {
        state: {
            ward,
            shiftTeams,
            selectedNurse,
            selectedNurseDrawerMode,
            isNurseDraftDirty,
            isAddingNurse,
            nurseSaveStatus,
            isDeletingNurse,
        },
        actions: {
            selectNurse,
            setNurseDraftDirty,
            createShiftTeam,
            addNurse,
            deleteNurse,
            deleteShiftTeam,
            moveNurseOrder,
            updateShiftTeam,
            updateNurse,
            updateNurseShift,
            disconnectNurse,
        },
    } = useEditShiftTeam();
    const [activeShiftTeamId, setActiveShiftTeamId] = useState<number | null>(null);
    const [nurseSortMode, setNurseSortMode] = useState<TMemberNurseSortMode>('manual');
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const [skillSettings, setSkillSettings] = useState<TWardSkillSettings | null>(null);
    const [unselectedSkillNurseIds, setUnselectedSkillNurseIds] = useState<Set<number>>(new Set());
    const [pendingWorkerByNurseId, setPendingWorkerByNurseId] = useState<Record<number, boolean>>({});
    const [manualOrderByTeamId, setManualOrderByTeamId] = useState<Record<number, number[]>>({});
    const [skillModalOpen, setSkillModalOpen] = useState(false);
    const [openedRoleHelp, setOpenedRoleHelp] = useState<TNurseRoleHelpType | null>(null);
    const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
    const [editingTeamName, setEditingTeamName] = useState('');
    const [activeIndicatorStyle, setActiveIndicatorStyle] = useState<{left: number; width: number} | null>(null);
    const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
    const [showUnsavedGuardModal, setShowUnsavedGuardModal] = useState(false);
    const [connectionManageModalOpen, setConnectionManageModalOpen] = useState(false);
    const [wardCodeGuideOpen, setWardCodeGuideOpen] = useState(false);
    const hasInitializedSelectionRef = useRef(false);
    const rowRefByNurseId = useRef<Record<number, HTMLDivElement | null>>({});
    const previousTopByNurseIdRef = useRef<Record<number, number>>({});
    const previousNurseIdsRef = useRef<number[]>([]);
    const skipFlipAnimationOnceRef = useRef(false);
    const tabListRef = useRef<HTMLDivElement | null>(null);
    const teamNameInputRef = useRef<HTMLInputElement | null>(null);
    const tabButtonRefByTeamId = useRef<Record<number, HTMLButtonElement | null>>({});
    const pendingUnsavedActionRef = useRef<null | (() => void | Promise<void>)>(null);
    const selectedNurseDraftActionsRef = useRef<TNurseDraftActions | null>(null);
    const isRunningPendingUnsavedActionRef = useRef(false);
    const allNurses = useMemo(() => shiftTeams?.flatMap((shiftTeam) => shiftTeam.nurses) ?? [], [shiftTeams]);
    const wardId = ward?.wardId ?? null;
    const requestedShiftTeamId = useMemo(() => parsePositiveInt(searchParams.get('shiftTeamId')), [searchParams]);

    useEffect(() => {
        setSkillSettings(getWardSkillSettings(wardId));
    }, [wardId]);
    useEffect(() => {
        if (!wardId) {
            setManualOrderByTeamId({});
            return;
        }

        const stored = localStorage.getItem(getMemberManualOrderStorageKey(wardId));
        setManualOrderByTeamId(parseManualOrderByTeamId(stored));
    }, [wardId]);
    useEffect(() => {
        if (!wardId) return;

        localStorage.setItem(getMemberManualOrderStorageKey(wardId), JSON.stringify(manualOrderByTeamId));
    }, [manualOrderByTeamId, wardId]);
    useEffect(() => {
        if (hasInitializedSelectionRef.current) {
            return;
        }

        hasInitializedSelectionRef.current = true;
        selectNurse(null);
    }, [selectNurse]);

    const {config: skillConfig, levelsByNurseId} = useMemo(
        () => resolveWardSkillLevels(allNurses, skillSettings),
        [allNurses, skillSettings],
    );
    const isSkillFeatureEnabled = skillConfig.enabled;
    const availableSortOptions = useMemo(
        () => (isSkillFeatureEnabled ? MEMBER_SORT_OPTIONS : MEMBER_SORT_OPTIONS.filter((option) => option.value !== 'skill')),
        [isSkillFeatureEnabled],
    );
    const activeShiftTeam = useMemo(
        () => shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === activeShiftTeamId) ?? shiftTeams?.[0],
        [activeShiftTeamId, shiftTeams],
    );
    const displayedNurses = useMemo(() => {
        const teamNurses = [...(activeShiftTeam?.nurses ?? [])];
        const teamId = activeShiftTeam?.shiftTeamId;

        if (!teamId) return teamNurses;

        const manualOrder = manualOrderByTeamId[teamId] ?? teamNurses.map((nurse) => nurse.nurseId);
        const nurseById = new Map(teamNurses.map((nurse) => [nurse.nurseId, nurse]));
        const manualSorted = manualOrder.map((id) => nurseById.get(id)).filter((nurse): nurse is TNurse => Boolean(nurse));
        const remaining = teamNurses.filter((nurse) => !manualOrder.includes(nurse.nurseId));
        const baseNurses = [...manualSorted, ...remaining];
        const isEffectiveWorker = (nurse: TNurse) => pendingWorkerByNurseId[nurse.nurseId] ?? nurse.isWorker;
        const onNurses = baseNurses.filter((nurse) => isEffectiveWorker(nurse));
        const offNurses = baseNurses.filter((nurse) => !isEffectiveWorker(nurse));

        if (nurseSortMode === 'manual') {
            return onNurses.concat(offNurses);
        }

        const comparator =
            nurseSortMode === 'name'
                ? compareMemberNurseName
                : (left: TNurse, right: TNurse) => compareMemberNurseSkill(left, right, levelsByNurseId as Record<number, number>);

        return [...onNurses].sort(comparator).concat([...offNurses].sort(comparator));
    }, [
        activeShiftTeam?.nurses,
        activeShiftTeam?.shiftTeamId,
        levelsByNurseId,
        manualOrderByTeamId,
        nurseSortMode,
        pendingWorkerByNurseId,
    ]);
    const activeTeamNurseCount = activeShiftTeam?.nurseCnt ?? activeShiftTeam?.nurses.length ?? 0;
    const isActiveTeamEmpty = activeTeamNurseCount === 0;

    useEffect(() => {
        if (!shiftTeams?.length) {
            setActiveShiftTeamId(null);
            return;
        }

        const requestedShiftTeam = requestedShiftTeamId
            ? shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === requestedShiftTeamId)
            : null;

        if (requestedShiftTeam) {
            if (activeShiftTeamId !== requestedShiftTeam.shiftTeamId) {
                selectNurse(null);
                setActiveShiftTeamId(requestedShiftTeam.shiftTeamId);
            }

            return;
        }

        // Keep the currently selected team unless it disappears.
        if (activeShiftTeamId && shiftTeams.some((shiftTeam) => shiftTeam.shiftTeamId === activeShiftTeamId)) {
            return;
        }

        // Initial fallback: follow selected nurse's team if present, else first team.
        if (selectedNurse) {
            const selectedShiftTeam = shiftTeams.find((shiftTeam) =>
                shiftTeam.nurses.some((nurse) => nurse.nurseId === selectedNurse.nurseId),
            );

            if (selectedShiftTeam) {
                setActiveShiftTeamId(selectedShiftTeam.shiftTeamId);
                return;
            }
        }

        setActiveShiftTeamId(shiftTeams[0].shiftTeamId);
    }, [activeShiftTeamId, requestedShiftTeamId, selectNurse, selectedNurse, shiftTeams]);

    useEffect(() => {
        if (!sortMenuOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (sortMenuRef.current?.contains(event.target as Node)) return;

            setSortMenuOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);

        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [sortMenuOpen]);
    useEffect(() => {
        if (isSkillFeatureEnabled) return;
        if (nurseSortMode !== 'skill') return;

        setNurseSortMode('manual');
    }, [isSkillFeatureEnabled, nurseSortMode]);
    useEffect(() => {
        if (!editingTeamId) {
            return;
        }

        const timer = setTimeout(() => {
            teamNameInputRef.current?.focus();
            teamNameInputRef.current?.select();
        }, 0);

        return () => clearTimeout(timer);
    }, [editingTeamId]);
    useLayoutEffect(() => {
        const currentTeamId = activeShiftTeam?.shiftTeamId;

        if (!currentTeamId) {
            setActiveIndicatorStyle(null);

            return;
        }

        const containerElement = tabListRef.current;
        const activeButtonElement = tabButtonRefByTeamId.current[currentTeamId];

        if (!containerElement || !activeButtonElement) return;

        const containerRect = containerElement.getBoundingClientRect();
        const activeRect = activeButtonElement.getBoundingClientRect();

        setActiveIndicatorStyle({
            left: activeRect.left - containerRect.left + containerElement.scrollLeft,
            width: activeRect.width,
        });
    }, [activeShiftTeam?.shiftTeamId, editingTeamId, editingTeamName, shiftTeams]);

    useEffect(() => {
        if (!isActiveTeamEmpty) return;

        setSortMenuOpen(false);
    }, [isActiveTeamEmpty]);
    useEffect(() => {
        if (!selectedNurse || selectedNurseDrawerMode !== 'create') return;

        setUnselectedSkillNurseIds((prev) => {
            if (prev.has(selectedNurse.nurseId)) return prev;

            const next = new Set(prev);
            next.add(selectedNurse.nurseId);

            return next;
        });
    }, [selectedNurse, selectedNurseDrawerMode]);
    useLayoutEffect(() => {
        const nextTopByNurseId: Record<number, number> = {};
        const currentNurseIds = displayedNurses.map((nurse) => nurse.nurseId);
        const previousNurseIds = previousNurseIdsRef.current;
        const hasStructuralListChange =
            previousNurseIds.length !== currentNurseIds.length ||
            previousNurseIds.some((nurseId) => !currentNurseIds.includes(nurseId)) ||
            currentNurseIds.some((nurseId) => !previousNurseIds.includes(nurseId));
        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const shouldSkipFlipAnimation = skipFlipAnimationOnceRef.current || hasStructuralListChange;

        displayedNurses.forEach((nurse) => {
            const rowElement = rowRefByNurseId.current[nurse.nurseId];

            if (!rowElement) {
                return;
            }

            // Use layout position not visual (transformed) position to avoid
            // re-triggering FLIP while a previous transform animation is still running.
            const nextTop = rowElement.offsetTop;
            const previousTop = previousTopByNurseIdRef.current[nurse.nurseId];

            nextTopByNurseId[nurse.nurseId] = nextTop;

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
        previousNurseIdsRef.current = currentNurseIds;
    }, [displayedNurses]);
    useEffect(() => {
        const skipFlipForReentry = () => {
            skipFlipAnimationOnceRef.current = true;
            previousTopByNurseIdRef.current = {};
            previousNurseIdsRef.current = [];

            requestAnimationFrame(() => {
                skipFlipAnimationOnceRef.current = false;
            });
        };

        // Initial mount.
        skipFlipForReentry();

        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            skipFlipForReentry();
        };

        window.addEventListener('pageshow', skipFlipForReentry);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.removeEventListener('pageshow', skipFlipForReentry);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);
    useEffect(() => {
        const teamId = activeShiftTeam?.shiftTeamId;

        if (!teamId) return;

        setManualOrderByTeamId((prev) => {
            if (prev[teamId]?.length) return prev;

            return {...prev, [teamId]: (activeShiftTeam?.nurses ?? []).map((nurse) => nurse.nurseId)};
        });
    }, [activeShiftTeam]);

    const handleDismissDetailPanel = () => {
        selectNurse(null);

        return true;
    };
    const handleRegisterNurseDraftActions = useCallback((actions: TNurseDraftActions | null) => {
        selectedNurseDraftActionsRef.current = actions;
    }, []);
    const cancelPendingUnsavedAction = () => {
        pendingUnsavedActionRef.current = null;
        setShowUnsavedGuardModal(false);
    };
    const runPendingUnsavedAction = async () => {
        const pendingAction = pendingUnsavedActionRef.current;

        pendingUnsavedActionRef.current = null;

        if (!pendingAction) return;

        isRunningPendingUnsavedActionRef.current = true;

        try {
            await pendingAction();
        } finally {
            isRunningPendingUnsavedActionRef.current = false;
        }
    };
    const discardDraftAndRunPendingAction = async () => {
        setShowUnsavedGuardModal(false);
        selectedNurseDraftActionsRef.current?.discard();
        setNurseDraftDirty(false);
        await runPendingUnsavedAction();
    };
    const saveDraftAndRunPendingAction = async () => {
        const saveDraft = selectedNurseDraftActionsRef.current?.save;

        if (!saveDraft) {
            pendingUnsavedActionRef.current = null;

            return;
        }

        setShowUnsavedGuardModal(false);

        const saved = await saveDraft();

        if (!saved) {
            pendingUnsavedActionRef.current = null;

            return;
        }

        setNurseDraftDirty(false);
        await runPendingUnsavedAction();
    };
    const shouldBlockForUnsavedChanges = (nextAction: () => void | Promise<void>) => {
        if (isRunningPendingUnsavedActionRef.current) return false;

        if (!isNurseDraftDirty) return false;

        pendingUnsavedActionRef.current = nextAction;
        setShowUnsavedGuardModal(true);

        return true;
    };
    const handleSelectTeam = (shiftTeamId: number) => {
        if (!shiftTeams) return;

        if (
            shouldBlockForUnsavedChanges(() => {
                handleSelectTeam(shiftTeamId);
            })
        )
            return;

        selectNurse(null);
        setActiveShiftTeamId(shiftTeamId);

        const nextSearchParams = new URLSearchParams(searchParams);

        nextSearchParams.set('shiftTeamId', String(shiftTeamId));
        setSearchParams(nextSearchParams, {replace: true});
    };
    const handleSaveSkillSettings = (nextConfig: TWardSkillSettings['config']) => {
        if (!wardId) return;

        const nextSettings = createWardSkillSettings(allNurses, nextConfig, skillSettings);

        saveWardSkillSettings(wardId, nextSettings);
        setSkillSettings(nextSettings);
    };
    const handleDisableSkillFeature = () => {
        if (!wardId) return;

        const nextSettings = createWardSkillSettings(
            allNurses,
            {
                ...skillConfig,
                enabled: false,
                autoAssign: false,
            },
            skillSettings,
        );

        nextSettings.frozenLevelsByNurseId = {};
        saveWardSkillSettings(wardId, nextSettings);
        setSkillSettings(nextSettings);
        setNurseSortMode('manual');
    };
    const handleDeleteActiveTeam = async () => {
        if (
            shouldBlockForUnsavedChanges(async () => {
                await handleDeleteActiveTeam();
            })
        )
            return;
        if (!activeShiftTeam) return;
        const deletingTeamName = activeShiftTeam.name;

        if ((activeShiftTeam.nurseCnt ?? activeShiftTeam.nurses.length) === 0) {
            if (selectedNurse?.shiftTeamId === activeShiftTeam.shiftTeamId) {
                const canClose = selectNurse(null);

                if (!canClose) {
                    return;
                }
            }

            await deleteShiftTeam(activeShiftTeam.shiftTeamId);
            toast.success(`${deletingTeamName} 팀을 삭제했어요.`);

            return;
        }

        setShowDeleteTeamModal(true);

        return;
    };
    const handleSubmitTeamRename = async (shiftTeamId: number, currentName: string) => {
        const nextName = editingTeamName.trim();
        const isDuplicate = shiftTeams?.some((candidate) => candidate.shiftTeamId !== shiftTeamId && candidate.name.trim() === nextName);

        if (!nextName || isDuplicate || nextName === currentName.trim()) {
            setEditingTeamId(null);

            return;
        }

        await updateShiftTeam(shiftTeamId, {name: nextName});
        setEditingTeamId(null);
    };
    const handleDragEnd = (result: DropResult) => {
        const teamId = activeShiftTeam?.shiftTeamId;
        const {source, destination} = result;

        if (!teamId || !destination || source.index === destination.index) return;

        skipFlipAnimationOnceRef.current = true;
        setNurseSortMode('manual');
        setManualOrderByTeamId((prev) => {
            // Always reorder from the currently rendered order to avoid stale manual order drift.
            const current = displayedNurses.map((nurse) => nurse.nurseId);
            const next = [...current];
            const [moved] = next.splice(source.index, 1);

            if (moved == null) return prev;

            next.splice(destination.index, 0, moved);

            return {...prev, [teamId]: next};
        });

        requestAnimationFrame(() => {
            skipFlipAnimationOnceRef.current = false;
        });
    };
    const reorderNurseForWorkerToggle = (teamId: number, nurseId: number, isWorker: boolean) => {
        setNurseSortMode('manual');
        setManualOrderByTeamId((prev) => {
            const teamNurses = shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === teamId)?.nurses ?? [];
            const teamNurseIds = teamNurses.map((nurse) => nurse.nurseId);
            const renderedOrderForActiveTeam =
                activeShiftTeam?.shiftTeamId === teamId ? displayedNurses.map((nurse) => nurse.nurseId) : undefined;
            const currentOrder = renderedOrderForActiveTeam?.length ? renderedOrderForActiveTeam : (prev[teamId] ?? teamNurseIds);
            const mergedOrder = [...currentOrder, ...teamNurseIds.filter((id) => !currentOrder.includes(id))];
            const nextOrder = mergedOrder.filter((id) => id !== nurseId);
            const isWorkerByNurseId = new Map(teamNurses.map((nurse) => [nurse.nurseId, nurse.isWorker]));

            isWorkerByNurseId.set(nurseId, isWorker);

            nextOrder.splice(getWorkerBoundaryIndex(nextOrder, isWorkerByNurseId), 0, nurseId);

            return {...prev, [teamId]: nextOrder};
        });
    };
    const handleUpdateNurse = async (nurse: TNurse, nextNurse: TNurse) => {
        const isWorkerChanged = nurse.isWorker !== nextNurse.isWorker;

        if (isWorkerChanged && nurse.shiftTeamId != null) {
            setPendingWorkerByNurseId((prev) => ({...prev, [nurse.nurseId]: nextNurse.isWorker}));
            // Reorder immediately so the row transitions once into the target worker group.
            reorderNurseForWorkerToggle(nurse.shiftTeamId, nurse.nurseId, nextNurse.isWorker);
        }

        const saved = await updateNurse(nurse.nurseId, nextNurse);

        if (!saved) {
            if (isWorkerChanged && nurse.shiftTeamId != null) {
                // Roll back local manual ordering if the worker toggle failed to persist.
                reorderNurseForWorkerToggle(nurse.shiftTeamId, nurse.nurseId, nurse.isWorker);
                setPendingWorkerByNurseId((prev) => {
                    const next = {...prev};
                    delete next[nurse.nurseId];

                    return next;
                });
            }

            return false;
        }

        return true;
    };
    useEffect(() => {
        if (Object.keys(pendingWorkerByNurseId).length === 0) {
            return;
        }

        setPendingWorkerByNurseId((prev) => {
            const next = {...prev};
            let changed = false;

            allNurses.forEach((nurse) => {
                const pending = next[nurse.nurseId];

                if (pending == null) return;
                if (pending !== nurse.isWorker) return;

                delete next[nurse.nurseId];
                changed = true;
            });

            return changed ? next : prev;
        });
    }, [allNurses, pendingWorkerByNurseId]);
    const handleCreateShiftTeam = async () => {
        if (
            shouldBlockForUnsavedChanges(async () => {
                await handleCreateShiftTeam();
            })
        )
            return;

        const teamCount = shiftTeams?.length ?? 0;

        if (teamCount >= MAX_ONBOARDING_TEAMS) {
            toast.error('팀은 최대 8개까지 추가할 수 있어요.');

            return;
        }

        const createdShiftTeam = await createShiftTeam();
        if (createdShiftTeam?.shiftTeamId) {
            setActiveShiftTeamId(createdShiftTeam.shiftTeamId);
            selectNurse(null);

            const nextSearchParams = new URLSearchParams(searchParams);

            nextSearchParams.set('shiftTeamId', String(createdShiftTeam.shiftTeamId));
            setSearchParams(nextSearchParams, {replace: true});
        }
        sendEvent(events.memberPage.createShiftTeam);
        toast.success(`간호사 ${teamCount + 1}팀을 추가했어요.`, {position: 'bottom-center'});
    };
    const modalRoot = document.getElementById('modal-root') ?? document.body;

    const handleAddNurse = async () => {
        if (
            shouldBlockForUnsavedChanges(async () => {
                await handleAddNurse();
            })
        )
            return;
        if (!activeShiftTeam) return;

        const activeTeamNurseCount = activeShiftTeam.nurses.length;

        if (activeTeamNurseCount >= MAX_ONBOARDING_NURSES) {
            toast.error('한 팀에는 간호사를 최대 40명까지 추가할 수 있어요.');

            return;
        }

        await addNurse(activeShiftTeam.shiftTeamId);
    };
    const handleMoveSelectedNurseToTeam = async (nextShiftTeamId: number) => {
        if (
            shouldBlockForUnsavedChanges(async () => {
                await handleMoveSelectedNurseToTeam(nextShiftTeamId);
            })
        )
            return false;
        if (!selectedNurse || !shiftTeams) return false;

        const payload = createMoveNurseToTeamPayload({
            shiftTeams,
            nurseId: selectedNurse.nurseId,
            destinationShiftTeamId: nextShiftTeamId,
        });
        const destinationShiftTeam = shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === nextShiftTeamId);

        if (!payload || !destinationShiftTeam) return false;

        const moved = await moveNurseOrder(
            payload.nurseId,
            payload.sourceShiftTeamId,
            payload.destinationShiftTeamId,
            payload.divisionNum,
            payload.prevPriority,
            payload.nextPriority,
            DateUtil.getDateString(new Date(), 'yyyy-MM'),
        );

        if (!moved) return false;

        setNurseSortMode('manual');
        setActiveShiftTeamId(nextShiftTeamId);
        setManualOrderByTeamId((prev) => {
            const sourceTeam = shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === payload.sourceShiftTeamId);
            const sourceOrder = prev[payload.sourceShiftTeamId] ?? sourceTeam?.nurses.map((nurse) => nurse.nurseId) ?? [];
            const destinationOrder = prev[payload.destinationShiftTeamId] ?? destinationShiftTeam.nurses.map((nurse) => nurse.nurseId);

            return {
                ...prev,
                [payload.sourceShiftTeamId]: sourceOrder.filter((nurseId) => nurseId !== selectedNurse.nurseId),
                [payload.destinationShiftTeamId]: [
                    ...destinationOrder.filter((nurseId) => nurseId !== selectedNurse.nurseId),
                    selectedNurse.nurseId,
                ],
            };
        });

        sendEvent(events.memberPage.moveNurse);
        toast.success(
            `${selectedNurse.name.trim() ? selectedNurse.name : '선택한 간호사'}를 ${destinationShiftTeam.name} 팀으로 이동했어요.`,
        );

        return true;
    };
    const totalNurseCount = allNurses.length;
    const connectedNurseCount = allNurses.filter((nurse) => nurse.isConnected).length;
    const unconnectedNurseCount = Math.max(0, totalNurseCount - connectedNurseCount);
    const hospitalName = ward?.hospitalName?.trim() || '-';
    const wardName = ward?.name?.trim() || '-';
    const wardGuideTitle = getWardDisplayTitle(ward);
    const wardGuideCode = getWardDisplayCode(ward, '-');

    return (
        <div className="min-h-screen bg-main-bg [&_button:not(:disabled)]:cursor-pointer">
            <WardCodeGuideModal
                open={wardCodeGuideOpen}
                wardCode={wardGuideCode}
                wardTitle={wardGuideTitle}
                onClose={() => setWardCodeGuideOpen(false)}
            />
            {showDeleteTeamModal && activeShiftTeam
                ? createPortal(
                      <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
                          <div role="dialog" aria-modal="true" className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5">
                              <p className="font-apple text-[20px] font-semibold text-sub-1">팀을 삭제할까요?</p>
                              <p className="mt-2 font-apple text-[15px] text-gray-3">
                                  <span className="font-semibold text-sub-1">{activeShiftTeam.name}</span>
                                  {` 팀을 삭제하면 소속 간호사 ${activeTeamNurseCount}명도 함께 삭제돼요.`}
                              </p>
                              <div className="mt-6 flex items-center gap-3">
                                  <button
                                      type="button"
                                      className="h-11 flex-1 rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                      onClick={() => setShowDeleteTeamModal(false)}
                                  >
                                      닫기
                                  </button>
                                  <button
                                      type="button"
                                      className="h-11 flex-1 rounded-[10px] bg-[#D14343] px-6 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                      onClick={async () => {
                                          setShowDeleteTeamModal(false);

                                          if (selectedNurse?.shiftTeamId === activeShiftTeam.shiftTeamId) {
                                              const canClose = selectNurse(null);

                                              if (!canClose) {
                                                  return;
                                              }
                                          }

                                          await deleteShiftTeam(activeShiftTeam.shiftTeamId);
                                          toast.success(`${activeShiftTeam.name} 팀을 삭제했어요.`);
                                      }}
                                  >
                                      삭제하기
                                  </button>
                              </div>
                          </div>
                      </div>,
                      modalRoot,
                  )
                : null}
            {showUnsavedGuardModal
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]"
                          onClick={cancelPendingUnsavedAction}
                      >
                          <div
                              role="dialog"
                              aria-modal="true"
                              className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5"
                              onClick={(event) => event.stopPropagation()}
                          >
                              <p className="font-apple text-[20px] font-semibold text-sub-1">저장하지 않고 나갈까요?</p>
                              <p className="mt-2 font-apple text-[15px] text-gray-3">변경사항이 저장되지 않을 수 있어요.</p>
                              <div className="mt-6 grid grid-cols-3 gap-2">
                                  <button
                                      type="button"
                                      className="h-11 rounded-[10px] bg-[#F3F4F6] px-4 font-apple text-[15px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                      onClick={cancelPendingUnsavedAction}
                                  >
                                      취소
                                  </button>
                                  <button
                                      type="button"
                                      className="h-11 rounded-[10px] bg-[#FFF5F5] px-4 font-apple text-[15px] font-semibold text-[#D14343] transition-colors hover:bg-[#FEECEC]"
                                      onClick={() => void discardDraftAndRunPendingAction()}
                                  >
                                      저장 안 함
                                  </button>
                                  <button
                                      type="button"
                                      className="h-11 rounded-[10px] bg-main-1 px-4 font-apple text-[15px] font-semibold text-white transition-colors hover:bg-main-2"
                                      onClick={() => void saveDraftAndRunPendingAction()}
                                  >
                                      저장 후 나가기
                                  </button>
                              </div>
                          </div>
                      </div>,
                      modalRoot,
                  )
                : null}
            <div className="mx-auto flex min-h-screen w-full max-w-[1560px] min-w-[1280px] gap-4 overflow-visible px-6 pt-11 pb-12 min-[1440px]:min-w-[1360px] min-[1440px]:gap-5 min-[1440px]:px-10 min-[1440px]:pt-[52px] min-[1440px]:pb-14">
                <section className="min-w-[840px] flex-1">
                    <div id="ward_info" className="flex min-w-0 items-center gap-4 min-[1440px]:gap-5">
                        <div className="shrink-0">
                            <h1 className="font-apple text-[30px] font-semibold text-text-1 min-[1440px]:text-[32px]">
                                {t('page.member.title')}
                            </h1>
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5 min-[1440px]:gap-2">
                            <div className="flex h-11 max-w-[360px] min-w-[300px] items-center justify-center rounded-[10px] bg-white px-3 min-[1440px]:h-[46px] min-[1440px]:max-w-none min-[1440px]:min-w-[370px] min-[1440px]:px-4">
                                <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 pr-3 min-[1440px]:gap-2 min-[1440px]:pr-4">
                                    <span className="truncate font-apple text-[15px] leading-none font-semibold text-[#616C84] min-[1440px]:text-[16px]">
                                        {hospitalName}
                                    </span>
                                    <span className="truncate font-apple text-[15px] leading-none font-semibold text-[#616C84] min-[1440px]:text-[16px]">
                                        {wardName}
                                    </span>
                                </div>
                                <span className="h-[20px] w-px shrink-0 bg-[#C8CFDB]" />
                                <div className="flex shrink-0 items-center justify-center gap-2 pl-3 min-[1440px]:gap-3 min-[1440px]:pl-4">
                                    <div className="flex items-baseline gap-1.5 whitespace-nowrap min-[1440px]:gap-2">
                                        <span className="font-apple text-[13px] font-normal text-[#8A94A8] min-[1440px]:text-[14px]">
                                            전체 인원
                                        </span>
                                        <span className="font-poppins text-[15px] leading-none font-bold text-[#657084] min-[1440px]:text-[16px]">
                                            {totalNurseCount}
                                        </span>
                                    </div>
                                    <span className="h-[20px] w-px shrink-0 bg-[#C8CFDB]" />
                                    <div className="flex items-baseline gap-1.5 whitespace-nowrap min-[1440px]:gap-2">
                                        <span className="font-apple text-[13px] font-normal text-[#8A94A8] min-[1440px]:text-[14px]">
                                            연동됨
                                        </span>
                                        <span className="font-poppins text-[15px] leading-none font-bold text-[#657084] min-[1440px]:text-[16px]">
                                            {connectedNurseCount}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5 whitespace-nowrap min-[1440px]:gap-2">
                                        <span className="font-apple text-[13px] font-normal text-[#8A94A8] min-[1440px]:text-[14px]">
                                            미연동
                                        </span>
                                        <span className="font-poppins text-[15px] leading-none font-bold text-[#657084] min-[1440px]:text-[16px]">
                                            {unconnectedNurseCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div
                                role="button"
                                tabIndex={0}
                                aria-label={`병동코드 ${wardGuideCode} 안내 보기`}
                                className="flex h-11 shrink-0 cursor-pointer items-center rounded-[10px] border border-[#D6DDEA] bg-white px-3 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-colors hover:bg-[#F7F8FA] focus-visible:outline-2 focus-visible:outline-main-1 min-[1440px]:h-[46px] min-[1440px]:px-4"
                                onClick={() => setWardCodeGuideOpen(true)}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;

                                    if (event.key !== 'Enter' && event.key !== ' ') return;

                                    event.preventDefault();
                                    setWardCodeGuideOpen(true);
                                }}
                            >
                                <span className="font-apple text-[13px] text-[#8A94A8] min-[1440px]:text-[14px]">병동 코드</span>
                                <span className="ml-2 font-poppins text-[15px] font-bold text-main-1 min-[1440px]:text-[16px]">
                                    {wardGuideCode}
                                </span>
                                <button
                                    type="button"
                                    className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-[#8A94A8] transition-colors hover:bg-[#F2F4F8] hover:text-[#657084] focus-visible:outline-2 focus-visible:outline-main-1"
                                    aria-label="병동 코드 복사"
                                    onClick={async (event) => {
                                        event.stopPropagation();

                                        if (!ward?.code) return;

                                        await navigator.clipboard.writeText(ward.code);
                                        toast.success('병동 코드를 복사했어요.');
                                    }}
                                >
                                    <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                                </button>
                            </div>
                            <button
                                type="button"
                                className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#D6DDEA] bg-white px-3 font-apple text-[13px] font-medium text-[#657084] shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-colors hover:bg-[#F7F8FA] focus-visible:outline-2 focus-visible:outline-main-1 min-[1440px]:h-[46px] min-[1440px]:px-4 min-[1440px]:text-[14px]"
                                onClick={() => setConnectionManageModalOpen(true)}
                            >
                                {(watingNurses?.length ?? 0) > 0 ? (
                                    <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E97A84] px-1.5 font-poppins text-[11px] leading-none font-bold text-white">
                                        {watingNurses?.length}
                                    </span>
                                ) : null}
                                연동관리
                                <Link2 className="h-[18px] w-[18px] text-main-1 min-[1440px]:h-5 min-[1440px]:w-5" strokeWidth={2.8} />
                            </button>
                        </div>
                        <button
                            id="member_skill_settings_button"
                            type="button"
                            aria-label={t('page.member.skillSettings')}
                            title={t('page.member.skillSettings')}
                            className={cn(
                                'ml-auto flex h-10 w-10 shrink-0 items-center justify-center gap-0 rounded-[8px] bg-[#F3EEFF] px-0 font-apple text-[14px] font-medium text-[#6746C3] transition-colors hover:bg-[#E9DFFF] focus-visible:outline-2 focus-visible:outline-main-1 min-[1440px]:h-[42px]',
                                selectedNurse
                                    ? 'min-[1440px]:w-[42px] min-[1440px]:px-0'
                                    : 'min-[1440px]:w-auto min-[1440px]:gap-1.5 min-[1440px]:px-4',
                            )}
                            onClick={() => setSkillModalOpen(true)}
                        >
                            <span className={cn('hidden', !selectedNurse && 'min-[1440px]:inline')}>{t('page.member.skillSettings')}</span>
                            <Settings2 className="h-5 w-5 text-[#7658D8]" />
                        </button>
                    </div>
                    <ConnectionManage open={connectionManageModalOpen} setOpen={setConnectionManageModalOpen} />

                    <div className="mt-8">
                        <div
                            id="shift_team_list"
                            className="flex w-full min-w-0 items-center rounded-[12px] border border-[#4F5A71] bg-[#3D4658] p-0.5"
                        >
                            <div
                                ref={tabListRef}
                                className="relative scrollbar-hide flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto"
                            >
                                {activeIndicatorStyle ? (
                                    <span
                                        className="pointer-events-none absolute top-1/2 z-0 h-8 -translate-y-1/2 rounded-[9px] bg-white transition-[left,width] duration-250 ease-out will-change-[left,width]"
                                        style={{
                                            left: activeIndicatorStyle.left,
                                            width: activeIndicatorStyle.width,
                                        }}
                                    />
                                ) : null}
                                {shiftTeams?.map((shiftTeam) => {
                                    const isActive = shiftTeam.shiftTeamId === activeShiftTeam?.shiftTeamId;
                                    const isEditing = editingTeamId === shiftTeam.shiftTeamId;

                                    return (
                                        <button
                                            key={shiftTeam.shiftTeamId}
                                            type="button"
                                            ref={(element) => {
                                                tabButtonRefByTeamId.current[shiftTeam.shiftTeamId] = element;
                                            }}
                                            aria-pressed={isActive}
                                            className={cn(
                                                'relative z-10 flex h-8 shrink-0 items-center justify-center gap-1 rounded-[9px] px-3.5 font-apple text-[14px] leading-none font-semibold',
                                                isActive ? 'text-[#111827]' : 'text-[#AEB7C7] hover:text-[#D2D9E5]',
                                            )}
                                            onClick={() => {
                                                if (!isActive) {
                                                    setEditingTeamId(null);
                                                    handleSelectTeam(shiftTeam.shiftTeamId);

                                                    return;
                                                }

                                                if (isEditing) {
                                                    return;
                                                }

                                                setEditingTeamId(shiftTeam.shiftTeamId);
                                                setEditingTeamName(shiftTeam.name);
                                            }}
                                        >
                                            {isEditing ? (
                                                <input
                                                    ref={teamNameInputRef}
                                                    value={editingTeamName}
                                                    maxLength={TEAM_NAME_MAX_LENGTH}
                                                    className="border-0 bg-transparent text-center font-apple text-[14px] font-semibold text-[#111827] outline-none"
                                                    style={{width: `${Math.max(6, Math.min(18, editingTeamName.length + 1))}ch`}}
                                                    onChange={(event) => setEditingTeamName(event.target.value)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onBlur={() => void handleSubmitTeamRename(shiftTeam.shiftTeamId, shiftTeam.name)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Escape') {
                                                            setEditingTeamId(null);
                                                        }

                                                        if (event.key === 'Enter') {
                                                            void handleSubmitTeamRename(shiftTeam.shiftTeamId, shiftTeam.name);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <span>{shiftTeam.name}</span>
                                            )}
                                            {isActive && !isEditing ? (
                                                <span className="flex items-center gap-1 font-poppins text-[14px] font-semibold">
                                                    <PersonIcon className="h-[18px] w-[18px] text-[#37404F]" />
                                                    {shiftTeam.nurses.length}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                className="group ml-2 flex h-8 shrink-0 items-center rounded-[9px] px-2 font-apple text-[14px] font-medium text-[#D2D9E5] transition-colors hover:text-white"
                                onClick={() => void handleCreateShiftTeam()}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#CFD6DF] transition-colors group-hover:bg-[#EEF2F6]">
                                        <Plus className="h-[12px] w-[12px] text-[#4F5A71]" strokeWidth={3} />
                                    </span>
                                    {t('page.member.addTeam')}
                                </span>
                            </button>
                        </div>
                    </div>

                    {!isActiveTeamEmpty ? (
                        <div className="mt-6 flex items-center justify-end gap-4">
                            <div ref={sortMenuRef} className="relative">
                                {(() => {
                                    const selectedSortOption = availableSortOptions.find((option) => option.value === nurseSortMode);

                                    return (
                                        <>
                                            <button
                                                type="button"
                                                aria-haspopup="listbox"
                                                aria-expanded={sortMenuOpen}
                                                aria-label={t('page.member.sortListMenuAria')}
                                                className={cn(
                                                    'flex h-8 min-w-[112px] items-center justify-between gap-3 rounded-[5px] bg-gray-6 px-3 font-apple text-[16px] text-gray-3 transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                                    sortMenuOpen
                                                        ? 'bg-white text-sub-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]'
                                                        : 'hover:bg-gray-7',
                                                )}
                                                onClick={() => {
                                                    setSortMenuOpen((prev) => !prev);
                                                }}
                                            >
                                                <span>
                                                    {selectedSortOption?.label ??
                                                        availableSortOptions[0]?.label ??
                                                        MEMBER_SORT_OPTIONS[0].label}
                                                </span>
                                                <ChevronDown
                                                    aria-hidden="true"
                                                    className={cn('h-4 w-4 shrink-0 transition-transform', sortMenuOpen && 'rotate-180')}
                                                />
                                            </button>
                                            {sortMenuOpen ? (
                                                <div
                                                    role="listbox"
                                                    className="absolute top-full right-0 z-20 mt-1 w-[150px] animate-in overflow-hidden rounded-[10px] border border-gray-6 bg-white py-1 shadow-[0px_10px_28px_rgba(95,100,135,0.16)] duration-150 fade-in-0 zoom-in-95 slide-in-from-top-1"
                                                >
                                                    {availableSortOptions.map((option) => {
                                                        const isSelected = nurseSortMode === option.value;

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
                                                                    setNurseSortMode(option.value);
                                                                    setSortMenuOpen(false);
                                                                }}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-2 rounded-[15px]">
                        {!isActiveTeamEmpty ? (
                            <div
                                className={cn(
                                    'grid items-center py-3 font-apple text-[16px] text-gray-3',
                                    MEMBER_GRID_GAP_CLASS,
                                    MEMBER_GRID_PADDING_X,
                                    isSkillFeatureEnabled ? MEMBER_GRID_COLS_WITH_SKILL : MEMBER_GRID_COLS_WITHOUT_SKILL,
                                )}
                            >
                                <span />
                                <span className="text-center">{t('page.member.table.name')}</span>
                                {isSkillFeatureEnabled ? <span className="text-center">{t('page.member.table.level')}</span> : null}
                                <span className="text-center">{t('page.member.table.shiftTypes')}</span>
                                <span className="flex justify-center text-center">
                                    <MemberRoleHeaderHelp
                                        type="preceptor"
                                        openedType={openedRoleHelp}
                                        onToggle={(type) => setOpenedRoleHelp((prev) => (prev === type ? null : type))}
                                    />
                                </span>
                                <span className="flex justify-center text-center">
                                    <MemberRoleHeaderHelp
                                        type="preceptee"
                                        openedType={openedRoleHelp}
                                        onToggle={(type) => setOpenedRoleHelp((prev) => (prev === type ? null : type))}
                                    />
                                </span>
                                <span className="text-center">{t('page.member.table.isWorker')}</span>
                                <span className="text-center">{t('page.member.table.connection')}</span>
                                <span />
                            </div>
                        ) : null}

                        <div className="space-y-2 pb-4">
                            {!isActiveTeamEmpty ? (
                                <DragDropContext onDragEnd={handleDragEnd}>
                                    <Droppable droppableId={String(activeShiftTeam?.shiftTeamId ?? 0)}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                                                {displayedNurses.map((nurse, index) => (
                                                    <Draggable key={nurse.nurseId} draggableId={String(nurse.nurseId)} index={index}>
                                                        {(dragProvided) => (
                                                            <MemberNurseRow
                                                                rowId={index === 0 ? 'nurse_sample' : undefined}
                                                                nurse={nurse}
                                                                isWorker={pendingWorkerByNurseId[nurse.nurseId] ?? nurse.isWorker}
                                                                isSelected={selectedNurse?.nurseId === nurse.nurseId}
                                                                isSkillUnselected={unselectedSkillNurseIds.has(nurse.nurseId)}
                                                                isSkillFeatureEnabled={isSkillFeatureEnabled}
                                                                skillLevel={levelsByNurseId[nurse.nurseId]}
                                                                skillConfig={skillConfig}
                                                                wardShiftTypes={ward?.wardShiftTypes}
                                                                isBusy={nurseSaveStatus === 'saving' || isDeletingNurse}
                                                                dragRef={(element) => {
                                                                    dragProvided.innerRef(element);
                                                                    rowRefByNurseId.current[nurse.nurseId] = element;
                                                                }}
                                                                draggableProps={dragProvided.draggableProps}
                                                                dragHandleProps={dragProvided.dragHandleProps}
                                                                onDeleteNurse={deleteNurse}
                                                                onDisconnectNurse={disconnectNurse}
                                                                onOpenWardCodeGuide={() => setWardCodeGuideOpen(true)}
                                                                onUpdateNurse={(nurseId, nextNurse) => {
                                                                    if (nurseId !== nurse.nurseId) {
                                                                        return updateNurse(nurseId, nextNurse);
                                                                    }

                                                                    return handleUpdateNurse(nurse, nextNurse);
                                                                }}
                                                                onUpdateNurseShift={updateNurseShift}
                                                                onSaveSkillLevel={(nextLevel) => {
                                                                    if (nextLevel === null) {
                                                                        setUnselectedSkillNurseIds((prev) =>
                                                                            new Set(prev).add(nurse.nurseId),
                                                                        );

                                                                        return;
                                                                    }

                                                                    setUnselectedSkillNurseIds((prev) => {
                                                                        const next = new Set(prev);

                                                                        next.delete(nurse.nurseId);

                                                                        return next;
                                                                    });

                                                                    if (!wardId) return;

                                                                    const normalized = Math.max(
                                                                        1,
                                                                        Math.min(skillConfig.levelCount, nextLevel),
                                                                    );
                                                                    const nextConfig = {...skillConfig, autoAssign: false};
                                                                    const nextSettings = createWardSkillSettings(
                                                                        allNurses,
                                                                        nextConfig,
                                                                        skillSettings,
                                                                    );

                                                                    nextSettings.frozenLevelsByNurseId[nurse.nurseId] = normalized;
                                                                    saveWardSkillSettings(wardId, nextSettings);
                                                                    setSkillSettings(nextSettings);
                                                                }}
                                                                onSelect={() => {
                                                                    if (
                                                                        shouldBlockForUnsavedChanges(() => {
                                                                            selectNurse(nurse.nurseId);
                                                                            sendEvent(events.memberPage.focusNurse);
                                                                        })
                                                                    )
                                                                        return;
                                                                    selectNurse(nurse.nurseId);
                                                                    sendEvent(events.memberPage.focusNurse);
                                                                }}
                                                            />
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            ) : (
                                <div className="mt-2 flex min-h-[280px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#C8CFDB] bg-white px-6 py-12 text-center">
                                    <p className="font-apple text-[20px] font-semibold text-sub-1">{t('page.member.emptyTeamTitle')}</p>
                                    <p className="mt-2 font-apple text-[16px] text-gray-3">{t('page.member.emptyTeamDescription')}</p>
                                    <button
                                        id="member_add_nurse_button"
                                        type="button"
                                        disabled={!activeShiftTeam || isAddingNurse}
                                        className="group mt-6 flex items-center gap-2 font-apple text-[16px] font-medium text-gray-3 transition-colors hover:text-[#4E586C] focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-40"
                                        onClick={() => void handleAddNurse()}
                                    >
                                        <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[#657084] transition-colors group-hover:bg-[#4E586C]">
                                            <Plus className="h-[11px] w-[11px] text-white" />
                                        </span>
                                        {isAddingNurse ? t('page.member.addingNurse') : t('page.member.addNurse')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <button
                            type="button"
                            disabled={!activeShiftTeam}
                            className="group flex items-center gap-2 font-apple text-[16px] font-medium text-[#E24B4B] transition-colors hover:text-[#C93838] focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={handleDeleteActiveTeam}
                        >
                            <Trash2 className="h-[16px] w-[16px]" strokeWidth={2.2} />
                            {t('page.member.deleteTeam')}
                        </button>
                        {!isActiveTeamEmpty ? (
                            <button
                                id="member_add_nurse_button"
                                type="button"
                                disabled={!activeShiftTeam || isAddingNurse}
                                className="group flex items-center gap-2 font-apple text-[16px] font-medium text-gray-3 transition-colors hover:text-[#4E586C] focus-visible:outline-2 focus-visible:outline-main-1 disabled:opacity-40"
                                onClick={() => void handleAddNurse()}
                            >
                                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[#657084] transition-colors group-hover:bg-[#4E586C]">
                                    <Plus className="h-[11px] w-[11px] text-white" />
                                </span>
                                {isAddingNurse ? t('page.member.addingNurse') : t('page.member.addNurse')}
                            </button>
                        ) : null}
                    </div>
                </section>

                <aside
                    id="nurse_edit_drawer"
                    className={cn(
                        'sticky top-11 h-[calc(100vh-5.75rem)] shrink-0 overflow-hidden rounded-[16px] border bg-white transition-[width,opacity,transform,border-color] duration-250 ease-out will-change-[width,opacity,transform] min-[1440px]:top-[52px] min-[1440px]:h-[calc(100vh-6.75rem)]',
                        selectedNurse
                            ? 'pointer-events-auto w-[360px] translate-x-0 border-gray-7/80 opacity-100 min-[1440px]:w-[400px]'
                            : 'pointer-events-none w-0 translate-x-3 border-transparent opacity-0',
                    )}
                    aria-hidden={!selectedNurse}
                >
                    <div className="h-full w-[360px] min-[1440px]:w-[400px]">
                        {selectedNurse ? (
                            <NurseDetailPanel
                                onClose={handleDismissDetailPanel}
                                onOpenWardCodeGuide={() => setWardCodeGuideOpen(true)}
                                onRegisterDraftActions={handleRegisterNurseDraftActions}
                                isSkillFeatureEnabled={isSkillFeatureEnabled}
                                isSkillUnselected={unselectedSkillNurseIds.has(selectedNurse.nurseId)}
                                onSaveSkillLevel={(nextLevel) => {
                                    if (!isSkillFeatureEnabled) return;

                                    if (nextLevel === null) {
                                        setUnselectedSkillNurseIds((prev) => new Set(prev).add(selectedNurse.nurseId));

                                        return;
                                    }

                                    setUnselectedSkillNurseIds((prev) => {
                                        const next = new Set(prev);

                                        next.delete(selectedNurse.nurseId);

                                        return next;
                                    });

                                    if (!wardId) return;

                                    const normalized = Math.max(1, Math.min(skillConfig.levelCount, nextLevel));
                                    const nextConfig = {...skillConfig, autoAssign: false};
                                    const nextSettings = createWardSkillSettings(allNurses, nextConfig, skillSettings);

                                    nextSettings.frozenLevelsByNurseId[selectedNurse.nurseId] = normalized;
                                    saveWardSkillSettings(wardId, nextSettings);
                                    setSkillSettings(nextSettings);
                                }}
                                skillConfig={skillConfig}
                                skillLevel={levelsByNurseId[selectedNurse.nurseId]}
                                shiftTeams={shiftTeams}
                                onMoveShiftTeam={handleMoveSelectedNurseToTeam}
                                wardShiftTypes={ward?.wardShiftTypes}
                            />
                        ) : null}
                    </div>
                </aside>
            </div>

            <MemberSkillLevelModal
                open={skillModalOpen}
                config={skillConfig}
                onClose={() => setSkillModalOpen(false)}
                onSave={handleSaveSkillSettings}
                onDisable={handleDisableSkillFeature}
            />
        </div>
    );
}

function MemberNurseRow({
    rowId,
    nurse,
    isWorker,
    isSelected,
    isSkillUnselected,
    isSkillFeatureEnabled,
    skillLevel,
    skillConfig,
    wardShiftTypes,
    isBusy,
    dragRef,
    draggableProps,
    dragHandleProps,
    onUpdateNurse,
    onUpdateNurseShift,
    onDeleteNurse,
    onDisconnectNurse,
    onOpenWardCodeGuide,
    onSaveSkillLevel,
    onSelect,
}: {
    rowId?: string;
    nurse: TNurse;
    isWorker: boolean;
    isSelected: boolean;
    isSkillUnselected: boolean;
    isSkillFeatureEnabled: boolean;
    skillLevel: number | null | undefined;
    skillConfig: TWardSkillSettings['config'];
    wardShiftTypes: TWardShiftType[] | undefined;
    isBusy: boolean;
    dragRef: (element: HTMLDivElement | null) => void;
    draggableProps: DraggableProvidedDraggableProps;
    dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
    onUpdateNurse: (nurseId: number, nurse: TNurse) => Promise<boolean>;
    onUpdateNurseShift: (
        nurseId: number,
        nurseShiftTypeId: number,
        change: {isPossible?: boolean; isPreferred?: boolean; isPrefer?: boolean},
        shiftTypeMeta?: TUpdateNurseShiftMeta,
    ) => Promise<boolean>;
    onDeleteNurse: (shiftTeamId: number, nurseId: number) => Promise<void>;
    onDisconnectNurse: (nurseId: number) => Promise<boolean>;
    onOpenWardCodeGuide: () => void;
    onSaveSkillLevel: (nextLevel: number | null) => void;
    onSelect: () => void;
}) {
    const [nameDraft, setNameDraft] = useState(nurse.name);
    const [skillMenuOpen, setSkillMenuOpen] = useState(false);
    const [disconnectConfirmModalOpen, setDisconnectConfirmModalOpen] = useState(false);
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const skillMenuRef = useRef<HTMLDivElement | null>(null);
    const modalRoot = document.getElementById('modal-root') ?? document.body;

    useEffect(() => {
        setNameDraft(nurse.name);
    }, [nurse.name, nurse.nurseId]);

    const shiftTypeColorById = useMemo(() => {
        return new Map((wardShiftTypes ?? []).map((shiftType) => [shiftType.wardShiftTypeId, shiftType.color]));
    }, [wardShiftTypes]);
    const shiftTypeOptions = useMemo(() => {
        return resolveNurseShiftTypeOptions(nurse.nurseShiftTypes, wardShiftTypes);
    }, [nurse.nurseShiftTypes, wardShiftTypes]);
    const isPreceptor = Boolean(nurse.isWardManager);
    const isPreceptee = hasPrecepteeMemo(nurse.memo);
    const fadedClass = isWorker ? '' : 'opacity-55';

    useEffect(() => {
        if (!skillMenuOpen) {
            return;
        }

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (skillMenuRef.current?.contains(event.target as Node)) {
                return;
            }

            setSkillMenuOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
        };
    }, [skillMenuOpen]);

    return (
        <>
            <div
                id={rowId}
                ref={dragRef}
                {...draggableProps}
                className={cn(
                    'relative grid w-full items-center rounded-[12px] border py-[6px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                    MEMBER_GRID_GAP_CLASS,
                    MEMBER_GRID_PADDING_X,
                    isSkillFeatureEnabled ? MEMBER_GRID_COLS_WITH_SKILL : MEMBER_GRID_COLS_WITHOUT_SKILL,
                    'cursor-pointer',
                    skillMenuOpen ? 'z-40' : 'z-0',
                    isSelected
                        ? 'border-main-2 bg-white ring-1 ring-main-2/25'
                        : 'border-gray-7 bg-white hover:border-main-3/40 hover:bg-main-light/40',
                )}
                onClick={onSelect}
            >
                <button
                    type="button"
                    {...dragHandleProps}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelect();
                    }}
                    className={cn('flex h-5 w-5 items-center justify-center text-gray-4 transition-colors hover:text-gray-3', fadedClass)}
                    aria-label="드래그해서 순서 변경"
                >
                    <SixDotsIcon className="h-3.5 w-3.5" />
                </button>
                <Input
                    value={nameDraft}
                    disabled={isBusy}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelect();
                    }}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={async () => {
                        const nextName = nameDraft.trim();

                        if (!nextName || nextName === nurse.name) {
                            setNameDraft(nurse.name);

                            return;
                        }

                        const saved = await onUpdateNurse(nurse.nurseId, {...nurse, name: nextName});

                        if (!saved) {
                            setNameDraft(nurse.name);
                        }
                    }}
                    variant="flush"
                    fieldSize="default"
                    className={cn('min-w-0 text-center text-[16px] font-medium text-sub-1', fadedClass)}
                    placeholder="-"
                    maxLength={30}
                />
                {isSkillFeatureEnabled ? (
                    <div className="flex justify-center">
                        <div ref={skillMenuRef} className="relative">
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSelect();
                                    setSkillMenuOpen((prev) => !prev);
                                }}
                                className="inline-flex items-center gap-1"
                            >
                                <SkillBadge
                                    level={isSkillUnselected ? null : skillLevel}
                                    config={skillConfig}
                                    label={isSkillUnselected ? '선택안함' : undefined}
                                    backgroundColor={isSkillUnselected ? '#E5E7EB' : undefined}
                                    textColor={isSkillUnselected ? '#6B7280' : undefined}
                                />
                                <ChevronDown className={cn('h-3 w-3 text-gray-4 transition-transform', skillMenuOpen && 'rotate-180')} />
                            </button>
                            {skillMenuOpen ? (
                                <div className="absolute top-full left-1/2 z-30 mt-2 min-w-[120px] -translate-x-1/2 rounded-[10px] border border-gray-6 bg-white p-2 opacity-100 shadow-[0px_12px_28px_rgba(61,70,88,0.18)]">
                                    <div className="space-y-1.5">
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-center rounded-[6px] px-2 py-1 transition-colors hover:bg-gray-7"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onSaveSkillLevel(null);
                                                setSkillMenuOpen(false);
                                            }}
                                        >
                                            <SkillBadge
                                                level={null}
                                                config={skillConfig}
                                                label="선택안함"
                                                backgroundColor="#E5E7EB"
                                                textColor="#6B7280"
                                            />
                                        </button>
                                        {Array.from({length: skillConfig.levelCount}, (_, index) => skillConfig.levelCount - index).map(
                                            (level) => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    className="flex w-full items-center justify-center rounded-[6px] px-2 py-1 transition-colors hover:bg-gray-7"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onSaveSkillLevel(level);
                                                        setSkillMenuOpen(false);
                                                    }}
                                                >
                                                    <SkillBadge level={level} config={skillConfig} />
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                <div className={cn('flex min-w-0 flex-nowrap items-center justify-center gap-1 whitespace-nowrap', fadedClass)}>
                    {shiftTypeOptions.length > 0 ? (
                        shiftTypeOptions.map((shiftType) => {
                            const selected = shiftType.isPossible;
                            const baseColor =
                                (typeof shiftType.wardShiftTypeId === 'number'
                                    ? shiftTypeColorById.get(shiftType.wardShiftTypeId)
                                    : undefined) ?? '#BFC7D4';
                            const badgeBackgroundColor = selected ? baseColor : tintHexColor(baseColor, 0.45);
                            return (
                                <button
                                    key={shiftType.apiShiftTypeId}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={async (event) => {
                                        event.stopPropagation();
                                        onSelect();

                                        if (isBusy) return;

                                        await onUpdateNurseShift(
                                            nurse.nurseId,
                                            shiftType.apiShiftTypeId,
                                            {isPossible: !selected},
                                            {
                                                wardShiftTypeId: shiftType.wardShiftTypeId,
                                                name: shiftType.name,
                                                shortName: shiftType.shortName ?? '',
                                            },
                                        );
                                    }}
                                    className={cn(
                                        'group relative cursor-pointer rounded-[7px] p-[1px] transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-main-1/35',
                                        selected ? 'opacity-100' : 'opacity-55 hover:opacity-100',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex h-[19px] min-w-[19px] items-center justify-center rounded-[4px] transition-[max-width,padding,gap] duration-150',
                                            selected
                                                ? 'max-w-[53px] gap-0.5 px-1'
                                                : 'max-w-[19px] gap-0 overflow-hidden px-[2px] group-hover:max-w-[53px] group-hover:gap-0.5 group-hover:px-1',
                                        )}
                                        style={{backgroundColor: badgeBackgroundColor}}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-[9px] items-center justify-center overflow-hidden transition-[width,opacity] duration-150',
                                                selected
                                                    ? 'w-[9px] opacity-100'
                                                    : 'w-0 opacity-0 group-hover:w-[9px] group-hover:opacity-75',
                                            )}
                                        >
                                            <Check
                                                className={cn(
                                                    'h-[9px] w-[9px] shrink-0 text-white transition-all duration-150',
                                                    selected
                                                        ? 'scale-100 opacity-100'
                                                        : 'scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-75',
                                                )}
                                                strokeWidth={3}
                                            />
                                        </span>
                                        <span className="font-poppins text-[12px] leading-none font-medium whitespace-nowrap text-white transition-transform duration-150">
                                            {shiftType.shortName || '-'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })
                    ) : (
                        <span className="font-apple text-[16px] text-gray-4">-</span>
                    )}
                </div>
                <div className={cn('flex items-center justify-center', fadedClass)}>
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked={isPreceptor}
                        aria-label={`${nurse.name || '간호사'} 프리셉터`}
                        className={cn(
                            'group flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                            isPreceptor
                                ? 'border-main-1 bg-main-1 text-white'
                                : 'border-sub-4 bg-white text-transparent hover:border-2 hover:border-main-1 hover:bg-main-light',
                        )}
                        onClick={async (event) => {
                            event.stopPropagation();
                            onSelect();
                            const nextIsPreceptor = !isPreceptor;

                            await onUpdateNurse(nurse.nurseId, {
                                ...nurse,
                                isWardManager: nextIsPreceptor,
                                memo: nextIsPreceptor ? setPrecepteeMemo(nurse.memo, false) : nurse.memo,
                            });
                        }}
                    >
                        <Check className="h-3.5 w-3.5 stroke-[3] transition-[stroke-width] duration-150 group-hover:stroke-[3.6]" />
                    </button>
                </div>
                <div className={cn('flex items-center justify-center', fadedClass)}>
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked={isPreceptee}
                        aria-label={`${nurse.name || '간호사'} 프리셉티`}
                        className={cn(
                            'group flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                            isPreceptee
                                ? 'border-main-1 bg-main-1 text-white'
                                : 'border-sub-4 bg-white text-transparent hover:border-2 hover:border-main-1 hover:bg-main-light',
                        )}
                        onClick={async (event) => {
                            event.stopPropagation();
                            onSelect();
                            const nextIsPreceptee = !isPreceptee;

                            await onUpdateNurse(nurse.nurseId, {
                                ...nurse,
                                isWardManager: nextIsPreceptee ? false : nurse.isWardManager,
                                memo: setPrecepteeMemo(nurse.memo, nextIsPreceptee),
                            });
                        }}
                    >
                        <Check className="h-3.5 w-3.5 stroke-[3] transition-[stroke-width] duration-150 group-hover:stroke-[3.6]" />
                    </button>
                </div>
                <div className={cn('flex justify-center', fadedClass)}>
                    <Switch
                        checked={isWorker}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect();
                        }}
                        onCheckedChange={async (checked) => {
                            if (isBusy) {
                                return;
                            }

                            onSelect();
                            await onUpdateNurse(nurse.nurseId, {...nurse, isWorker: checked});
                        }}
                        className="relative h-5 w-9 justify-start border-0 bg-sub-4 p-0 shadow-none data-[state=checked]:bg-main-1 data-[state=unchecked]:bg-sub-4"
                        thumbClassName="absolute top-0.5 left-0.5 h-4 w-4 translate-x-0 bg-white shadow-sm data-[state=checked]:translate-x-4"
                        aria-label={`${nurse.name} worker`}
                    />
                </div>
                <div className={cn('flex justify-center', fadedClass)}>
                    <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] transition-colors hover:bg-gray-7"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect();

                            if (nurse.isConnected) {
                                setDisconnectConfirmModalOpen(true);

                                return;
                            }

                            onOpenWardCodeGuide();
                        }}
                        aria-label={`${nurse.name} 연동 상태 안내`}
                    >
                        {nurse.isConnected ? <LinkedIcon className="h-5 w-5" /> : <UnlinkedIcon className="h-5 w-5" />}
                    </button>
                </div>
                <div className={cn('flex w-full justify-end pr-1', fadedClass)}>
                    <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1"
                        onClick={(event) => {
                            event.stopPropagation();
                            setDeleteConfirmModalOpen(true);
                        }}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            {deleteConfirmModalOpen
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/45 px-4"
                          onClick={() => setDeleteConfirmModalOpen(false)}
                      >
                          <div
                              role="dialog"
                              aria-modal="true"
                              className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5"
                              onClick={(event) => event.stopPropagation()}
                          >
                              <p className="font-apple text-[20px] font-semibold text-sub-1">간호사를 삭제할까요?</p>
                              <p className="mt-2 font-apple text-[15px] text-gray-3">
                                  <span className="font-semibold text-sub-1">{nurse.name || '선택한 간호사'}</span>
                                  {' 삭제 후에는 되돌릴 수 없어요.'}
                              </p>
                              <div className="mt-6 flex items-center gap-3">
                                  <button
                                      type="button"
                                      className="h-11 flex-1 rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                      onClick={() => setDeleteConfirmModalOpen(false)}
                                  >
                                      닫기
                                  </button>
                                  <button
                                      type="button"
                                      className="h-11 flex-1 rounded-[10px] bg-[#D14343] px-6 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                      onClick={async () => {
                                          setDeleteConfirmModalOpen(false);

                                          if (!nurse.shiftTeamId) return;

                                          await onDeleteNurse(nurse.shiftTeamId, nurse.nurseId);
                                      }}
                                  >
                                      삭제하기
                                  </button>
                              </div>
                          </div>
                      </div>,
                      modalRoot,
                  )
                : null}
            {disconnectConfirmModalOpen
                ? createPortal(
                      <div
                          className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/45 px-4"
                          onClick={() => setDisconnectConfirmModalOpen(false)}
                      >
                          <div
                              role="dialog"
                              aria-modal="true"
                              className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5"
                              onClick={(event) => event.stopPropagation()}
                          >
                              <p className="font-apple text-[20px] font-semibold text-sub-1">연동을 끊을까요?</p>
                              <p className="mt-2 font-apple text-[15px] text-gray-3">
                                  <span className="font-semibold text-sub-1">{nurse.name || '선택한 간호사'}</span>
                                  {' 의 앱 연동을 끊어요.'}
                              </p>
                              <div className="mt-6 flex items-center gap-3">
                                  <button
                                      type="button"
                                      className="h-11 flex-1 rounded-[10px] bg-[#F3F4F6] px-6 font-apple text-[16px] font-semibold text-gray-3 transition-colors hover:bg-[#EAECEF]"
                                      onClick={() => setDisconnectConfirmModalOpen(false)}
                                  >
                                      닫기
                                  </button>
                                  <button
                                      type="button"
                                      className="h-11 flex-1 rounded-[10px] bg-[#D14343] px-6 font-apple text-[16px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                      onClick={async () => {
                                          const ok = await onDisconnectNurse(nurse.nurseId);

                                          if (ok) {
                                              setDisconnectConfirmModalOpen(false);
                                          }
                                      }}
                                  >
                                      연동 끊기
                                  </button>
                              </div>
                          </div>
                      </div>,
                      modalRoot,
                  )
                : null}
        </>
    );
}

export default MemberPage;
