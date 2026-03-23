import {cn} from '@dutying/utils/style';
import {ChevronDown, Plus} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {events, sendEvent} from '@/analytics';
import {type TNurse} from '@/entities';
import {
    createWardSkillSettings,
    getWardSkillSettings,
    resolveWardSkillLevels,
    saveWardSkillSettings,
    type TWardSkillSettings,
} from '@/features/ward/skill-level';
import SkillBadge from '@/features/ward/SkillBadge';
import useEditShiftTeam from '@/features/ward/useEditShiftTeam';
import {LinkedIcon, MoreIcon, PlusIcon, UnlinkedIcon} from '@/shared/assets/svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';
import MemberSkillLevelModal from './ui/MemberSkillLevelModal';
import NurseDetailPanel from './ui/NurseDetailPanel';

function MemberPage() {
    const {t} = useTypedTranslation();
    const {
        state: {ward, shiftTeams, selectedNurse, isAddingNurse},
        actions: {selectNurse, createShiftTeam, addNurse, deleteShiftTeam},
    } = useEditShiftTeam();
    const [activeShiftTeamId, setActiveShiftTeamId] = useState<number | null>(null);
    const [sortBySkill, setSortBySkill] = useState(true);
    const [skillSettings, setSkillSettings] = useState<TWardSkillSettings | null>(null);
    const [skillModalOpen, setSkillModalOpen] = useState(false);
    const [teamMenuOpen, setTeamMenuOpen] = useState(false);
    const allNurses = useMemo(() => shiftTeams?.flatMap((shiftTeam) => shiftTeam.nurses) ?? [], [shiftTeams]);
    const wardId = ward?.wardId ?? null;

    useEffect(() => {
        setSkillSettings(getWardSkillSettings(wardId));
    }, [wardId]);

    const {config: skillConfig, levelsByNurseId} = useMemo(
        () => resolveWardSkillLevels(allNurses, skillSettings),
        [allNurses, skillSettings],
    );
    const activeShiftTeam = useMemo(
        () => shiftTeams?.find((shiftTeam) => shiftTeam.shiftTeamId === activeShiftTeamId) ?? shiftTeams?.[0],
        [activeShiftTeamId, shiftTeams],
    );
    const visibleNurses = useMemo(() => {
        const nurses = [...(activeShiftTeam?.nurses ?? [])];

        if (!sortBySkill) {
            return nurses.sort((left, right) => left.priority - right.priority);
        }

        return nurses.sort((left, right) => {
            const levelGap = (levelsByNurseId[right.nurseId] ?? 0) - (levelsByNurseId[left.nurseId] ?? 0);

            if (levelGap !== 0) {
                return levelGap;
            }

            return left.priority - right.priority;
        });
    }, [activeShiftTeam?.nurses, levelsByNurseId, sortBySkill]);

    useEffect(() => {
        if (!shiftTeams?.length) {
            setActiveShiftTeamId(null);

            return;
        }

        if (selectedNurse) {
            const selectedShiftTeam = shiftTeams.find((shiftTeam) =>
                shiftTeam.nurses.some((nurse) => nurse.nurseId === selectedNurse.nurseId),
            );

            if (selectedShiftTeam && selectedShiftTeam.shiftTeamId !== activeShiftTeamId) {
                setActiveShiftTeamId(selectedShiftTeam.shiftTeamId);
            }

            return;
        }

        if (!activeShiftTeamId || !shiftTeams.some((shiftTeam) => shiftTeam.shiftTeamId === activeShiftTeamId)) {
            setActiveShiftTeamId(shiftTeams[0].shiftTeamId);
        }
    }, [activeShiftTeamId, selectedNurse, shiftTeams]);

    useEffect(() => {
        if (!activeShiftTeam || visibleNurses.length === 0) {
            return;
        }

        if (!selectedNurse || selectedNurse.shiftTeamId !== activeShiftTeam.shiftTeamId) {
            selectNurse(visibleNurses[0].nurseId);
        }
    }, [activeShiftTeam, selectNurse, selectedNurse, visibleNurses]);

    const handleSelectTeam = (shiftTeamId: number) => {
        if (!shiftTeams) return;

        const nextTeam = shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === shiftTeamId);
        const nextNurseId = nextTeam?.nurses[0]?.nurseId ?? null;
        const canMove = selectNurse(nextNurseId);

        if (!canMove) return;

        setActiveShiftTeamId(shiftTeamId);
        setTeamMenuOpen(false);
    };
    const handleSaveSkillSettings = (nextConfig: TWardSkillSettings['config']) => {
        if (!wardId) return;

        const nextSettings = createWardSkillSettings(allNurses, nextConfig, skillSettings);

        saveWardSkillSettings(wardId, nextSettings);
        setSkillSettings(nextSettings);
    };
    const handleDeleteActiveTeam = () => {
        if (!activeShiftTeam) return;

        const shouldDelete = window.confirm(t('page.member.confirmDeleteTeam', {teamName: activeShiftTeam.name}));

        if (!shouldDelete) return;

        deleteShiftTeam(activeShiftTeam.shiftTeamId);
        setTeamMenuOpen(false);
    };

    return (
        <>
            <div className="flex h-screen min-w-0 gap-5 overflow-x-auto px-10 pt-[52px] pb-14">
                <section className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-6">
                        <div>
                            <h1 className="font-apple text-[32px] font-semibold text-text-1">{t('page.member.title')}</h1>
                            <p className="mt-2 font-apple text-[16px] text-gray-3">{t('page.member.description')}</p>
                        </div>
                        <button
                            type="button"
                            className="flex h-[42px] items-center gap-2 rounded-[5px] bg-gray-6 px-4 font-apple text-[20px] font-medium text-sub-2 transition-colors hover:bg-gray-5 focus-visible:outline-2 focus-visible:outline-main-1"
                            onClick={() => setSkillModalOpen(true)}
                        >
                            {t('page.member.skillSettings')}
                            <span className="text-lg">→</span>
                        </button>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-4">
                        <div className="flex min-h-[56px] items-center rounded-[15px] bg-main-light px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                                {shiftTeams?.map((shiftTeam) => {
                                    const isActive = shiftTeam.shiftTeamId === activeShiftTeam?.shiftTeamId;

                                    return (
                                        <button
                                            key={shiftTeam.shiftTeamId}
                                            type="button"
                                            className={cn(
                                                'flex items-center gap-2 rounded-[10px] px-4 py-1.5 font-apple text-[20px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                                isActive ? 'bg-main-1 text-white' : 'text-gray-4 hover:bg-white/70',
                                            )}
                                            onClick={() => handleSelectTeam(shiftTeam.shiftTeamId)}
                                        >
                                            <span>{shiftTeam.name}</span>
                                            {isActive ? (
                                                <span className="font-poppins text-[16px] font-medium text-white">
                                                    {shiftTeam.nurses.length}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="relative flex items-center gap-4">
                            <button
                                type="button"
                                className="flex items-center gap-1 font-apple text-[16px] font-medium text-gray-3 transition-colors hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                                onClick={async () => {
                                    await createShiftTeam();
                                    sendEvent(events.memberPage.createShiftTeam);
                                }}
                            >
                                <Plus aria-hidden="true" className="size-4" />
                                {t('page.member.addTeam')}
                            </button>
                            <button
                                type="button"
                                disabled={!activeShiftTeam || isAddingNurse}
                                className="flex items-center gap-1 font-apple text-[16px] font-medium text-gray-3 transition-colors hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={async () => {
                                    if (!activeShiftTeam) return;

                                    await addNurse(activeShiftTeam.shiftTeamId);
                                }}
                            >
                                <Plus aria-hidden="true" className="size-4" />
                                {isAddingNurse ? t('page.member.addingNurse') : t('page.member.addNurse')}
                            </button>
                            <button
                                type="button"
                                className="grid size-8 place-items-center rounded-full text-gray-4 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1"
                                onClick={() => setTeamMenuOpen((prev) => !prev)}
                                aria-label={t('page.member.teamMenu')}
                            >
                                <MoreIcon aria-hidden="true" className="size-6" />
                            </button>
                            {teamMenuOpen && activeShiftTeam ? (
                                <div className="absolute top-10 right-0 z-20 min-w-[160px] rounded-[10px] border border-gray-6 bg-white p-2 shadow-[0px_10px_28px_rgba(95,100,135,0.16)]">
                                    <button
                                        type="button"
                                        className="flex w-full items-center rounded-[8px] px-3 py-2 text-left font-apple text-[15px] text-red transition-colors hover:bg-red/5 focus-visible:outline-2 focus-visible:outline-main-1"
                                        onClick={handleDeleteActiveTeam}
                                    >
                                        {t('page.member.deleteTeam')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                        <button
                            type="button"
                            className={cn(
                                'flex items-center gap-1 rounded-[5px] px-2 py-1 font-apple text-[16px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                                sortBySkill ? 'text-gray-3 hover:bg-white' : 'text-gray-4 hover:bg-gray-7 hover:text-sub-1',
                            )}
                            onClick={() => setSortBySkill((prev) => !prev)}
                        >
                            {t('page.member.sortBySkill')}
                            <ChevronDown aria-hidden="true" className="size-5" />
                        </button>
                        <div className="flex items-center gap-1 font-apple text-[16px] text-main-1">
                            <span>{t('page.member.canMakeDuty')}</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-main-1 focus-visible:outline-2 focus-visible:outline-main-1"
                                            aria-label={t('page.member.canMakeDutyTooltip')}
                                        >
                                            <span className="text-base">ⓘ</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-gray-6 text-[14px] leading-5 text-sub-1">
                                        {t('page.member.canMakeDutyTooltip')}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    <div className="mt-4 rounded-[15px]">
                        <div className="grid grid-cols-[minmax(120px,1.8fr)_96px_minmax(150px,1.4fr)_minmax(120px,1.6fr)_100px_80px_120px] items-center px-[22px] py-3 font-apple text-[16px] text-gray-3">
                            <span>{t('page.member.table.name')}</span>
                            <span>{t('page.member.table.level')}</span>
                            <span>{t('page.member.table.shiftTypes')}</span>
                            <span>{t('page.member.table.memo')}</span>
                            <span className="text-center">{t('page.member.table.isWorker')}</span>
                            <span className="text-center">{t('page.member.table.connection')}</span>
                            <span className="text-center">{t('page.member.table.isDutyManager')}</span>
                        </div>

                        <div className="space-y-2">
                            {visibleNurses.length === 0 ? (
                                <div className="rounded-[15px] border border-dashed border-gray-6 bg-white px-8 py-12 text-center">
                                    <p className="font-apple text-[24px] font-semibold text-sub-1">{t('page.member.emptyTeamTitle')}</p>
                                    <p className="mt-3 font-apple text-[16px] leading-7 text-gray-3">
                                        {t('page.member.emptyTeamDescription')}
                                    </p>
                                    <button
                                        type="button"
                                        className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-main-1 px-4 py-2 font-apple text-[16px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-main-1"
                                        onClick={async () => {
                                            if (!activeShiftTeam) return;

                                            await addNurse(activeShiftTeam.shiftTeamId);
                                        }}
                                    >
                                        <PlusIcon aria-hidden="true" className="size-5" />
                                        {t('page.member.addFirstNurse')}
                                    </button>
                                </div>
                            ) : (
                                visibleNurses.map((nurse) => (
                                    <MemberNurseRow
                                        key={nurse.nurseId}
                                        nurse={nurse}
                                        isSelected={selectedNurse?.nurseId === nurse.nurseId}
                                        skillLevel={levelsByNurseId[nurse.nurseId]}
                                        skillConfig={skillConfig}
                                        onSelect={() => {
                                            selectNurse(nurse.nurseId);
                                            sendEvent(events.memberPage.focusNurse);
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </section>

                <NurseDetailPanel
                    skillConfig={skillConfig}
                    skillLevel={selectedNurse ? levelsByNurseId[selectedNurse.nurseId] : null}
                    wardShiftTypes={ward?.wardShiftTypes}
                />
            </div>

            <MemberSkillLevelModal
                open={skillModalOpen}
                config={skillConfig}
                onClose={() => setSkillModalOpen(false)}
                onSave={handleSaveSkillSettings}
            />
        </>
    );
}

function MemberNurseRow({
    nurse,
    isSelected,
    skillLevel,
    skillConfig,
    onSelect,
}: {
    nurse: TNurse;
    isSelected: boolean;
    skillLevel: number | null | undefined;
    skillConfig: TWardSkillSettings['config'];
    onSelect: () => void;
}) {
    const shiftCodes = nurse.nurseShiftTypes
        .filter((shiftType) => shiftType.isPossible)
        .map((shiftType) => shiftType.shortName || shiftType.name);

    return (
        <button
            type="button"
            className={cn(
                'grid w-full grid-cols-[minmax(120px,1.8fr)_96px_minmax(150px,1.4fr)_minmax(120px,1.6fr)_100px_80px_120px] items-center rounded-[10px] border px-[22px] py-[14px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-main-1',
                isSelected ? 'border-transparent bg-main-light' : 'border-gray-7 bg-white hover:border-main-3/40 hover:bg-main-light/40',
            )}
            onClick={onSelect}
        >
            <span className="min-w-0 truncate font-apple text-[20px] font-medium text-sub-1">{nurse.name}</span>
            <SkillBadge level={skillLevel} config={skillConfig} />
            <div className="flex flex-wrap items-center gap-1">
                {shiftCodes.length > 0 ? (
                    shiftCodes.map((code) => (
                        <span
                            key={`${nurse.nurseId}-${code}`}
                            className={cn(
                                'inline-flex h-[23px] w-[21px] items-center justify-center rounded-[5px] font-poppins text-[14px] text-white',
                                code === 'D' && 'bg-[#4DC2AD]',
                                code === 'E' && 'bg-[#FF8BA5]',
                                code === 'N' && 'bg-[#3580FF]',
                                code === 'O' && 'bg-[#465B7A]',
                            )}
                        >
                            {code}
                        </span>
                    ))
                ) : (
                    <span className="font-apple text-[16px] text-gray-4">-</span>
                )}
            </div>
            <span className="truncate font-apple text-[20px] font-medium text-sub-1">{nurse.memo?.trim() || '-'}</span>
            <div className="flex justify-center">
                <span className={cn('relative inline-flex h-4 w-8 rounded-full', nurse.isWorker ? 'bg-main-1' : 'bg-gray-6')}>
                    <span
                        className={cn(
                            'absolute top-0.5 size-3 rounded-full bg-white transition-all',
                            nurse.isWorker ? 'left-[17px]' : 'left-0.5',
                        )}
                    />
                </span>
            </div>
            <div className="flex justify-center">
                {nurse.isConnected ? (
                    <LinkedIcon aria-hidden="true" className="size-6" />
                ) : (
                    <UnlinkedIcon aria-hidden="true" className="size-6" />
                )}
            </div>
            <div className="flex justify-center">
                <input
                    type="checkbox"
                    checked={nurse.isDutyManager}
                    readOnly
                    className="pointer-events-none size-4 rounded-[3px] accent-main-1"
                />
            </div>
        </button>
    );
}

export default MemberPage;
